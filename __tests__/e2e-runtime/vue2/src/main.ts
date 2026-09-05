// Tier 2 fixture 装配 —— 复刻 __tests__/e2e/fixtures/vue2-fresh/src/main.js 的真实装配方式：
// 真实 Vue 2.7 + 真实 Element UI + 真实 @es-plus/vue2 dist（经 vite.config alias 消费构建产物）。
import Vue from 'vue'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import ESPlus from '@es-plus/vue2'
import '@es-plus/vue2/dist/style.css'
import App from './App.vue'

Vue.use(ElementUI)
Vue.use(ESPlus)

new Vue({ render: (h) => h(App) }).$mount('#app')
