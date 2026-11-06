#!/usr/bin/env node
/**
 * `dataOptions` 形状对账守卫（选项契约只允许一个形状）
 *
 * ## 为什么需要这道守卫
 *
 * 同一个「静态选项」形状此前被手写了五份，且已经漂移出**真实缺陷**：
 *
 *   - AI 前门（`DataOptionSchema`）放行 `children`（Cascader）与 `tagType`
 *     （字段级选项会被生成器整份复制到派生列做状态染色）；
 *   - vue3 / antdv 的 `FormItemOption` 却是 `{label, value, disabled?}` ⟹
 *     **前门校验通过的配置被本库自己的类型判红**。每次发生都会在 eval 的
 *     typecheck 腿上记成「模型写错了」，而模型只是照发布出来的契约写；
 *   - MCP 的 prompt / API 文档只教模型 `{label, value}` ⟹ 模型不知道
 *     `disabled` / `children` / `tagType` 合法，能力白给。
 *
 * 单看任何一处都「自洽」，只有逐键对账才看得见分叉。所以这里以**前门的 Zod**
 * 为契约源，对下面每处逐键比对（缺键、多键、必填/可选写反都算分叉）：
 *
 *   1. `DataOptionSchema`（shared，AI 生成走的就是它）
 *   2. `packages/shared/schemas/form-item.schema.json`（发布给宿主的 JSON Schema；
 *      改它之后必须跑 `npm run schemas:sync` 与文档站 `gen-doc-schemas`）
 *   3. core `FormDataOption`（权威 TS 类型）
 *   4. vue3 / antdv 的 `FormDataOption` 引用（两处 `dataOptions?:` 都必须是它，
 *      不得再写内联字面量 —— 那正是漂移的来源）
 *   5. MCP 的 `resources/types.ts`（模型读的类型文档）
 *   6. MCP 的 `get-component-api` 文案与 `form-config` prompt（模型读的自然语言）
 *   7. `bundled/*.d.ts` 是否仍是源码的新鲜副本（否则发布出去的包教模型旧形状）
 *
 * 另外扫一遍各包 `src`：任何 `dataOptions?: Array<{ … }>` 内联声明都判红。
 * 契约要变时，改 Zod + JSON Schema + core 类型，其余各处跟着**引用**它，同一批
 * 提交里更新本文件的 EXPECTED 常量（那是刻意的评审时刻，不是负担）。
 *
 * 用法：node scripts/check-option-shape.mjs
 * 退出码：0 = 七处逐键一致；1 = 至少一处分叉。
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'
import { normalizeEol } from './lib/text-sync.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => normalizeEol(readFileSync(join(ROOT, p), 'utf8'))

/**
 * 契约的逐键期望 —— 有意硬编码。
 *
 * 从 Zod 动态推导「期望」会让「把某个键从所有地方一起删掉」静默通过；而
 * 「少一个键」恰恰是最想抓的分叉。改契约就必须同批改这里。
 */
const EXPECTED_REQUIRED = ['label', 'value']
const EXPECTED_OPTIONAL = ['disabled', 'children', 'tagType']

let failed = false
const ok = (msg) => console.log(`✅ ${msg}`)
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}

/** 取 `startMarker` 之后、第一个满足 `endRegex` 的行之前的内容。 */
function sliceBetween(src, startMarker, endRegex, label) {
  const i = src.indexOf(startMarker)
  if (i === -1) {
    fail(`${label}：未定位到 ${JSON.stringify(startMarker)}（选择器失效，请检查脚本）`)
    return null
  }
  const rest = src.slice(i + startMarker.length)
  const re = new RegExp(endRegex, 'm')
  const m = re.exec(rest)
  if (!m) {
    fail(`${label}：未定位到块结束（${endRegex}）`)
    return null
  }
  return rest.slice(0, m.index)
}

/**
 * 解析一级属性：`indent` 个空格缩进的 `key?:` 行开启一个片段，
 * 后续更深缩进的行并入该片段（用于判断 `.optional()` / `?`）。
 */
function propsOf(body, indent, label) {
  const re = new RegExp(`^ {${indent}}([A-Za-z_$][\\w$]*)\\??:`)
  const out = new Map()
  let current = null
  for (const line of body.split('\n')) {
    const trimmed = line.trim()
    const m = re.exec(line)
    if (m) {
      current = m[1]
      out.set(current, line)
    } else if (!trimmed) {
      current = null
    } else if (current && !/^(\/\*|\*|\/\/)/.test(trimmed) && !/^ {0,3}[})]/.test(line)) {
      // 注释行不算属性体（注释里出现 `?` / `.optional()` 会造成假判）
      out.set(current, out.get(current) + '\n' + line)
    }
  }
  return out
}

/** 逐键对账：缺键 / 多键 / 必填可选写反。 */
function checkKeySet(label, props, { requiredKeys = EXPECTED_REQUIRED, optionalKeys = EXPECTED_OPTIONAL } = {}) {
  const got = [...props.keys()]
  const want = [...requiredKeys, ...optionalKeys]
  const missing = want.filter((k) => !got.includes(k))
  const extra = got.filter((k) => !want.includes(k))
  if (missing.length) fail(`${label}：缺键 ${missing.join(', ')}`)
  if (extra.length) fail(`${label}：多出未登记键 ${extra.join(', ')}`)
  for (const k of requiredKeys) {
    const seg = props.get(k)
    if (seg && (seg.includes('?') || seg.includes('.optional()'))) fail(`${label}：${k} 必须必填（不得为可选）`)
  }
  for (const k of optionalKeys) {
    const seg = props.get(k)
    if (seg && !(seg.includes('?') || seg.includes('.optional()'))) fail(`${label}：${k} 必须可选`)
  }
}

/** 取 `export interface Name {` … `}` 的块体。 */
function interfaceBody(src, name, label) {
  return sliceBetween(src, `export interface ${name} {`, '^}', label)
}

/** 某个接口里的 `dataOptions?:` 必须引用权威类型，不得是内联字面量。 */
function expectRef(file, src, iface, expectedType = 'FormDataOption[]') {
  const body = interfaceBody(src, iface, `${file} · ${iface}`)
  if (body === null) return
  const m = body.match(/^ {2}dataOptions\?: (.+)$/m)
  if (!m) {
    fail(`${file} · ${iface}：没有 dataOptions 声明（如果契约搬家了，请同步本守卫）`)
    return
  }
  const type = m[1].trim()
  if (type !== expectedType) {
    fail(`${file} · ${iface}.dataOptions 必须是 ${expectedType}（实得 ${type}）`)
  }
}

// ── 1. 前门 Zod：契约源 ─────────────────────────────────────────
{
  const file = 'packages/shared/src/structured-config.schema.ts'
  const src = read(file)
  const block = sliceBetween(
    src,
    'const DataOptionSchema: z.ZodType<any> = z.lazy(() =>',
    '^\\s*\\)$',
    file
  )
  if (block !== null) {
    checkKeySet(`${file} · DataOptionSchema`, propsOf(block, 4, file))
    ok('前门 Zod（DataOptionSchema）与契约一致')
  }
}

// ── 2. 发布给宿主的 JSON Schema ─────────────────────────────────
{
  const file = 'packages/shared/schemas/form-item.schema.json'
  const schema = JSON.parse(read(file))
  const items = schema?.properties?.dataOptions?.items
  if (!items) {
    fail(`${file}：找不到 properties.dataOptions.items`)
  } else {
    const got = Object.keys(items.properties ?? {})
    const want = [...EXPECTED_REQUIRED, ...EXPECTED_OPTIONAL]
    const missing = want.filter((k) => !got.includes(k))
    const extra = got.filter((k) => !want.includes(k))
    if (missing.length) fail(`${file}：dataOptions.items 缺键 ${missing.join(', ')}`)
    if (extra.length) fail(`${file}：dataOptions.items 多出未登记键 ${extra.join(', ')}`)
    const required = [...(items.required ?? [])].sort()
    if (JSON.stringify(required) !== JSON.stringify([...EXPECTED_REQUIRED].sort())) {
      fail(`${file}：items.required 必须是 ${JSON.stringify(EXPECTED_REQUIRED)}（实得 ${JSON.stringify(items.required ?? [])}）`)
    }
    ok('JSON Schema（form-item.schema.json）与契约一致')
  }
}

// ── 3. core：权威 TS 类型 ──────────────────────────────────────
{
  const file = 'packages/core/src/types.ts'
  const src = read(file)
  const body = interfaceBody(src, 'FormDataOption', `${file} · FormDataOption`)
  if (body !== null) {
    checkKeySet(`${file} · FormDataOption`, propsOf(body, 2, file))
    ok('core FormDataOption 与契约一致')
  }
  expectRef(file, src, 'FormItemOption')
  expectRef(file, src, 'FieldReactionFulfill')
}

// ── 4. 三端渲染器的框架特化副本 ────────────────────────────────
for (const [file, pkg] of [
  ['packages/vue3/src/types/index.ts', '@es-plus/core'],
  ['packages/adapter-antdv/src/types/index.ts', '@es-plus/core'],
]) {
  const src = read(file)
  if (!/import type \{[^}]*\bFormDataOption\b[^}]*\} from '@es-plus\/core'/.test(src)) {
    fail(`${file}：必须从 ${pkg} 引入 FormDataOption（不得再本地重写形状）`)
  }
  expectRef(file, src, 'FormItemOption')
  expectRef(file, src, 'FieldReactionFulfill')
}

// ── 5. MCP 的类型文档（模型读的 TS） ───────────────────────────
{
  const file = 'packages/mcp-server/src/resources/types.ts'
  const src = read(file)
  const body = interfaceBody(src, 'FormDataOption', `${file} · FormDataOption`)
  if (body !== null) {
    checkKeySet(`${file} · FormDataOption`, propsOf(body, 2, file))
    ok('MCP resources/types.ts 与契约一致')
  }
  expectRef(file, src, 'FormItemOption')
  expectRef(file, src, 'FieldReactionFulfill')
}

/** 从一行 `Array<{ a: T, b?: U }>` 文案里取键名（括号外的解释文字不算）。 */
function keysInLiteral(line) {
  const m = line.match(/Array<\s*\{([\s\S]*?)\}/)
  if (!m) return null
  const keys = []
  for (const part of m[1].split(/[;,]/)) {
    const k = part.trim().match(/^([A-Za-z_$][\w$]*)\??:/)
    if (k) keys.push(k[1])
  }
  return keys
}

/** 文案里的键集必须与契约**全等**（解释文字里提到某个词不算教了模型这个键）。 */
function checkLiteralLine(file, line, what) {
  const keys = keysInLiteral(line)
  if (!keys) {
    fail(`${file}：${what} 不是 \`Array<{ … }>\` 形态，无法对账`)
    return
  }
  const want = [...EXPECTED_REQUIRED, ...EXPECTED_OPTIONAL]
  const missing = want.filter((k) => !keys.includes(k))
  const extra = keys.filter((k) => !want.includes(k))
  if (missing.length) fail(`${file}：${what} 缺 ${missing.join(', ')}（模型看不到这些键就不会用）`)
  if (extra.length) fail(`${file}：${what} 多出未登记键 ${extra.join(', ')}`)
  if (!missing.length && !extra.length) ok(`${what} 与契约一致`)
}

// ── 6. MCP 的自然语言文档（模型读的 prompt / API 文案） ─────────
{
  const file = 'packages/mcp-server/src/tools/get-component-api.ts'
  const src = read(file)
  const line = src.split('\n').find((l) => /dataOptions\?:/.test(l))
  if (!line) fail(`${file}：找不到 dataOptions 的声明文案`)
  else checkLiteralLine(file, line, 'get-component-api 文案')
}
{
  const file = 'packages/mcp-server/src/prompts/form-config.ts'
  const src = read(file)
  const line = src.split('\n').find((l) => /^- dataOptions:/.test(l))
  if (!line) fail(`${file}：找不到 dataOptions 的 prompt 条目`)
  else checkLiteralLine(file, line, 'form-config prompt')
}

// ── 7. 内联字面量清扫：漂移的来源就是「再写一份」 ───────────────
{
  const walk = (dir) => {
    const out = []
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === 'build' || entry === 'dist' || entry === '__tests__') continue
      const p = join(dir, entry)
      const st = statSync(p)
      if (st.isDirectory()) out.push(...walk(p))
      else if (/\.(ts|tsx)$/.test(entry)) out.push(p)
    }
    return out
  }
  const packagesDir = join(ROOT, 'packages')
  // 这个文件里的 `dataOptions?: Array<{…}>` 是**发射给模型的文档字符串**（模板字面量），
  // 不是 TS 类型声明 —— 它在第 6 步已按逐键文案单独校验。
  const DOC_TEMPLATE_FILES = new Set(['packages/mcp-server/src/tools/get-component-api.ts'])
  const offenders = []
  for (const pkg of readdirSync(packagesDir)) {
    const srcDir = join(packagesDir, pkg, 'src')
    if (!existsSync(srcDir)) continue
    for (const file of walk(srcDir)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/')
      if (DOC_TEMPLATE_FILES.has(rel)) continue
      const text = normalizeEol(readFileSync(file, 'utf8'))
      text.split('\n').forEach((line, i) => {
        if (/dataOptions\?: Array<\s*\{/.test(line)) {
          offenders.push(`${rel}:${i + 1}`)
        }
      })
    }
  }
  if (offenders.length) {
    fail(`仍有内联的 dataOptions 字面量声明（应引用 FormDataOption）：\n    ${offenders.join('\n    ')}`)
  } else {
    ok('packages/*/src 无内联 dataOptions 字面量声明')
  }
}

// ── 8. bundled/*.d.ts 必须是源码的新鲜副本 ──────────────────────
//
// 发布物里带的是这份副本；它过期时，模型读到的是**旧契约**，而源码全绿。
// 生成器：packages/mcp-server/scripts/bundle-types.mjs（prebuild 自动跑）。
{
  const dir = join(ROOT, 'packages/mcp-server/bundled')
  const HEADER_RE = /^\/\/ Auto-generated from (.+)\n\/\/ Do not edit manually — run "npm run bundle-types" to update\n\n/
  let checked = 0
  if (!existsSync(dir)) {
    fail('packages/mcp-server/bundled 不存在（bundle-types 产物缺失）')
  } else {
    for (const name of readdirSync(dir).filter((f) => f.endsWith('.d.ts'))) {
      const dest = join(dir, name)
      const text = normalizeEol(readFileSync(dest, 'utf8'))
      const m = HEADER_RE.exec(text)
      if (!m) {
        fail(`bundled/${name}：缺少 bundle-types 头部（被手改过？）`)
        continue
      }
      const srcPath = join(ROOT, 'packages', m[1].trim())
      if (!existsSync(srcPath)) {
        fail(`bundled/${name}：头部指向的源文件不存在（${m[1].trim()}）`)
        continue
      }
      const src = normalizeEol(readFileSync(srcPath, 'utf8'))
      const expected = text.slice(0, m[0].length) + src
      if (expected !== text) {
        fail(`bundled/${name} 已过期（源：${m[1].trim()}）—— 跑 npm run bundle-types -w @es-plus/mcp-server 更新`)
      } else {
        checked++
      }
    }
    if (checked) ok(`bundled/*.d.ts 均为源码的新鲜副本（${checked} 个）`)
  }
}

if (failed) {
  console.error('\n[check-option-shape] 选项契约分叉 —— 前门放行 ≠ 类型/文档放行，模型会照发布出去的形状写。')
  process.exit(1)
}
console.log('[check-option-shape] 选项契约七处逐键一致 ✔')
