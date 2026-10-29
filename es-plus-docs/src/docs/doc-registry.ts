// 指南文档的**构建侧注册表**：slug → 正文。
//
// 谁用得到它：prerender（生成 26 个内容页静态 HTML）、llms（.md 镜像）、sitemap、
// nav-coverage —— 全部在 Node 里跑，静态 import 正好合适。**浏览器不再静态引用它**：
// 首屏只需要标题（`doc-meta.ts`）与当前这一篇的正文（`doc-content.ts` 惰性 glob），
// 搜索索引则把这个模块连同全部正文一起装进按需 chunk（`utils/search-engine.ts`）。
//
// 曾经它是「Doc.vue + 搜索索引」共同的静态来源，等于每一页都背着 343 KB 指南正文。
// 现在分工是：
//   · 标题 / slug / 英文字尾 → `doc-meta.ts`（单一真源，本文件直接引用）
//   · 本文件 → 正文（静态 `?raw`），只给构建期与按需 chunk 用
//   · `doc-content.ts` → 浏览器按 slug 惰性取正文
// 三处必须在同一份清单上，`npm run check:bundle-sources` 会逐个对账。
import { DOC_META } from './doc-meta'

import gettingStartedMd from '@/docs/getting-started.md?raw'
import installationMd from '@/docs/installation.md?raw'
import usageMd from '@/docs/usage.md?raw'
import crudPageMd from '@/docs/crud-page.md?raw'
import vue2Md from '@/docs/vue2.md?raw'
import adapterAntdvMd from '@/docs/adapter-antdv.md?raw'
import mcpServerMd from '@/docs/mcp-server.md?raw'
import cliMd from '@/docs/cli.md?raw'
import permissionI18nMd from '@/docs/permission-i18n.md?raw'
import migrationMd from '@/docs/migration.md?raw'
import changelogMd from '@/docs/changelog.md?raw'
import schemaSetupMd from '@/docs/schema-setup.md?raw'
import whyEsPlusMd from '@/docs/why-es-plus.md?raw'
// 生态与关于（路线图 3.7）：FAQ / 对比 / 基准 / 路线图 / Vue 2 周期 / 贡献。
// 这六篇是「要不要采用」的决策材料，与组件 API 同等重要 —— 此前三站都没有。
import faqMd from '@/docs/faq.md?raw'
import comparisonMd from '@/docs/comparison.md?raw'
import benchmarkMd from '@/docs/benchmark.md?raw'
import roadmapMd from '@/docs/roadmap.md?raw'
import vue2EolMd from '@/docs/vue2-eol.md?raw'
import contributingMd from '@/docs/contributing.md?raw'

// 英文正文：哪些 slug 有译文由 doc-meta 的 enFile 决定，这里只是「文件 → 字符串」的搬运。
import gettingStartedEnMd from '@/docs/getting-started.en.md?raw'
import mcpServerEnMd from '@/docs/mcp-server.en.md?raw'
import vue2EnMd from '@/docs/vue2.en.md?raw'
import whyEsPlusEnMd from '@/docs/why-es-plus.en.md?raw'
// 英文迁移指南：单源是根 docs/migrate-v1.4.md（由 sync-docs.mjs 镜像）。
// 文件名保持历史命名，但它是 migration 的英文正文，不是独立页面。
import migrationEnMd from '@/docs/migrate-v1.4.md?raw'

/** 中文正文：键就是可访问的 slug */
const CONTENT: Record<string, string> = {
  'why-es-plus': whyEsPlusMd,
  'getting-started': gettingStartedMd,
  'installation': installationMd,
  'usage': usageMd,
  'crud-page': crudPageMd,
  'vue2': vue2Md,
  'adapter-antdv': adapterAntdvMd,
  'mcp-server': mcpServerMd,
  'cli': cliMd,
  'permission-i18n': permissionI18nMd,
  'schema-setup': schemaSetupMd,
  'migration': migrationMd,
  'changelog': changelogMd,
  'faq': faqMd,
  'comparison': comparisonMd,
  'benchmark': benchmarkMd,
  'roadmap': roadmapMd,
  'vue2-eol': vue2EolMd,
  'contributing': contributingMd,
}

/** 英文正文：键仍是 slug（文件名由 doc-meta 的 enFile 决定） */
const CONTENT_EN: Record<string, string> = {
  'why-es-plus': whyEsPlusEnMd,
  'getting-started': gettingStartedEnMd,
  'vue2': vue2EnMd,
  'mcp-server': mcpServerEnMd,
  'migration': migrationEnMd,
}

export type DocEntry = { title: string; content: string; titleEn?: string; contentEn?: string }

export const docsData: Record<string, DocEntry> = Object.fromEntries(
  Object.entries(CONTENT).map(([slug, content]) => {
    const meta = DOC_META[slug]
    // 标题缺失必须响亮地失败：Object.fromEntries 会安静地写出 { undefined, ... }，
    // 页面标题变成空白而没人知道为什么。
    if (!meta) throw new Error(`doc-meta.ts 里没有 '${slug}' —— 三处 slug 清单已经漂移`)
    const entry: DocEntry = { title: meta.title, content }
    if (meta.titleEn) entry.titleEn = meta.titleEn
    if (CONTENT_EN[slug]) entry.contentEn = CONTENT_EN[slug]
    return [slug, entry]
  }),
)

/** 可访问的 /guide/:name 集合（真源在 doc-meta，这里转出去是为了不打扰老调用方） */
export { GUIDE_SLUGS } from './doc-meta'
