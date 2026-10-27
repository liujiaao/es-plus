#!/usr/bin/env node
/**
 * AI 栏度量口径的单测（无需模型，进 `check:consistency`）。
 *
 * ## 为什么值得单测
 *
 * `cases:metrics:check` 在**本地 Windows 上永远是绿的**（工作树 CRLF），到 Linux CI
 * （检出 LF）才红 —— 2026-10-27 就是这么红了一次，而它挡的是 deploy-docs。根因是
 * `bytes` 用了原始文本：同一份 JSON，CRLF 比 LF 每行多 1 字节。这里把两条钉死：
 *
 *   1) **行尾无关**：同一份 JSON 的 LF 版与 CRLF 版，`aiMetricsOf` 产出必须逐字段相同；
 *   2) **内嵌脚本可见**：JSON 里的 `formatter` / `render` 字符串不计入「自写函数」（它们不是
 *      `<script>`），但必须出现在 `features.scriptStrings` —— 否则页面那句「0 个函数」会在
 *      产物带脚本时变成假话。
 *
 * 用法：node scripts/gen-cases-metrics.test.mjs
 * 退出码：0 = 口径成立；1 = 至少一条失效。
 */
import { aiMetricsOf } from './gen-cases-metrics.mjs'

let failures = 0
function check(cond, msg) {
  if (cond) return
  failures++
  console.error(`  ✗ ${msg}`)
}
const eq = (a, b, msg) => check(a === b, `${msg}（期望 ${JSON.stringify(b)}，实得 ${JSON.stringify(a)}）`)

const schema = {
  name: 'Demo',
  formItems: [{ prop: 'a', label: 'A', formtype: 'Input' }],
  columns: [{ prop: 'a', label: 'A' }],
  dialogs: { add: { title: '新增' } },
  actions: ['add'],
  fields: [{ prop: 'a', dataOptions: [] }],
}

const lfText = `${JSON.stringify(schema, null, 2)}\n`
const crlfText = lfText.replace(/\n/g, '\r\n')

// ── 1) 行尾无关 ──────────────────────────────────────────────────────────────
{
  const lf = aiMetricsOf(lfText)
  const crlf = aiMetricsOf(crlfText)
  eq(crlf.bytes, lf.bytes, 'CRLF 与 LF 的 bytes 相同（按归一后的文本计）')
  eq(crlf.bytes, Buffer.byteLength(lfText), 'bytes 就是 LF 文本的字节数')
  eq(crlf.lines, lf.lines, '行数相同')
  check(JSON.stringify(crlf) === JSON.stringify(lf), '整个度量对象逐字段相同')
}

// ── 2) 计数口径 ──────────────────────────────────────────────────────────────
{
  const m = aiMetricsOf(lfText)
  eq(m.events, 0, 'JSON 没有模板 ⟹ 事件 0')
  eq(m.functions, 0, 'JSON 没有 <script> ⟹ 自写函数 0')
  eq(m.vIf, 0, 'JSON 没有模板 ⟹ v-if 0')
  eq(m.features.formItems, 1, 'formItems 条数')
  eq(m.features.columns, 1, 'columns 条数')
  eq(m.features.dialogs, 1, 'dialogs 键数')
  eq(m.features.actions, 1, 'actions 条数')
  eq(m.features.scriptStrings, 0, '纯 JSON 没有内嵌脚本串')
}

// ── 3) 内嵌脚本可见 ──────────────────────────────────────────────────────────
{
  const withScript = JSON.parse(lfText)
  withScript.columns[0].formatter = '(row) => row.a.toFixed(2)'
  withScript.fields[0].render = '(h, row) => h("span", row.a)'
  const m = aiMetricsOf(`${JSON.stringify(withScript, null, 2)}\n`)
  eq(m.functions, 0, '脚本住在 JSON 字符串里，<script> 计数器看不见 ⟹ 仍是 0（本口径的已知边界）')
  eq(m.features.scriptStrings, 2, '但 scriptStrings 必须数到它 —— 页面不能对带脚本的产物说「0 个函数」')
}

// ── 4) 坏 JSON 必须炸，不能静默算成 0 ───────────────────────────────────────
{
  let threw = false
  try {
    aiMetricsOf('{ not json')
  } catch {
    threw = true
  }
  check(threw, '坏 JSON 抛错（否则 AI 栏会静默显示 0/0/0）')
}

if (failures) {
  console.error(`\n❌ AI 栏度量口径：${failures} 条失效`)
  process.exit(1)
}
console.log('✅ AI 栏度量口径：行尾无关 / 计数 / 内嵌脚本可见 / 坏 JSON 抛错 全部成立')
