import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
// ant-design-vue 4.x DatePicker 依赖 dayjs locale，必须手动加载
import 'dayjs/locale/zh-cn'
import ESPlus from '@es-plus/adapter-antdv'
import '@es-plus/adapter-antdv/dist/style.css'
import App from './App.vue'
import router from './router'
import './styles/design-tokens.css'
import './styles/global.css'

const app = createApp(App)
app.use(Antd)
app.use(router)
app.use(ESPlus, {
  globalProperties: true,
  permission: (value) => true,
})
app.mount('#app')
