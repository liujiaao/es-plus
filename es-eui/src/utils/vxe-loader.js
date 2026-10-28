/**
 * vxe 引擎的**按需加载门** —— 哪些路由真的会渲染 `engine: 'vxe'`，在这里说清楚。
 *
 * 背景与另两站完全相同：`vxe-table` + `vxe-pc-ui` 全量注册让它们进了 `chunk-vendors`，
 * 于是**每一页**（含首页与全部指南）都先付这笔钱，而真正用到它的只有
 * `/component/vxetable` 的示例与 `/ai-gallery/<id>` 的 engine-lab 案例。
 *
 * 这里只做两件事：判断「这一页要不要」，以及把 `import('./vxe-install')` 收敛成一次。
 * 加载失败（离线、产物缺块）时**不阻塞导航**：页面照常渲染，EsTable 会按「未注册 vxe」
 * 的既有约定给出提示——白屏比提示更难诊断。
 *
 * 清单由 `scripts/check-bundle-sources.mjs` 从数据反查，少一条就红。
 */
export const VXE_ROUTE_NAMES = {
    /** `/component/vxetable`：17 个 `examples/vxe-table/*` 示例全部走 vxe 引擎 */
    vxeTableDocs: 'VxeTableDocs',
    /** `/ai-gallery/<id>`：画廊详情页，宿主按案例 JSON 渲染 */
    galleryCase: 'AiGalleryCase',
}

/** 这一条路由会不会渲染 vxe？ */
export function needsVxe(route) {
    const name = typeof route.name === 'string' ? route.name : ''
    return name === VXE_ROUTE_NAMES.vxeTableDocs || name === VXE_ROUTE_NAMES.galleryCase
}

/** 共享的模块加载：无论多少条路由要 vxe，`import()` 只发生一次 */
let loading = null
let installed = false

/** 确保 vxe 已注册到 Vue；重复调用无副作用 */
export function ensureVxe(Vue) {
    if (installed) return Promise.resolve()
    loading = loading || import('./vxe-install')
    return loading.then((mod) => {
        // 并发调用（快速连点两条 vxe 路由）时，两次 then 都会走到这里
        if (installed) return
        mod.installVxe(Vue)
        installed = true
    })
}

/** vxe 是否已注册 */
export function hasVxe() {
    return installed
}
