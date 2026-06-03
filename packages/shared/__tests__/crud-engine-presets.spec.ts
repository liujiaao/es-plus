import { describe, it, expect } from 'vitest'
import { generateCrudConfig } from '../src/crud-engine.js'

/**
 * Regression coverage for the 6 docs-site "AI CRUD Generator" presets.
 *
 * Background: the docs site's `/#/ai-crud` page ships 6 curated prompts
 * (preset-examples.ts) that exercise different facets of @es-plus/vue3
 * (basic CRUD, multi-tab dialog, virtual scroll, multi-step form, cross-page
 * selection, cascading filter). The earlier rule-based parser used a regex
 * with a Chinese inner char class + positive lookahead — three of the six
 * prompts contain Chinese fullwidth parentheses `（）` or arrows `→` that
 * fall outside that class, which silently broke the lookahead and produced
 * either empty form / table sections or single-character "fields" like "支"
 * (lifted out of "表格支持跨页选择" — the parser captured the first Chinese
 * char of "支持" because 支 was in the inner class but the next char 持 was
 * in the stop class).
 *
 * These tests assert the high-level shape per preset: query field count,
 * table column count (minus the operate column), placeholder presence on
 * every form item, span sum per row, and that special features surface as
 * `featureHints` instead of silently disappearing. They do NOT pin exact
 * field names — that's covered by the existing crud-engine.spec.ts. The
 * goal is to prevent regression of the specific bugs that broke the docs
 * preview.
 */

// Mirrors PRESETS[i].prompt.zh in es-plus-docs/src/utils/preset-examples.ts
const PRESETS = {
  userMgmt:
    '用户管理页面，查询条件：姓名、手机号、状态（启用/禁用）。表格列：姓名、手机号、邮箱、状态、创建时间。支持新增、编辑、删除。',
  orderDialog:
    '订单列表，查询订单号、客户姓名、订单状态、下单日期范围。列表显示订单号、客户、金额、状态、下单时间。每行有"详情"按钮，点击打开弹窗，弹窗内三个 tab：订单信息、收货地址、商品列表。',
  productVirtual:
    '商品列表，10 万行数据，启用虚拟滚动。查询条件：商品名（模糊）、分类、价格区间。列：商品名、分类、价格、库存、上架状态。支持批量上下架。',
  articleMultiStep:
    '文章发布页面。多步表单：第一步基础信息（标题、分类、标签），第二步内容（富文本），第三步发布设置（定时发布时间、可见范围）。每步可以前后跳。',
  auditCrossPage:
    '审核工单列表。查询工单号、申请人、类型、状态。表格支持跨页选择，底部固定栏显示已选数量 + 批准/拒绝按钮。',
  cascadeRegion:
    '会员管理。查询条件包含级联筛选：省 → 市 → 区。表格显示会员姓名、手机、地址（省市区拼接）、注册时间。',
}

// Helpers ────────────────────────────────────────────────────────────────────

function spansPerRow(spans: number[]): number[] {
  // Walks the span list in document order and returns the sum of each row.
  // Element Plus grids close a row at 24. Any row sum != 24 means a visible
  // gap in the preview.
  const rows: number[] = []
  let cur = 0
  for (const s of spans) {
    cur += s
    if (cur >= 24) {
      rows.push(cur)
      cur = 0
    }
  }
  if (cur > 0) rows.push(cur)
  return rows
}

function tableColsExcludingOperate(cfg: ReturnType<typeof generateCrudConfig>): number {
  return cfg.columns.filter((c) => c.prop !== 'operate').length
}

// Shared invariants — every preset MUST pass these regardless of content ────

function expectUniversalInvariants(cfg: ReturnType<typeof generateCrudConfig>) {
  // Every form item must have a placeholder. The earlier engine left attrs as
  // { clearable: true } only, so el-input rendered with empty placeholder and
  // the preview looked unfinished.
  for (const item of cfg.formItems) {
    expect(item.attrs?.placeholder, `placeholder missing for ${item.prop}`).toBeTruthy()
  }

  // Every row in the form grid must total exactly 24. Without span
  // normalization the old engine emitted span:6 + span:8 mixed (datePicker
  // wider than Input) which produced 6+6+8 = 20-col rows with a visible gap.
  if (cfg.formItems.length > 0) {
    const rows = spansPerRow(cfg.formItems.map((f) => f.span))
    for (const sum of rows) {
      expect(sum, `row span sum ${sum} ≠ 24 (mis-aligned grid)`).toBe(24)
    }
  }

  // Query + Reset buttons always present
  expect(cfg.queryBtns.some((b) => b.key === 'query')).toBe(true)
  expect(cfg.queryBtns.some((b) => b.key === 'rest')).toBe(true)
}

// Per-preset assertions ──────────────────────────────────────────────────────

describe('preset 1: 用户管理 (basic CRUD)', () => {
  const cfg = generateCrudConfig(PRESETS.userMgmt)

  it('extracts all 3 query fields despite the "（启用/禁用）" modifier', () => {
    // Bug fixed: the `（）` previously broke the query regex → 0 query fields.
    expect(cfg.formItems.length).toBe(3)
    const props = cfg.formItems.map((f) => f.prop).sort()
    expect(props).toEqual(['name', 'phone', 'status'])
  })

  it('extracts all 5 table columns', () => {
    expect(tableColsExcludingOperate(cfg)).toBe(5)
  })

  it('infers Select + dataOptions on status field', () => {
    const status = cfg.formItems.find((f) => f.prop === 'status')
    expect(status?.formtype).toBe('Select')
    expect(status?.dataOptions?.length).toBeGreaterThan(0)
  })

  it('passes universal invariants', () => expectUniversalInvariants(cfg))
})

describe('preset 2: 订单管理 (multi-tab dialog)', () => {
  const cfg = generateCrudConfig(PRESETS.orderDialog)

  it('parses both "查询" section and the "列表显示" section as table fields', () => {
    // Bug fixed: previously "列表" wasn't a recognized head marker, so the
    // 5 table-only fields (订单号/客户/金额/状态/下单时间) were dropped.
    expect(cfg.formItems.length).toBe(4)
    expect(tableColsExcludingOperate(cfg)).toBeGreaterThanOrEqual(5)
  })

  it('surfaces "multi-tab detail dialog" as a featureHint', () => {
    // Without this the preview would silently render a plain table, hiding
    // a feature the prompt explicitly asked for.
    expect(cfg.featureHints?.join(' ')).toMatch(/多\s*Tab|tabs|tab/i)
  })

  it('passes universal invariants', () => expectUniversalInvariants(cfg))
})

describe('preset 3: 商品管理 (virtual scrolling)', () => {
  const cfg = generateCrudConfig(PRESETS.productVirtual)

  it('extracts query fields despite "（模糊）" modifier', () => {
    expect(cfg.formItems.length).toBe(3)
  })

  it('extracts all 5 table columns', () => {
    expect(tableColsExcludingOperate(cfg)).toBe(5)
  })

  it('enables tableOptions.virtual when the prompt mentions "虚拟滚动" or "10 万行"', () => {
    expect(cfg.tableOptions.virtual).toBe(true)
  })

  it('surfaces virtual-scrolling note in featureHints', () => {
    expect(cfg.featureHints?.join(' ')).toMatch(/虚拟|virtual/i)
  })

  it('passes universal invariants', () => expectUniversalInvariants(cfg))
})

describe('preset 4: 文章发布 (multi-step form)', () => {
  const cfg = generateCrudConfig(PRESETS.articleMultiStep)

  it('does not silently emit garbled fields like "→" or single chars', () => {
    // Bug fixed: with no 查询/表格 markers AND nested 第一步/第二步... the
    // old fallback split on arrows/punctuation and emitted single-char fields.
    for (const f of cfg.formItems) {
      expect(f.prop.length, `garbled prop "${f.prop}"`).toBeGreaterThanOrEqual(2)
      expect(['→', '↔', '+', '-']).not.toContain(f.prop)
    }
  })

  it('surfaces multi-step form note', () => {
    expect(cfg.featureHints?.join(' ')).toMatch(/多步|分步|multi.?step/i)
  })

  it('passes universal invariants', () => expectUniversalInvariants(cfg))
})

describe('preset 5: 跨页批量审核 (cross-page selection)', () => {
  const cfg = generateCrudConfig(PRESETS.auditCrossPage)

  it('does NOT emit "支" or other single-char fields from "表格支持跨页选择"', () => {
    // The marquee bug — old engine captured 支 as a 1-char table field.
    for (const c of cfg.columns) {
      expect(c.prop?.length, `column prop "${c.prop}" too short`).toBeGreaterThanOrEqual(2)
    }
    expect(cfg.columns.find((c) => c.prop === '支')).toBeUndefined()
  })

  it('parses all 4 query fields', () => {
    expect(cfg.formItems.length).toBe(4)
  })

  it('enables cachePageSelection in tableOptions', () => {
    expect(cfg.tableOptions.cachePageSelection).toBe(true)
  })

  it('surfaces cross-page selection note in featureHints', () => {
    expect(cfg.featureHints?.join(' ')).toMatch(/跨页|cross.?page/i)
  })

  it('detects approve/reject actions from the row btns description', () => {
    expect(cfg.actions).toContain('approve')
    expect(cfg.actions).toContain('reject')
  })

  it('passes universal invariants', () => expectUniversalInvariants(cfg))
})

describe('preset 6: 级联筛选 (region cascader)', () => {
  const cfg = generateCrudConfig(PRESETS.cascadeRegion)

  it('handles "省 → 市 → 区" — arrows normalized to commas', () => {
    // Bug fixed: → was outside the inner char class, breaking the query
    // regex AND polluting extractAllFields fallback with "→" as a field.
    for (const f of cfg.formItems) {
      expect(['→', '↔']).not.toContain(f.prop)
    }
  })

  it('produces some cascader / region field(s)', () => {
    const hasCascader = cfg.formItems.some(
      (f) => f.formtype === 'Cascader' || /province|city|district|region|省|市|区/i.test(f.prop),
    )
    expect(hasCascader).toBe(true)
  })

  it('surfaces cascader feature note', () => {
    expect(cfg.featureHints?.join(' ')).toMatch(/级联|cascader/i)
  })

  it('extracts table columns despite "（省市区拼接）" modifier', () => {
    expect(tableColsExcludingOperate(cfg)).toBeGreaterThanOrEqual(3)
  })

  it('passes universal invariants', () => expectUniversalInvariants(cfg))
})

// Sanity that the original test suite's prompts still work — guards against
// over-fitting to the presets.
describe('engine still handles simple prompts', () => {
  it('basic "查询X，表格显示Y" still parses both sections', () => {
    const cfg = generateCrudConfig('查询条件有姓名、手机号，表格显示姓名、手机号、邮箱')
    expect(cfg.formItems.length).toBe(2)
    expect(tableColsExcludingOperate(cfg)).toBe(3)
    expectUniversalInvariants(cfg)
  })

  it('fallback for "field, field, field" still works', () => {
    const cfg = generateCrudConfig('姓名、手机号、邮箱、状态')
    expect(cfg.formItems.length).toBeGreaterThan(0)
    expectUniversalInvariants(cfg)
  })
})
