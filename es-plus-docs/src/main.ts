import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createHead } from '@unhead/vue/client'
import 'element-plus/dist/index.css'
import 'vxe-pc-ui/lib/style.css'
import 'vxe-table/dist/style.css'
import VxeUI from 'vxe-pc-ui'
import VxeTable from 'vxe-table'
import router from './router'
import App from './App.vue'
// 设计 token 单一真源（docs/tokens/design-tokens.css → scripts/sync-tokens.mjs 分发）
import '@/styles/design-tokens.css'
// 文档内容设计规范单一真源（docs/theme/docs-content.css → scripts/sync-theme.mjs 分发）
import '@/styles/docs-content.css'
import '@/styles/index.scss'

// dist 模式：别名指向打包产物，样式通过下方 import 引入
// 源码模式：别名指向 src，样式由 Vite SCSS 管道自动处理（空文件占位）
import 'es-plus-ui/dist/style.css'

import { installAppPlugins } from '@/utils/install-app-plugins'

const app = createApp(App)

const head = createHead()
head.push({
  titleTemplate: (title?: string) => (title ? `${title} · ES-Plus` : 'ES-Plus · 中后台 CRUD 的配置层'),
  meta: [
    { name: 'description', content: 'ES-Plus — 中后台 CRUD 的配置层：一份 JSON 配置，Vue 2 / Vue 3 / Ant Design Vue 三端通用，AI 生成即编译。' },
    { name: 'keywords', content: 'Vue 3, Vue 2, Ant Design Vue, Element Plus, Element UI, CRUD, 配置化表单, 配置化表格, MCP Server, AI 编码' },
    { property: 'og:type', content: 'website' },
    { property: 'og:title', content: 'ES-Plus · 中后台 CRUD 的配置层' },
    { property: 'og:description', content: '一份 JSON 配置，三个渲染器通用，AI 生成即编译 —— 中后台 CRUD 的配置层。' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ],
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
  ],
})
app.use(head)

app.use(createPinia())
app.use(router)
app.use(VxeUI)
app.use(VxeTable)

// Element Plus + icons + ES-Plus + i18n — shared with in-doc demo sub-apps.
// i18n 由 installAppPlugins 统一安装，main.ts 不再重复 app.use(i18n)（否则 "Plugin has already been applied"）
installAppPlugins(app)

app.mount('#app')
