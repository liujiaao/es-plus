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
    // 2026-10-28 实测 1535.6 KB（入口 898.4）：element-plus 356 + vxe 344 +
    // 共享 chunk（hljs 与 demo 组件）311 + index 197（内含 es-plus 库本体）。
    ceiling: 1600,
    target: 300,
  },
  'es-pc': {
    route: '/quickstart',
    // es-pc 的路由不切分（只有一个入口 chunk + vendor），没有可单独称的路由 chunk
    routeChunkPrefix: null,
    // 2026-10-28 实测 1027.8 KB：antd 397 + vxe 344 + antd-icons 181 + index 64
    ceiling: 1100,
    target: 400,
  },
  'es-eui': {
    route: '/quickstart',
    routeChunkPrefix: null,
    // 2026-10-28 实测 667.6 KB：chunk-vendors 623（webpack 不打散 vendor）+ app 44
    ceiling: 720,
    target: 400,
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
          + '\n   这不是回归（回归线未破），是已知的未完成项：需要把入口里的 element-plus / vxe / es-plus 拆成按需加载。',
      )
    }
  }
}

main()
