import Vue from 'vue'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import EsPlus from '@es-plus/vue2'
import '@es-plus/vue2/dist/style.css'
import App from './App.vue'

// Vue 2.7 自带 Composition API，运行时不走 @vue/composition-api，所以这里不 Vue.use 它。
// （package.json 仍装该包，仅为让 @es-plus/vue2 产物里那条静态 import 在打包时可解析，详见 README。）
Vue.use(ElementUI)
Vue.use(EsPlus)

new Vue({ render: (h) => h(App) }).$mount('#app')
