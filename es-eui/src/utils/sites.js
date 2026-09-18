/**
 * 三端站点清单 —— 站点切换器与案例卡跨端互链共用的一份数据。
 *
 * `SITES` 是三站共同维护的列表，内容必须逐字一致，由 scripts/check-site-nav.mjs 校验。
 * 该门禁同时断言：每项只有一个 `url`（即 CI 实际部署到的地址）、url 的路径 ==
 * 部署工作流把该站拷贝到的子路径、地址基准 == 文档站 vite.config.ts 的 SITE_HOSTNAME。
 *
 * 为什么从布局组件里抽出来：**案例卡也要用它拼跨端链接**。留在布局组件里的话，
 * 案例页就得再抄一份地址表 —— 那会成为第 4 份副本，而门禁只覆盖布局里那一份
 * （这类"两份记录只改一处"的漂移在这个仓库里已经出现过多次）。
 *
 * 每项三个字段各司其职：
 *   - `key`   ：身份，与 cases.json 的 links 键、本站 SITE_KEY 对应；
 *   - `label` ：切换器里的完整写法（含 UI 库后缀）；
 *   - `short` ：案例卡这类空间紧张处的短写法。
 */
export const SITES = [
  {
    key: 'vue3',
    label: 'Vue 3 · Element Plus',
    short: 'Vue 3 · EP',
    url: 'https://liujiaao.github.io/es-plus/',
  },
  {
    key: 'antdv',
    label: 'Vue 3 · Ant Design Vue',
    short: 'Vue 3 · AntDV',
    url: 'https://liujiaao.github.io/es-plus/es-pc/',
  },
  {
    key: 'vue2',
    label: 'Vue 2 · Element UI',
    short: 'Vue 2 · EUI',
    url: 'https://liujiaao.github.io/es-plus/es-eui/',
  },
]

/**
 * 本站身份：直接声明，不从 hostname/pathname 反推。
 * 反推覆盖不了 localhost、预览环境与将来的自有域名，猜错会显示错误的当前站
 * 并把用户送去别站地址。该常量与 SITES 的一致性由 check-site-nav.mjs 校验。
 */
export const SITE_KEY = 'vue2'

/** 该 key 对应的站点（找不到时返回 undefined，调用方自行兜底） */
export const siteOf = (key) => SITES.find((s) => s.key === key)

/**
 * 跨端链接：把某站在**它自己站内**的路由路径拼成该站的绝对地址。
 *
 * 三站都是 hash 路由（createWebHashHistory / VueRouter mode:'hash'），
 * 所以形如 `https://…/es-pc/#/es-form`；cases.json 里的 links 存的是站内路径
 * （`/es-form`），这里补上站点前缀与 `#`。
 */
export function crossSiteUrl(key, path) {
  const site = siteOf(key)
  if (!site || !path) return site?.url ?? '#'
  // 必须保留前导斜杠：三站都是 hash 路由，正确形式是 `#/es-form`。
  // 写成 `#es-form`（少了斜杠）vue-router 匹配不到该路径，会落到 404/兜底页 ——
  // 这个错误在构建产物里看不出来（URL 结构看起来完全正常），只能靠真点一次发现。
  return `${site.url}#${path.startsWith('/') ? path : '/' + path}`
}
