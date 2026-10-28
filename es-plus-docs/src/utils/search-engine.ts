/**
 * 全站搜索的**按需引擎**：Fuse + 全部可搜内容，只在用户第一次打开搜索时才下载。
 *
 * 为什么单独一个模块：搜索索引的数据源里装着**全部指南正文**（343 KB 原文 / 120 KB gz）、
 * 案例目录、逐页 meta。它们以前跟着 `DocSearch.vue` 静态进入口，等于每一页都先把
 * 整站正文读一遍再说。现在这个模块只被 `DocSearch.vue` 用 `await import()` 取一次，
 * 之后走浏览器缓存。
 *
 * 两段式装载，别合并：
 *   · 第一段（`ensureIndex`）等**指南 / 固定页 / 案例**就绪就返回 —— 用户在输入框里
 *     打完第一个词时索引已经能用；
 *   · 第二段（示例索引）会拖进两个 `.data.ts`（103 个示例 SFC 原文，约 680 KB），
 *     放后台跑；回来之后 `onIndexUpdate` 通知调用方把当前查询重跑一遍。
 *   合并会让首屏搜索体验多等 680 KB。
 */
import Fuse from 'fuse.js'
import { docsData } from '@/docs/doc-registry'
import {
  buildCaseEntries,
  buildExampleEntries,
  buildFixedEntries,
  buildGuideEntries,
  type SearchCategory,
  type SearchEntry,
} from '@/utils/search-index'

let fuse: Fuse<SearchEntry> | null = null
let builtLang = ''
let labelFor: (category: SearchCategory) => string = () => ''
let baseEntries: SearchEntry[] = []
let exampleEntries: SearchEntry[] = []
let ensurePromise: Promise<void> | null = null
let examplePromise: Promise<void> | null = null
const listeners = new Set<() => void>()

const notify = () => {
  for (const cb of listeners) {
    try {
      cb()
    } catch {
      /* 一个订阅者出错不该拖垮其他订阅者 */
    }
  }
}

/** 索引变更（第二段装载完成）时回调；返回取消订阅的函数 */
export function onIndexUpdate(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function buildFuse(): void {
  fuse = new Fuse([...baseEntries, ...exampleEntries], {
    keys: [
      { name: 'title', weight: 0.6 },
      { name: 'content', weight: 0.3 },
      // 路径参与检索：「mcp」「es-form」这类词直接落在 URL 里；
      // 分类用本地化文案而不是内部 key（搜「组件」要命中，搜 component 也要命中）
      { name: 'path', weight: 0.05 },
      { name: 'category', weight: 0.05, getFn: (item: SearchEntry) => labelFor(item.category) },
    ],
    threshold: 0.4,
    ignoreLocation: true,
    minMatchCharLength: 2,
  })
}

function loadExampleIndex(): Promise<void> {
  if (examplePromise) return examplePromise
  examplePromise = (async () => {
    try {
      const [{ docsData: componentDocs }, { docsData: advancedDocs }] = await Promise.all([
        import('@/views/component-doc.data'),
        import('@/views/advanced-doc.data'),
      ])
      exampleEntries = [
        ...buildExampleEntries(componentDocs, '/components', 'component'),
        ...buildExampleEntries(advancedDocs, '/advanced', 'advanced'),
      ]
      if (fuse) buildFuse()
      notify()
    } catch (e) {
      // 索引加载失败不该让搜索不可用：指南 / 案例 / 固定页仍在
      console.warn('[search-engine] 组件索引加载失败', e)
    }
  })()
  return examplePromise
}

/**
 * 装载第一段索引。语言切换会重建（英文站只索引有 contentEn 的指南）；
 * `labelFor` 每次都会更新 —— 它决定「搜『组件』能不能命中 component」。
 */
export function ensureIndex(lang: string, label: (category: SearchCategory) => string): Promise<void> {
  labelFor = label
  if (ensurePromise && builtLang === lang) return ensurePromise
  const isEn = lang === 'en-US'
  baseEntries = [
    ...buildGuideEntries(isEn, docsData),
    ...buildFixedEntries(),
    // 案例目录只有中文正文：英文站不索引，免得搜出「摘要与查询语言无关」的噪音
    ...(isEn ? [] : buildCaseEntries()),
  ]
  builtLang = lang
  buildFuse()
  ensurePromise = loadExampleIndex()
  return Promise.resolve()
}

/** 同步查询：调用前必须先 await ensureIndex（否则索引是空的） */
export function search(query: string): SearchEntry[] {
  if (!fuse || !query) return []
  return fuse.search(query).slice(0, 30).map((r) => r.item)
}

/** 当前索引条目数（自测与守卫用得上：0 条意味着尺子坏了） */
export function entryCount(): number {
  return baseEntries.length + exampleEntries.length
}
