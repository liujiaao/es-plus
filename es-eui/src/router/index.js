import Vue from 'vue'
import VueRouter from 'vue-router'
import { applyPageSeo } from '../utils/site-seo.js'

Vue.use(VueRouter)

// `meta.duplicate: true` = 「这一页在主站有同一路径的同一内容」。
//
// 本站是渲染器门户，像 /quickstart、/cases、/ai-gallery 这些页是把主站的页换成本站
// 的 UI 库再写一遍 —— 三站各有其实例，同一份内容出现三份，索引被稀释。带这个标记的
// 路由在 afterEach 里把 canonical 与 og:url 指回主站（见 utils/site-seo.js），
// 站点因此只对**本渲染器专属的页**（/guide/*、/component/*、/ai-tools…）声明所有权。
//
// 标记不是拍脑袋加的：scripts/gen-subsite-seo.mjs --check 把这份声明与主站路由表
// **双向**核对 —— 主站有这条路径就必须标，标了主站就必须有。
const routes = [
  // 首页
  {
    path: '/',
    name: 'Home',
    meta: { title: '首页' },
    component: () => import('../views/home/index.vue')
  },
  
  // 开发指南
  {
    path: '/guide',
    component: () => import('../views/guide/index.vue'),
    children: [
      {
        path: '',
        name: 'GuideIntroduction',
        meta: { title: '介绍' },
        component: () => import('../views/guide/introduction.vue')
      },
      {
        path: 'installation',
        name: 'GuideInstallation',
        meta: { title: '安装' },
        component: () => import('../views/guide/installation.vue')
      },
      {
        path: 'quickstart',
        name: 'GuideQuickstart',
        meta: { title: '快速开始' },
        component: () => import('../views/guide/quickstart.vue')
      },
      {
        path: 'configuration',
        name: 'GuideConfiguration',
        meta: { title: '全局配置' },
        component: () => import('../views/guide/configuration.vue')
      },
      {
        path: 'theme',
        name: 'GuideTheme',
        meta: { title: '主题定制' },
        component: () => import('../views/guide/theme.vue')
      },
      {
        path: 'i18n',
        name: 'GuideI18n',
        meta: { title: '国际化' },
        component: () => import('../views/guide/i18n.vue')
      },
      {
        path: 'developer-guide',
        name: 'DeveloperGuide',
        meta: { title: '开发者指南' },
        component: () => import('../views/docs/EsEuiDeveloperGuide.vue')
      }
    ]
  },
  
  // 组件文档
  {
    path: '/component',
    component: () => import('../views/component/index.vue'),
    children: [
      {
        path: 'installation',
        name: 'ComponentInstallation',
        meta: { title: '组件安装' },
        component: () => import('../views/component/installation.vue')
      },
      {
        path: 'quickstart',
        name: 'ComponentQuickstart',
        meta: { title: '组件快速开始' },
        component: () => import('../views/guide/quickstart.vue')
      },
      {
        path: 'estable',
        name: 'EsTableDocs',
        meta: { title: 'EsTable 表格' },
        component: () => import('../views/docs/EsTableDocs.vue')
      },
      {
        path: 'vxetable',
        name: 'VxeTableDocs',
        meta: { title: 'vxe-table 高性能表格' },
        component: () => import('../views/docs/VxeTableDocs.vue')
      },
      {
        path: 'esform',
        name: 'EsFormDocs',
        meta: { title: 'EsForm 表单' },
        component: () => import('../views/docs/EsFormDocs.vue')
      },
      {
        path: 'esdialog',
        name: 'EsDialogDocs',
        meta: { title: 'EsDialog 弹窗' },
        component: () => import('../views/docs/EsDialogDocs.vue')
      },
      {
        path: 'escrudpage',
        name: 'EsCrudPageDocs',
        meta: { title: 'EsCrudPage 增删改查页' },
        component: () => import('../views/docs/EsCrudPageDocs.vue')
      },
      {
        path: 'eserrorboundary',
        name: 'EsErrorBoundaryDocs',
        meta: { title: 'EsErrorBoundary 错误边界' },
        component: () => import('../views/docs/EsErrorBoundaryDocs.vue')
      },
      {
        path: 'svgicon',
        name: 'SvgIconDocs',
        meta: { title: 'SvgIcon 图标' },
        component: () => import('../views/docs/SvgIconDocs.vue')
      },
      {
        path: 'combination',
        name: 'CombinationDocs',
        meta: { title: '高级联动组合' },
        component: () => import('../views/docs/CombinationDocs.vue')
      }
    ]
  },
  
  // 30 秒上手（L1 聚合页）
  {
    path: '/quickstart',
    name: 'QuickStart',
    meta: { title: '30 秒上手', duplicate: true },
    component: () => import('../views/quickstart.vue')
  },

  // 核心案例（L1-L5 梯度）
  {
    path: '/cases',
    name: 'Cases',
    meta: { title: '核心案例', duplicate: true },
    component: () => import('../views/cases.vue')
  },

  // 旗舰案例「合同审批工作台」：整页由 docs/cases/flagship-approval.json 驱动，
  // 三站加载同一份字节（scripts/sync-cases.mjs 分发）
  {
    path: '/flagship-approval',
    name: 'FlagshipApproval',
    meta: { title: '旗舰案例 · 合同审批工作台', duplicate: true },
    component: () => import('../views/flagship-approval.vue')
  },

  // F7「一句话 → 页面」：整页由 docs/cases/generated/purchase-approval.json 驱动 ——
  // AI 生成、未经手工修改的纯 JSON，三站加载同一份字节
  {
    path: '/ai-generated',
    name: 'AiGenerated',
    meta: { title: 'AI 生成 · 一句话成页', duplicate: true },
    component: () => import('../views/ai-generated.vue')
  },

  // A8 片段拼装：三个片段工具 → 一个非 CRUD 分析页。es-eui 只做编译验证与源码展示
  // （vue2 目标的片段面向 Vue 2.7 的 defineComponent，本站是 Vue 2.6 + composition-api）。
  {
    path: '/fragment-dashboard',
    name: 'FragmentDashboard',
    meta: { title: '片段拼装仪表盘', duplicate: true },
    component: () => import('../views/fragment-dashboard.vue')
  },

  // A9 三栏对照：原生 / 手写 es-plus / AI 产物，四个口径同尺量（数字与源码同源生成）
  {
    path: '/native-vs-ai',
    name: 'NativeVsAi',
    meta: { title: '原生 · 手写 · AI 三栏对照', duplicate: true },
    component: () => import('../views/native-vs-ai.vue')
  },

  // AI 案例画廊：清单来自 manifest 生成的 registry（docs/cases/ai-cases.json），
  // 列表页 + 通用宿主详情页共用同一份组件
  {
    path: '/ai-gallery',
    name: 'AiGallery',
    meta: { title: 'AI 案例画廊', duplicate: true },
    component: () => import('../views/ai-gallery.vue')
  },
  {
    // S2 组合画廊：18 例组合语料（6 个逻辑案例 × 3 端）的检视页。
    // 组合事实与产物由 `scripts/gen-composition-gallery.mjs` 用评测同一个函数算好，
    // 浏览器里不重算。排在 `/ai-gallery/:id` 之前，避免被详情路由吃掉。
    path: '/ai-gallery/composition',
    name: 'AiGalleryComposition',
    meta: { title: '组合画廊 · 三端对照', duplicate: true },
    component: () => import('../views/ai-composition.vue')
  },
  {
    // S3 工具工作流：三条链、9 次真 handler 调用（入参冻结、出参逐字节）。
    // 记录由 `scripts/gen-ai-workflows.mjs` 生成，浏览器里不重算。同样排详情路由之前。
    path: '/ai-gallery/workflows',
    name: 'AiGalleryWorkflows',
    meta: { title: 'MCP 工具工作流', duplicate: true },
    component: () => import('../views/ai-workflows.vue')
  },
  {
    path: '/ai-gallery/:id',
    name: 'AiGalleryCase',
    meta: { title: 'AI 案例详情', duplicate: true },
    component: () => import('../views/ai-gallery.vue')
  },

  // 主题：早期是独立的 views/theme/index.vue（自带一份 side-nav），与 /guide/theme
  // 讲同一件事却两处漂移 —— 一份说「ES-Plus 提供可定制 CSS 变量」，而组件库根本没有
  // 这层 API。现在只保留指南里那一页，旧地址走重定向，避免外链 404。
  {
    path: '/theme',
    redirect: '/guide/theme'
  },

  // AI 工具链（跨渲染器：MCP/CLI 能生成 vue2/vue3/antdv 三种 target）
  {
    path: '/ai-tools',
    name: 'AiTools',
    meta: { title: 'AI 工具链' },
    component: () => import('../views/ai-tools.vue')
  },

  // 404 兜底：此前没有这一条，匹配不到的地址（含写错的跨站链接）会渲染成整页空白。
  // Vue 2 的通配写法是 path: '*'（Vue 3 用 ':pathMatch(.*)*'）。
  {
    path: '*',
    name: 'NotFound',
    meta: { title: '页面不存在' },
    component: () => import('../views/NotFound.vue')
  }
]

// 原 `/test/recharge-record` 路由已移除：那是一个公网可达的测试页（475 行、直连
// DummyJSON、内含 TODO），而它要演示的能力已有专用 CI 覆盖 ——
// `__tests__/e2e-runtime/tests/vue2-crud.spec.ts`。文件本身保留为参考示例，
// 见 `src/examples/vue2-compat/RechargeRecord.vue` 的头部注释。

const router = new VueRouter({
  mode: 'hash',
  base: process.env.BASE_URL,
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    // 案例卡会带 `#anchor` 落到页内某一节（如 /guide/configuration#permission）。
    // 以前这里无条件回到顶部，锚点被吞掉、链接看起来「指向了页面」但没落到内容上。
    if (to.hash) return { selector: to.hash, offset: { x: 0, y: 88 } }
    return { x: 0, y: 0 }
  }
})

// 逐页 title：此前 30 条路由共用 public/index.html 的那一句，分享出去分不清是哪一篇。
// meta.title 是单一来源（scripts/check-subpage-title.mjs 断言每条具名路由都有）。
const SITE_SUFFIX = 'ES-Plus · Vue 2 + Element UI'
const SITE_DEFAULT_TITLE = 'ES-Plus 文档 · Vue 2 + Element UI 端'

router.afterEach((to) => {
  const title = to.matched
    .map((record) => record.meta && record.meta.title)
    .filter(Boolean)
    .pop()
  document.title = title ? `${title} · ${SITE_SUFFIX}` : SITE_DEFAULT_TITLE
  // canonical / og:url / robots：重复页指回主站，404 拿 noindex（utils/site-seo.js）
  applyPageSeo(to)
})

export default router
