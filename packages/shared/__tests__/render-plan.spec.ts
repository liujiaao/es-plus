import { describe, it, expect } from 'vitest'
import { StructuredCrudConfigSchema, type StructuredCrudConfig } from '../src/structured-config.schema.js'
import {
  buildRenderPlan,
  RENDER_PLAN_CONTRACT,
} from '../src/render-plan.js'
import { generateFromConfig } from '../src/structured-generator.js'

const field = (prop: string, extra: Record<string, unknown> = {}) => ({
  prop,
  label: prop,
  formtype: 'Input',
  ...extra,
})

const base = (extra: Record<string, unknown> = {}): StructuredCrudConfig =>
  ({
    name: 'Demo',
    apiUrl: '/api/demo',
    fields: [field('name')],
    actions: ['add', 'edit', 'delete'],
    ...extra,
  }) as StructuredCrudConfig

describe('RenderPlan — 键账本与生成器一致', () => {
  it('账本键集 == StructuredCrudConfig 的键集（新增顶层键必须登记）', () => {
    const schemaKeys = Object.keys(StructuredCrudConfigSchema.shape).sort()
    const planKeys = Object.keys(RENDER_PLAN_CONTRACT).sort()
    expect(planKeys).toEqual(schemaKeys)
  })

  it('每个 downgrade 行都必须有原因（否则宿主看不到为什么被降级）', () => {
    for (const [key, rule] of Object.entries(RENDER_PLAN_CONTRACT)) {
      for (const mode of ['schema', 'sfc'] as const) {
        if (rule[mode] === 'downgrade') {
          expect(rule.reason, `${key}.${mode} 是 downgrade 但缺 reason`).toBeTruthy()
        }
      }
    }
  })

  it('缺席的能力键落成 absent；always 键（meta/默认值）不落 absent', () => {
    const plan = buildRenderPlan(base())
    expect(plan.entries.dialogs.disposition).toBe('absent')
    expect(plan.entries.tableBtns.disposition).toBe('absent')
    expect(plan.entries.operationColumn.disposition).toBe('absent')
    expect(plan.entries.mode.disposition).toBe('meta')
    expect(plan.entries.tableOptions.disposition).toBe('emit')
    expect(plan.entries.actions.disposition).toBe('emit')
  })

  it('schema / sfc 的 mode 差异按契约落位', () => {
    const config = base({
      dialogs: { add: { title: '新增' } },
      tableBtns: [{ name: '导出', actionType: 'export' }],
      toolbarBtns: [{ name: '批量删除', actionType: 'delete' }],
      operationColumn: { btns: [{ name: '查看', dialogKey: 'view' }] },
      permissions: { add: 'p:add' },
    })
    const schema = buildRenderPlan(config, { mode: 'schema' })
    const sfc = buildRenderPlan(config, { mode: 'sfc' })

    for (const key of ['dialogs', 'tableBtns', 'toolbarBtns', 'operationColumn'] as const) {
      expect(schema.entries[key].disposition, `${key} schema`).toBe('emit')
      expect(sfc.entries[key].disposition, `${key} sfc`).toBe('downgrade')
    }
    expect(schema.entries.permissions.disposition).toBe('downgrade')
    expect(sfc.entries.permissions.disposition).toBe('emit')
  })

  it('sfc 的 operationColumn:false 是 emit（抑制即语义），对象形态才是 downgrade', () => {
    const off = buildRenderPlan(base({ operationColumn: false }), { mode: 'sfc' })
    expect(off.entries.operationColumn.disposition).toBe('emit')
    const obj = buildRenderPlan(base({ operationColumn: { label: '操作', btns: [{ name: '查看' }] } }), {
      mode: 'sfc',
    })
    expect(obj.entries.operationColumn.disposition).toBe('downgrade')
    expect(obj.downgrades().map((e) => e.key)).toContain('operationColumn')
  })

  it('空 dialogs record 视同未声明（否则 legacy 派生被跳过 → 点不开的死按钮）', () => {
    // B7：`repairConfig` 删掉 `dialogs.add: null` 后留下 `dialogs: {}`。若它算「已声明」，
    // 页面会被切进新弹窗模式：legacy 的 dialogFormItems 不发射，而工具栏仍由 actions
    // 派生「新增」→ openDialog('add') 找不到配置直接 return。
    const empty = buildRenderPlan(base({ dialogs: {} }), { mode: 'schema' })
    expect(empty.entries.dialogs.disposition).toBe('absent')
    expect(empty.renders('dialogs')).toBe(false)
    // 新弹窗模式的判定键一个都不 render ⇒ 生成器走 legacy 通道
    expect(empty.anyRenders(['dialogs', 'toolbarBtns', 'tableBtns', 'operationColumn'])).toBe(false)

    // 非空 record 照旧是声明
    const one = buildRenderPlan(base({ dialogs: { add: { title: '新增' } } }), { mode: 'schema' })
    expect(one.entries.dialogs.disposition).toBe('emit')
    expect(one.anyRenders(['dialogs', 'toolbarBtns', 'tableBtns', 'operationColumn'])).toBe(true)
  })

  it('helpers：emits / renders / anyRenders 与 disposition 一致', () => {
    const plan = buildRenderPlan(base({ operationColumn: false }), { mode: 'schema' })
    expect(plan.emits('operationColumn')).toBe(true)
    expect(plan.renders('actions')).toBe(true)
    expect(plan.renders('dialogs')).toBe(false)
    expect(plan.anyRenders(['dialogs', 'operationColumn'])).toBe(true)
    expect(plan.anyRenders(['dialogs', 'tableBtns'])).toBe(false)
  })
})

describe('RenderPlan — 生成器真的消费它', () => {
  it('sfc + operationColumn:false 不再派生操作列，也不发「不支持」告警', () => {
    const r = generateFromConfig(base({ mode: 'sfc', operationColumn: false }))
    // SFC 操作列固定 prop = OPERATION_COLUMN_PROP_SFC（'operate'）
    expect(r.code).not.toContain("prop: 'operate'")
    expect(r.warnings.join('\n')).not.toContain('does not yet consume')
  })

  it('sfc + operationColumn 对象形态仍派生 + 降级告警点名', () => {
    const r = generateFromConfig(
      base({ mode: 'sfc', operationColumn: { label: '操作', btns: [{ name: '查看' }] } }),
    )
    expect(r.code).toContain("prop: 'operate'")
    const w = r.warnings.find((x) => x.includes('does not yet consume'))
    expect(w, '对象形态必须保留降级告警').toBeTruthy()
    expect(w).toContain('operationColumn')
  })

  it('schema + operationColumn:false 落进 pageSchema（不是「未提供」）', () => {
    const r = generateFromConfig(base({ operationColumn: false }))
    expect(r.code).toContain('"operationColumn": false')
  })
})
