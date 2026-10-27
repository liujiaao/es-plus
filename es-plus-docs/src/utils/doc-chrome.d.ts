// 手写类型声明：doc-chrome.js 是 scripts/sync-theme.mjs 从 docs/theme/ 分发的单源实现
// （模块本身必须保持无类型的纯 JS，另两站是 JS + webpack 工程，用不了 .ts）。
// 改 API 时两处一起改：docs/theme/doc-chrome.js 与这里。

export interface DocHeading {
  id: string
  text: string
  level: number
  el: HTMLElement
}

export function slugifyHeading(text: string): string

export function collectHeadings(root: Element | Document | null, selector?: string): DocHeading[]

export function createScrollSpy(
  headings: DocHeading[],
  options?: { onChange?: (id: string) => void; offset?: number }
): { stop: () => void; focus: (id: string) => void }

export function scrollToHeading(id: string | HTMLElement, options?: { offset?: number }): void

/** 收尾条取数口：编辑此页 / 报告问题 / 最后更新 */
export const REPO_URL: string
export const REPO_BRANCH: string
export function editUrlFor(pathInRepo: string): string
export function issueUrlFor(title: string): string
export function lastUpdatedFor(key: string): string
