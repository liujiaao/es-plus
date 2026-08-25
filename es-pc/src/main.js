import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
// ant-design-vue 4.x DatePicker 依赖 dayjs locale，必须手动加载
import 'dayjs/locale/zh-cn'
// vxe-table 高性能引擎（es-table 的 engine:'vxe' 依赖，先于 ESPlus 注册）
import VxeUIAll from 'vxe-pc-ui'
import 'vxe-pc-ui/lib/style.css'
import VxeTable from 'vxe-table'
import 'vxe-table/lib/style.css'
import ESPlus from '@es-plus/adapter-antdv'
import '@es-plus/adapter-antdv/dist/style.css'
import App from './App.vue'
import router from './router'
import './styles/design-tokens.css'
import './styles/global.css'

const app = createApp(App)
app.use(Antd)
app.use(VxeUIAll).use(VxeTable)
app.use(router)
app.use(ESPlus, {
  globalProperties: true,
  permission: (value) => true,
})
app.mount('#app')
