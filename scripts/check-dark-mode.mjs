#!/usr/bin/env node
/**
 * 深色模式口径检查（路线图 1.5：补全或**明确关闭**）。
 *
 * 审计 P1-6 的结论是「深色不是有/没有，而是有的站半坏、有的站没有」：
 *   - 主站有开关，但主题类在 onMounted 才挂 → 首屏闪白；
 *   - 另两站 token 里有 `.dark` 块，却没有任何代码挂这个类 → 深色是死配置。
 *
 * 于是把口径定成两种，且必须**显式**落到代码里，本脚本逐条断言：
 *   A. 支持深色的站（es-plus-docs / es-pc）：
 *      1. index.html 里有首屏内联脚本，且在模块脚本之前（否则先渲染一帧白再刷黑）；
 *      2. 脚本判定规则与 stores/theme 一致（localStorage 'theme' 优先，否则跟随系统）；
 *      3. 主题类名是 `dark`（Element Plus / ant-design-vue / vxe 的约定键），
 *         且同时设置 color-scheme，否则滚动条/表单控件仍是亮色；
 *      4. Ant Design Vue 端额外一条：组件颜色由 cssinjs 算法计算，只挂 `dark` 类是
 *         「外壳暗、a-* 组件全亮」，必须把 darkAlgorithm 传给 ConfigProvider；
 *         且必须真有一个切换入口（有 `.dark` 规则但没人能切 = 死配置，正是审计对
 *         旧版的判词）。
 *   B. 明确 light-only 的站（es-eui）：
 *      1. index.html 声明 `color-scheme: light`（不声明的话，系统深色时浏览器会把
 *         原生控件按深色渲染，嵌在浅色页面里更难看）；
 *      2. 源码里没有挂 `.dark` 的任何代码 —— 有就是不完整深色，比没有更糟。
 *        （es-eui 是 Vue2 + Element UI 2：主题在 SCSS 编译期确定，没有运行时暗色，
 *         要做只能整站换主题包 + 两套产物。这是它保持 light-only 的技术原因，
 *         不是漏做。）
 *   C. token 单源：`.dark` 块必须覆盖页面真正依赖的那批颜色名。只断言「有 .dark 块」
 *      是不够的：块里少一个 --es-border-tint，页面上就是一处亮色残留。
 *
 * 用法：node scripts/check-dark-mode.mjs
 * 退出码：0 = 口径一致；1 = 有缺口。
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const DARK_SITES = [
  {
    label: 'es-plus-docs',
    html: 'es-plus-docs/index.html',
    store: 'es-plus-docs/src/stores/theme.ts',
    srcDir: 'es-plus-docs/src',
  },
  {
    label: 'es-pc',
    html: 'es-pc/index.html',
    store: 'es-pc/src/stores/theme.js',
    srcDir: 'es-pc/src',
    // ADv 4 暗色不是 CSS 类：组件颜色由 cssinjs 算法算，必须显式传算法
    requires: [
      {
        file: 'es-pc/src/App.vue',
        must: ['darkAlgorithm', 'defaultAlgorithm'],
        why: 'Ant Design Vue 4 的组件颜色由 cssinjs 算法计算，只挂 `dark` 类是「外壳暗、a-* 组件全亮」；两个算法都要出现，切换才是双向的',
      },
      {
        file: 'es-pc/src/main.js',
        must: ['initTheme()'],
        why: '首屏脚本只改 DOM，模块级 isDark 由 initTheme() 对齐 —— 不调用则 ConfigProvider 永远停在亮色算法',
      },
    ],
  },
]
const LIGHT_SITES = [
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

/** 递归列出源码文件（跳过 node_modules / dist） */
const walkSrc = (rel) => {
  const out = []
  const dir = join(ROOT, rel)
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      if (name === 'node_modules' || name === 'dist') continue
      const p = join(d, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(js|ts|vue)$/.test(name)) out.push(p)
    }
  }
  if (existsSync(dir)) walk(dir)
  return out
}

/* ── A. 支持深色的站 ────────────────────────────────────────────── */
for (const site of DARK_SITES) {
  const html = read(site.html)
  if (html) {
    const bootstrapAt = html.indexOf("localStorage.getItem('theme')")
    const moduleAt = html.indexOf('<script type="module"')
    if (bootstrapAt < 0) {
      fail(`${site.html} 没有首屏深色脚本 —— 用户开着深色打开任何一页都会先闪一帧白`)
    } else if (moduleAt >= 0 && bootstrapAt > moduleAt) {
      fail(`${site.html} 的首屏深色脚本排在模块脚本之后，起不到防闪作用`)
    }
    if (bootstrapAt >= 0 && !html.includes("classList.toggle('dark'")) {
      fail(`${site.html} 的首屏脚本没有挂 \`dark\` 类（三站约定键）`)
    }
    if (bootstrapAt >= 0 && !html.includes('colorScheme')) {
      fail(`${site.html} 的首屏脚本没有同步 color-scheme —— 滚动条/表单控件会留在亮色`)
    }
    if (bootstrapAt >= 0 && !html.includes("setAttribute('data-vxe-ui-theme'")) {
      fail(
        `${site.html} 的首屏脚本没有设 data-vxe-ui-theme —— vxe-table 4.x 的暗色变量整块` +
          '挂在 [data-vxe-ui-theme="dark"] 上，不认 `dark` 类，深色页面里的 vxe 表格仍是一整块白',
      )
    }
  }

  const store = read(site.store)
  if (store) {
    if (!store.includes("classList.toggle('dark'")) {
      fail(`${site.store} 没有挂 \`dark\` 类（与首屏脚本的约定键不一致）`)
    }
    if (!store.includes('colorScheme')) {
      fail(`${site.store} 切换主题时没有同步 color-scheme`)
    }
    if (!store.includes("setAttribute('data-vxe-ui-theme'")) {
      fail(`${site.store} 切换主题时没有同步 data-vxe-ui-theme（vxe-table 的暗色键）`)
    }
    // 规则一致：localStorage 'theme' 优先，否则跟随系统
    if (!store.includes("localStorage.getItem('theme')") || !store.includes('prefers-color-scheme: dark')) {
      fail(`${site.store} 的判定规则与首屏脚本不一致（应为 localStorage 'theme' 优先，否则跟随系统）`)
    }
  }

  // 各端特有接线（如 AntDV 的 cssinjs 算法）
  for (const rule of site.requires || []) {
    const text = read(rule.file)
    if (!text) continue
    for (const token of rule.must) {
      if (!text.includes(token)) fail(`${rule.file} 缺少 \`${token}\` —— ${rule.why}`)
    }
  }

  // 有深色规则却没有任何切换入口 = 死配置（审计对旧版的判词）。
  // 只扫 .vue：store 自己定义 toggleTheme 不算入口，必须有一个页面真的能点。
  {
    const vues = walkSrc(site.srcDir).filter((f) => f.endsWith('.vue'))
    const hasEntry = vues.some((f) => readFileSync(f, 'utf8').includes('toggleTheme'))
    if (vues.length && !hasEntry) {
      fail(`${site.label} 声明支持深色，但 src 下没有任何 .vue 调用 toggleTheme —— 用户没有任何切换入口`)
    }
  }
}

/* ── A2. 惰性加载的 vxe 必须重设主题 ─────────────────────────────
 * vxe-pc-ui 在**模块求值**时无条件 setTheme('light')（packages/components.ts 底部），
 * 把首屏脚本挂好的 data-vxe-ui-theme 覆盖掉。两站都把 vxe 挪进了懒加载块，于是覆盖
 * 发生在 initTheme 之后 —— 实测 /advanced/vxe-table 与 /es-vxe-table 在深色下整块白
 * （html 有 dark 类、color-scheme=dark，表格背景 rgb(255,255,255)）。
 * 修法是在安装模块里登记主题回调；这里断言这条接线还在，且 store 真的会通知回调。
 */
const VXE_THEME_WIRING = [
  { installer: 'es-plus-docs/src/utils/vxe-install.ts', store: 'es-plus-docs/src/stores/theme.ts' },
  { installer: 'es-pc/src/utils/vxe-install.js', store: 'es-pc/src/stores/theme.js' },
]
for (const wiring of VXE_THEME_WIRING) {
  const installer = read(wiring.installer)
  if (installer) {
    if (!installer.includes('onThemeApplied(') || !installer.includes('VxeUI.setTheme(')) {
      fail(
        `${wiring.installer} 没有在加载后重设 vxe 主题 —— vxe 求值时会 setTheme('light')，` +
          '深色页面里的 vxe 表格会整块白',
      )
    }
  }
  const store = read(wiring.store)
  if (store && !store.includes('appliedListeners.forEach')) {
    fail(`${wiring.store} 没有通知 onThemeApplied 登记的回调 —— 登记的 vxe 重设永远不会被调用`)
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
for (const site of LIGHT_SITES) {
  for (const rel of site.srcDirs) {
    for (const file of walkSrc(rel)) {
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
console.log(
  `✅ 深色口径一致：${DARK_SITES.map((s) => s.label).join(' / ')} 支持深色（首屏不闪），` +
    `${LIGHT_SITES.map((s) => s.label).join(' / ')} 明确 light-only`,
)
