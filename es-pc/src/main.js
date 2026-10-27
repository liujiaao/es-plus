import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
// ant-design-vue 4.x DatePicker 依赖 dayjs locale，必须手动加载
import 'dayjs/locale/zh-cn'
// vxe-table 高性能引擎（es-table 的 engine:'vxe' 依赖，先于 ESPlus 注册）
// 注册方式与主站 es-plus-docs 完全一致（vxe-pc-ui 默认导出 + vxe-table 默认导出）
import 'vxe-pc-ui/lib/style.css'
import 'vxe-table/dist/style.css'
import VxeUI from 'vxe-pc-ui'
import VxeTable from 'vxe-table'
import ESPlus from '@es-plus/adapter-antdv'
import '@es-plus/adapter-antdv/dist/style.css'
import App from './App.vue'
import router from './router'
import { demoHttpRequest } from './utils/demo-http'
import './styles/design-tokens.css'
import './styles/docs-content.css'
import './styles/docs-layout.css'
import './styles/docs-chrome.css'
// 三站统一页脚外观（docs/theme/docs-footer.css → scripts/sync-theme.mjs 分发）
import './styles/docs-footer.css'
// 三站统一 404 外观（docs/theme/docs-notfound.css → scripts/sync-theme.mjs 分发）
import './styles/docs-notfound.css'
import './styles/global.css'
// 可访问性基线（docs/theme/docs-a11y.css → scripts/sync-theme.mjs 分发）。
// 放在最后一个全局样式之后：`:focus-visible` 要盖住前面所有 outline 约定。
import './styles/docs-a11y.css'

const app = createApp(App)
app.use(Antd)
app.use(VxeUI)
app.use(VxeTable)
app.use(router)
app.use(ESPlus, {
  globalProperties: true,
  // 全局请求只在这一处配置：示例组件一律只声明 apiParams，不传 httpRequest。
  // 这正是「schema 可 JSON 序列化」的前提 —— 函数值进不了 JSON，只能来自入口。
  httpRequest: demoHttpRequest,
})
app.mount('#app')
