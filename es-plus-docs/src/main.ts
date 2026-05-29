import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createHead } from '@unhead/vue/client'
import 'element-plus/dist/index.css'
import router from './router'
import i18n from './locales'
import App from './App.vue'
import '@/styles/index.scss'

// dist 模式：别名指向打包产物，样式通过下方 import 引入
// 源码模式：别名指向 src，样式由 Vite SCSS 管道自动处理（空文件占位）
import 'es-plus-ui/dist/style.css'

import { installAppPlugins } from '@/utils/install-app-plugins'

const app = createApp(App)

const head = createHead()
head.push({
  titleTemplate: (title?: string) => (title ? `${title} · ES-Plus` : 'ES-Plus 高级 CRUD 组件库'),
  meta: [
    { name: 'description', content: 'ES-Plus — 基于 Vue 3 + Element Plus 的高级 CRUD 组件库，配置化表单、表格、CRUD 页面，原生支持 AI 编码与 MCP Server。' },
    { name: 'keywords', content: 'Vue 3, Element Plus, CRUD, 配置化表单, 配置化表格, 低代码, MCP Server, AI 编码' },
    { property: 'og:type', content: 'website' },
    { property: 'og:title', content: 'ES-Plus · 高级 CRUD 组件库' },
    { property: 'og:description', content: '让 Vue + Element Plus 表单/表格/CRUD 页面只用 JSON 配置，原生支持 AI 编码助手。' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ],
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
  ],
})
app.use(head)

app.use(createPinia())
app.use(router)
app.use(i18n)

// Element Plus + icons + ES-Plus — shared with in-doc demo sub-apps
installAppPlugins(app)

app.mount('#app')
