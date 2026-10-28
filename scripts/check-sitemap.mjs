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
 *   3. 404.html 存在、BASE 与 SITE_HOSTNAME 的路径一致、子站前缀与 sites.ts 一致、
 *      且**用假 location 真跑一遍改写逻辑**：主站深链回到主站 hash，子站深链回到
 *      子站自己的 hash（这张 404 页是整个 Pages 站点共用的，此前一律按主站改写，
 *      把 `/es-plus/es-pc/guide/x` 送进了主站的一条不存在的路由）。
 *
 * 用法：node scripts/check-sitemap.mjs
 * 退出码：0 = 一致；1 = 漂移。
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readText, sameText } from './lib/text-sync.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SITE = 'es-plus-docs'
const SITEMAP = join(SITE, 'public', 'sitemap.xml')
const NOT_FOUND = join(SITE, 'public', '404.html')
const VITE_CONFIG = join(SITE, 'vite.config.ts')
const SITES_MODULE = join(SITE, 'src', 'utils', 'sites.ts')

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

  // 3. 404 兜底：BASE 一致 + 子站前缀一致 + 改写逻辑真跑一遍
  const notFound = read(NOT_FOUND)
  if (notFound) {
    const m = notFound.match(/var BASE = '([^']+)'/)
    if (!m) {
      fail('404.html 里没有 `var BASE = \'…\'` —— 深链兜底失效')
    } else {
      const expectedBase = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`
      if (m[1] !== expectedBase) {
        fail(`404.html 的 BASE 是 ${m[1]}，而站点规范路径是 ${expectedBase} —— 换部署路径时漏改一处`)
      }
      if (!/location\.replace\(/.test(notFound)) {
        fail('404.html 里没有 location.replace —— 路径式深链不会被改写成 hash 路由')
      }

      // 3a. 子站前缀必须与 sites.ts 一致：三站清单里除主站外的每一项
      const sitesSrc = read(SITES_MODULE)
      const subSites = [...sitesSrc.matchAll(/url:\s*'([^']+)'/g)]
        .map((match) => {
          const pathname = new URL(match[1]).pathname
          return pathname.endsWith('/') ? pathname : `${pathname}/`
        })
        .filter((pathname) => pathname !== expectedBase && pathname.startsWith(expectedBase))
      if (!subSites.length) fail(`没能从 ${SITES_MODULE} 里解析出任何子站地址（解析规则可能已失效）`)
      const declared = [...notFound.matchAll(/'(\/[^']*\/)'/g)]
        .map((match) => match[1])
        .filter((pathname) => pathname !== expectedBase && pathname.startsWith(expectedBase))
      for (const pathname of subSites) {
        if (!declared.includes(pathname)) {
          fail(`404.html 的 SITES 里没有子站前缀 ${pathname} —— 该站的路径式深链会被改写进主站`)
        }
      }
      for (const pathname of declared) {
        if (!subSites.includes(pathname)) {
          fail(`404.html 的 SITES 里有 ${pathname}，但 ${SITES_MODULE} 里没有这个子站 —— 两边已漂移`)
        }
      }

      // 3b. 真的跑一遍改写逻辑（这个文件只在线上 404 时才执行，读代码看不出送错站点）
      const scriptBody = [...notFound.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]).pop()
      if (!scriptBody) {
        fail('404.html 里没有可执行的内联脚本')
      } else {
        const runRewrite = (pathname, search = '', hash = '') => {
          let target = null
          const fakeLocation = { pathname, search, hash, replace: (value) => { target = value } }
          const fakeDocument = { getElementById: () => ({ textContent: '' }) }
          // eslint-disable-next-line no-new-func
          new Function('location', 'document', scriptBody)(fakeLocation, fakeDocument)
          return target
        }
        const cases = [
          ['/es-plus/guide/installation', '', '', '/es-plus/#/guide/installation'],
          ['/es-plus/es-pc/quickstart', '', '', '/es-plus/es-pc/#/quickstart'],
          ['/es-plus/es-eui/component/esform', '', '', '/es-plus/es-eui/#/component/esform'],
          ['/es-plus/es-pc/quickstart', '?from=mail', '#top', '/es-plus/es-pc/#/quickstart?from=mail#top'],
          ['/es-plus/', '', '', null],
          ['/outside/page', '', '', null],
        ]
        for (const [pathname, search, hash, expected] of cases) {
          const actual = runRewrite(pathname, search, hash)
          if (actual !== expected) {
            fail(`404.html 改写 ${pathname}${search}${hash} 得到 ${actual ?? '（不跳转）'}，应为 ${expected ?? '（不跳转）'}`)
          }
        }
      }

      if (!failed) {
        console.log(`   404.html: BASE ${m[1]} 与规范域名一致；子站深链回到子站（${subSites.join(' / ')}）；改写逻辑已实跑`)
      }
    }
  }
}

if (failed) {
  console.error('\n提示：sitemap 由 npm run sitemap:gen 生成；404 兜底见 es-plus-docs/public/404.html')
  process.exit(1)
}

console.log(`✅ sitemap 与 404 兜底一致（基准 ${SITE}）`)
