/**
 * 指南正文的**浏览器侧加载器**：一次取一篇。
 *
 * 以前正文是 `doc-registry.ts` 里的静态 `?raw` import，而注册表被搜索索引静态引用，
 * 于是每一页的首屏都背着全部指南（343 KB 原文 / 120 KB gz）。这里改成惰性 glob：
 * Vite 给每一份 .md 生成一个独立的小 chunk，路由切到哪篇就只下载那篇。
 *
 * 为什么不用 `docsData[slug].content`：那个形状要求注册表本身进包 —— 见 doc-registry.ts
 * 的注释。标题走 `doc-meta.ts`（几百字节），正文走这里。
 *
 * 缓存：切回已经读过的文章不再发请求（`loadGuide` 的 Promise 按 slug 记忆）。
 * 英文正文的文件名由 `DOC_META[slug].enFile` 决定（默认 `<slug>.en.md`），
 * 没有译文就是 undefined —— 页面据此显示「本文暂无译文」的横幅，而不是空白。
 */
import { DOC_META } from './doc-meta'

const mdFiles = import.meta.glob('./*.md', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>

const cache = new Map<string, Promise<string>>()

function read(key: string): Promise<string> {
  let pending = cache.get(key)
  if (!pending) {
    pending = mdFiles[key]()
    cache.set(key, pending)
  }
  return pending
}

export type GuideContent = { content: string; contentEn?: string }

/**
 * 取一篇指南的正文。slug 不在 `DOC_META` 里返回 null（路由会渲染「未找到」）；
 * 在 `DOC_META` 里却没有对应 .md 属于注册表漂移 —— 直接抛错，别静默渲染空页。
 *
 * `wantEn` 只在英文站为真：中文站不该为了「可能有用」把英文正文也拉下来
 * （4 篇译文里 why-es-plus 一篇就 48 KB）。语言切换时按同一 slug 重取即可命中缓存。
 */
export async function loadGuide(slug: string, opts: { wantEn?: boolean } = {}): Promise<GuideContent | null> {
  const meta = DOC_META[slug]
  if (!meta) return null
  const zhKey = `./${slug}.md`
  if (!mdFiles[zhKey]) throw new Error(`doc-meta.ts 声明了 '${slug}'，但 src/docs/${slug}.md 不存在`)
  const content = await read(zhKey)
  if (!opts.wantEn) return { content }
  const enKey = `./${meta.enFile ?? `${slug}.en`}.md`
  if (!mdFiles[enKey]) return { content }
  return { content, contentEn: await read(enKey) }
}

/** 当前构建里有英文正文的 slug（供「哪些页有译文」这类界面提示使用） */
export function hasEnglish(slug: string): boolean {
  const meta = DOC_META[slug]
  if (!meta) return false
  return Boolean(mdFiles[`./${meta.enFile ?? `${slug}.en`}.md`])
}
