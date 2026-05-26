import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import router from './router'
import i18n from './locales'
import App from './App.vue'
import '@/styles/index.scss'

// 导入 ES-Plus 组件
// dist 模式：别名指向打包产物，样式通过下方 import 引入
// 源码模式：别名指向 src，样式由 Vite SCSS 管道自动处理（空文件占位）
import ESPlus from 'es-plus'
import 'es-plus-ui/dist/style.css'

const app = createApp(App)

// Register Element Plus icons
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(createPinia())
app.use(router)
app.use(ElementPlus, { size: 'small' })
app.use(i18n)

// 使用 ES-Plus 组件库
app.use(ESPlus, {
  globalProperties: true
})

app.mount('#app')
