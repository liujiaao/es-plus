/**
 * `doc-markdown.mjs` 的类型声明。
 *
 * 实现故意是 `.mjs` 而不是 `.ts`：守卫脚本（Node 直接运行）与站点（Vite 打包）
 * 必须跑**同一份**渲染器，`.mjs` 两边都能直接加载；类型只服务于站点侧。
 */

export interface FenceInfo {
  lang: string
  title: string
}

export function escapeHtmlAttr(value: unknown): string
export function parseFenceInfo(info: string): FenceInfo
export function highlightCode(raw: string, lang: string): string
export function renderCodeBlock(md: unknown, raw: string, info: string): string
export function expandContainers(md: unknown, markdown: string): string
export function addHeadingIds(html: string): string
export function createDocMarkdown(): unknown
export function renderDocMarkdown(markdown: string): string
