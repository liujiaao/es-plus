/**
 * 分析统计运行时（审计 3.5）—— GoatCounter，无 Cookie、无需同意横幅。
 *
 * 与 es-plus-docs/src/utils/analytics.ts 逐条同构（端点与事件词表由
 * scripts/check-analytics.mjs 对着 docs/analytics/analytics.json 核对三站一致）。
 * 这是 Vue 3 (Vite) 子站的一份；注释详见主站那份。
 */

/** 端点：与 docs/analytics/analytics.json 的 endpoint 一致（check:analytics 校验） */
export const ANALYTICS_ENDPOINT = 'https://es-plus.goatcounter.com/count'

/** 事件词表：与 docs/analytics/analytics.json 的 events[].name 一致（check:analytics 校验） */
export const EVENT_NAMES = [
  'search-open',
  'search-hit',
  'copy-command',
  'download-schema',
  'ai-gallery-open',
  'example-copy',
  'example-lang',
  'cta-start',
]

// 路由会被 Node 里的门禁真求值（gen-site-seo --check 模拟 afterEach）：没有 window 时
// 分析统计缺席是正常状态，静默跳过，别让守卫链在这里崩掉。
const gc = () => (typeof window === "undefined" ? undefined : window.goatcounter)

export function trackPageview(path) {
  gc()?.count?.({ path })
}

export function trackEvent(name) {
  if (!EVENT_NAMES.includes(name)) {
    if (import.meta.env?.DEV) console.warn(`[analytics] 未登记的事件名：${name}（见 docs/analytics/analytics.json）`)
    return
  }
  gc()?.count?.({ path: name, event: true })
}

export function initAnalytics() {
  document.addEventListener(
    'click',
    (e) => {
      const el = e.target?.closest?.('[data-track]')
      const name = el?.getAttribute('data-track')
      if (name) trackEvent(name)
    },
    { passive: true },
  )
}
