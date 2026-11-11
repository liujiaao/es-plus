#!/usr/bin/env node
/**
 * R5 / R6 指标的 meta-eval —— 无模型、无 API key，进 `check:consistency`。
 *
 * 为什么需要它：`check:provenance` 只对着**仓库里当前那份语料**跑。若判据被悄悄放宽
 * （例如回读失败时 `continue`、幂等比较只比值类型、`lossy` 一律当「不可比」），
 * 真语料照样全绿 —— 假绿不会被自己的绿光照亮。这里用假实现把每条判据打穿：
 *
 *   · 回读失败 / 重生成不一致 / 生成器抛错，都必须**判红**且原因可区分；
 *   · 空分母的 rate 必须是 `null`（不是 0、不是 100%）；
 *   · R6 的四种「不可比」必须各自有独立状态，不能被混成 `ok`；
 *   · `canonicalConfig` 的两处归一（字段顺序、弹窗表单项成员布尔）必须真的生效。
 */
import {
  ROUND_TRIP_EXITS,
  roundTripOfConfig,
  summarizeRoundTrip,
  canonicalConfig,
  surfacesIdempotenceOf,
  summarizeSurfacesIdempotence,
} from './provenance.mjs'

let checks = 0
const failures = []
function check(cond, msg) {
  checks++
  if (cond) return
  failures.push(msg)
  console.error(`  ✗ ${msg}`)
}

// ── R5：单条往返 ────────────────────────────────────────────
const config = { name: 'X', apiUrl: '/api/x', fields: [{ prop: 'a', label: 'A', formtype: 'Input' }] }

/** 一套「一切正常」的假 shared；`over` 覆盖任意一环。 */
function fakeShared(over = {}) {
  const calls = []
  let last = config // 出处应回读**本次生效**的配置（含出口覆盖的 mode/typescript）
  const base = {
    generateFromConfig(input) {
      calls.push({ kind: 'generate', input })
      last = input
      return { code: `PAGE:${JSON.stringify(input)}` }
    },
    readPageSource(code, filename) {
      calls.push({ kind: 'read', code, filename })
      return { ok: true, source: { config: last } }
    },
    stripPageSourceArtifact(code) {
      return code.replace(/\/\/ source.*$/m, '')
    },
    ...over,
  }
  return { shared: base, calls }
}

{
  const { shared, calls } = fakeShared()
  const r = roundTripOfConfig(config, ROUND_TRIP_EXITS[0], shared)
  check(r.ok, 'R5 · 正常往返必须通过')
  check(
    calls[0].input.mode === 'schema' && calls[0].input.typescript === true,
    'R5 · schema-ts 出口必须覆盖 mode/typescript'
  )
  check(calls[1].filename === 'schema.ts', 'R5 · schema 出口的回读文件名应是 schema.ts')
}
{
  const { shared, calls } = fakeShared()
  const r = roundTripOfConfig(config, ROUND_TRIP_EXITS[1], shared)
  check(r.ok && calls[0].input.typescript === false, 'R5 · schema-js 出口必须把 typescript 覆盖成 false')
}
{
  const { shared, calls } = fakeShared()
  const r = roundTripOfConfig(config, ROUND_TRIP_EXITS[2], shared)
  check(r.ok && calls[0].input.mode === 'sfc' && calls[1].filename === 'Page.vue', 'R5 · sfc 出口的 mode/文件名必须正确')
}
{
  const { shared } = fakeShared({ readPageSource: () => ({ ok: false, error: '找不到页面出处标记' }) })
  const r = roundTripOfConfig(config, ROUND_TRIP_EXITS[0], shared)
  check(!r.ok && r.reason.includes('回读失败') && r.reason.includes('找不到页面出处标记'), 'R5 · 回读失败必须判红且带上原因')
}
{
  // 产物与重生成不同 —— 只在页面层不同（出处块被 strip 掉不应影响判定）。
  let n = 0
  const { shared } = fakeShared({
    generateFromConfig: () => ({ code: n++ === 0 ? 'PAGE_A' : 'PAGE_B' }),
  })
  const r = roundTripOfConfig(config, ROUND_TRIP_EXITS[0], shared)
  check(!r.ok && r.reason.includes('页面'), 'R5 · 重生成页面不同必须判红')
}
{
  // 出处块里的差异（lossy 列表）必须被 strip 掉，不影响判定。
  let n = 0
  const { shared } = fakeShared({
    generateFromConfig: () => ({
      code: n++ === 0 ? 'PAGE_X\n// source: [lossy]' : 'PAGE_X\n// source: []',
    }),
  })
  const r = roundTripOfConfig(config, ROUND_TRIP_EXITS[0], shared)
  check(r.ok, 'R5 · 出处块自身差异（lossy 列表）不计入往返判定')
}
{
  const { shared } = fakeShared({ generateFromConfig: () => { throw new Error('boom') } })
  const r = roundTripOfConfig(config, ROUND_TRIP_EXITS[0], shared)
  check(!r.ok && r.reason.includes('boom'), 'R5 · 生成器抛错必须判红并带原文')
}

// ── R5：汇总 ────────────────────────────────────────────────
{
  const results = [
    { source: 'a', exit: 'schema-ts', ok: true },
    { source: 'b', exit: 'schema-ts', ok: false, reason: 'r1' },
    { source: 'a', exit: 'sfc', ok: true },
  ]
  const s = summarizeRoundTrip(results)
  check(s.total === 3 && s.ok === 2 && s.failed === 1, 'R5 汇总 · 分子/分母/失败数')
  check(s.byExit['schema-ts'].total === 2 && s.byExit['schema-ts'].ok === 1, 'R5 汇总 · 按出口拆开')
  check(s.byExit.sfc.total === 1 && s.byExit.sfc.ok === 1, 'R5 汇总 · 未出现的出口也要有零桶')
  check(s.rate === Number((2 / 3).toFixed(4)), 'R5 汇总 · rate 由合计派生')
  check(summarizeRoundTrip([]).rate === null, 'R5 汇总 · 空分母的 rate 必须是 null（不是 0 / 100%）')
}
{
  const many = Array.from({ length: 30 }, (_, i) => ({ source: `s${i}`, exit: 'schema-ts', ok: false, reason: 'x' }))
  const s = summarizeRoundTrip(many, { maxFailures: 5 })
  check(s.failed === 30 && s.failures.length === 5, 'R5 汇总 · 失败明细截断，但失败计数保持完整')
}

// ── R6：规范化 ──────────────────────────────────────────────
{
  const parse = (x) => x
  const a = canonicalConfig(
    { fields: [{ prop: 'b' }, { prop: 'a' }], dialogs: { add: { formItems: [{ prop: 'a', inQuery: false, inForm: true }] } } },
    parse
  )
  check(a.fields[0].prop === 'a', 'R6 规范化 · fields 按 prop 排序')
  check(a.dialogs.add.formItems[0].inQuery === undefined && a.dialogs.add.formItems[0].inForm === undefined, 'R6 规范化 · 弹窗表单项的成员布尔被抹掉')
}

// ── R6：单条幂等 ────────────────────────────────────────────
function fakeIdem(over = {}) {
  return {
    configToSurfaces: () => ({ intent: { surfaces: {} }, lossy: [] }),
    surfacesToConfig: () => ({ hasTable: true, config: { ...config } }),
    StructuredCrudConfigSchema: { parse: (x) => x },
    ...over,
  }
}
{
  const r = surfacesIdempotenceOf(config, fakeIdem())
  check(r.status === 'ok', 'R6 · 组合回原文必须 ok')
}
{
  const r = surfacesIdempotenceOf(config, fakeIdem({ configToSurfaces: () => ({ intent: {}, lossy: [{ path: 'columns' }] }) }))
  check(r.status === 'lossy', 'R6 · surfaces 词汇外的配置必须记为 lossy（不可比）')
}
{
  const cfg = { fields: [{ prop: 'a', children: [{ prop: 'b' }] }] }
  const r = surfacesIdempotenceOf(cfg, fakeIdem())
  check(r.status === 'children', 'R6 · 嵌套容器必须单独记 children')
}
{
  const r = surfacesIdempotenceOf(config, fakeIdem({ surfacesToConfig: () => ({ hasTable: false }) }))
  check(r.status === 'no-table', 'R6 · 无表格必须记 no-table')
}
{
  const r = surfacesIdempotenceOf(config, fakeIdem({ surfacesToConfig: () => ({ hasTable: true, config: { ...config, name: 'Y' } }) }))
  check(r.status === 'mismatch' && r.keys.includes('name'), 'R6 · 键不一致必须报 mismatch 并点名键')
}
{
  const r = surfacesIdempotenceOf(config, fakeIdem({ StructuredCrudConfigSchema: { parse: () => { throw new Error('bad config') } } }))
  check(r.status === 'mismatch' && r.reason.includes('bad config'), 'R6 · 解析失败必须判 mismatch（不能静默 ok）')
}

// ── R6：汇总 ────────────────────────────────────────────────
{
  const s = summarizeSurfacesIdempotence([
    { source: 'a', status: 'ok' },
    { source: 'b', status: 'mismatch', reason: 'k' },
    { source: 'c', status: 'lossy' },
    { source: 'd', status: 'children' },
    { source: 'e', status: 'no-table' },
  ])
  check(s.comparable === 2 && s.ok === 1, 'R6 汇总 · 分母只含可比配置')
  check(s.excluded.lossy === 1 && s.excluded.children === 1 && s.excluded['no-table'] === 1, 'R6 汇总 · 三类排除各自计数')
  check(s.rate === 0.5 && s.failures.length === 1, 'R6 汇总 · rate 与失败明细')
  const empty = summarizeSurfacesIdempotence([{ source: 'x', status: 'lossy' }])
  check(empty.rate === null, 'R6 汇总 · 没有可比配置时 rate 必须是 null')
}

if (failures.length) {
  console.error(`\n✗ check:provenance-metrics FAILED（${failures.length}/${checks}）`)
  process.exit(1)
}
console.log(`✅ check:provenance-metrics：${checks} 条断言全过（R5/R6 判据非空证明）。`)
