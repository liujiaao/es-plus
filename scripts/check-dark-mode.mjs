#!/usr/bin/env node
/**
 * 深色模式口径检查（路线图 1.5：补全或**明确关闭**）。
 *
 * 审计 P1-6 的结论是「深色不是有/没有，而是有的站半坏、有的站没有」：
 *   - 主站有开关，但主题类在 onMounted 才挂 → 首屏闪白；
 *   - 另两站 token 里有 `.dark` 块，却没有任何代码挂这个类 → 深色是死配置。
 *
 * 于是把口径定成两种，且必须**显式**落到代码里，本脚本逐条断言：
 *   A. 支持深色的站（es-plus-docs）：
 *      1. index.html 里有首屏内联脚本，且在模块脚本之前（否则先渲染一帧白再刷黑）；
 *      2. 脚本判定规则与 stores/theme.ts 一致（localStorage 'theme' 优先，否则跟随系统）；
 *      3. 主题类名是 `dark`（Element Plus / ant-design-vue / vxe 的约定键），
 *         且同时设置 color-scheme，否则滚动条/表单控件仍是亮色。
 *   B. 明确 light-only 的站（es-pc / es-eui）：
 *      1. index.html 声明 `color-scheme: light`（不声明的话，系统深色时浏览器会把
 *         原生控件按深色渲染，嵌在浅色页面里更难看）；
 *      2. 源码里没有挂 `.dark` 的任何代码 —— 有就是不完整深色，比没有更糟。
 *   C. token 单源：`.dark` 块必须覆盖页面真正依赖的那批颜色名。只断言「有 .dark 块」
 *      是不够的：块里少一个 --es-border-tint，页面上就是一处亮色残留。
 *
 * 用法：node scripts/check-dark-mode.mjs
 * 退出码：0 = 口径一致；1 = 有缺口。
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const DARK_SITE = {
  label: 'es-plus-docs',
  html: 'es-plus-docs/index.html',
  store: 'es-plus-docs/src/stores/theme.ts',
}
const LIGHT_SITES = [
  { label: 'es-pc', html: 'es-pc/index.html', srcDirs: ['es-pc/src'] },
  { label: 'es-eui', html: 'es-eui/public/index.html', srcDirs: ['es-eui/src'] },
]

/** 页面实际依赖的暗色 token：少一个就是一处「深色下的亮块」 */
const REQUIRED_DARK = [
  '--es-text-primary', '--es-text-regular', '--es-text-secondary', '--es-text-tertiary',
  '--es-border', '--es-border-light', '--es-border-lighter',
  '--es-bg', '--es-bg-page', '--es-bg-subtle', '--es-fill', '--es-fill-light',
  '--es-code-bg', '--es-link', '--es-brand-tint',
  '--es-success-tint', '--es-warning-tint', '--es-danger-tint', '--es-info-tint',
  '--es-shadow-sm', '--es-shadow-md', '--es-focus-ring',
]

let failed = false
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}
const read = (rel) => {
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) {
    fail(`文件缺失：${rel}`)
    return null
  }
  return readFileSync(abs, 'utf8').replace(/\r\n?/g, '\n')
}

/* ── A. 支持深色的站 ────────────────────────────────────────────── */
{
  const html = read(DARK_SITE.html)
  if (html) {
    const bootstrapAt = html.indexOf("localStorage.getItem('theme')")
    const moduleAt = html.indexOf('<script type="module"')
    if (bootstrapAt < 0) {
      fail(`${DARK_SITE.html} 没有首屏深色脚本 —— 用户开着深色打开任何一页都会先闪一帧白`)
    } else if (moduleAt >= 0 && bootstrapAt > moduleAt) {
      fail(`${DARK_SITE.html} 的首屏深色脚本排在模块脚本之后，起不到防闪作用`)
    }
    if (bootstrapAt >= 0 && !html.includes("classList.toggle('dark'")) {
      fail(`${DARK_SITE.html} 的首屏脚本没有挂 \`dark\` 类（三站约定键）`)
    }
    if (bootstrapAt >= 0 && !html.includes('colorScheme')) {
      fail(`${DARK_SITE.html} 的首屏脚本没有同步 color-scheme —— 滚动条/表单控件会留在亮色`)
    }
    if (bootstrapAt >= 0 && !html.includes("setAttribute('data-vxe-ui-theme'")) {
      fail(
        `${DARK_SITE.html} 的首屏脚本没有设 data-vxe-ui-theme —— vxe-table 4.x 的暗色变量整块` +
          '挂在 [data-vxe-ui-theme="dark"] 上，不认 `dark` 类，深色页面里的 vxe 表格仍是一整块白',
      )
    }
  }

  const store = read(DARK_SITE.store)
  if (store) {
    if (!store.includes("classList.toggle('dark'")) {
      fail(`${DARK_SITE.store} 没有挂 \`dark\` 类（与首屏脚本的约定键不一致）`)
    }
    if (!store.includes('colorScheme')) {
      fail(`${DARK_SITE.store} 切换主题时没有同步 color-scheme`)
    }
    if (!store.includes("setAttribute('data-vxe-ui-theme'")) {
      fail(`${DARK_SITE.store} 切换主题时没有同步 data-vxe-ui-theme（vxe-table 的暗色键）`)
    }
    // 规则一致：localStorage 'theme' 优先，否则跟随系统
    if (!store.includes("localStorage.getItem('theme')") || !store.includes('prefers-color-scheme: dark')) {
      fail(`${DARK_SITE.store} 的判定规则与首屏脚本不一致（应为 localStorage 'theme' 优先，否则跟随系统）`)
    }
  }
}

/* ── B. 明确 light-only 的站 ───────────────────────────────────── */
for (const site of LIGHT_SITES) {
  const html = read(site.html)
  if (html && !/name="color-scheme"\s+content="light"/.test(html)) {
    fail(`${site.html} 没有声明 color-scheme: light —— 系统深色时原生控件会被浏览器按深色渲染`)
  }
}

// 「没有挂 .dark 的代码」：扫源码里是否出现给元素加 dark 类的写法
{
  const { readdirSync, statSync } = await import('node:fs')
  const walk = (dir, out = []) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === 'dist') continue
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p, out)
      else if (/\.(js|ts|vue)$/.test(name)) out.push(p)
    }
    return out
  }
  for (const site of LIGHT_SITES) {
    for (const rel of site.srcDirs) {
      const dir = join(ROOT, rel)
      if (!existsSync(dir)) continue
      for (const file of walk(dir)) {
        // 代码示例里当然会出现 `classList.toggle('dark')`（主题页就在教这件事），
        // 那不是「本站挂了深色」，先剥掉 <pre> 与注释再判。
        const text = readFileSync(file, 'utf8')
          .replace(/<pre[\s\S]*?<\/pre>/g, '')
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/^\s*\/\/.*$/gm, '')
        if (/classList\.(add|toggle)\(\s*['"]dark['"]/.test(text)) {
          fail(`${file.replace(ROOT, '').replace(/\\/g, '/')} 会给元素挂 \`dark\` 类，但本站声明为 light-only`)
        }
      }
    }
  }
}

/* ── C. token 单源的深色覆盖 ───────────────────────────────────── */
{
  const css = read('docs/tokens/design-tokens.css')
  if (css) {
    // 取所有 `.dark {` 块（含 :root.dark）里声明的名字
    const declared = new Set()
    for (const m of css.matchAll(/(?:^|\n)\s*:?root\.dark[^{]*\{([\s\S]*?)\n\s*\}/g)) {
      for (const d of m[1].matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)) declared.add(d[1])
    }
    for (const m of css.matchAll(/(?:^|\n)\.dark\s*\{([\s\S]*?)\n\s*\}/g)) {
      for (const d of m[1].matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)) declared.add(d[1])
    }
    const missing = REQUIRED_DARK.filter((name) => !declared.has(name))
    if (missing.length) {
      fail(`docs/tokens/design-tokens.css 的 .dark 块缺少：${missing.join(', ')}`)
    }
  }
}

if (failed) {
  console.error('\n深色模式口径不一致。')
  process.exit(1)
}
console.log('✅ 深色口径一致：es-plus-docs 支持深色（首屏不闪），es-pc / es-eui 明确 light-only')
