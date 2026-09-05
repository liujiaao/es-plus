import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import ESPlus from '@es-plus/adapter-antdv'
import '@es-plus/adapter-antdv/dist/style.css'
// App.vue is the generated CRUD page — the e2e harness writes the cli output
// here before invoking `vite build`. If this file is missing or has compile
// errors, vite will fail loudly and the e2e job goes red.
import App from './App.vue'

const app = createApp(App)
app.use(Antd)
app.use(ESPlus)
app.mount('#app')
