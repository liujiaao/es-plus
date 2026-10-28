/**
 * vxe 引擎的**按需加载门**——哪些路由 / 视图真的会渲染 `engine: 'vxe'`，就在这里说清楚。
 *
 * 背景（也是这个文件存在的唯一理由）：`vxe-table` + `vxe-pc-ui` 全量注册是 344.2 KB gz，
 * 以前写在 `main.ts` 的顶层，于是**每一页**（含首页与全部指南）都先付这笔钱，而真正
 * 用到它的只有 `/advanced/vxe-table` 的 19 个示例与 `/ai-gallery` 的 engine-lab 案例。
 *
 * 这里只做两件事：判断「这一页要不要」，以及把 `import('./vxe-install')` 收敛成一次。
 * 加载失败（离线、产物缺块）时**不阻塞导航**：页面照常渲染，EsTable 会按「未注册 vxe」
 * 的既有约定给出提示——白屏比提示更难诊断。
 */
import type { App } from 'vue'

/**
 * 会渲染 `engine: 'vxe'` 的路由。
 *
 * 判据不是「名字里带 vxe 的页面」，而是数据：`src/components/examples/vxe-table/*` 是
 * `/advanced/vxe-table` 的示例，`src/cases/generated/engine-lab.json` 的 `tableOptions.engine`
 * 是 `"vxe"` 且由 `/ai-gallery/<id>` 的宿主渲染。`scripts/check-bundle-sources.mjs` 从这两处
 * 数据反查，**本清单少一条就红**——新增 vxe 示例或 vxe 案例时要同步改这里。
 *
 * 画廊**列表**页（`ai-gallery`）不在清单里：它只渲染案例卡，一张表都不建
 * （实测 `.es-crud-page` 0 个）—— 让列表页白等 344KB 是上一版的门写成前缀匹配的代价。
 */
export const VXE_ROUTE_NAMES = {
  /** `/advanced/:name`，只有 vxe-table 这一篇用 vxe 引擎 */
  advancedVxeTable: 'vxe-table',
  /** `/ai-gallery/<id>`：AiGallery.vue 的详情分支，宿主是 AiCaseHost */
  galleryCase: 'ai-gallery-case',
} as const

/** 这一条路由会不会渲染 vxe？ */
export function needsVxe(route: { name?: unknown; params?: Record<string, unknown> }): boolean {
  const name = typeof route.name === 'string' ? route.name : ''
  if (name === 'advanced') return route.params?.name === VXE_ROUTE_NAMES.advancedVxeTable
  return name === VXE_ROUTE_NAMES.galleryCase
}

/** 共享的模块加载：无论多少条路由/子应用要 vxe，`import()` 只发生一次 */
let loading: Promise<typeof import('./vxe-install')> | null = null
/** 已经注册过 vxe 的 app —— 主应用与文档内示例子应用各算一个 */
const installed = new WeakSet<App>()

/** 确保某个 app 已注册 vxe；重复调用无副作用 */
export function ensureVxe(app: App): Promise<void> {
  if (installed.has(app)) return Promise.resolve()
  loading = loading || import('./vxe-install')
  return loading.then((mod) => {
    // 并发调用（快速连点两条 vxe 路由）时，两次 then 都会走到这里
    if (installed.has(app)) return
    mod.installVxe(app)
    installed.add(app)
  })
}

/** 这个 app 是否已注册 vxe（示例宿主判断要不要 await） */
export function hasVxe(app: App): boolean {
  return installed.has(app)
}
