import Vue from 'vue'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import ESPlus from '@es-plus/vue2'
import '@es-plus/vue2/dist/style.css'
import App from './App.vue'

Vue.use(ElementUI)
Vue.use(ESPlus)

new Vue({
  render: (h) => h(App),
}).$mount('#app')
