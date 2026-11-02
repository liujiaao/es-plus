/**
 * 分析统计运行时（审计 3.5）—— GoatCounter，无 Cookie、无需同意横幅。
 *
 * 单一真源是 `docs/analytics/analytics.json`：端点与事件名由 `scripts/check-analytics.mjs`
 * 对着那份文件核对三站一致（本文件、es-pc、es-eui 的同名文件三份端点与事件集必须相同）。
 * index.html 里的 `<script data-goatcounter>` 负责加载 count.js 并带 `no_onload`（不在硬加载时
 * 自动计数）；真正的计数全部由这里显式触发，因此 hash 路由下每条路由各计一次、互不吞没。
 *
 * 两类事件：
 *   · pageview —— 由各站 router 的 afterEach 调 `trackPageview(to.fullPath)`（afterEach 在首次
 *     导航也会跑，所以初次进入也计一次，不靠 count.js 的 onload）；
 *   · 关键事件 —— `initAnalytics()` 装一个委托点击监听，读被点元素最近的 `[data-track]`，
 *     事件名必须在 EVENT_NAMES 里（拼错/未登记的名字开发期 warn，不发出去）。
 *
 * 不碰 `document.cookie` / `localStorage`：GoatCounter 本就不设 Cookie，这也是守卫的一条断言
 * —— 一旦有人在这里按会话去重而用上存储，就破坏了「无同意负担」这个前提。
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
] as const

type GoatCounter = { count?: (opts: { path: string; title?: string; event?: boolean }) => void }
const gc = (): GoatCounter | undefined => (window as unknown as { goatcounter?: GoatCounter }).goatcounter

/** 一次 pageview：path 用路由全路径（含 hash 段），不同路由各计一次 */
export function trackPageview(path: string): void {
  gc()?.count?.({ path })
}

/** 一次关键事件：name 必须在词表里 */
export function trackEvent(name: string): void {
  if (!(EVENT_NAMES as readonly string[]).includes(name)) {
    if (import.meta.env?.DEV) console.warn(`[analytics] 未登记的事件名：${name}（见 docs/analytics/analytics.json）`)
    return
  }
  gc()?.count?.({ path: name, event: true })
}

/** 装一次全局委托：点到带 data-track 的元素就发对应事件（整个 app 只需调一次） */
export function initAnalytics(): void {
  document.addEventListener(
    'click',
    (e) => {
      const el = (e.target as Element | null)?.closest?.('[data-track]')
      const name = el?.getAttribute('data-track')
      if (name) trackEvent(name)
    },
    { passive: true },
  )
}
