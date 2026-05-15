import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/Home.vue')
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
  }
]

const router = createRouter({
  history: createWebHistory(),
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
