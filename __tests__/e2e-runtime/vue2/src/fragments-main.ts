// 片段 fixture 入口（AI-44）—— 与 main.ts（CRUD fixture）平行，互不影响。
//
// 关键差异：这里**只**给插件传顶层 httpRequest：
//   Vue.use(ESPlus, { httpRequest: backend.httpRequest })
// 片段产物本身没有 `:http-request` prop（它们只写 apiParams.url），
// 所以它必须经 AI-43 修好的「全局 httpRequest 兜底」才能发请求 ——
// 本 fixture 同时是那条兜底路径的运行时见证。
import Vue from 'vue'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import ESPlus from '@es-plus/vue2'
import '@es-plus/vue2/dist/style.css'
import FragmentsApp from './FragmentsApp.vue'
import { createFragmentBackend } from './fragments-backend'

Vue.use(ElementUI)

const backend = createFragmentBackend()
;(window as any).__backend = backend
// 与 CRUD fixture 的 App.vue 同口径：把未捕获 promise rejection 暴露给 spec，
// 断言片段在成功/失败路径上都不制造 unhandled rejection。
;(window as any).__unhandled = []
window.addEventListener('unhandledrejection', (e) => {
  const reason = (e as PromiseRejectionEvent).reason
  ;(window as any).__unhandled.push(String((reason && reason.message) || reason))
})

Vue.use(ESPlus, { httpRequest: backend.httpRequest })

new Vue({ render: (h) => h(FragmentsApp) }).$mount('#app')
