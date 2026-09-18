import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import ElementUI from 'element-ui'
import http from '@/utils/server/request.js'
// Element UI 主题：由单源 token 生成（$--color-primary 取自 --es-brand-primary），
// 取代原先直接引 element-ui 预编译 CSS 的做法 —— 预编译产物里主色是写死的 #409EFF，
// 无法在运行期覆盖，导致本站组件库默认蓝与自研组件的品牌蓝 #3b82f6 不一致。
// 生成物由 scripts/gen-element-theme.mjs 产出，勿手改。
import './styles/element-theme.generated.scss'
import './assets/design-tokens.css'
import './assets/docs-content.css'
Vue.use(ElementUI, { size: 'mini' })
// vxe-table 3.x —— es-table 的 engine:'vxe' 高性能引擎依赖此库（须先于 EsPlus 注册）
// vxe-table 3.22.x 采用拆分架构：表格/表头/工具栏来自 vxe-table，而分页器 VxePager、
// 编辑输入 VxeInput/VxeSelect、按钮 VxeButton、弹窗 VxeModal 等 PC 组件来自 vxe-pc-ui，
// 由 @vxe-ui/core 的 VxeUI 注册表统一管理。必须先 Vue.use(VxeUIAll) 再 Vue.use(VxeTable)，
// 否则 grid 内部 VxeUI.getComponent('VxePager') 取不到组件 → 分页器/编辑框/导出按钮不渲染。
import VxeUIAll from 'vxe-pc-ui'
import 'vxe-pc-ui/lib/style.css'
import VxeTable from 'vxe-table'
import 'vxe-table/lib/style.css'
Vue.use(VxeUIAll)
Vue.use(VxeTable)
// es-eui 使用 Vue 2.6.x，原生不支持 Composition API —— 需要手动注册 polyfill。
// @es-plus/vue2 1.1.0+ 的 install() 内置了 alreadyInstalled 检测，不会重复注册。
// Vue.use(VueCompositionAPI)
import EsPlus from '@es-plus/vue2'
import '@es-plus/vue2/dist/style.css'

Vue.use(EsPlus, {
    EsTable: {
        methods: {
            $httpRequest({ url, headers, formParams, ...options }) {

                const opt = {
                    baseURL: '',
                    url,
                    contentType: 'application/json',
                    method: options?.method || 'POST',
                    headers: {
                        ...(headers || {}),
                        // 'Access-Control-Allow-Origin': '*',

                    },
                    //   data: formParams
                    // ...options,
                }
                if (opt.method.toUpperCase() === 'GET') {
                    opt.params = formParams
                } else {
                    opt.data = formParams
                }

                return http(opt)
            },
            paginationLayout: () => ({
                layout: 'total, sizes, prev, pager, next, jumper',
                pageSizes: [10, 20, 50, 100],
                isSmall: true,
                background: false
            }),
            // 配置自动查询字段输出
            configQueryfieldOutput() {
                return {
                    total: 'total',
                    pageSize: 'pageSize',
                    current: 'pageIndex',
                    tableData: 'data'
                }
            }
        }
    },
    EsForm: {
        methods: {
            $httpRequest({ url, headers, formParams, ...options }) {
                const opt = {
                    baseURL: '',
                    url,
                    contentType: 'application/json',
                    method: options.method || 'POST',
                    // data: formParams
                    // ...options,

                }
                if (opt.method.toUpperCase() === 'GET') {
                    opt.params = formParams
                } else {
                    opt.data = formParams
                }
                return http(opt)
            },
            // 配置自动查询字段输出
            fieldFieldOutput() {
                return {
                    total: 'total',
                    pageSize: 'pageSize',
                    current: 'pageIndex',
                    listData: 'data'
                }
            }
        }
    }
})
Vue.config.productionTip = false

// 全局错误处理
Vue.config.errorHandler = function (err, vm, info) {
    console.error('Vue Error:', err, info)
}
/*
Vue.config.warnHandler = function (msg, vm, trace) {
    if (msg.includes('infinite update loop')) {
        console.error('[DEBUG-WARN] Infinite loop warning:')
        console.error('  vm:', vm ? (vm.$options?.name || vm.constructor?.name || 'anonymous') : 'null')
        console.error('  trace:', trace)
    }
    console.warn('Vue Warn:', msg)
} */

// 全局 Promise 错误处理
window.addEventListener('unhandledrejection', event => {
    console.error('Unhandled promise rejection:', event.reason)
    event.preventDefault()
})

new Vue({
    router,
    store,
    render: h => h(App)
}).$mount('#app')
