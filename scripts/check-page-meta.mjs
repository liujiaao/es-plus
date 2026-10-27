#!/usr/bin/env node
/**
 * 逐页 title / description 覆盖检查。
 *
 * 背景：17 条路由里只有 Home / Doc / ComponentDoc 调了 useHead，其余 13 个视图
 * （营销页、AI 证据页、工具页、404）共用 index.html 那一份 title。表现是：
 * 分享十六条链接长得一模一样；浏览器历史全是同一个标题；搜索结果里没有一条
 * 描述能点进内容。
 *
 * 为什么检查「源码接线」而不渲染页面：这套站点是 hash 路由 + 无 SSR，渲染后的
 * <title> 只有真跑一遍浏览器才看得到（且 CI 里没有浏览器）。但「这个视图有没有
 * 调 usePageMeta」「PAGE_META 里的键是否被某个路由使用」是静态可判的 —— 而这两条
 * 恰好覆盖了真实失败模式：新增页面忘了挂 meta、以及表里留着一个已删除页面的条目。
 *
 * 校验项：
 *   1. router/index.ts 里每个具名路由，其视图组件都调了 usePageMeta / useHead；
 *   2. 静态页的 key 与路由 name 逐字一致（否则 usePageMeta 查不到表项，静默回落默认文案）；
 *   3. PAGE_META 里没有无人使用的键（删除页面后忘了删条目）；
 *   4. 标题唯一、≤ 30 字、不含数字与百分号（数字必须来自单源，见 check:site-claims）；
 *      描述 20–120 字（太短等于没写，太长会被搜索截断）。
 *
 * 用法：node scripts/check-page-meta.mjs
 * 退出码：0 = 全覆盖；1 = 有缺口。
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SITE = 'es-plus-docs'
const ROUTER = join(SITE, 'src', 'router', 'index.ts')
const META = join(SITE, 'src', 'utils', 'page-meta.ts')

let failed = false
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}

// Windows 检出是 CRLF，下面的解析全按 `\n` 切块 —— 不归一化会「只解析到第一个路由」，
// 而那种失败看起来像「路由表只有一条」（真的踩过一次）。
const toLF = (s) => s.replace(/\r\n?/g, '\n')

const read = (p) => {
  const abs = join(ROOT, p)
  if (!existsSync(abs)) {
    fail(`文件缺失：${p}`)
    return ''
  }
  return toLF(readFileSync(abs, 'utf8'))
}

/** 路由表：从 router/index.ts 里抠出 { path, name, view } */
function parseRoutes(src) {
  const routes = []
  const blocks = src.split(/\n {2}\{\n/)
  for (const block of blocks) {
    const name = block.match(/name: '([^']+)'/)
    const path = block.match(/path: '([^']*)'/)
    const view = block.match(/component: \(\) => import\('@\/views\/([^']+)'\)/)
    if (!name || !path) continue
    routes.push({ path: path[1], name: name[1], view: view ? view[1] : null })
  }
  return routes
}

/** PAGE_META 表项：key → { title, description } */
function parsePageMeta(src) {
  const entries = new Map()
  const re = /^ {2}'?([A-Za-z0-9-]+)'?: \{\n {4}title: '([^']*)',\n {4}description: '([^']*)',/gm
  let m
  while ((m = re.exec(src))) {
    entries.set(m[1], { title: m[2], description: m[3] })
  }
  return entries
}

const routes = parseRoutes(read(ROUTER))
const metaSrc = read(META)
const pageMeta = parsePageMeta(metaSrc)

if (!routes.length) fail('没有从 router/index.ts 解析到任何具名路由（解析规则可能已失效）')
if (!pageMeta.size) fail('没有从 page-meta.ts 解析到任何 PAGE_META 表项（解析规则可能已失效）')

const usedKeys = new Set()
const titles = new Map()

for (const route of routes) {
  if (!route.view) {
    fail(`路由 ${route.path}（${route.name}）没有可解析的视图组件`)
    continue
  }
  const file = `${SITE}/src/views/${route.view}`
  const src = read(file)
  if (!src) continue
  if (!/usePageMeta\s*\(|useHead\s*\(/.test(src)) {
    fail(`${route.path}（${route.name}）→ ${route.view} 没有调用 usePageMeta / useHead，标题会退回站点默认值`)
    continue
  }

  const entry = pageMeta.get(route.name)
  if (entry) {
    usedKeys.add(route.name)
    // 静态页必须按路由 name 取表，否则表项永远查不到（静默回落）。
    // 一个视图服务多条路由时（AiGallery 同时是列表与详情）走函数形式，退而要求
    // 它显式引用了本路由的键 —— 少了这一步，删掉表项也不会有人发现。
    const wired =
      src.includes(`usePageMeta('${route.name}')`) || src.includes(`PAGE_META['${route.name}']`)
    if (!wired) {
      fail(`${route.path}（${route.name}）在 PAGE_META 里有条目，但视图没有取用 '${route.name}'`)
    }
  } else if (!/usePageMeta\s*\(\s*\(\)/.test(src) && !/useHead\s*\(/.test(src)) {
    // 动态页（指南 / 组件 / 高级 / 画廊详情）没有表项，必须自己算
    fail(`${route.path}（${route.name}）既没有 PAGE_META 条目，视图也没有传函数现算标题`)
  }
}

for (const key of pageMeta.keys()) {
  if (!usedKeys.has(key)) fail(`PAGE_META 里的 '${key}' 没有任何路由在用（页面已删除或 name 改了）`)
}

for (const [key, { title, description }] of pageMeta) {
  if (titles.has(title)) fail(`标题重复：'${title}' 同时用于 ${titles.get(title)} 与 ${key}`)
  titles.set(title, key)

  if ([...title].length > 30) fail(`'${key}' 的标题 ${[...title].length} 字，超过 30`)
  // 统计口径类数字（百分号、小数、三位以上）禁止写进标题：它们是复测量，写死在标题里
  // 就会过期。「30 秒上手」这类产品命名不算 —— 所以不整体禁数字。
  if (/[%％]|\d+\.\d+|\d{3,}/.test(title)) {
    fail(`'${key}' 的标题含统计口径数字（「${title}」）—— 数字必须来自单源，页标题会过期`)
  }
  const len = [...description].length
  if (len < 20) fail(`'${key}' 的描述只有 ${len} 字，信息量不足`)
  if (len > 120) fail(`'${key}' 的描述 ${len} 字，超过 120 会被搜索结果截断`)
}

if (failed) {
  console.error('\n提示：逐页 meta 的单一来源是 es-plus-docs/src/utils/page-meta.ts')
  process.exit(1)
}

console.log(
  `✅ 逐页 meta 全覆盖：${routes.length} 条路由，PAGE_META ${pageMeta.size} 条（标题唯一、无死条目）`,
)
