import { createRouter, createWebHashHistory } from 'vue-router'
import DocLayout from '@/layouts/DocLayout.vue'
import Home from '@/views/Home.vue'
import Guide from '@/views/Guide.vue'
import QuickStart from '@/views/QuickStart.vue'
import Cases from '@/views/Cases.vue'

const routes = [
  {
    path: '/',
    component: DocLayout,
    children: [
      { path: '', name: 'Home', meta: { title: '首页' }, component: Home },
      { path: 'quickstart', name: 'QuickStart', meta: { title: '30 秒上手' }, component: QuickStart },
      { path: 'cases', name: 'Cases', meta: { title: '核心案例' }, component: Cases },
      { path: 'guide', name: 'Guide', meta: { title: '快速上手' }, component: Guide },
      {
        path: 'es-form',
        name: 'EsForm',
        meta: { title: 'EsForm 动态表单' },
        component: () => import('@/views/EsForm.vue'),
      },
      {
        path: 'es-table',
        name: 'EsTable',
        meta: { title: 'EsTable 动态表格' },
        component: () => import('@/views/EsTable.vue'),
      },
      {
        path: 'es-dialog',
        name: 'EsDialog',
        meta: { title: 'EsDialog 动态弹窗' },
        component: () => import('@/views/EsDialog.vue'),
      },
      {
        path: 'es-crud-page',
        name: 'EsCrudPage',
        meta: { title: 'EsCrudPage CRUD页面' },
        component: () => import('@/views/EsCrudPage.vue'),
      },
      {
        path: 'advanced',
        name: 'Advanced',
        meta: { title: '高级联动' },
        component: () => import('@/views/Advanced.vue'),
      },
      {
        path: 'es-vxe-table',
        name: 'EsVxeTable',
        meta: { title: 'vxe 高性能引擎' },
        component: () => import('@/views/EsVxeTable.vue'),
      },
      {
        path: 'ai-tools',
        name: 'AiTools',
        meta: { title: 'AI 工具链' },
        component: () => import('@/views/AiTools.vue'),
      },
    ],
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
