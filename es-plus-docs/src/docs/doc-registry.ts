// 指南文档的**唯一注册表**：Doc.vue（渲染路由）与 DocSearch.vue（搜索索引）都从这里取，
// 避免「搜索按目录 glob 建索引、路由按白名单渲染」两条链路各自演化 —— 那会让搜索搜出
// /guide/getting-started.en、/guide/migrate-v1.4 这类**没有路由**的死链接。
//
// 约定：
// - 只有这里的 key 才是可访问的 /guide/:name；
// - `*.en.md` 是某个 slug 的英文正文（contentEn），不是独立路由；
// - 新增文档时只改本文件，Doc.vue 与搜索会同时生效。
import gettingStartedMd from '@/docs/getting-started.md?raw'
import installationMd from '@/docs/installation.md?raw'
import usageMd from '@/docs/usage.md?raw'
import vue2Md from '@/docs/vue2.md?raw'
import adapterAntdvMd from '@/docs/adapter-antdv.md?raw'
import mcpServerMd from '@/docs/mcp-server.md?raw'
import cliMd from '@/docs/cli.md?raw'
import permissionI18nMd from '@/docs/permission-i18n.md?raw'
import migrationMd from '@/docs/migration.md?raw'
// 英文迁移指南：单源是根 docs/migrate-v1.4.md（由 sync-docs.mjs 镜像）。
// 文件名保持历史命名，但它是 migration 的 contentEn，不是独立页面。
import migrationEnMd from '@/docs/migrate-v1.4.md?raw'
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

import gettingStartedEnMd from '@/docs/getting-started.en.md?raw'
import mcpServerEnMd from '@/docs/mcp-server.en.md?raw'
import vue2EnMd from '@/docs/vue2.en.md?raw'
import whyEsPlusEnMd from '@/docs/why-es-plus.en.md?raw'

export type DocEntry = { title: string; content: string; titleEn?: string; contentEn?: string }

export const docsData: Record<string, DocEntry> = {
  'why-es-plus': { title: '为什么是 ES-Plus', content: whyEsPlusMd, titleEn: 'Why ES-Plus', contentEn: whyEsPlusEnMd },
  'getting-started': { title: '快速开始', content: gettingStartedMd, titleEn: 'Getting Started', contentEn: gettingStartedEnMd },
  'installation': { title: '安装', content: installationMd },
  'usage': { title: '使用', content: usageMd },
  'vue2': { title: 'Vue 2 指南', content: vue2Md, titleEn: 'Vue 2 Guide', contentEn: vue2EnMd },
  'adapter-antdv': { title: 'Ant Design Vue 适配器', content: adapterAntdvMd, titleEn: 'Ant Design Vue Adapter' },
  'mcp-server': { title: 'MCP Server', content: mcpServerMd, titleEn: 'MCP Server', contentEn: mcpServerEnMd },
  'cli': { title: 'CLI 工具', content: cliMd },
  'permission-i18n': { title: '权限与国际化', content: permissionI18nMd },
  'schema-setup': { title: 'IDE 配置自动补全', content: schemaSetupMd },
  'migration': { title: '迁移指南', content: migrationMd, titleEn: 'Migration Guide', contentEn: migrationEnMd },
  'changelog': { title: '更新日志', content: changelogMd },
  // 生态与关于（顺序与侧栏一致：先决策材料，再路线图，最后参与方式）
  'faq': { title: '常见问题', content: faqMd },
  'comparison': { title: '与其它方案对比', content: comparisonMd },
  'benchmark': { title: '性能与准确率基准', content: benchmarkMd },
  'roadmap': { title: '路线图与版本策略', content: roadmapMd },
  'vue2-eol': { title: 'Vue 2 支持周期', content: vue2EolMd },
  'contributing': { title: '贡献指南', content: contributingMd }
}

/** 可访问的 /guide/:name 集合（Doc.vue 渲染与搜索索引共用） */
export const GUIDE_SLUGS = Object.keys(docsData)
