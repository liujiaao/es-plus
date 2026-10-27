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
 *   2. 每条 <loc> 都在站点基准之下，且除首页外都带 `#/`（hash 路由的可打开形式）；
 *   3. 404.html 存在、BASE 与 SITE_HOSTNAME 的路径一致、且真的调用了 location.replace。
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
      // 首页之外必须是 hash 形式，否则在 GitHub Pages 上仍然是 404
      if (rest && !rest.startsWith('#')) {
        fail(`sitemap 条目是路径式地址，在 hash 路由下打不开：${loc}`)
      }
      if (rest.startsWith('#') && !rest.startsWith('#/')) {
        fail(`sitemap 条目的 hash 不是以 #/ 开头：${loc}`)
      }
    }
    if (locs.length && !failed) console.log(`   sitemap: ${locs.length} 条，全部为可打开的 hash 地址`)
  }

  // 3. 404 兜底：BASE 一致 + 真的跳转
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
      if (!failed) console.log(`   404.html: BASE ${m[1]} 与规范域名一致，深链会改写为 hash 路由`)
    }
  }
}

if (failed) {
  console.error('\n提示：sitemap 由 npm run sitemap:gen 生成；404 兜底见 es-plus-docs/public/404.html')
  process.exit(1)
}

console.log(`✅ sitemap 与 404 兜底一致（基准 ${SITE}）`)
