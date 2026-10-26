import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/Home.vue')
  },
  {
    path: '/quickstart',
    name: 'quickstart',
    component: () => import('@/views/QuickStart.vue')
  },
  {
    path: '/cases',
    name: 'cases',
    component: () => import('@/views/Cases.vue')
  },
  {
    // 旗舰案例「合同审批工作台」：整页由 docs/cases/flagship-approval.json 驱动，
    // 三站加载同一份字节（scripts/sync-cases.mjs 分发）
    path: '/flagship-approval',
    name: 'flagship-approval',
    component: () => import('@/views/FlagshipApproval.vue')
  },
  {
    // F7「一句话 → 页面」：整页由 docs/cases/generated/purchase-approval.json 驱动 ——
    // AI 生成、未经手工修改的纯 JSON，三站加载同一份字节
    path: '/ai-generated',
    name: 'ai-generated',
    component: () => import('@/views/AiGenerated.vue')
  },
  {
    // AI 案例画廊：清单来自 manifest 生成的 registry（docs/cases/ai-cases.json），
    // 列表页 + 通用宿主详情页（`/ai-gallery/<id>`）共用同一份组件。
    path: '/ai-gallery',
    name: 'ai-gallery',
    component: () => import('@/views/AiGallery.vue')
  },
  {
    path: '/ai-gallery/:id',
    name: 'ai-gallery-case',
    component: () => import('@/views/AiGallery.vue')
  },
  {
    path: '/guide/:name',
    name: 'guide',
    component: () => import('@/views/Doc.vue')
  },
  {
    path: '/components/:name',
    name: 'component',
    component: () => import('@/views/ComponentDoc.vue')
  },
  {
    path: '/advanced/:name',
    name: 'advanced',
    component: () => import('@/views/AdvancedDoc.vue')
  },
  {
    path: '/playground',
    name: 'playground',
    component: () => import('@/views/Playground.vue')
  },
  {
    path: '/ai-crud',
    name: 'ai-crud',
    component: () => import('@/views/AiCrud.vue')
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFound.vue')
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    // 案例卡 / 跨站链接会带 `#demo-xxx` 落到页内某个示例上。
    // 以前这里无条件 `return { top: 0 }` —— 锚点被吞掉，链接看起来「指向了页面」
    // 却没落到内容上（es-eui 早就按 hash 滚动，docs 一直是回顶部）。
    if (to.hash) return { el: to.hash, top: 88, behavior: 'smooth' }
    return { top: 0 }
  }
})

export default router
