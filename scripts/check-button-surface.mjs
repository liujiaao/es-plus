#!/usr/bin/env node
/**
 * 两个按钮面的**分工**守卫（静态，无需 API key、无需构建）。
 *
 * ## 为什么需要它
 *
 * `tableBtns`（表格上方的工具栏）与 `toolbarBtns`（查询表单按钮区，跟在 查询/重置 后面）
 * 是**两个不同的渲染位置**，不是别名。但两边都能写 `{ name, type, position, dialogKey }`，
 * 于是模型看不出区别 —— 2026-10-27 那批全量 dump 里 **11/11** 条「表格上方左侧…右侧…」
 * 语料都把按钮写进了 `toolbarBtns`：`tableBtns` 维度被结构性判负，而「左/右」这个要求
 * 在表单按钮区**根本无处落地**（那边不读 `position`）。
 *
 * 这正是本仓反复出现的形状：同一个语义两个键、没有一条规则说清谁管哪儿，模型只能猜。
 * 修法是**把分工写进模型看得见的三处**，并让它们与运行时事实绑定：
 *
 *   1. 系统 prompt 有一条定位规则：只有 `tableBtns` 认 `position`；
 *   2. shared schema 的 `toolbarBtns.describe` 不再声称支持 position（旧措辞正是误导源）；
 *   3. MCP 工具 schema 同上（第二处模型可见面，曾经与 shared 说法相反）。
 *
 * 第 4 条把「事实」本身钉住：**EsForm 的按钮区不读 `position`**。哪天它开始读了（真去支持
 * 分侧），这条会红 —— 那时 prompt 的「只有 tableBtns 认 position」就该改，而不是留着变成假话。
 * 这是有意的连锁：守卫红 = 有一处真相变了，请同步，而不是「守卫太吵」。
 *
 * 用法：`node scripts/check-button-surface.mjs`
 * 退出码：0 = 三处说法一致且与运行时事实相符；1 = 至少一处漂移。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

const failures = []
const ok = (cond, msg) => {
  if (!cond) failures.push(msg)
}

// ── 1. 系统 prompt：一条说清分工的规则 ────────────────────────────────────────
const promptSrc = read('packages/shared/src/ai-nl-to-config-prompt.ts')
ok(
  /Only `tableBtns` honours/.test(promptSrc),
  '系统 prompt 缺少分工规则：「Only `tableBtns` honours `position`」—— 删掉它，模型会重新把「表格上方」写进 toolbarBtns'
)
ok(
  /ABOVE THE TABLE/.test(promptSrc) && /QUERY-FORM button area/.test(promptSrc),
  '系统 prompt 必须同时说清两个面的位置（ABOVE THE TABLE / QUERY-FORM button area），否则「上方」仍是歧义'
)

// ── 2/3. 两处模型可见的 schema 说明：toolbarBtns 不得再声称支持 position ───────
const schemaSrc = read('packages/shared/src/structured-config.schema.ts')
const toolbarLine = (src, key) => src.split('\n').find((l) => l.trim().startsWith(`${key}: `)) ?? ''
ok(!/position:left\|right/.test(toolbarLine(schemaSrc, 'toolbarBtns')), 'shared schema：toolbarBtns 的说明又声称支持 position（表单按钮区不读它）')
ok(
  /NO left\/right placement/.test(toolbarLine(schemaSrc, 'toolbarBtns')),
  'shared schema：toolbarBtns 的说明应明写「没有左右定位」'
)
ok(
  /only button surface that honours/.test(toolbarLine(schemaSrc, 'tableBtns')),
  'shared schema：tableBtns 的说明应明写它是唯一认 position 的按钮面'
)

const mcpSrc = read('packages/mcp-server/src/tools/generate-crud.ts')
const mcpToolbar = (mcpSrc.match(/toolbarBtns: z[\s\S]*?\.describe\(\s*(["'])([\s\S]*?)\1\s*\)/) ?? [])[2] ?? ''
ok(mcpToolbar.length > 0, 'MCP 工具 schema：找不到 toolbarBtns 的 describe（结构变了？请同步本守卫）')
ok(!/position:left\|right/.test(mcpToolbar), 'MCP 工具 schema：toolbarBtns 的说明又声称支持 position')
ok(/No left\/right placement/.test(mcpToolbar), 'MCP 工具 schema：toolbarBtns 的说明应明写「没有左右定位」')

// ── 4. 运行时事实：EsForm 的按钮区不读 position ───────────────────────────────
// 只扫模板/脚本正文，注释里的解释不算（沿用 entry-keys 的 stripComments 口径）。
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '')
const esFormFiles = ['packages/vue3/src/components/es-form/src/es-form.vue', 'packages/vue2/src/components/es-form/es-form.vue']
for (const f of esFormFiles) {
  let src
  try {
    src = read(f)
  } catch {
    continue // 某一端没有这个文件不算漂移（覆盖边界写在本守卫头注里）
  }
  ok(
    !/\bposition\b/.test(stripComments(src)),
    `${f} 开始读 position 了 —— 若表单按钮区真的支持左右分侧，请同步改 prompt 与两处 schema 说明（本守卫第 4 条正是为此存在）`
  )
}

if (failures.length) {
  console.error(`\n按钮面分工守卫失败：${failures.length} 条`)
  for (const f of failures) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log('✅ 按钮面分工守卫通过（prompt 有定位规则 / 两处 schema 说明一致 / EsForm 仍不读 position）')
