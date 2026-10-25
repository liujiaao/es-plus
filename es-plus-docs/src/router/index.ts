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
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  }
})

export default router
