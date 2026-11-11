#!/usr/bin/env node
/**
 * R5 / R6 —— 出处的两条**确定性**指标（无模型、无付费）。
 *
 * ## R5 · 出处往返率（`provenanceRoundTrip`）
 *
 * 对每条 CRUD 配置在三种出口各生成一次并回读：
 *   - `schema-ts`：`generateFromConfig({ mode: 'schema', typescript: true })`（B1 的默认出口）
 *   - `schema-js`：`generateFromConfig({ mode: 'schema', typescript: false })`
 *   - `sfc`：`generateFromConfig({ mode: 'sfc' })`
 *
 * 判据不是「能读回」而是**往返**：读回的配置重新生成出的**页面**必须逐字节等于原产物。
 * 只断言 `read.ok` 的话，「配置里悄悄多一个键 / 少一个键」根本测不出来 —— 而 W4 出口标准
 * 的原话就是「生成器是出处的逆函数」。
 *
 * 比较的是 `stripPageSourceArtifact(code)` 之后的字节：出处块里 `lossy[]` 记录的是**这一次**
 * 归一化掉了什么；读回的配置已经归一过，重生成时自然没有可报的损失。页面的差异才是缺陷。
 *
 * ## R6 · `config → surfaces → config` 幂等率
 *
 * 对「surfaces 词汇内」的配置（`configToSurfaces(cfg).lossy` 为空）：
 * `surfacesToConfig(configToSurfaces(cfg).intent).config` 必须与 `cfg` 相等。
 *
 * 比较口径（两处归一，其余逐键严格）：
 *   1. 两侧都过 `StructuredCrudConfigSchema.parse` —— 省略的默认值（target/mode/成员布尔）
 *      在两侧补齐，否则「省略 == true」会被误判成漂移；
 *   2. `fields[]` 按 `prop` 排序后比较 —— 组合层按「首次出现的面」推字段顺序
 *      （query → table → form），与原始 `fields[]` 顺序不同；渲染顺序由各面自己的顺序决定，
 *      不依赖这个数组，故顺序不是语义。
 *
 * 不计入分母的三类（**显式**记录，不是静默跳过）：
 *   - `lossy`：surfaces 词汇表达不了（显式 columns / 三面全 false 的字段 / dialog 非面键）；
 *   - `children`：嵌套容器不在 `SurfaceField`（组合层）词汇里；
 *   - `no-table`：无表格子集走片段发射器，不经过组合层。
 *
 * 用法：由 `scripts/check-provenance.mjs`（守卫）与 `scripts/eval-llm.mjs`（产物指标）调用。
 * 本模块不读文件、不 import shared —— 生成器/回读器由调用方注入，故可用假实现直接单测。
 */

/** R5 的三种出口。顺序冻结：报表与产物按此序。 */
export const ROUND_TRIP_EXITS = [
  { id: 'schema-ts', mode: 'schema', typescript: true },
  { id: 'schema-js', mode: 'schema', typescript: false },
  { id: 'sfc', mode: 'sfc' },
]

/**
 * 一条配置在一种出口上的往返判定。
 *
 * @param {Record<string, unknown>} config 已解析过的 CRUD 配置
 * @param {{ id: string, mode: string, typescript?: boolean }} exit
 * @param {{ generateFromConfig: Function, readPageSource: Function, stripPageSourceArtifact: Function }} shared
 * @returns {{ ok: boolean, reason?: string }}
 */
export function roundTripOfConfig(config, exit, shared) {
  const input = { ...config, mode: exit.mode }
  if (exit.typescript !== undefined) input.typescript = exit.typescript
  let produced
  try {
    produced = shared.generateFromConfig(input)
  } catch (err) {
    return { ok: false, reason: `生成器抛错：${err instanceof Error ? err.message : String(err)}` }
  }
  const read = shared.readPageSource(produced.code, exit.mode === 'sfc' ? 'Page.vue' : 'schema.ts')
  if (!read.ok) return { ok: false, reason: `回读失败：${read.error}` }
  let again
  try {
    again = shared.generateFromConfig(read.source.config)
  } catch (err) {
    return {
      ok: false,
      reason: `用读回的配置重新生成抛错：${err instanceof Error ? err.message : String(err)}`,
    }
  }
  const pageOf = (code) => shared.stripPageSourceArtifact(code)
  if (pageOf(produced.code) !== pageOf(again.code)) {
    return { ok: false, reason: '读回配置重新生成的页面与原产物不同（出处不是逆函数）' }
  }
  return { ok: true }
}

/**
 * R5 汇总。`results` 是 `[{ source, label, exit, ok, reason? }]`。
 * `failures` 截断到 `maxFailures`（默认 20），但 `failed` 计数是完整的。
 */
export function summarizeRoundTrip(results, { maxFailures = 20 } = {}) {
  const byExit = {}
  for (const e of ROUND_TRIP_EXITS) byExit[e.id] = { ok: 0, total: 0 }
  let ok = 0
  const failures = []
  for (const r of results) {
    const bucket = byExit[r.exit] ?? (byExit[r.exit] = { ok: 0, total: 0 })
    bucket.total++
    if (r.ok) {
      ok++
      bucket.ok++
    } else if (failures.length < maxFailures) {
      failures.push({ source: r.source, exit: r.exit, reason: r.reason })
    }
  }
  const total = results.length
  return {
    ok,
    total,
    failed: total - ok,
    rate: total ? Number((ok / total).toFixed(4)) : null,
    byExit,
    failures,
  }
}

/**
 * 规范化一份 CRUD 配置，供 R6 比较（见文件头「比较口径」）。
 * `parse` 由调用方注入（`StructuredCrudConfigSchema.parse`），便于单测。
 *
 * 除字段顺序外还抹掉**弹窗表单项上的成员布尔**：`configToSurfaces` 按契约
 * （`SurfaceFieldSchema = FieldConfigSchema.omit({inQuery,inTable,inForm})`）不投影它们，
 * 而弹窗的 formItems 是自己的字段表，成员关系不影响渲染 —— 它们不是「哪个面」的标记。
 * 不抹掉的话，一条 `inQuery:false` 的弹窗表单项会让「配置 → surfaces → 配置」永远差一个键。
 */
export function canonicalConfig(config, parse) {
  const parsed = parse(config)
  const json = JSON.parse(JSON.stringify(parsed))
  if (Array.isArray(json.fields)) {
    json.fields = [...json.fields].sort((a, b) => String(a?.prop).localeCompare(String(b?.prop)))
  }
  if (json.dialogs && typeof json.dialogs === 'object') {
    for (const dlg of Object.values(json.dialogs)) {
      if (!dlg || !Array.isArray(dlg.formItems)) continue
      for (const item of dlg.formItems) {
        if (!item || typeof item !== 'object') continue
        delete item.inQuery
        delete item.inTable
        delete item.inForm
      }
    }
  }
  return json
}

const hasContainerField = (config) =>
  Array.isArray(config?.fields) &&
  config.fields.some((f) => f && Array.isArray(f.children) && f.children.length > 0)

/**
 * 一条配置的 R6 判定。
 *
 * @returns {{ status: 'ok'|'mismatch'|'lossy'|'children'|'no-table', reason?: string, keys?: string[] }}
 */
export function surfacesIdempotenceOf(config, shared) {
  const projected = shared.configToSurfaces(config)
  if (projected.lossy.length > 0) {
    return { status: 'lossy', reason: projected.lossy[0]?.path }
  }
  if (hasContainerField(config)) return { status: 'children' }
  const composed = shared.surfacesToConfig(projected.intent)
  if (!composed.hasTable) return { status: 'no-table' }
  let a
  let b
  try {
    a = canonicalConfig(config, shared.StructuredCrudConfigSchema.parse)
    b = canonicalConfig(composed.config, shared.StructuredCrudConfigSchema.parse)
  } catch (err) {
    return { status: 'mismatch', reason: `解析失败：${err instanceof Error ? err.message : String(err)}` }
  }
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  const diff = [...new Set([...keysA, ...keysB])].filter(
    (k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]),
  )
  if (diff.length === 0) return { status: 'ok' }
  return { status: 'mismatch', keys: diff.slice(0, 8), reason: `键不一致：${diff.slice(0, 8).join(', ')}` }
}

/**
 * R6 汇总。分母 = 可比配置（`ok` + `mismatch`）；其余三类进 `excluded`。
 */
export function summarizeSurfacesIdempotence(results, { maxFailures = 20 } = {}) {
  const excluded = { lossy: 0, children: 0, 'no-table': 0 }
  let ok = 0
  let mismatch = 0
  const failures = []
  for (const r of results) {
    if (r.status === 'ok') ok++
    else if (r.status === 'mismatch') {
      mismatch++
      if (failures.length < maxFailures) {
        failures.push({ source: r.source, reason: r.reason, keys: r.keys })
      }
    } else excluded[r.status] = (excluded[r.status] ?? 0) + 1
  }
  const comparable = ok + mismatch
  return {
    ok,
    comparable,
    excluded,
    rate: comparable ? Number((ok / comparable).toFixed(4)) : null,
    failures,
  }
}
