#!/usr/bin/env node
/**
 * 内置文案单源守卫（W3-1）。
 *
 * 判据只有一条：**字典里的中文值不得再以字面量出现在运行时代码里**。
 *
 * 为什么需要它：W3-1 之前，「新增 / 暂无数据 / 操作 / 确定删除该条数据吗？」这类
 * 框架自有文案在三个渲染器里各写一份（约 60 处、15 个文件）。改一句措辞要改 3 个包、
 * 漏改一处不会有任何测试变红 —— 英文宿主就会拿到半中半英的界面。把文案收进
 * `packages/core/src/locale.ts` 只是第一步；**没有守卫，第二天就会有人再写一遍字面量**。
 *
 * 扫描口径：
 *   1. 只扫 `packages/{core,vue3,vue2,adapter-antdv}/src/**` 的 .ts / .vue；
 *   2. 先剥注释（`/* *\/`、`<!-- -->`、行首 `//`），注释里引用文案不算违约；
 *   3. 只匹配单/双引号字符串字面量，按**整串相等**比较（`'操作列'` 不算 `'操作'`）；
 *   4. `packages/core/src/constants.ts` 是**注册过的例外**：`DEFAULT_TOOLBAR_BTNS` /
 *      `DEFAULT_ROW_BTNS` 是兼容导出，必须保持静态 zh 值（见 locale.ts 的 getter 注释）。
 *
 * 同时校验字典自身：类型联合、zh 字典、en 字典三者的键集必须完全一致 —— 漏一个键
 * 会得到 `undefined` 文案（静默比缺失更糟：界面显示空按钮）。
 *
 * 用法：node scripts/check-i18n-literals.mjs
 * 退出码：0 = 无违例；1 = 有。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const LOCALE_SRC = 'packages/core/src/locale.ts'

const SRC_DIRS = [
  'packages/core/src',
  'packages/vue3/src',
  'packages/vue2/src',
  'packages/adapter-antdv/src',
]

/** 注册的例外：文件 → 原因。新增例外必须在 PR 里说明「为什么不能走 locale」。 */
const FILE_ALLOWLIST = new Map([
  [
    'packages/core/src/constants.ts',
    'DEFAULT_TOOLBAR_BTNS / DEFAULT_ROW_BTNS 是兼容导出：模块加载时求值、且与 shared/contract.ts 的静态副本逐值比对（check:schema-contract）——不能改成 locale 函数',
  ],
])

const read = (p) => readFileSync(join(ROOT, p), 'utf8')

// ── 1. 解析字典 ─────────────────────────────────────────────
const localeSrc = read(LOCALE_SRC)

function fail(msg) {
  console.error(`  ✗ ${msg}`)
  process.exitCode = 1
}

const typeBlock = localeSrc.match(/export type BuiltinTextKey\s*=([\s\S]*?)\n\n/)
const keysFromType = typeBlock
  ? [...typeBlock[1].matchAll(/'([A-Za-z0-9_]+)'/g)].map((m) => m[1])
  : []
if (!keysFromType.length) {
  fail('无法从 locale.ts 解析 BuiltinTextKey 联合类型（结构变了？请同步本守卫）')
}

function parseDict(name) {
  const m = localeSrc.match(
    new RegExp(`export const ${name}: Record<BuiltinTextKey, string> = \\{([\\s\\S]*?)\\n\\}`)
  )
  if (!m) return null
  const out = new Map()
  for (const line of m[1].split('\n')) {
    const mm = line.match(/^\s*([A-Za-z0-9_]+):\s*'((?:[^'\\]|\\.)*)',?\s*$/)
    if (mm) out.set(mm[1], mm[2].replace(/\\(.)/g, '$1'))
  }
  return out
}

const zh = parseDict('ZH_CN_MESSAGES')
const en = parseDict('EN_US_MESSAGES')
if (!zh) fail('无法解析 ZH_CN_MESSAGES')
if (!en) fail('无法解析 EN_US_MESSAGES')

if (zh && en) {
  const keySet = new Set(keysFromType)
  const zhKeys = new Set(zh.keys())
  const enKeys = new Set(en.keys())
  const sameSet = (a, b) => a.size === b.size && [...a].every((k) => b.has(k))
  if (!sameSet(keySet, zhKeys)) {
    fail(
      `BuiltinTextKey 与 ZH_CN_MESSAGES 键集不一致：` +
        `类型多出 [${[...keySet].filter((k) => !zhKeys.has(k)).join(', ')}] / 字典多出 [${[...zhKeys].filter((k) => !keySet.has(k)).join(', ')}]`
    )
  }
  if (!sameSet(keySet, enKeys)) {
    fail(
      `BuiltinTextKey 与 EN_US_MESSAGES 键集不一致：` +
        `类型多出 [${[...keySet].filter((k) => !enKeys.has(k)).join(', ')}] / 字典多出 [${[...enKeys].filter((k) => !keySet.has(k)).join(', ')}]`
    )
  }
  for (const [k, v] of zh) if (!v.trim()) fail(`ZH_CN_MESSAGES.${k} 为空串`)
  for (const [k, v] of en) if (!v.trim()) fail(`EN_US_MESSAGES.${k} 为空串`)
}

// ── 2. 收集源码文件 ─────────────────────────────────────────
function walk(dir, out = []) {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`
    const st = statSync(join(ROOT, rel))
    if (st.isDirectory()) walk(rel, out)
    else if (/\.(ts|vue)$/.test(name) && !/\.spec\.ts$/.test(name)) out.push(rel)
  }
  return out
}

/** 剥掉注释（保留字符串内容：只处理注释边界，不做完整词法分析）。 */
function stripComments(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

/** 抽出单/双引号字符串字面量的内容（整串）。 */
function stringLiterals(code) {
  const out = []
  const re = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g
  let m
  while ((m = re.exec(code))) out.push(m[1] ?? m[2] ?? '')
  return out
}

const zhValues = zh ? new Map([...zh].map(([k, v]) => [v, k])) : new Map()

const violations = []
let scanned = 0
let matchedLiterals = 0

for (const dir of SRC_DIRS) {
  for (const rel of walk(dir)) {
    if (rel === LOCALE_SRC) continue
    if (FILE_ALLOWLIST.has(rel)) continue
    scanned++
    const code = stripComments(read(rel))
    for (const lit of stringLiterals(code)) {
      matchedLiterals++
      const key = zhValues.get(lit)
      if (key) violations.push({ file: rel, key, lit })
    }
  }
}

if (violations.length) {
  console.error(`[check:i18n-literals] ${violations.length} 处字面量绕过了 locale 单源：`)
  for (const v of violations) {
    console.error(`  ✗ ${v.file} — '${v.lit}' → 请改用 resolveBuiltinText('${v.key}')`)
  }
  process.exitCode = 1
} else {
  console.log(
    `[check:i18n-literals] 扫 ${scanned} 个运行时文件 / ${matchedLiterals} 个字符串字面量：` +
      `字典里的 ${zhValues.size} 个中文值零裸用` +
      (FILE_ALLOWLIST.size ? `（${FILE_ALLOWLIST.size} 个注册例外）` : '') +
      ' ✔'
  )
}

// ── 3. 非空证明：判据必须真的咬得住 ─────────────────────────
{
  const probe = stringLiterals("const x = '暂无数据'")
  const bites = probe.some((lit) => zhValues.has(lit))
  if (!bites) fail('非空证明：合成样本里的「暂无数据」未被判红 —— 匹配规则失效')
  else console.log('  ✅ 非空证明：合成样本 `const x = \'暂无数据\'` 被判定违例')

  // 整串相等而非子串：'操作列' 不应误报
  const near = stringLiterals("const x = '操作列'")
  if (near.some((lit) => zhValues.has(lit))) fail("非空证明：'操作列' 被误判为 '操作'（应整串相等）")
  else console.log("  ✅ 非空证明：'操作列' 不误报（整串相等）")
}

if (process.exitCode) {
  console.error('\n内置文案单源守卫失败。修法：把字面量换成 resolveBuiltinText(key)，' +
    '或在 locale.ts 增键（zh/en 同时填值）。')
} else {
  console.log('\n内置文案单源守卫通过：zh/en 键集一致，runtime 零裸用。')
}
