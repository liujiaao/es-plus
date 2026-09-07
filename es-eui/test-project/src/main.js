import Vue from 'vue'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import EsEui from 'es-eui'
import 'es-eui/es-eui.css'
import App from './App.vue'

Vue.use(ElementUI)
Vue.use(EsEui)

Vue.config.productionTip = false

new Vue({
    render: h => h(App)
}).$mount('#app')