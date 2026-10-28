/**
 * 站点「路由表」与「逐页 meta」的解析规则（单一实现）。
 *
 * 两个消费者：`check-page-meta.mjs`（断言每条路由都有 title/description）与
 * `gen-llms.mjs`（`llms.txt` 的「站点页面」一节按路由表列页面）。
 * 规则写两份的后果是两边**认不同的页面** —— 一条路由在门禁里存在、在索引里消失，
 * 而两边各自的校验都是绿的。
 *
 * 解析对象是 TypeScript 源文件，走正则而不是编译：这两处结构是「字面量表」，
 * 没有需要求值的表达式，而编译要拖进 vue-router 的浏览器依赖（`createWebHashHistory`
 * 在 Node 里直接抛错）。
 */

/** 路由表：从 router/index.ts 里抠出 { path, name, view } */
export function parseRoutes(src) {
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

/**
 * PAGE_META 表项：key → { title, description }
 *
 * 断言条目的字段**恰好**是 title 与 description 相邻两行：表项里插了新字段（如
 * `keywords`）时这里会解析不到 —— 那是提醒，不是静默跳过（跳过会让首页索引少一条）。
 */
export function parsePageMeta(src) {
  const entries = new Map()
  const re = /^ {2}'?([A-Za-z0-9-]+)'?: \{\n {4}title: '([^']*)',\n {4}description: '([^']*)',/gm
  let m
  while ((m = re.exec(src))) {
    entries.set(m[1], { title: m[2], description: m[3] })
  }
  return entries
}
