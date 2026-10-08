import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import EsPlus from '@es-plus/vue3'
import '@es-plus/vue3/dist/style.css'
import App from './App.vue'

const app = createApp(App)
app.use(ElementPlus)
app.use(EsPlus)
app.mount('#app')
