/**
 * 逐页 title / description 的单一来源。
 *
 * 现状（2026-10-27 审计）：17 条路由里只有 Home / Doc / ComponentDoc 三处调了
 * useHead，其余 13 个视图（营销页、AI 证据页、工具页、404）共用 index.html 的
 * 那一份 title —— 分享出去十六条链接长得一模一样，浏览器历史也分不清，搜索
 * 结果里没有一个是能点进内容的描述。
 *
 * 为什么集中在表里而不是每个视图各写一份：
 *   - 同一句描述在「视图」「OG 卡片」「未来的 sitemap」之间会被抄三遍，改一处漏两处；
 *   - 门禁（scripts/check-page-meta.mjs）需要能静态读到「这个路由该有什么 title」，
 *     才能断言「每个路由都有且唯一」，散落在 SFC 里就只能靠正则猜。
 *
 * 约束（门禁会查）：
 *   - title 不含数字与百分号 —— 数字必须来自单源（check:site-claims 的同一原则），
 *     内容页标题不是宣传位，写死 76.5% 之类会在下次复测后变成假话；
 *   - title 在 30 个字符内（中文按字计），description 在 20–120 字之间。
 */
import { computed } from 'vue'
import { useHead } from '@unhead/vue'
import { useRoute } from 'vue-router'
import { techArticle, useJsonLd, webPage } from './json-ld'

export const SITE_TAGLINE = '中后台 CRUD 的配置层'

export const DEFAULT_DESCRIPTION =
  'ES-Plus —— 中后台 CRUD 的配置层：一份 JSON 配置，Vue 2 / Vue 3 / Ant Design Vue 三端通用，AI 生成即编译。'

export interface PageMeta {
  title: string
  description: string
}

/** 路由 name → 元信息。动态页（指南 / 组件 / 高级 / 画廊详情）在各自的视图里现算。 */
export const PAGE_META: Record<string, PageMeta> = {
  quickstart: {
    title: '30 秒上手',
    description: '从安装依赖到第一个可跑页面的最短路径：三段代码、一份 JSON 配置，查询表单与表格自动联动。',
  },
  cases: {
    title: '核心案例总览',
    description: '真实业务场景的完整配置：查询、表格、弹窗、联动与权限，每张卡都能落到可直接复制的页面。',
  },
  'flagship-approval': {
    title: '旗舰案例 · 合同审批工作台',
    description: '一次审批工作台的完整拆解：整页由一份 JSON 驱动，查询表单、明细表格与审批弹窗如何拼在一起。',
  },
  // 描述同时是这一页的**搜索摘要**（search-index 的 buildFixedEntries 拿它当 content）。
  // 案例名「采购申请审批页」必须出现在这里：它是定制宿主，画廊的逐条索引不收它，
  // 搜案例名只能落到这一页 —— 少了这几个字，搜「采购审批」是零结果。
  'ai-generated': {
    title: 'AI 生成 · 一句话成页',
    description: '一句话描述需求，AI 产出一份可编译的 CRUD 配置，再用同一份配置渲染出三个渲染端的页面。本页案例是采购申请审批页。',
  },
  'ai-gallery': {
    title: 'AI 案例画廊',
    description: '自然语言生成的中后台案例集：每个案例都附配置、产物与复现步骤，而不是只有一张截图。',
  },
  'ai-gallery-composition': {
    title: '组合画廊 · 三端对照',
    description: '组合能力的三端对照：同一份配置在 Vue 3、Vue 2 与 Ant Design Vue 上的一致性证据。',
  },
  'ai-gallery-workflows': {
    title: 'MCP 工具工作流',
    description: 'MCP 工具的真实调用链：输入、输出、校验结果与耗时逐条留档，与 IDE 里看到的一致。',
  },
  // 同 'ai-generated'：定制宿主的案例名只在这一页的描述里，它同时是搜索摘要
  'fragment-dashboard': {
    title: '片段拼装 · 分析看板',
    description: '用片段工具拼出一个非 CRUD 的分析页（片段拼装仪表盘）：宿主取数、原生图表与弹窗如何各归其位。',
  },
  'native-vs-ai': {
    title: '原生 · 手写 · AI 三栏对照',
    description: '同一功能的三种写法并列：原生模板、手写 ES-Plus 配置、AI 产物，用同一把尺子量成本。',
  },
  playground: {
    title: 'Playground 在线试',
    description: '在线改 JSON 配置，实时看表单、表格与弹窗的渲染结果，不用装任何依赖。',
  },
  'ai-crud': {
    title: 'AI CRUD 生成器',
    description: '自然语言转完整 CRUD 页面配置：支持 OpenAI 兼容接口，也可以不填 Key 用本地规则引擎。',
  },
  'not-found': {
    title: '页面不存在',
    description: '这个地址没有对应页面，可能是链接过期或拼写有误 —— 从搜索或侧栏重新进入。',
  },
}

type PageMetaSource = string | PageMeta | (() => PageMeta | null | undefined)

function resolveSource(source: PageMetaSource): () => PageMeta | null {
  if (typeof source === 'string') return () => PAGE_META[source] ?? null
  if (typeof source === 'function') return source
  return () => source
}

/**
 * 挂上本页的 title / description / OG / JSON-LD。
 *
 * `titleTemplate` 在 main.ts 里统一加 ` · ES-Plus`，这里只管裸标题 ——
 * 两处都拼会得到「X · ES-Plus · ES-Plus」。
 *
 * 结构化数据的类型按**路由名**分：指南 / 组件 / 高级用法是有正文的文章（TechArticle），
 * 其余是普通内容页（WebPage）。首页与另三个自己调 useHead 的视图不经过这里，
 * 各自显式给类型（见 Home.vue 的 SoftwareApplication）。
 */
export function usePageMeta(source: PageMetaSource) {
  const get = resolveSource(source)
  const meta = computed<PageMeta>(() => get() ?? { title: SITE_TAGLINE, description: DEFAULT_DESCRIPTION })
  const route = useRoute()
  const isArticle = ['guide', 'component', 'advanced'].includes(String(route.name ?? ''))

  useHead({
    title: () => meta.value.title,
    meta: [
      { name: 'description', content: () => meta.value.description },
      { property: 'og:title', content: () => `${meta.value.title} · ES-Plus` },
      { property: 'og:description', content: () => meta.value.description },
    ],
  })

  useJsonLd(() => {
    const input = { title: meta.value.title, description: meta.value.description, path: route.path }
    return isArticle ? techArticle({ ...input, section: route.path.split('/')[1] }) : webPage(input)
  })
}
