/**
 * 全站搜索索引的**唯一来源**。
 *
 * 审计（2026-10-27）发现搜索只索引 /guide/*：组件页、高级页、案例目录、AI 证据页、
 * Playground 全都搜不到 —— 而站点的价值主张恰恰集中在这些页面上。本模块把「哪些页面
 * 可搜、搜到的标题/摘要从哪来」收敛到一处，DocSearch 只负责交互。
 *
 * 数据来源与取舍：
 *   - 指南：正文由调用方（`utils/search-engine.ts`）从 `docs/doc-registry` 传入 ——
 *     本模块**不许自己 import 语料**，否则语料又会跟着任何引用者进入口；
 *   - 固定页：`utils/page-meta`（逐页 title/description 的单一真源，check:page-meta 守）；
 *   - 案例：`cases/cases.json`（21 组案例目录，链接自带 `#demo-*` 锚点）；
 *   - 组件/高级：两个 `.data.ts` **按需**加载 —— 它们 `import.meta.glob(..., { eager: true })`
 *     把 103 个示例 SFC 原文（约 680KB）打进模块，不能进首屏包。见 search-engine 的
 *     loadExampleIndex()。
 *
 * 语言：正文只有中文单源（英文站除 4 篇指南外无译文）。英文站搜英文关键词只能命中
 * 有 contentEn 的指南 —— 这是翻译批次的事，索引层不造假：不给中文正文编英文关键词。
 */
import casesCatalog from '@/cases/cases.json'
import { PAGE_META } from '@/utils/page-meta'

/** 指南正文的形状：与 `docs/doc-registry` 的 DocEntry 兼容，但本模块只认它需要的字段 */
export type GuideDoc = { title: string; titleEn?: string; content: string; contentEn?: string }

export type SearchCategory = 'guide' | 'component' | 'advanced' | 'case' | 'ai' | 'tool'

export interface SearchEntry {
  /** 结果标题：页面标题，或「页面 › 小节」 */
  title: string
  /** 跳转地址，可带 `#anchor` */
  path: string
  category: SearchCategory
  /** 摘要文本，只进索引不出现在界面上（界面显示命中结果里的 mark 片段） */
  content: string
  /** 1 = 页面级，2 = 页面内小节/示例 */
  level: number
}

/** 固定页：路径与分类只在这里写一次。`not-found` 不进搜索（它是兜底页）。 */
const FIXED_PAGES: { key: keyof typeof PAGE_META; path: string; category: SearchCategory }[] = [
  { key: 'quickstart', path: '/quickstart', category: 'guide' },
  { key: 'cases', path: '/cases', category: 'case' },
  { key: 'flagship-approval', path: '/flagship-approval', category: 'case' },
  { key: 'ai-generated', path: '/ai-generated', category: 'ai' },
  { key: 'ai-gallery', path: '/ai-gallery', category: 'ai' },
  { key: 'ai-gallery-composition', path: '/ai-gallery/composition', category: 'ai' },
  { key: 'ai-gallery-workflows', path: '/ai-gallery/workflows', category: 'ai' },
  { key: 'fragment-dashboard', path: '/fragment-dashboard', category: 'ai' },
  { key: 'native-vs-ai', path: '/native-vs-ai', category: 'ai' },
  { key: 'playground', path: '/playground', category: 'tool' },
  { key: 'ai-crud', path: '/ai-crud', category: 'ai' },
]

// 与 Doc.vue 的标题锚点算法逐字一致，否则搜到的 #anchor 打不开
const slugify = (text: string) =>
  text.toLowerCase().replace(/[^\w一-龥]+/g, '-').replace(/^-|-$/g, '')

/** 指南：按 h1–h3 切段（代码块先剔除，避免 fence 里的 `## ` 被当成标题）。 */
export function buildGuideEntries(isEn: boolean, guideDocs: Record<string, GuideDoc>): SearchEntry[] {
  const entries: SearchEntry[] = []
  for (const slug of Object.keys(guideDocs)) {
    const doc = guideDocs[slug]
    const raw = isEn && doc.contentEn ? doc.contentEn : doc.content
    const pageTitle = (isEn && doc.titleEn) || doc.title
    const routePath = `/guide/${slug}`

    const lines = raw.replace(/```[\s\S]*?```/g, '').split('\n')

    let pageHeading = ''
    const headings: { level: number; text: string; lineIdx: number }[] = []
    lines.forEach((line, idx) => {
      const m = /^(#{1,3})\s+(.+?)\s*$/.exec(line)
      if (m) {
        const level = m[1].length
        const text = m[2].replace(/[*_`]/g, '').trim()
        if (level === 1 && !pageHeading) pageHeading = text
        headings.push({ level, text, lineIdx: idx })
      }
    })

    headings.forEach((h, i) => {
      const next = headings[i + 1]
      const bodyLines = lines.slice(h.lineIdx + 1, next ? next.lineIdx : h.lineIdx + 20)
      const content = bodyLines
        .join(' ')
        .replace(/[#>*_`|\-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200)

      entries.push({
        title: h.level === 1 ? h.text : `${pageHeading || pageTitle} › ${h.text}`,
        path: h.level === 1 ? routePath : `${routePath}#${slugify(h.text)}`,
        category: 'guide',
        content,
        level: h.level,
      })
    })
  }
  return entries
}

/** 固定页：标题/描述来自 PAGE_META，改文案只改那一个文件。 */
export function buildFixedEntries(): SearchEntry[] {
  return FIXED_PAGES.flatMap(({ key, path, category }) => {
    const meta = PAGE_META[key]
    if (!meta) return []
    return [{ title: meta.title, path, category, content: meta.description, level: 1 }]
  })
}

/**
 * 案例目录：每组一个「组标题」，每个案例一条，跳到主站对应示例的锚点。
 * 目录里 links.vue3 写的是主站路径（`/components/es-form#demo-basic`），可直接搜。
 */
export function buildCaseEntries(): SearchEntry[] {
  const entries: SearchEntry[] = []
  const levels = (casesCatalog as {
    levels: Record<string, { title: string; goal?: string; cases: { title: string; pain: string; win: string; links: Record<string, string> }[] }>
  }).levels

  for (const group of Object.values(levels)) {
    for (const c of group.cases) {
      const path = c.links?.vue3
      if (!path) continue
      entries.push({
        title: `${group.title} › ${c.title}`,
        path,
        category: 'case',
        // pain + win 是案例页上唯一的两句话，正好当摘要
        content: `${c.pain} ${c.win}`,
        level: 2,
      })
    }
  }
  return entries
}

type DocLike = {
  title: string
  description?: string
  features?: { name: string; desc: string }[]
  examples?: { key: string; title: string; description?: string }[]
  api?: { props?: { name: string; desc?: string }[] }
}

/**
 * 组件 / 高级页：页面一条 + 每个示例一条（`#demo-<key>` 锚点）。
 *
 * `docs` 由调用方传进来 —— 这两个模块含 680KB 示例源码，只能按需 import。
 */
export function buildExampleEntries(
  docs: Record<string, DocLike>,
  base: '/components' | '/advanced',
  category: SearchCategory,
): SearchEntry[] {
  const entries: SearchEntry[] = []
  for (const [name, doc] of Object.entries(docs)) {
    if (!doc || typeof doc.title !== 'string') continue

    // 页面级摘要：描述 + 特性名 + 主要 prop 名，开发者搜 formItemList / apiParams 能落到页
    const featureText = (doc.features ?? []).map((f) => `${f.name} ${f.desc}`).join(' ')
    const propText = (doc.api?.props ?? []).map((p) => `${p.name} ${p.desc ?? ''}`).join(' ')
    entries.push({
      title: doc.title,
      path: `${base}/${name}`,
      category,
      content: [doc.description ?? '', featureText, propText].join(' ').slice(0, 600),
      level: 1,
    })

    for (const ex of doc.examples ?? []) {
      if (!ex?.key) continue
      entries.push({
        title: `${doc.title} › ${ex.title}`,
        path: `${base}/${name}#demo-${ex.key}`,
        category,
        content: ex.description ?? '',
        level: 2,
      })
    }
  }
  return entries
}
