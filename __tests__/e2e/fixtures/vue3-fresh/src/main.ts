import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import ESPlus from '@es-plus/vue3'
import '@es-plus/vue3/dist/style.css'
// App.vue is the generated CRUD page — the e2e harness writes the cli output
// here before invoking `vite build`. If this file is missing or has compile
// errors, vite will fail loudly and the e2e job goes red.
import App from './App.vue'

const app = createApp(App)
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component as never)
}
app.use(ElementPlus, { size: 'small' })
app.use(ESPlus)
app.mount('#app')
