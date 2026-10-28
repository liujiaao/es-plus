// 手写类型声明：site-seo.js 是 scripts/sync-theme.mjs 从 docs/theme/ 分发的单源实现
// （模块本身必须保持无类型的纯 JS，另两站是 JS + webpack 工程，用不了 .ts）。
// 改 API 时两处一起改：docs/theme/site-seo.js 与这里。

/** 只用到路由对象的三样：路径、合并后的 meta、命中的路由记录（取最后一条判 404） */
export interface SeoRouteLike {
  path?: string
  meta?: { duplicate?: boolean; [key: string]: unknown }
  matched?: Array<{ name?: unknown; meta?: { duplicate?: boolean } }>
}

/**
 * 按当前路由写 `<link rel="canonical">`、`<meta property="og:url">` 与
 * `<meta name="robots">`。在 `router.afterEach` 里调用。
 */
export function applyPageSeo(to: SeoRouteLike | null | undefined): void
