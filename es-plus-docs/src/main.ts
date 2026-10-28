import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createHead } from '@unhead/vue/client'
import 'element-plus/dist/index.css'
// Element Plus 暗色主题（选择器 html.dark）——不导入它，切到暗色时只有站点外壳变暗，
// 正文里的 el-* 组件（本页内容就是组件 demo）仍是亮色。类名由 stores/theme.ts 挂载。
import 'element-plus/theme-chalk/dark/css-vars.css'
import 'vxe-pc-ui/lib/style.css'
import 'vxe-table/dist/style.css'
// vxe 的**插件**不在这里静态引入：全量注册是 344.2 KB gz，只有 /advanced/vxe-table 与
// /ai-gallery/<id> 真的会渲染 engine:'vxe'。按需加载见 utils/vxe-loader.ts（下面的 router 门）。
// 样式保留在首屏：它是 CSS，不进 JS 预算；挪进懒加载块会让注入顺序排到站点覆盖规则之后，
// 收益与风险不对等。
import router from './router'
import App from './App.vue'
// 设计 token 单一真源（docs/tokens/design-tokens.css → scripts/sync-tokens.mjs 分发）
import '@/styles/design-tokens.css'
// 文档内容设计规范单一真源（docs/theme/docs-content.css → scripts/sync-theme.mjs 分发）
import '@/styles/docs-content.css'
// 外壳契约单一真源（docs/theme/docs-layout.css → scripts/sync-theme.mjs 分发）
import '@/styles/docs-layout.css'
// 文档 chrome 契约单一真源（docs/theme/docs-chrome.css → scripts/sync-theme.mjs 分发）
import '@/styles/docs-chrome.css'
// 三站统一页脚外观（docs/theme/docs-footer.css → scripts/sync-theme.mjs 分发）
import '@/styles/docs-footer.css'
// 三站统一 404 外观（docs/theme/docs-notfound.css → scripts/sync-theme.mjs 分发）
import '@/styles/docs-notfound.css'
// 可访问性基线单一真源（docs/theme/docs-a11y.css → scripts/sync-theme.mjs 分发）
// 必须最后 import：它要压过站点/site 组件里自己的 outline 规则
import '@/styles/docs-a11y.css'
import '@/styles/index.scss'

// dist 模式：别名指向打包产物；源码模式：别名指向空文件（样式由 Vite SCSS 管道处理）。
// 旧代码 import 的是不存在的包名 `es-plus-ui/dist/style.css`，纯误导，已改为站点自有别名。
import '@es-plus/style.css'

import { installAppPlugins } from '@/utils/install-app-plugins'
import { ensureVxe, needsVxe } from '@/utils/vxe-loader'

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
    // 必须带 base：GitHub Pages 部署在 /es-plus/ 子路径，绝对路径 /favicon.svg
    // 会指向站点根（liujiaao.github.io/favicon.svg）→ 线上 404。
    { rel: 'icon', type: 'image/svg+xml', href: `${import.meta.env.BASE_URL}favicon.svg` },
  ],
})
app.use(head)

app.use(createPinia())
app.use(router)

// vxe 引擎按需加载（路线图 3.6）：导航到真的要渲染 engine:'vxe' 的页面前再拉那 344 KB。
// 守在 beforeEach 而不是组件里，是因为 app.use 必须在子组件创建**之前**完成——晚一步
// EsTable 会拿着未注册的引擎渲染「未安装 vxe」的提示。
router.beforeEach(async (to) => {
  if (!needsVxe(to)) return
  try {
    await ensureVxe(app)
  } catch (err) {
    // 产物缺块 / 离线：照常进页面，让 EsTable 的既有提示去说这件事，别白屏
    console.error('[vxe] 按需加载失败，engine:"vxe" 的表格将显示未安装提示', err)
  }
})

// Element Plus + icons + ES-Plus + i18n — shared with in-doc demo sub-apps.
// i18n 由 installAppPlugins 统一安装，main.ts 不再重复 app.use(i18n)（否则 "Plugin has already been applied"）
installAppPlugins(app)

app.mount('#app')
