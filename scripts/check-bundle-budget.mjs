#!/usr/bin/env node
/**
 * 首屏 JS 预算（路线图 3.6）—— 对**构建产物**称重，不对源码猜。
 *
 * 审计给的预算：主站文档路由首屏 JS ≤ 300KB gzip、es-pc ≤ 400KB、es-eui ≤ 400KB。
 * 这个脚本做三件事：
 *
 *   1. **算真实首屏**。hash 路由下所有页面共用一个 `index.html`，所以「首屏」=
 *      `<script type=module>` + 全部 `<link rel=modulepreload>` 指向的 JS，加上该路由
 *      自己的异步 chunk 及其静态 import 闭包（Vite 产物里的相对 import 就是加载图）。
 *      不数 CSS（它有自己的体积问题，但混进 JS 预算里只会让数字失去意义）。
 *   2. **守住已经付过代价的那几条线**：monaco 与它的四个 worker 绝不能被首屏预加载
 *      （2026-10 修过一次：首页预加载了 4.3MB 的 monaco）；入口预加载总量不许悄悄长。
 *   3. **把「目标 vs 现状」并排打在日志里**。差多少是要被看见的事，不能被一个
 *      「✅ 通过」盖过去 —— 所以脚本同时输出目标线与实测线，只有**回归**才判红。
 *
 * 为什么阈值写在脚本里而不是产物里：上限是人对「这一版可以接受多重」的决定，
 * 不是构建算得出来的东西。改上限必须改这里，并在同一行写清为什么。
 *
 * 与 `check-bundle-sources.mjs` 的分工：那边在**源码层**挡「换个 import 就多 300KB」
 * 的两件事（高亮器换成全集、示例 glob 改回 eager），不需要构建；这边在**产物层**
 * 称总重量，是回归的最终判据。两条都要 —— 只称产物，是事后才发现；只看源码，
 * 量不出「到底是哪一块变重了」。
 *
 * 用法：
 *   node scripts/check-bundle-budget.mjs                 # 三个站都称（需先构建）
 *   node scripts/check-bundle-budget.mjs --site=es-pc    # 只称一个
 *   node scripts/check-bundle-budget.mjs --json          # 机器可读
 *
 * 退出码：0 = 没有回归；1 = 有回归（首屏变大 / monaco 回到预加载 / 目标已达成但有超标）。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * 每个站的预算。
 *
 * `ceiling` 是**回归线**（超过即红），`target` 是审计里的目标值（只打印，不判红）——
 * 现状本来就高于目标，把两者混成一个数会让「还没做完」看起来像「已达成」。
 * 收紧 ceiling 的方式只有一个：先把首屏真的做小，再把这里的数字改成新的实测值。
 */
const BUDGETS = {
  'es-plus-docs': {
    // 文档路由（/guide/:name）的首屏：入口预加载 + 该路由 chunk 的静态闭包
    route: '/guide/getting-started',
    routeChunkPrefix: 'Doc-',
    // 2026-10-28 实测 448.6 KB（入口 369.8）：element-plus 275.4 + index 93.9
    // （es-plus 库本体、vue-i18n/router）+ Doc 52.9 + DocMeta 24.2 + json-ld 1.1。
    // 现在**不再随文档字数浮动**：正文按 slug 惰性加载，写多长都不进首屏（见最后一笔）。
    //
    // 同一天的前两步，三笔都来自「源码层就错了」，不是调参：
    //   · 高亮器引入的是 highlight.js 全集（190 种语言，含 mathematica/isbl/sqf），
    //     文档只用得上 11 种 —— 共享 chunk 311.4 → 24.2（utils/highlight.mjs）；
    //   · 指南的示例注册表两个 glob 都是 eager: true，于是 103 个示例组件（~145KB）
    //     与它们的源码文本（115KB）跟着每一篇指南下载，哪怕正文里一个 <demo> 都没有
    //     （components/doc/example-registry.ts 改成惰性）：1535.6 → 975.0；
    //   · vxe-table + vxe-pc-ui 全量注册（344.2）改成按需（utils/vxe-loader.ts）：
    //     994.6 → 650.1。这里有个只有称产物才抓得到的坑 —— **样式表不能跟着 vxe 的
    //     JS 分到同一个 chunk**：CSS 在哪个 chunk，浏览器就得先加载那个 JS 块，
    //     入口于是出现 `import "./vxe-*.js"`，改了半天一点没省（994.6 就是这么来的）。
    //     vite.config.ts 的 manualChunks 因此单独放行 vxe 的 CSS。
    // 随后加入六篇生态内容（FAQ/对比/基准/路线图/Vue 2 周期/贡献），index 从 198.2
    // 涨到 216.0（+17.8）：**指南正文是搜索索引的数据源**（utils/search-index.ts
    // 静态 import doc-registry），所以每多一篇指南，所有 /guide/* 的首屏都长一截。
    // 这笔是结构性的：修法是把正文改成按 slug 惰性加载，搜索索引随第一次开搜索再建。
    //   · `app.use(ElementPlus)` 换成显式注册 30 个组件（utils/install-app-plugins.ts
    //     的 ELEMENT_PLUS_COMPONENTS）后，这一块 356.2 → 275.4：650.1 → 571.9。
    //     省下的只有**站点模板自己用到、而 @es-plus/* 内部没用到的**那些组件 ——
    //     库的组件是直接 import 的，所以剩下 275.4 里有相当一部分还必须留在首屏。
    //   · 上面那笔结构性开销按原计划修掉（docs/doc-meta.ts + docs/doc-content.ts 按
    //     slug 惰性取正文；utils/search-engine.ts 把 fuse + 全部正文收成按需 chunk，
    //     DocSearch 第一次打开时才 import）：index 219.8 → 93.9，571.9 → 448.6。
    //     判据不是「有没有动态 import」而是「谁在静态 import 语料」—— 见
    //     check-bundle-sources 第 5 块；它同时守住「doc-meta / doc-registry / 磁盘」
    //     三处 slug 清单不许漂移。
    //
    // 收紧到 470 = 实测 448.6 + 约 4.8%。抬线要写理由，压线要靠真做小。
    // 剩下的唯一大头是 element-plus 275.4：那是 `@es-plus/*` 自己直接 import 的组件，
    // 站点注册方式已经改不动它了。
    ceiling: 470,
    target: 300,
    // 首屏闭包里不该出现的块：vxe 引擎只在 /advanced/vxe-table 与 /ai-gallery/<id> 注册
    // （344.2KB）。源码层守卫（check-bundle-sources）看得出「谁 import 了它」，看不出
    // 「谁为了加载 CSS 顺手把它拉进来」—— 那一条只有称产物才抓得到。
    forbidFirstLoad: /(^|\/)vxe-[\w]+\.js$/,
  },
  'es-pc': {
    route: '/quickstart',
    // es-pc 的路由不切分（只有一个入口 chunk + vendor），没有可单独称的路由 chunk
    routeChunkPrefix: null,
    // 2026-10-28 实测 604.9 KB：vendor-antd 318 + antd-icons 181.4 + index 64.9 + vue 40.6。
    // 这一天拿掉两笔，都是与主站同构的「源码层就错了」：
    //   · vxe-table + vxe-pc-ui 全量注册（344.2）改成 utils/vxe-loader.js 的路由门：
    //     1027.9 → 683.9。样式表仍留在入口（CSS 不进 JS 预算；挪进懒加载块会让注入
    //     顺序排到站点覆盖规则之后）。
    //   · `app.use(Antd)`（397.2 → 326.1）改成 utils/install-antd.js 的 26 组显式清单：
    //     683.9 → 604.9。省下的比主站 Element Plus 那笔小得多：adapter-antdv 自己就
    //     直接 import 了 Table / Pagination / Spin / ConfigProvider / Button / Tooltip /
    //     Tag / Modal / Space —— 实测把 app.use(Antd) 整个删掉，vendor-antd 仍有 310.1，
    //     那才是库侧的底。
    // 底在哪里：图标 181.4 来自 adapter-antdv 的 `import * as Icons`（它按名字解析任意
    // 图标，删了就变成空白图标），antd 底约 310 —— 两者都是库侧架构，站点改不动。
    // 所以 ≤400 这个目标在三个站点里只有主站还有一线（且要靠库改），这里只能守住不退化。
    ceiling: 630,
    target: 400,
    // 首屏闭包里不该出现的块：vxe 只在 /es-vxe-table 与 /ai-gallery/<id> 注册
    forbidFirstLoad: /(^|\/)vendor-vxe-[\w-]+\.js$/,
  },
  'es-eui': {
    route: '/quickstart',
    routeChunkPrefix: null,
    // 2026-10-28 实测 325.4 KB：chunk-vendors 280.8（webpack 不打散 vendor）+ app 44.6。
    // 这天之前是 667.6 —— 差的那一半几乎全是 vxe-table / vxe-pc-ui：它们原本
    // `Vue.use` 在 main.js 顶层，于是被 splitChunks 收进 `chunk-vendors`，每一页都下载。
    // 改成 utils/vxe-loader.js 的路由门（只在 /component/vxetable 与 /ai-gallery/<id>
    // 注册）后，**这一站因此落到了 ≤400 的目标线内**，是三站里第一个达标的。
    ceiling: 345,
    target: 400,
    // 首屏闭包里不该出现的块：webpack 的异步 vxe 块名是数字（`js/47.*.js`），
    // 认不出前缀，所以这里用「体积指纹」不合适 —— 改由 check-bundle-sources 的
    // 值导入判据守源码侧，产物侧只守住总重量这一条。
  },
}

/** 构建产物目录：es-eui 的 dist 会被开发服务器句柄锁住，本地常构建到 dist-verify */
const DIST = process.env.BUDGET_DIST || 'dist'

/** 首屏绝不该出现的块：monaco 与它的 worker（共 4.3MB 源码 / ~3MB gzip） */
const FORBIDDEN_PRELOAD = /monaco|worker/i

const toKB = (bytes) => Math.round((bytes / 1024) * 10) / 10

/** `--verbose`：把首屏里最大的几块也打出来 */
const VERBOSE = process.argv.includes('--verbose')

function gzSize(file) {
  return gzipSync(readFileSync(file), { level: 9 }).length
}

/** `index.html` 里真正会被浏览器拉下来的 JS 文件（不含 CSS、不含 inline） */
function entryScripts(siteDir) {
  const html = readFileSync(join(siteDir, DIST, 'index.html'), 'utf8')
  const hrefs = new Set()
  for (const re of [
    // Vite（es-plus-docs / es-pc）：<script type="module" src> + modulepreload
    /<script[^>]*\btype="module"[^>]*\bsrc="([^"]+)"/g,
    /<link[^>]*\brel="modulepreload"[^>]*\bhref="([^"]+)"/g,
    // webpack（es-eui）：<script defer src>，没有 modulepreload —— 同步 chunk
    // 全靠 index.html 直接列出，所以这一段就是它的首屏
    /<script[^>]*\bsrc="([^"]+\.js)"/g,
  ]) {
    let m
    while ((m = re.exec(html))) {
      // 部署在子路径下时 href 是 `/es-plus/assets/x.js` 或 `/es-plus/es-eui/js/x.js`：
      // 只认产物目录之后的部分，否则拼出来的本地路径不存在，闭包算成 0 ——
      // 一个「通过」的假数字（es-eui 第一次称重就是这么骗过自己的）
      const asset = m[1].match(/(assets|js)\/[^/]+\.js$/)
      if (asset) hrefs.add(`/${asset[0]}`)
    }
  }
  return [...hrefs]
}

/**
 * 从入口文件出发，沿**相对 import** 走一遍静态闭包。
 *
 * 只需要认 Vite 产物里的两种形态：`import "./x.js"` 与 `import{...}from"./x.js"`，
 * 以及同一文件里被再次导出的 `export{...}from"./x.js"`。动态 `import()` 不算 ——
 * 那正是懒加载的意义所在，把它算进首屏会让「改成懒加载」永远不生效。
 */
function staticClosure(siteDir, entries) {
  const distDir = join(siteDir, DIST)
  const seen = new Set()
  const queue = [...entries]
  while (queue.length) {
    const href = queue.shift()
    const file = join(distDir, href.replace(/^\//, ''))
    if (seen.has(file) || !existsSync(file)) continue
    seen.add(file)
    const code = readFileSync(file, 'utf8')
    const re = /(?:import|export)\s*(?:[^"'()]*?)\s*from\s*["'](\.\/[^"']+\.js)["']|import\s*["'](\.\/[^"']+\.js)["']/g
    let m
    while ((m = re.exec(code))) {
      const rel = m[1] || m[2]
      queue.push(`/${relative(distDir, resolve(dirname(file), rel)).replace(/\\/g, '/')}`)
    }
  }
  return [...seen]
}

function measure(site, budget) {
  const siteDir = join(ROOT, site)
  if (!existsSync(join(siteDir, DIST, 'index.html'))) {
    return { site, missing: true }
  }

  const entries = entryScripts(siteDir)
  const entryFiles = staticClosure(siteDir, entries)
  const entryGz = entryFiles.reduce((sum, file) => sum + gzSize(file), 0)
  const preloaded = entries.map((href) => href.split('/').pop())
  const forbidden = preloaded.filter((name) => FORBIDDEN_PRELOAD.test(name))
  // 站点自带的「首屏不该有」清单（如 es-plus-docs 的 vxe）：查的是整个首屏闭包，
  // 不只是 index.html 里显式 preload 的那几个 —— 被 CSS 拖进来的块不会出现在 preload 里
  const firstLoadFiles = (() => {
    if (!budget.routeChunkPrefix) return entryFiles
    const assets = join(siteDir, DIST, 'assets')
    const seeds = readdirSync(assets)
      .filter((name) => name.startsWith(budget.routeChunkPrefix) && name.endsWith('.js'))
      .map((name) => `/assets/${name}`)
    const merged = new Set(entryFiles)
    for (const file of staticClosure(siteDir, seeds)) merged.add(file)
    return [...merged]
  })()
  const forbiddenFirstLoad = budget.forbidFirstLoad
    ? firstLoadFiles
        .map((file) => relative(join(siteDir, DIST), file).replace(/\\/g, '/'))
        .filter((name) => budget.forbidFirstLoad.test(name))
    : []

  // 路由 chunk：按文件名前缀找（产物名形如 `Doc-d58f4f87.js`）
  let routeFiles = []
  let routeGz = 0
  if (budget.routeChunkPrefix) {
    const assets = join(siteDir, DIST, 'assets')
    const names = readdirSync(assets).filter(
      (name) => name.startsWith(budget.routeChunkPrefix) && name.endsWith('.js'),
    )
    const seeds = names.map((name) => `/assets/${name}`)
    // 路由 chunk 的首屏 = 入口闭包 + 路由闭包（两者去重）
    const merged = new Map(entryFiles.map((file) => [file, true]))
    for (const file of staticClosure(siteDir, seeds)) merged.set(file, true)
    routeFiles = [...merged.keys()]
    routeGz = routeFiles.reduce((sum, file) => sum + gzSize(file), 0)
  }

  return {
    site,
    missing: false,
    entryFiles,
    entryGz: toKB(entryGz),
    routeFiles,
    routeGz: toKB(routeGz),
    // 首屏里最大的几块：超标时「是谁占的」比「一共多少」更有用
    top: [...new Set([...entryFiles, ...routeFiles])]
      .map((file) => ({ file: relative(join(siteDir, DIST), file).replace(/\\/g, '/'), gz: toKB(gzSize(file)) }))
      .sort((a, b) => b.gz - a.gz)
      .slice(0, 8),
    preloaded,
    forbidden,
    forbiddenFirstLoad,
    budget,
  }
}

function report(result) {
  const { site, budget } = result
  if (result.missing) {
    console.error(`❌ ${site}: 没有 ${DIST}/index.html —— 先构建再称重（这个检查跑在构建之后）`)
    return true
  }
  // 解析不到任何 JS 时**必须判红**：0 KB 看起来是最漂亮的首屏，实际是尺子坏了
  if (!result.entryFiles.length) {
    console.error(`❌ ${site}: 没有从 ${DIST}/index.html 解析到任何 JS —— 称重失败不等于通过`)
    return true
  }

  const firstLoad = result.routeGz || result.entryGz
  const label = result.routeGz ? `路由 ${budget.route}` : '入口'
  console.log(
    `${site}  ${label} 首屏 ${firstLoad} KB gz`
      + `（入口 ${result.entryGz} KB / 目标 ≤ ${budget.target} KB / 回归线 ${budget.ceiling} KB）`,
  )
  // 超标时最需要的是「大块头是谁」——只报总数会把人赶回手动 du
  if (VERBOSE) {
    for (const item of result.top) console.log(`    ${String(item.gz).padStart(8)} KB  ${item.file}`)
  }

  let failed = false
  if (result.forbidden.length) {
    console.error(`❌ ${site}: monaco / worker 出现在首屏预加载里（${result.forbidden.join(', ')}）—— 它必须留懒加载`)
    failed = true
  }
  if (result.forbiddenFirstLoad.length) {
    console.error(
      `❌ ${site}: 首屏闭包里出现了不该有的块（${result.forbiddenFirstLoad.join(', ')}）`
        + ' —— vxe 引擎只该在用到它的路由加载（主站 /advanced/vxe-table 与 /ai-gallery/<id>，'
        + ' es-pc 的 /es-vxe-table 与 /ai-gallery/<id>）；'
        + ' 若是样式表把它拖进来的，改对应站点 vite.config 的 manualChunks（CSS 别分给 vxe chunk）',
    )
    failed = true
  }
  if (firstLoad > budget.ceiling) {
    console.error(
      `❌ ${site}: ${label} 首屏 ${firstLoad} KB gz 超过回归线 ${budget.ceiling} KB`
        + ' —— 先找出这次多出来的 chunk，再决定是修回去还是抬线上限（抬线要在脚本里写理由）',
    )
    failed = true
  }
  return failed
}

function main() {
  const args = process.argv.slice(2)
  const only = args.find((arg) => arg.startsWith('--site='))?.slice('--site='.length)
  const asJson = args.includes('--json')

  const sites = only ? [only] : Object.keys(BUDGETS)
  const unknown = sites.filter((site) => !BUDGETS[site])
  if (unknown.length) {
    console.error(`❌ 未知站点：${unknown.join(', ')}（可选：${Object.keys(BUDGETS).join(', ')}）`)
    process.exit(1)
  }

  const results = sites.map((site) => measure(site, BUDGETS[site]))

  if (asJson) {
    console.log(JSON.stringify(results, null, 2))
  } else {
    let failed = false
    for (const result of results) failed = report(result) || failed
    if (failed) {
      console.error('\n提示：首屏构成见上方数字；monaco 与 worker 必须是动态 import（components/doc/CodePlayground 一带）')
      process.exit(1)
    }
    const gaps = results.filter((r) => !r.missing && (r.routeGz || r.entryGz) > r.budget.target)
    if (gaps.length) {
      // 目标未达成不是回归，但必须被看见 —— 一行「✅」会把 4 倍的差距藏起来
      console.log(
        `\n⚠️  首屏预算目标未达成：${gaps.map((r) => `${r.site} ${r.routeGz || r.entryGz} KB（目标 ${r.budget.target} KB）`).join('；')}`
          + '\n   这不是回归（回归线未破），是已知的未完成项。剩下的底都是**库侧**的：'
          + '\n   es-plus-docs 的大头是 element-plus 275.4（`@es-plus/*` 内部直接 import 的组件）；'
          + '\n   es-pc 是 antd 318（adapter-antdv 自己 import 的）+ 图标 181.4（它 `import * as`）。'
          + '\n   es-eui 已经达标（325.4 ≤ 400），但它的 Element UI 仍是全量注册 —— 再往下走'
          + '\n   要先扫组件页模板、再抄一遍显式清单。vxe 三站都已按需。',
      )
    }
  }
}

main()
