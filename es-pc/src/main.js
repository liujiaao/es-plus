import { createApp } from 'vue'
// Ant Design Vue 的**全量**注册（`app.use(Antd)`）不在这里：站点模板只用到 26 组标签，
// 显式清单见 utils/install-antd.js。`@es-plus/adapter-antdv` 内部是直接 import 组件的，
// 不依赖全局注册。
import 'ant-design-vue/dist/reset.css'
// ant-design-vue 4.x DatePicker 依赖 dayjs locale，必须手动加载
import 'dayjs/locale/zh-cn'
// vxe-table 高性能引擎（es-table 的 engine:'vxe' 依赖）。**插件**不在这里静态引入：
// 全量注册是 344.2 KB gz，只有 /es-vxe-table 与 /ai-gallery/<id> 真的会渲染 engine:'vxe'。
// 按需加载见 utils/vxe-loader.js（下面的 router 门）。样式保留在首屏：它是 CSS，
// 不进 JS 预算；挪进懒加载块会让注入顺序排到站点覆盖规则之后，收益与风险不对等。
import 'vxe-pc-ui/lib/style.css'
import 'vxe-table/dist/style.css'
import ESPlus from '@es-plus/adapter-antdv'
import '@es-plus/adapter-antdv/dist/style.css'
import App from './App.vue'
import router from './router'
import { demoHttpRequest } from './utils/demo-http'
import { installAntd } from './utils/install-antd'
import { ensureVxe, needsVxe } from './utils/vxe-loader'
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
installAntd(app)
app.use(router)
app.use(ESPlus, {
  globalProperties: true,
  // 全局请求只在这一处配置：示例组件一律只声明 apiParams，不传 httpRequest。
  // 这正是「schema 可 JSON 序列化」的前提 —— 函数值进不了 JSON，只能来自入口。
  httpRequest: demoHttpRequest,
})

// vxe 引擎按需加载（路线图 3.6）：导航到真的要渲染 engine:'vxe' 的页面前再拉那 344 KB。
// 守在 beforeEach 而不是组件里，是因为 app.use 必须在子组件创建**之前**完成 —— 晚一步
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

app.mount('#app')
