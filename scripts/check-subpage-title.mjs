#!/usr/bin/env node
/**
 * 子站（es-pc / es-eui）逐页 title 接线检查。
 *
 * 背景：es-pc 的 22 条路由**早就写着** `meta: { title: ... }`，es-eui 的 30 条一条
 * 也没有 —— 但两者的表现一样：整站共用 index.html 的那一句 title。因为没有任何地方
 * 消费 meta.title（没有 afterEach、没有 document.title 赋值）。这类缺陷特别隐蔽：
 * 声明齐了、代码「看起来」是对的，只有分享链接或浏览器历史才暴露。
 *
 * 校验项（每个站点）：
 *   1. 每条具名路由都有 meta.title（解析到的条数必须等于 `name:` 出现次数，
 *      防止正则漏匹配被当成「全覆盖」）；
 *   2. 同一站点内标题不重复（两个页面同名等于没分）；
 *   3. 路由器里存在 afterEach 且真的写 document.title（声明存在但没人用，
 *      正是这次要根除的失败模式）；
 *   4. 标题不含统计口径数字（百分号 / 小数 / 三位以上整数）—— 与主站同一口径。
 *
 * 用法：node scripts/check-subpage-title.mjs
 * 退出码：0 = 三端口径一致；1 = 有缺口。
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const SITES = [
  { dir: 'es-pc', router: 'es-pc/src/router/index.js', label: 'Ant Design Vue' },
  { dir: 'es-eui', router: 'es-eui/src/router/index.js', label: 'Vue 2 + Element UI' },
]

let failed = false
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}

const toLF = (s) => s.replace(/\r\n?/g, '\n')

for (const site of SITES) {
  const abs = join(ROOT, site.router)
  if (!existsSync(abs)) {
    fail(`文件缺失：${site.router}`)
    continue
  }
  const src = toLF(readFileSync(abs, 'utf8'))

  const nameCount = (src.match(/\bname: '/g) || []).length
  const routes = []
  const re = /name: '([^']+)',\s*(?:meta: \{ title: '([^']*)' \})?/g
  let m
  while ((m = re.exec(src))) routes.push({ name: m[1], title: m[2] || null })

  if (routes.length !== nameCount) {
    fail(`${site.router}：解析到 ${routes.length} 条具名路由，但出现 ${nameCount} 个 name —— 解析规则已失效`)
    continue
  }

  const missing = routes.filter((r) => !r.title)
  if (missing.length) {
    fail(`${site.router}：${missing.length} 条路由缺 meta.title（${missing.map((r) => r.name).join('、')}）`)
  }

  const seen = new Map()
  for (const route of routes) {
    if (!route.title) continue
    if (seen.has(route.title)) {
      fail(`${site.router}：标题「${route.title}」被 ${seen.get(route.title)} 与 ${route.name} 共用`)
    }
    seen.set(route.title, route.name)
    if (/[%％]|\d+\.\d+|\d{3,}/.test(route.title)) {
      fail(`${site.router}：${route.name} 的标题含统计口径数字（「${route.title}」）`)
    }
  }

  // 声明存在但没人消费 —— 就是这次要根除的那种「看起来对」的缺陷
  if (!/afterEach\s*\(/.test(src)) {
    fail(`${site.router}：没有 router.afterEach —— meta.title 不会被写进 document.title`)
  } else if (!/document\.title\s*=/.test(src)) {
    fail(`${site.router}：afterEach 里没有给 document.title 赋值`)
  }

  console.log(`   ${site.dir}: ${routes.length} 条路由，${seen.size} 个不同标题`)
}

if (failed) {
  console.error('\n提示：title 的单一来源是各站 router 的 meta.title（不要另建一份映射表）')
  process.exit(1)
}

console.log('✅ 子站逐页 title 已接线（meta.title 全覆盖 + afterEach 消费 + 标题唯一）')
