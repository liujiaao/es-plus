import Vue from 'vue'
import VueRouter from 'vue-router'

Vue.use(VueRouter)

const routes = [
  // 首页
  {
    path: '/',
    name: 'Home',
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
        component: () => import('../views/guide/introduction.vue')
      },
      {
        path: 'installation',
        name: 'GuideInstallation',
        component: () => import('../views/guide/installation.vue')
      },
      {
        path: 'quickstart',
        name: 'GuideQuickstart',
        component: () => import('../views/guide/quickstart.vue')
      },
      {
        path: 'configuration',
        name: 'GuideConfiguration',
        component: () => import('../views/guide/configuration.vue')
      },
      {
        path: 'theme',
        name: 'GuideTheme',
        component: () => import('../views/guide/theme.vue')
      },
      {
        path: 'i18n',
        name: 'GuideI18n',
        component: () => import('../views/guide/i18n.vue')
      },
      {
        path: 'developer-guide',
        name: 'DeveloperGuide',
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
        component: () => import('../views/component/installation.vue')
      },
      {
        path: 'quickstart',
        name: 'ComponentQuickstart',
        component: () => import('../views/guide/quickstart.vue')
      },
      {
        path: 'estable',
        name: 'EsTableDocs',
        component: () => import('../views/docs/EsTableDocs.vue')
      },
      {
        path: 'vxetable',
        name: 'VxeTableDocs',
        component: () => import('../views/docs/VxeTableDocs.vue')
      },
      {
        path: 'esform',
        name: 'EsFormDocs',
        component: () => import('../views/docs/EsFormDocs.vue')
      },
      {
        path: 'esdialog',
        name: 'EsDialogDocs',
        component: () => import('../views/docs/EsDialogDocs.vue')
      },
      {
        path: 'escrudpage',
        name: 'EsCrudPageDocs',
        component: () => import('../views/docs/EsCrudPageDocs.vue')
      },
      {
        path: 'eserrorboundary',
        name: 'EsErrorBoundaryDocs',
        component: () => import('../views/docs/EsErrorBoundaryDocs.vue')
      },
      {
        path: 'svgicon',
        name: 'SvgIconDocs',
        component: () => import('../views/docs/SvgIconDocs.vue')
      },
      {
        path: 'combination',
        name: 'CombinationDocs',
        component: () => import('../views/docs/CombinationDocs.vue')
      }
    ]
  },
  
  // 30 秒上手（L1 聚合页）
  {
    path: '/quickstart',
    name: 'QuickStart',
    component: () => import('../views/quickstart.vue')
  },

  // 核心案例（L1-L5 梯度）
  {
    path: '/cases',
    name: 'Cases',
    component: () => import('../views/cases.vue')
  },

  // 旗舰案例「合同审批工作台」：整页由 docs/cases/flagship-approval.json 驱动，
  // 三站加载同一份字节（scripts/sync-cases.mjs 分发）
  {
    path: '/flagship-approval',
    name: 'FlagshipApproval',
    component: () => import('../views/flagship-approval.vue')
  },

  // F7「一句话 → 页面」：整页由 docs/cases/generated/purchase-approval.json 驱动 ——
  // AI 生成、未经手工修改的纯 JSON，三站加载同一份字节
  {
    path: '/ai-generated',
    name: 'AiGenerated',
    component: () => import('../views/ai-generated.vue')
  },

  // A8 片段拼装：三个片段工具 → 一个非 CRUD 分析页。es-eui 只做编译验证与源码展示
  // （vue2 目标的片段面向 Vue 2.7 的 defineComponent，本站是 Vue 2.6 + composition-api）。
  {
    path: '/fragment-dashboard',
    name: 'FragmentDashboard',
    component: () => import('../views/fragment-dashboard.vue')
  },

  // A9 三栏对照：原生 / 手写 es-plus / AI 产物，四个口径同尺量（数字与源码同源生成）
  {
    path: '/native-vs-ai',
    name: 'NativeVsAi',
    component: () => import('../views/native-vs-ai.vue')
  },

  // AI 案例画廊：清单来自 manifest 生成的 registry（docs/cases/ai-cases.json），
  // 列表页 + 通用宿主详情页共用同一份组件
  {
    path: '/ai-gallery',
    name: 'AiGallery',
    component: () => import('../views/ai-gallery.vue')
  },
  {
    // S2 组合画廊：18 例组合语料（6 个逻辑案例 × 3 端）的检视页。
    // 组合事实与产物由 `scripts/gen-composition-gallery.mjs` 用评测同一个函数算好，
    // 浏览器里不重算。排在 `/ai-gallery/:id` 之前，避免被详情路由吃掉。
    path: '/ai-gallery/composition',
    name: 'AiGalleryComposition',
    component: () => import('../views/ai-composition.vue')
  },
  {
    // S3 工具工作流：三条链、9 次真 handler 调用（入参冻结、出参逐字节）。
    // 记录由 `scripts/gen-ai-workflows.mjs` 生成，浏览器里不重算。同样排详情路由之前。
    path: '/ai-gallery/workflows',
    name: 'AiGalleryWorkflows',
    component: () => import('../views/ai-workflows.vue')
  },
  {
    path: '/ai-gallery/:id',
    name: 'AiGalleryCase',
    component: () => import('../views/ai-gallery.vue')
  },

  // 主题
  {
    path: '/theme',
    name: 'Theme',
    component: () => import('../views/theme/index.vue')
  },

  // AI 工具链（跨渲染器：MCP/CLI 能生成 vue2/vue3/antdv 三种 target）
  {
    path: '/ai-tools',
    name: 'AiTools',
    component: () => import('../views/ai-tools.vue')
  },

  // 404 兜底：此前没有这一条，匹配不到的地址（含写错的跨站链接）会渲染成整页空白。
  // Vue 2 的通配写法是 path: '*'（Vue 3 用 ':pathMatch(.*)*'）。
  {
    path: '*',
    name: 'NotFound',
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

export default router
