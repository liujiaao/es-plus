#!/usr/bin/env node
/**
 * sitemap + 404 兜底的一致性检查。
 *
 * 两个真实失败模式，这次都发生过：
 *   1. sitemap 里 19 条 URL 全是路径式（`/es-plus/guide/x`），而站点是 hash 路由 ——
 *      在 GitHub Pages 上逐条 404。生成器（gen-sitemap.mjs）已修，但「产物过期」
 *      这件事只有比对生成结果才能发现（有人手改了 xml、加了文档没重跑生成）。
 *   2. 404.html 里的部署基准路径（BASE）与站点规范域名（vite.config.ts 的
 *      SITE_HOSTNAME）是两处手写的常量。换域名时只改一处，跳转就会跨到别的站点根 ——
 *      而这个页面**只在线上 404 时**才跑到，本地开发永远看不见。
 *
 * 校验项：
 *   1. public/sitemap.xml 与 gen-sitemap.mjs 的产出逐字一致（等价于 --check）；
 *   2. 每条 <loc> 都在站点基准之下，且只有两种合法形式：文章页的路径式地址
 *      （`guide/…` 等有预渲染 HTML 的前缀，必须以 / 结尾），其余页面的 `#/…`；
 *   3. 404.html 存在、BASE 与 SITE_HOSTNAME 的路径一致、GitHub Pages 镜像的子站前缀与
 *      deploy-docs.yml 一致，且**用假 location 在两个宿主上各真跑一遍改写逻辑**：规范
 *      域名（EdgeOne，站点在根）的深链回到自己的 hash；Pages 镜像里 `/es-plus/es-pc/…`、
 *       `/es-plus/es-eui/…` 回到子站自己的 hash（此前一律按主站改写，把用户送进主站的
 *      一条不存在的路由）。
 *
 * 用法：node scripts/check-sitemap.mjs
 * 退出码：0 = 一致；1 = 漂移。
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { sameText } from './lib/text-sync.mjs'
import { PAGES_ORIGIN, PAGES_BASE, mirrorSubSites } from './lib/pages-mirror.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SITE = 'es-plus-docs'
const SITEMAP = join(SITE, 'public', 'sitemap.xml')
const NOT_FOUND = join(SITE, 'public', '404.html')
const VITE_CONFIG = join(SITE, 'vite.config.ts')

/**
 * 有预渲染产物的内容页前缀（`<dist>/<prefix>/<slug>/index.html`）。
 * 与 site-seo.js 的 ARTICLE_PREFIXES、json-ld.ts 的同名常量必须一致：
 * 这里放宽了 sitemap 的地址形式，写错前缀等于给一条打不开的地址开绿灯。
 */
const ARTICLE_PATHS = ['guide/', 'components/', 'advanced/']
let failed = false
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}
const toLF = (s) => s.replace(/\r\n?/g, '\n')
const read = (p) => {
  const abs = join(ROOT, p)
  if (!existsSync(abs)) {
    fail(`文件缺失：${p}`)
    return ''
  }
  return toLF(readFileSync(abs, 'utf8'))
}

// 1. 站点基准（单一来源：vite.config.ts 的 SITE_HOSTNAME）
const hostMatch = read(VITE_CONFIG).match(/SITE_HOSTNAME\s*=\s*'([^']+)'/)
if (!hostMatch) {
  fail(`未能在 ${VITE_CONFIG} 定位 SITE_HOSTNAME`)
} else {
  const url = new URL(hostMatch[1])
  const base = `${url.origin}${url.pathname.replace(/\/$/, '')}/`

  // 2. sitemap：产物必须等于生成器输出
  const sitemap = read(SITEMAP)
  if (sitemap) {
    // 直接复用生成器（它有 main-guard，被 import 时不会覆写产物）
    const { build } = await import('./gen-sitemap.mjs')
    if (typeof build !== 'function') {
      fail('gen-sitemap.mjs 没有导出 build()，无法比对产物是否过期')
    } else if (!sameText(sitemap, build())) {
      fail(`${SITEMAP} 与路由表/注册表不一致 —— 运行 npm run sitemap:gen（不要手改 xml）`)
    }

    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
    if (!locs.length) fail(`${SITEMAP} 里没有任何 <loc>`)
    for (const loc of locs) {
      if (!loc.startsWith(base)) {
        fail(`sitemap 条目不在站点基准之下：${loc}（基准 ${base}）`)
        continue
      }
      const rest = loc.slice(base.length)
      // 首页的规范地址就是站点根本身（`…/es-plus/`），不参与下面两种形式的判定
      if (!rest) continue
      // 两种合法形式：文章页的路径式地址（有静态 HTML），其余页面的 hash 形式。
      // 路径式只允许出现在有预渲染产物的前缀下 —— 否则那条地址在 Pages 上是 404。
      if (!rest.startsWith('#')) {
        if (!ARTICLE_PATHS.some((prefix) => rest.startsWith(prefix))) {
          fail(`sitemap 条目既不是 hash 形式，也不在预渲染的内容页前缀下：${loc}`)
        } else if (!rest.endsWith('/')) {
          fail(`sitemap 的路径式条目没有以 / 结尾（Pages 会先 301 再给页，规范地址应带斜杠）：${loc}`)
        }
      } else if (!rest.startsWith('#/')) {
        fail(`sitemap 条目的 hash 不是以 #/ 开头：${loc}`)
      }
    }
    if (locs.length && !failed) console.log(`   sitemap: ${locs.length} 条（文章页路径式 + 其余 hash 式），全部为可打开地址`)
  }

  // 3. 404 兜底：规范域名（根）+ Pages 镜像（子路径）两套基准都真跑一遍
  const notFound = read(NOT_FOUND)
  if (notFound) {
    const m = notFound.match(/var BASE = '([^']+)'/)
    if (!m) {
      fail('404.html 里没有 `var BASE = \'…\'` —— 深链兜底失效')
    } else {
      const expectedBase = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`
      if (m[1] !== expectedBase) {
        fail(`404.html 的 BASE 是 ${m[1]}，而站点规范路径是 ${expectedBase} —— 换域名时漏改一处`)
      }
      if (!/location\.replace\(/.test(notFound)) {
        fail('404.html 里没有 location.replace —— 路径式深链不会被改写成 hash 路由')
      }

      // 3a. Pages 镜像：宿主与基准必须与部署工作流一致
      const pagesHost = new URL(PAGES_ORIGIN).hostname
      const declaredHost = notFound.match(/var PAGES_HOST = '([^']+)'/)?.[1]
      if (declaredHost !== pagesHost) {
        fail(`404.html 的 PAGES_HOST 是 ${declaredHost ?? '(缺失)'}，应为 ${pagesHost}（GitHub Pages 镜像宿主）`)
      }
      const declaredPagesBase = notFound.match(/var PAGES_BASE = '([^']+)'/)?.[1]
      if (declaredPagesBase !== PAGES_BASE) {
        fail(`404.html 的 PAGES_BASE 是 ${declaredPagesBase ?? '(缺失)'}，应为 ${PAGES_BASE}`)
      }
      // 子站前缀必须与 deploy-docs.yml 的「目录 → 子路径」映射一致
      const expectedSubSites = mirrorSubSites()
      const declaredSubSites = [...(notFound.match(/var PAGES_SITES = \[([^\]]*)\]/)?.[1] ?? '').matchAll(/'([^']+)'/g)]
        .map((match) => match[1])
      for (const pathname of expectedSubSites) {
        if (!declaredSubSites.includes(pathname)) {
          fail(`404.html 的 PAGES_SITES 里没有子站前缀 ${pathname} —— 该站的 Pages 镜像深链会被改写进主站`)
        }
      }
      for (const pathname of declaredSubSites) {
        if (!expectedSubSites.includes(pathname)) {
          fail(`404.html 的 PAGES_SITES 里有 ${pathname}，但 deploy-docs.yml 没有发布这个子站 —— 两边已漂移`)
        }
      }

      // 3b. 真的跑一遍改写逻辑（这个文件只在线上 404 时才执行，读代码看不出送错站点）
      const scriptBody = [...notFound.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]).pop()
      if (!scriptBody) {
        fail('404.html 里没有可执行的内联脚本')
      } else {
        const runRewrite = (hostname, pathname, search = '', hash = '') => {
          let target = null
          const fakeLocation = { hostname, pathname, search, hash, replace: (value) => { target = value } }
          const fakeDocument = { getElementById: () => ({ textContent: '' }) }
          // eslint-disable-next-line no-new-func
          new Function('location', 'document', scriptBody)(fakeLocation, fakeDocument)
          return target
        }
        const MAIN_HOST = new URL(hostMatch[1]).hostname
        const cases = [
          // 规范域名：站点在根，任何路径都改写成该站的 hash
          [MAIN_HOST, '/guide/installation', '', '', '/#/guide/installation'],
          [MAIN_HOST, '/no-such-page', '?from=mail', '#top', '/#/no-such-page?from=mail#top'],
          // 首页与站点根不跳（否则会自己打自己）
          [MAIN_HOST, '/', '', '', null],
          // Pages 镜像：主站与两个子站各回自己的 hash
          [pagesHost, '/es-plus/guide/installation', '', '', '/es-plus/#/guide/installation'],
          [pagesHost, '/es-plus/es-pc/quickstart', '', '', '/es-plus/es-pc/#/quickstart'],
          [pagesHost, '/es-plus/es-eui/component/esform', '', '', '/es-plus/es-eui/#/component/esform'],
          [pagesHost, '/es-plus/es-pc/quickstart', '?from=mail', '#top', '/es-plus/es-pc/#/quickstart?from=mail#top'],
          [pagesHost, '/es-plus/', '', '', null],
          // 镜像之外的路径不动：它不属于这个仓库的站点
          [pagesHost, '/outside/page', '', '', null],
        ]
        for (const [hostname, pathname, search, hash, expected] of cases) {
          const actual = runRewrite(hostname, pathname, search, hash)
          if (actual !== expected) {
            fail(`404.html 在 ${hostname} 改写 ${pathname}${search}${hash} 得到 ${actual ?? '（不跳转）'}，应为 ${expected ?? '（不跳转）'}`)
          }
        }
      }

      if (!failed) {
        console.log(
          `   404.html: 规范域名 BASE ${m[1]}；Pages 镜像 ${PAGES_BASE}（子站 ${expectedSubSites.join(' / ')}）；` +
            '两套宿主上的改写逻辑已实跑',
        )
      }
    }
  }
}

if (failed) {
  console.error('\n提示：sitemap 由 npm run sitemap:gen 生成；404 兜底见 es-plus-docs/public/404.html')
  process.exit(1)
}

console.log(`✅ sitemap 与 404 兜底一致（基准 ${SITE}）`)
