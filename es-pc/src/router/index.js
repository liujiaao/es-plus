import { createRouter, createWebHashHistory } from 'vue-router'
import DocLayout from '@/layouts/DocLayout.vue'
import Home from '@/views/Home.vue'
import Guide from '@/views/Guide.vue'

const routes = [
  {
    path: '/',
    component: DocLayout,
    children: [
      { path: '', name: 'Home', meta: { title: '首页' }, component: Home },
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
    ],
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
