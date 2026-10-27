#!/usr/bin/env node
/**
 * 可访问性基线守卫（路线图 1.7）。
 *
 * ## 为什么要守卫
 *
 * 可访问性是最容易「改一次就退回去」的一类约束：有人给某个按钮加 `outline: none`
 * 图好看，键盘用户就再也看不见焦点；改个文案颜色，对比度就掉到 4.5 以下 —— 这两个
 * 缺陷在截图里都看不出来，评审也看不出来。所以把四件事钉成断言：
 *
 *   A. **单源**：docs/theme/docs-a11y.css 与三站副本逐字节一致，且三站都 import 它。
 *   B. **接线**：三站外壳各自有 skip link（`a.es-skip-link` → `#es-main`），
 *      且落点真的挂在正文地标上（<main> / a-layout-content），带 tabindex="-1"。
 *   C. **样式契约**：skip link / :focus-visible / prefers-reduced-motion /
 *      .es-visually-hidden 四组规则存在。
 *   D. **对比度**：直接从 token 与 docs-content.css 解析出实际颜色值算 WCAG 比值，
 *      正文 ≥ 4.5、非文本（焦点环、按钮底）≥ 3。改色不改守卫 → 这里红。
 *   E. **不许留裸 `outline: none`**：站点里出现它，同文件必须有 `:focus-visible`
 *      补偿，否则键盘焦点在那一处彻底消失。
 *
 * 用法：node scripts/check-a11y.mjs
 * 退出码：0 = 通过；1 = 有断言失败。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readText, sameText } from './lib/text-sync.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

let failed = false
let passed = 0
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}
const ok = (msg) => {
  passed += 1
  console.log(`✅ ${msg}`)
}
const rel = (abs) => abs.replace(ROOT + '\\', '').replace(ROOT + '/', '').replace(/\\/g, '/')

const A11Y_TARGETS = [
  ['es-plus-docs', 'src/styles/docs-a11y.css'],
  ['es-pc', 'src/styles/docs-a11y.css'],
  ['es-eui', 'src/assets/docs-a11y.css'],
]
const ENTRY = [
  ['es-plus-docs', 'src/main.ts', '@/styles/docs-a11y.css'],
  ['es-pc', 'src/main.js', './styles/docs-a11y.css'],
  ['es-eui', 'src/main.js', './assets/docs-a11y.css'],
]

// ── 颜色工具（WCAG 2.1 相对亮度 / 对比度）──────────────────────────────────
const parseColor = (raw) => {
  const s = String(raw).trim()
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split('').map((c) => c + c).join('') : hex[1]
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 }
  }
  const rgb = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i)
  if (rgb) {
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]), a: rgb[4] === undefined ? 1 : Number(rgb[4]) }
  }
  return null
}

/** 半透明前景压在实底上的实际颜色（提示框、行内代码底都是 rgba 浅色）。 */
const composite = (fg, bg) => ({
  r: fg.r * fg.a + bg.r * (1 - fg.a),
  g: fg.g * fg.a + bg.g * (1 - fg.a),
  b: fg.b * fg.a + bg.b * (1 - fg.a),
  a: 1,
})

const channel = (c) => {
  const v = c / 255
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
const luminance = (c) => 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b)
const ratio = (a, b) => {
  const x = luminance(a)
  const y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

// ── 从 CSS 里取变量（不引第三方解析器：都是自家「--x: value;」的扁平写法）──────
const collectVars = (css, selectorPattern, into) => {
  const re = new RegExp(`(^|\\n)${selectorPattern}\\s*\\{([\\s\\S]*?)\\n\\}`, 'g')
  let m
  while ((m = re.exec(css)) !== null) {
    for (const decl of m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) into.set(decl[1], decl[2].trim())
  }
  return into
}

const tokenCss = readText(join(ROOT, 'docs/tokens/design-tokens.css'))
const contentCss = readText(join(ROOT, 'docs/theme/docs-content.css'))

const lightVars = new Map()
collectVars(tokenCss, ':root', lightVars)
collectVars(contentCss, ':root', lightVars)

const darkVars = new Map(lightVars)
collectVars(tokenCss, ':root\\.dark', darkVars)
collectVars(tokenCss, '\\.dark', darkVars)
collectVars(contentCss, '\\.dark', darkVars)

/** 解析 `var(--x)` / `var(--x, #fff)` 链。 */
const resolve = (vars, name, depth = 0) => {
  if (depth > 8) return null
  const raw = vars.get(name)
  if (!raw) return null
  const ref = raw.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/)
  if (!ref) return raw
  return resolve(vars, ref[1], depth + 1) ?? ref[2] ?? null
}

const color = (vars, name) => {
  const raw = resolve(vars, name)
  return raw ? parseColor(raw) : null
}

/** 取一个「底色」变量，遇到 rgba 自动压到 #fff / #141414 上。 */
const bg = (vars, name, base) => {
  const fg = color(vars, name)
  if (!fg) return null
  return fg.a < 1 ? composite(fg, base) : fg
}

const assertContrast = (label, fg, back, min) => {
  if (!fg || !back) {
    fail(`对比度：${label} 的颜色解析不出来（变量缺失或写法变了）`)
    return
  }
  const r = ratio(fg, back)
  if (r < min) fail(`对比度：${label} 只有 ${r.toFixed(2)}:1，低于 ${min}:1`)
}

// ── A. 单源 ────────────────────────────────────────────────────────────────
function checkSingleSource() {
  const source = join(ROOT, 'docs', 'theme', 'docs-a11y.css')
  if (!existsSync(source)) {
    fail('单源缺失：docs/theme/docs-a11y.css')
    return
  }
  const src = readText(source)
  for (const [site, relPath] of A11Y_TARGETS) {
    const abs = join(ROOT, site, relPath)
    if (!existsSync(abs)) {
      fail(`站点副本缺失：${site}/${relPath}（运行 npm run theme:sync）`)
    } else if (!sameText(readFileSync(abs, 'utf8'), src)) {
      fail(`${site}/${relPath} 与单源不一致 —— 运行 npm run theme:sync，不要手改副本`)
    }
  }
  for (const [site, entry, spec] of ENTRY) {
    const text = readText(join(ROOT, site, entry))
    if (!text.includes(`'${spec}'`)) fail(`${site}/${entry} 没有 import ${spec}（基线样式不会生效）`)
  }
  if (!failed) ok(`单源 + ${A11Y_TARGETS.length} 份副本一致，三站均已 import`)
}

// ── B. skip link 接线 ──────────────────────────────────────────────────────
const SHELLS = [
  { file: 'es-plus-docs/src/App.vue', main: 'es-plus-docs/src/components/layout/AppContent.vue', landmark: '<main' },
  { file: 'es-pc/src/layouts/DocLayout.vue', main: 'es-pc/src/layouts/DocLayout.vue', landmark: '<a-layout-content' },
  { file: 'es-eui/src/App.vue', main: 'es-eui/src/App.vue', landmark: '<main' },
]

function checkSkipLink() {
  for (const { file, main, landmark } of SHELLS) {
    const shell = readText(join(ROOT, file))
    if (!/class="es-skip-link"[^>]*href="#es-main"|href="#es-main"[^>]*class="es-skip-link"/.test(shell)) {
      fail(`${file}：缺少 skip link（<a class="es-skip-link" href="#es-main">）`)
    }
    const mainText = readText(join(ROOT, main))
    const target = new RegExp(`${landmark}[^>]*id="es-main"[^>]*tabindex="-1"|${landmark}[^>]*tabindex="-1"[^>]*id="es-main"`)
    if (!target.test(mainText)) {
      fail(`${main}：落点不对 —— 需要 ${landmark} … id="es-main" tabindex="-1"`)
    }
    // 只写 href 是不够的：hash 路由会把 #es-main 当成路径，必须拦下默认行为
    if (!/bindSkipLink\s*\(/.test(shell)) {
      fail(`${file}：没有调用 bindSkipLink() —— hash 路由下点它会跳到 #/es-main（404）`)
    }
  }
  if (!failed) ok('接线：三站 skip link → #es-main，落点均为正文地标且可接焦点')
}

// ── C. 样式契约 ────────────────────────────────────────────────────────────
function checkStyleContract() {
  const css = readText(join(ROOT, 'docs', 'theme', 'docs-a11y.css'))
  const required = [
    ['.es-skip-link {', 'skip link'],
    [':focus-visible {', '键盘焦点环'],
    ['prefers-reduced-motion: reduce', '减少动效'],
    ['.es-visually-hidden {', '只给读屏的文本'],
  ]
  for (const [needle, label] of required) {
    if (!css.includes(needle)) fail(`样式契约：docs-a11y.css 缺少${label}`)
  }
  // skip link 默认必须移出视口：display:none 会把它从 Tab 序列里摘掉
  if (/\.es-skip-link\s*\{[^}]*display:\s*none/.test(css)) {
    fail('样式契约：.es-skip-link 不能用 display:none（键盘就再也拿不到它）')
  }
  if (!failed) ok('样式契约：skip link / 焦点环 / 减少动效 / 读屏工具类')
}

// ── D. 对比度 ──────────────────────────────────────────────────────────────
function checkContrast() {
  const WHITE = parseColor('#ffffff')
  const PAGE_LIGHT = bg(lightVars, '--es-bg-page', WHITE)
  const FILL_LIGHT = bg(lightVars, '--es-fill', WHITE)
  const CODE_TINT = bg(lightVars, '--es-doc-code-bg', WHITE)
  const DARK_BASE = parseColor('#141414')
  const DARK_BG = composite(parseColor('#1d1e1f'), DARK_BASE)

  // 正文层（docs-content.css）
  assertContrast('浅色 正文/白', color(lightVars, '--es-doc-text'), WHITE, 4.5)
  assertContrast('浅色 正文/页面底', color(lightVars, '--es-doc-text'), PAGE_LIGHT, 4.5)
  assertContrast('浅色 说明/白', color(lightVars, '--es-doc-text-secondary'), WHITE, 4.5)
  assertContrast('浅色 说明/页面底', color(lightVars, '--es-doc-text-secondary'), PAGE_LIGHT, 4.5)
  assertContrast('浅色 标题/白', color(lightVars, '--es-doc-heading'), WHITE, 4.5)
  assertContrast('浅色 链接/白', color(lightVars, '--es-link'), WHITE, 4.5)
  assertContrast('浅色 行内代码/浅底', color(lightVars, '--es-link'), CODE_TINT, 4.5)
  assertContrast('浅色 代码正文/代码底', color(lightVars, '--es-doc-code-block-text'), bg(lightVars, '--es-doc-code-block-bg', WHITE), 4.5)

  // 设计 token 层（三站外壳共用）
  assertContrast('浅色 text-regular/白', color(lightVars, '--es-text-regular'), WHITE, 4.5)
  assertContrast('浅色 text-secondary/白', color(lightVars, '--es-text-secondary'), WHITE, 4.5)
  assertContrast('浅色 text-secondary/页面底', color(lightVars, '--es-text-secondary'), PAGE_LIGHT, 4.5)
  assertContrast('浅色 text-secondary/填充底', color(lightVars, '--es-text-secondary'), FILL_LIGHT, 4.5)

  // 深色
  assertContrast('深色 正文/暗底', color(darkVars, '--es-doc-text'), DARK_BASE, 4.5)
  assertContrast('深色 说明/暗底', color(darkVars, '--es-doc-text-secondary'), DARK_BASE, 4.5)
  assertContrast('深色 标题/暗底', color(darkVars, '--es-doc-heading'), DARK_BASE, 4.5)
  assertContrast('深色 链接/暗底', color(darkVars, '--es-link'), DARK_BASE, 4.5)
  assertContrast('深色 正文/卡片底', color(darkVars, '--es-doc-text'), DARK_BG, 4.5)
  assertContrast('深色 text-secondary/暗底', color(darkVars, '--es-text-secondary'), DARK_BASE, 4.5)

  // 提示框标题：底色是 CSS 里的字面量，先确认它们还在，否则这条断言就失去意义
  const callouts = [
    ['tip', '#f0f9eb', '--es-doc-tip-text'],
    ['warning', '#fdf6ec', '--es-doc-warning-text'],
    ['info', '#ecf5ff', '--es-doc-info-text'],
    ['danger', '#fef0f0', '--es-doc-danger-text'],
  ]
  for (const [kind, background, token] of callouts) {
    if (!contentCss.includes(`background: ${background}`)) {
      fail(`对比度：${kind} 提示框底色已改（找不到 ${background}）—— 请同步更新本守卫的取值`)
      continue
    }
    assertContrast(`浅色 ${kind} 标题/提示框底`, color(lightVars, token), parseColor(background), 4.5)
  }

  // 非文本：焦点环要 ≥3:1（WCAG 2.2 SC 1.4.11）
  assertContrast('焦点环/白（非文本）', color(lightVars, '--es-link'), WHITE, 3)
  assertContrast('焦点环/页面底（非文本）', color(lightVars, '--es-link'), PAGE_LIGHT, 3)
  assertContrast('焦点环/暗底（非文本）', color(darkVars, '--es-link'), DARK_BASE, 3)

  // skip link 是白字压在实心深蓝上
  const a11yCss = readText(join(ROOT, 'docs', 'theme', 'docs-a11y.css'))
  const skipBg = a11yCss.match(/\.es-skip-link\s*\{[^}]*background:\s*(#[0-9a-f]{3,6})/i)
  if (!skipBg) fail('对比度：skip link 的底色不是字面色，无法校验')
  else assertContrast('skip link 白字/深蓝底', WHITE, parseColor(skipBg[1]), 4.5)

  if (!failed) ok(`对比度：${callouts.length + 21} 组配对全部达标（正文 4.5 / 非文本 3.0）`)
}

// ── E. 裸 outline:none ─────────────────────────────────────────────────────
function checkOutlineEscape() {
  const files = []
  const walk = (dir) => {
    let entries = []
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const abs = join(dir, entry.name)
      if (entry.isDirectory()) walk(abs)
      else if (/\.(vue|css|scss|js|ts)$/.test(entry.name)) files.push(abs)
    }
  }
  for (const site of ['es-plus-docs', 'es-pc', 'es-eui']) walk(join(ROOT, site, 'src'))

  for (const abs of files) {
    const text = readFileSync(abs, 'utf8')
    if (!/outline:\s*(none|0)\b/.test(text)) continue
    if (text.includes(':focus-visible')) continue
    fail(`${rel(abs)} 里有 outline: none 却没有 :focus-visible 补偿 —— 键盘焦点在这里会消失`)
  }
  if (!failed) ok(`键盘焦点：${files.length} 个源文件里没有裸 outline: none`)
}

// ── F. 键盘可达（站点自己的可交互件，不是组件库内部的）────────────────────
function checkKeyboard() {
  // 代码标签页：必须是 tablist + tab 按钮，不能是带 @click 的 div
  const playground = readText(join(ROOT, 'es-plus-docs/src/components/doc/CodePlayground.vue'))
  if (!playground.includes('role="tablist"')) fail('键盘可达：代码示例的标签页缺少 role="tablist"')
  if (!/<button[\s\S]{0,400}?role="tab"/.test(playground)) {
    fail('键盘可达：代码标签页不是 <button role="tab"> —— 键盘切不到 Script / Style')
  }
  if (!/ArrowLeft/.test(playground) || !/ArrowRight/.test(playground)) {
    fail('键盘可达：代码标签页没有左右方向键切换')
  }

  // 窄屏菜单开关：三个站都必须报告展开状态
  const toggles = [
    ['es-plus-docs/src/components/layout/AppHeader.vue', 'hamburger-btn'],
    ['es-pc/src/layouts/DocLayout.vue', 'nav-toggle'],
    ['es-eui/src/App.vue', 'nav-toggle'],
  ]
  for (const [file, cls] of toggles) {
    const text = readText(join(ROOT, file))
    const btn = text.match(new RegExp(`[\\s\\S]{0,600}?${cls}[\\s\\S]{0,600}?>`))
    if (!btn || !/aria-expanded/.test(btn[0])) {
      fail(`键盘可达：${file} 的窄屏菜单开关（.${cls}）缺少 aria-expanded`)
    }
  }

  if (!failed) ok('键盘可达：代码标签页为 tablist + 方向键；三站菜单开关均报 aria-expanded')
}

console.log('检查可访问性基线（路线图 1.7）…\n')
checkSingleSource()
checkSkipLink()
checkStyleContract()
checkContrast()
checkOutlineEscape()
checkKeyboard()

if (failed) {
  console.error('\n可访问性基线守卫失败')
  process.exit(1)
}
console.log(`\n✅ 可访问性基线守卫通过（${passed} 组断言）`)
