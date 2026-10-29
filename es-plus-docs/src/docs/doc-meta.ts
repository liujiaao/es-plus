/**
 * 指南的**元数据**：可访问的 slug、中英标题、英文正文的文件名。
 *
 * 为什么不和正文放在一起：正文是 24 份 markdown（343 KB 原文 / 120 KB gz），以前它们
 * 静态 import 在 `doc-registry.ts` 里，而注册表又被搜索索引静态引用 —— 于是**每一页**的
 * 首屏都背着全部指南正文（`index` 那个块 219.8 KB gz 里的大头）。
 *
 * 现在分两条腿：
 *   · 浏览器：本文件（几百字节）给标题与 slug；正文由 `doc-content.ts` 用惰性 glob
 *     按 slug 单独取（一次一篇）。
 *   · 构建侧：`doc-registry.ts` 仍然静态 import 全部正文 —— prerender / llms / sitemap
 *     这些脚本在 Node 里跑，没有 `import.meta.glob`，也不在乎首屏。
 *
 * 两条腿必须叠在同一个 slug 清单上，否则「侧栏有、页面没有」这类漂移会静默发生：
 * `npm run check:bundle-sources` 会对账本文件、`doc-registry.ts`、磁盘上的 .md 三处。
 *
 * `enFile` 是**不带 .md 的文件名**，只有六个历史例外需要显式写（迁移指南的英文正文
 * 是 `migrate-v1.4.md`）；其余英文正文一律叫 `<slug>.en.md`。带了 `titleEn` 却没有
 * 英文正文的（如 adapter-antdv）就是「只有标题译了，正文仍是中文」。
 */
export type DocMeta = { title: string; titleEn?: string; enFile?: string }

export const DOC_META: Record<string, DocMeta> = {
  'why-es-plus': { title: '为什么是 ES-Plus', titleEn: 'Why ES-Plus', enFile: 'why-es-plus.en' },
  'getting-started': { title: '快速开始', titleEn: 'Getting Started', enFile: 'getting-started.en' },
  'installation': { title: '安装' },
  'usage': { title: '使用' },
  // 整页 CRUD 的完整指南：与 /components/es-crud-page（API 页）分工不同 ——
  // 那页是「有哪些键」，这页是「按什么顺序把整页配出来」。
  'crud-page': { title: '整页 CRUD（EsCrudPage）' },
  'vue2': { title: 'Vue 2 指南', titleEn: 'Vue 2 Guide', enFile: 'vue2.en' },
  'adapter-antdv': { title: 'Ant Design Vue 适配器', titleEn: 'Ant Design Vue Adapter' },
  'mcp-server': { title: 'MCP Server', titleEn: 'MCP Server', enFile: 'mcp-server.en' },
  'cli': { title: 'CLI 工具' },
  'permission-i18n': { title: '权限与国际化' },
  'schema-setup': { title: 'IDE 配置自动补全' },
  'migration': { title: '迁移指南', titleEn: 'Migration Guide', enFile: 'migrate-v1.4' },
  'changelog': { title: '更新日志' },
  // 生态与关于（路线图 3.7）：顺序与侧栏一致 —— 先决策材料，再路线图，最后参与方式
  'faq': { title: '常见问题' },
  'comparison': { title: '与其它方案对比' },
  'benchmark': { title: '性能与准确率基准' },
  'roadmap': { title: '路线图与版本策略' },
  'vue2-eol': { title: 'Vue 2 支持周期' },
  'contributing': { title: '贡献指南' },
}

/** 可访问的 /guide/:name 集合（侧栏、搜索、Doc.vue 渲染与构建期脚本共用） */
export const GUIDE_SLUGS = Object.keys(DOC_META)
