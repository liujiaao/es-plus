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
      {
        // 旗舰案例「合同审批工作台」：整页由 docs/cases/flagship-approval.json 驱动，
        // 三站加载同一份字节（scripts/sync-cases.mjs 分发）
        path: 'flagship-approval',
        name: 'FlagshipApproval',
        meta: { title: '旗舰案例：合同审批工作台' },
        component: () => import('@/views/FlagshipApproval.vue'),
      },
      {
        // F7「一句话 → 页面」：整页由 docs/cases/generated/purchase-approval.json 驱动 ——
        // AI 生成、未经手工修改的纯 JSON，三站加载同一份字节
        path: 'ai-generated',
        name: 'AiGenerated',
        meta: { title: '一句话生成：采购申请审批页' },
        component: () => import('@/views/AiGenerated.vue'),
      },
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
        path: 'es-error-boundary',
        name: 'EsErrorBoundary',
        meta: { title: 'EsErrorBoundary 错误边界' },
        component: () => import('@/views/EsErrorBoundary.vue'),
      },
      {
        path: 'svg-icon',
        name: 'SvgIcon',
        meta: { title: 'SvgIcon 图标' },
        component: () => import('@/views/SvgIcon.vue'),
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
      // 404 兜底：此前没有这一条，匹配不到的地址会渲染成整页空白。
      // 跨站链接（见 docs/cases/cases.json）写错时的表现就从「白屏」变成「404 页」。
      {
        path: ':pathMatch(.*)*',
        name: 'NotFound',
        meta: { title: '页面不存在' },
        component: () => import('@/views/NotFound.vue'),
      },
    ],
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  // 案例卡会带 `#anchor` 落到页内某一节（如 /es-table#selection）。
  // 以前没有 scrollBehavior，锚点只能靠浏览器默认行为，异步路由组件还没渲染完
  // 就已经跳过了 —— 表现是「链接指对了页面，但停在页首」。
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash, top: 88, behavior: 'smooth' }
    return { top: 0 }
  },
})

export default router
