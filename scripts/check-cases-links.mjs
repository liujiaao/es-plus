#!/usr/bin/env node
/**
 * 案例目录的站内链接 ↔ 各站真实路由 校验
 *
 * 背景：docs/cases/cases.json 是三站「核心案例」页的单一真源，每条案例都带三端链接
 * （vue3 / antdv / vue2）。但此前**没有任何门禁校验这些链接能否解析** ——
 * cases:check 只比对三站副本是否一致，check:site-nav 只管切换器数组。
 * 实际后果：L2 头号案例（标注「放 C 位」）的 antdv 链接写的是 "/"，点进去落在 es-pc
 * 的首页；而 es-pc 其实有承载该案例的页面（/advanced 内嵌 ZeroCodeQuery）。
 * 更糟的是 es-pc / es-eui 两个站点**没有 404 兜底路由**，链接写错就是白屏，
 * 连「找不到页面」都看不到。
 *
 * 本脚本把「链接必须指向本站真实存在的页面」变成可校验的断言：
 *   - 主文档站：路由是动态段（/guide/:name、/components/:name、/advanced/:name），
 *     光看路由表无法判断某篇文章是否存在，因此以侧栏的页面清单（AppSidebar.vue 的
 *     `path:` 列表）为权威页面集合，另加静态路由（首页/案例/Playground 等）；
 *   - es-pc / es-eui：路由是静态字面量，直接解析 router/index.js（含嵌套 children）。
 *
 * 防「空集恒绿」：任一站点解析出的路径集合为空即报错，不允许把「解析失败」
 * 静默降级成「全部链接合法」。
 *
 * 用法：node scripts/check-cases-links.mjs
 * 退出码：0 = 全部解析；1 = 有链接指向不存在的页面 / 解析失败。
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

let failed = false
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}
const read = (p) => {
  const abs = join(ROOT, p)
  if (!existsSync(abs)) {
    fail(`文件缺失：${p}`)
    return null
  }
  return readFileSync(abs, 'utf-8')
}

/** 主文档站：侧栏列出的页面路径就是「真实存在的页面」集合 */
function docsPages() {
  const src = read('es-plus-docs/src/components/layout/AppSidebar.vue')
  if (!src) return null
  const paths = new Set()
  for (const m of src.matchAll(/path:\s*'([^']+)'/g)) paths.add(m[1])
  // 侧栏之外的静态路由（首页 / 案例 / Playground / AI 生成器）
  for (const p of ['/', '/cases', '/quickstart', '/playground', '/ai-crud']) paths.add(p)
  if (!paths.size) fail('未能从 AppSidebar.vue 解析出任何页面路径（侧栏结构变了请同步本脚本）')
  return paths
}

/**
 * 解析 vue-router 路由文件里的 path 字面量，支持 children 嵌套。
 * 返回完整路径集合（含父路径本身，因为父级通常渲染 <router-view> 容器页）。
 *
 * 用**缩进**判断嵌套层级，而不是数花括号：手写路由表里除了路由对象还有
 * import、箭头函数、`export default createRouter({...})` 等一堆花括号，
 * 数花括号会把兄弟路由误判成父子（第一次实现就踩了：解析出
 * `/quickstart/cases/guide/es-form` 这种不存在的路径，于是所有真实链接都被判非法）。
 */
function routerPaths(relPath, { vue2 = false } = {}) {
  const src = read(relPath)
  if (!src) return null
  const paths = new Set()
  const stack = [] // [{ indent, full }]，indent 是**路由对象**的缩进（不是 path 行的缩进）
  let pendingObjectIndent = null
  for (const line of src.split('\n')) {
    // 单行写法：{ path: 'quickstart', ... }  —— 对象缩进即 `{` 的缩进
    const single = /^(\s*)\{\s*path:\s*['"]([^'"]*)['"]/.exec(line)
    // 多行写法：对象以单独一行 `{` 开始，`path:` 在其下一行且缩进 +2。
    // 两者的缩进基准不同（6 vs 8），直接比较会把兄弟路由当成父子
    // （会解析出 /cases/es-form 这种不存在的路径）。所以统一换算到「对象缩进」。
    const multi = /^(\s*)path:\s*['"]([^'"]*)['"]/.exec(line)
    if (line.trim().endsWith('{')) pendingObjectIndent = line.match(/^(\s*)/)[1].length

    let objIndent = null
    let raw = null
    if (single) {
      objIndent = single[1].length
      raw = single[2]
    } else if (multi && pendingObjectIndent !== null) {
      objIndent = pendingObjectIndent
      raw = multi[2]
    } else {
      continue
    }
    pendingObjectIndent = null

    while (stack.length && stack[stack.length - 1].indent >= objIndent) stack.pop()
    const parent = stack.length ? stack[stack.length - 1].full : ''
    let full
    if (raw.startsWith('/')) full = raw
    else if (raw === '') full = parent || '/'
    else full = `${parent === '/' ? '' : parent}/${raw}`
    full = full.replace(/\/+$/, '') || '/'
    paths.add(full)
    if (parent) paths.add(parent.replace(/\/+$/, '') || '/')
    stack.push({ indent: objIndent, full })
  }
  if (!paths.size) fail(`未能从 ${relPath} 解析出任何路由（路由写法变了请同步本脚本）`)
  return paths
}

function main() {
  const cases = JSON.parse(read('docs/cases/cases.json') || '{}')
  const sites = {
    vue3: docsPages(),
    antdv: routerPaths('es-pc/src/router/index.js'),
    vue2: routerPaths('es-eui/src/router/index.js', { vue2: true }),
  }
  for (const [k, v] of Object.entries(sites)) {
    if (!v) fail(`未能取得 ${k} 站的路由集合`)
  }
  if (failed) {
    console.error('\n链接校验无法进行 —— 路由解析失败会让所有链接「看起来合法」，故直接失败。')
    process.exit(1)
  }

  let checked = 0
  for (const level of cases.levels || []) {
    for (const c of level.cases || []) {
      for (const [site, link] of Object.entries(c.links || {})) {
        checked++
        const set = sites[site]
        if (!set) {
          fail(`案例 #${c.id}（${c.title}）的链接指向未知站点 key：${site}`)
          continue
        }
        const norm = link.replace(/\/+$/, '') || '/'
        // 「能解析」不等于「去对了地方」：指向站点根的链接能通过路由检查，
        // 但案例卡的「查看案例」落到首页等于没有落点。L2 头号案例此前就是这样
        // （antdv 写 "/"，而承载它的页面是 es-pc 的 /advanced）。
        if (norm === '/') {
          fail(
            `案例 #${c.id}「${c.title}」的 ${site} 链接是站点根 "/" —— ` +
              '案例卡应当指向承载该案例的具体页面；指向首页等于没有落点',
          )
          continue
        }
        if (!set.has(norm)) {
          fail(
            `案例 #${c.id}「${c.title}」的 ${site} 链接 ${link} 在该站路由中不存在` +
              `（该站可用路径示例：${[...set].slice(0, 6).join(', ')}…）` +
              ' —— 三站均已补 404 兜底路由，这类链接点进去会落到 404 页',
          )
        }
      }
    }
  }

  if (failed) {
    console.error('\n案例目录存在指向不存在页面的链接。')
    process.exit(1)
  }
  console.log(`✅ 案例目录的 ${checked} 条站内链接在三站路由中全部存在`)
}

main()
