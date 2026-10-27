#!/usr/bin/env node
/**
 * 文档页清单（DOC_NAV）与路由 / 日期表的一致性检查。
 *
 * 背景：es-pc 与 es-eui 的文档 chrome（面包屑 / 上下篇 / 编辑此页 / 最后更新）
 * 都由同一张表派生 —— `src/utils/doc-nav.js` 的 DOC_NAV。表里一行同时说四件事：
 * 路由名、页面标题、正文源文件、日期键。这四件事分别住在别处（router、DOC_SOURCES），
 * 表只是引用它们。**引用写错不会报错**：面包屑会挂到别的分组、上下篇会跳到不存在的页、
 * 「编辑此页」会指向 404、最后更新会静默消失 —— 页面照常渲染，只是错。
 *
 * 因此本脚本把四条引用逐一钉死：
 *   1. 表里的 key 必须与 scripts/doc-meta.mjs 的 DOC_SOURCES 键**集合相等**
 *      （少一个 → 该页没有「最后更新」；多一个 → 日期表里有死条目）；
 *   2. 表里的 source 必须与 DOC_SOURCES 的路径**逐字相同**，且该文件真实存在；
 *   3. 表里的 route 必须在路由文件里有一条 `name: '<route>'`，且紧随其后的
 *      `meta.title` 与表里的 title **逐字相同**（同一个页面两个名字正是 1.4c 修掉的缺陷）；
 *   4. route 与 key 在各自站内唯一（两个条目指向同一页，上下篇会出现「下一篇」跳回自己）。
 *
 * 用法：node scripts/check-doc-nav.mjs
 * 退出码：0 = 全部一致；1 = 有漂移。
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { DOC_SOURCES } from './doc-meta.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const SITES = [
  { site: 'es-pc', nav: 'es-pc/src/utils/doc-nav.js', router: 'es-pc/src/router/index.js' },
  { site: 'es-eui', nav: 'es-eui/src/utils/doc-nav.js', router: 'es-eui/src/router/index.js' },
]

let failed = false
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}
const toLF = (s) => s.replace(/\r\n?/g, '\n')

/**
 * 从 doc-nav.js 源码里取出 DOC_NAV 的字面量条目。
 * 先去掉行注释（表里用注释分段），再按 `}, {` 切块，最后逐字段取值 ——
 * 字段顺序、换行、尾逗号都不影响结果。
 */
function parseNav(src) {
  const clean = src.replace(/^\s*\/\/.*$/gm, '')
  const start = clean.indexOf('export const DOC_NAV')
  if (start < 0) return []
  const open = clean.indexOf('[', start)
  const close = clean.indexOf('\n]', open)
  if (open < 0 || close < 0) return []
  const body = clean.slice(open + 1, close)
  const pick = (chunk, field) => {
    const m = chunk.match(new RegExp(`\\b${field}:\\s*'([^']*)'`))
    return m ? m[1] : ''
  }
  return body
    .split(/\}\s*,\s*\{/)
    .map((chunk) => ({
      key: pick(chunk, 'key'),
      route: pick(chunk, 'route'),
      title: pick(chunk, 'title'),
      group: pick(chunk, 'group'),
      source: pick(chunk, 'source'),
    }))
    .filter((entry) => entry.key)
}
const read = (rel) => {
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) {
    fail(`文件缺失：${rel}`)
    return null
  }
  return toLF(readFileSync(abs, 'utf8'))
}

for (const { site, nav, router } of SITES) {
  const sources = DOC_SOURCES[site]
  if (!sources) {
    fail(`doc-meta 里没有站点 ${site}`)
    continue
  }
  const navSrc = read(nav)
  if (!navSrc) continue
  const routerSrc = read(router)
  // 不 import：这两个 doc-nav.js 所在的包是 CJS（package.json 无 "type": "module"），
  // Node 的动态 import 会按 CJS 解析而报 SyntaxError。DOC_NAV 是纯字面量数组，
  // 按字段名逐个提取即可；下面还会核对「提取到的条数 == key: 出现次数」——
  // 解析漏掉一条会让数量对不上，是本脚本自身的失败模式，也必须显式报错。
  const DOC_NAV = parseNav(navSrc)
  const keyOccurrences = (navSrc.match(/\bkey:\s*'/g) || []).length
  if (!DOC_NAV.length) {
    fail(`[${site}] ${nav} 里没有解析到 DOC_NAV 条目`)
    continue
  }
  if (DOC_NAV.length !== keyOccurrences) {
    fail(`[${site}] DOC_NAV 解析不完整：提取到 ${DOC_NAV.length} 条，源码里有 ${keyOccurrences} 个 key`)
    continue
  }

  const navKeys = new Set()
  const navRoutes = new Set()
  for (const entry of DOC_NAV) {
    const label = `[${site}] ${entry.key || '(无 key)'}`
    for (const field of ['key', 'route', 'title', 'group', 'source']) {
      if (!entry[field]) fail(`${label} 缺少字段 ${field}`)
    }
    if (navKeys.has(entry.key)) fail(`${label} 的 key 重复`)
    if (navRoutes.has(entry.route)) fail(`${label} 的 route 重复（${entry.route}）`)
    navKeys.add(entry.key)
    navRoutes.add(entry.route)

    // 1 + 2：日期表的键与源文件
    if (!(entry.key in sources)) {
      fail(`${label} 不在 DOC_SOURCES['${site}'] 里 —— 这一页不会有「最后更新」`)
    } else if (sources[entry.key] !== entry.source) {
      fail(`${label} 的 source（${entry.source}）与 DOC_SOURCES（${sources[entry.key]}）不一致`)
    }
    if (entry.source && !existsSync(join(ROOT, entry.source))) {
      fail(`${label} 的 source 指向不存在的文件：${entry.source}`)
    }

    // 3：路由名与 meta.title
    if (routerSrc) {
      const at = routerSrc.indexOf(`name: '${entry.route}'`)
      if (at < 0) {
        fail(`${label} 的 route '${entry.route}' 在 ${router} 里找不到`)
      } else {
        // 路由对象里 name 之后才写 meta：在后续 240 字符内找 title
        const window = routerSrc.slice(at, at + 240)
        const m = window.match(/title:\s*'([^']*)'/)
        if (!m) {
          fail(`${label} 的 route '${entry.route}' 附近没有 meta.title`)
        } else if (m[1] !== entry.title) {
          fail(`${label} 的 title「${entry.title}」与路由 meta.title「${m[1]}」不一致`)
        }
      }
    }
  }

  // 1（反向）：日期表里不能有清单外的条目 —— 页面删了，日期还留着
  for (const key of Object.keys(sources)) {
    if (!navKeys.has(key)) {
      fail(`[${site}] DOC_SOURCES 的 '${key}' 没有对应的清单一页（页面已删？）`)
    }
  }
}

if (failed) {
  console.error('\n文档页清单与路由 / 日期表存在漂移。')
  process.exit(1)
}
console.log('✅ 文档页清单、路由标题、日期表三处一致（es-pc / es-eui）')
