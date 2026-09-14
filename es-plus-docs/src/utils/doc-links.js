/**
 * 站内绝对链接改写 — 文档站使用 hash 路由（createWebHashHistory），
 * 但 .md 作者习惯写根绝对路径 `/guide/xxx`。若原样输出，点击会整页跳转到
 * 不存在的 `/guide/xxx`（404 / 回首页）。这里在渲染后把「站内路由」链接改写为
 * hash 形式 `#/guide/xxx`，作者继续写 `/guide/xxx` 即可正常工作。
 *
 * 只改写明确属于本站路由的路径，其它一律不动：
 *   - 协议链接 `http://` `https://`、协议相对 `//cdn...`
 *   - 纯锚点 `#xxx`（同页锚点）
 *   - 其它站点路径 `/es-pc/...`、`/es-eui/...`、`/es-plus/...`
 *   - 相对路径 `./xxx`、`../xxx`、`foo/bar`
 */

// 前缀命中的站内路由分组（带结尾斜杠，避免误匹配 /guidebook）
const INTERNAL_PREFIXES = ['/guide/', '/components/', '/advanced/']
// 精确匹配的站内路由
const INTERNAL_EXACT = ['/', '/playground', '/ai-crud']

/**
 * 判断一个根绝对路径是否为本站路由。
 * @param {string} path 不含 query / fragment 的路径
 */
export function isInternalDocPath(path) {
  if (INTERNAL_EXACT.includes(path)) return true
  return INTERNAL_PREFIXES.some((prefix) => path.startsWith(prefix))
}

/**
 * 把单个 href 改写为 hash 形式；不属于站内路由的原样返回。
 * @param {string} href
 * @returns {string}
 */
export function toHashHref(href) {
  if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')) return href

  // 分离 query / fragment，仅对 path 做判定
  const hashIdx = href.indexOf('#')
  const queryIdx = href.indexOf('?')
  let cut = href.length
  if (hashIdx >= 0) cut = Math.min(cut, hashIdx)
  if (queryIdx >= 0) cut = Math.min(cut, queryIdx)
  const path = href.slice(0, cut)
  const rest = href.slice(cut)

  if (!isInternalDocPath(path)) return href

  // hash 路由下不能再带内层 `#fragment`（会被 router 当成路径的一部分），
  // 因此跨页锚点会退化为跳到目标页顶部；query 保留。
  const restWithoutHash = rest.includes('#') ? rest.slice(0, rest.indexOf('#')) : rest
  return `#${path}${restWithoutHash}`
}

/**
 * 对 markdown-it 渲染出的 HTML 做站内链接改写。
 * 仅匹配 href 属性，代码块内的示例文本已被转义为实体，不会被误改。
 * @param {string} html
 * @returns {string}
 */
export function rewriteInternalDocLinks(html) {
  if (!html) return html
  return html.replace(/href="([^"]*)"/g, (_m, href) => `href="${toHashHref(href)}"`)
}
