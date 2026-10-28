/**
 * vxe 引擎的**按需加载门** —— 哪些路由真的会渲染 `engine: 'vxe'`，在这里说清楚。
 *
 * 背景：`vxe-table` + `vxe-pc-ui` 全量注册是 344.2 KB gz，以前写在 `main.js` 顶层，
 * 于是**每一页**（含首页与全部组件页）都先付这笔钱，而真正用到它的只有
 * `/es-vxe-table` 的 17 个示例与 `/ai-gallery/<id>` 的 engine-lab 案例。
 *
 * 这里只做两件事：判断「这一页要不要」，以及把 `import('./vxe-install')` 收敛成一次。
 * 加载失败（离线、产物缺块）时**不阻塞导航**：页面照常渲染，EsTable 会按「未注册 vxe」
 * 的既有约定给出提示——白屏比提示更难诊断。
 *
 * 与主站 es-plus-docs 的 utils/vxe-loader.ts 同构（那边是 TS，这边是 JS）。
 * 清单由 `scripts/check-bundle-sources.mjs` 从数据反查，少一条就红。
 */
export const VXE_ROUTE_NAMES = {
  /** `/es-vxe-table`：workspace 页，17 个 `views/es-vxe/*` 示例全部走 vxe 引擎 */
  esVxeTable: 'EsVxeTable',
  /** `/ai-gallery/<id>`：AiGallery 的详情分支，宿主是 AiCaseHost */
  galleryCase: 'AiGalleryCase',
}

/** 这一条路由会不会渲染 vxe？ */
export function needsVxe(route) {
  const name = typeof route.name === 'string' ? route.name : ''
  return name === VXE_ROUTE_NAMES.esVxeTable || name === VXE_ROUTE_NAMES.galleryCase
}

/** 共享的模块加载：无论多少条路由要 vxe，`import()` 只发生一次 */
let loading = null
/** 已经注册过 vxe 的 app */
const installed = new WeakSet()

/** 确保某个 app 已注册 vxe；重复调用无副作用 */
export function ensureVxe(app) {
  if (installed.has(app)) return Promise.resolve()
  loading = loading || import('./vxe-install')
  return loading.then((mod) => {
    // 并发调用（快速连点两条 vxe 路由）时，两次 then 都会走到这里
    if (installed.has(app)) return
    mod.installVxe(app)
    installed.add(app)
  })
}

/** 这个 app 是否已注册 vxe */
export function hasVxe(app) {
  return installed.has(app)
}
