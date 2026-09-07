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

  // 测试页：Composition API + @es-plus/vue2 兼容性验证（Vue 2.6）
  {
    path: '/test/recharge-record',
    name: 'RechargeRecord',
    component: () => import('../views/test/RechargeRecord.vue')
  }
]

const router = new VueRouter({
  mode: 'hash',
  base: process.env.BASE_URL,
  routes,
  scrollBehavior() {
    return { x: 0, y: 0 }
  }
})

export default router
