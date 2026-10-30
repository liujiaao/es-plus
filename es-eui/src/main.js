import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import http from '@/utils/server/request.js'
// Element UI 主题：由单源 token 生成（$--color-primary 取自 --es-brand-primary），
// 取代原先直接引 element-ui 预编译 CSS 的做法 —— 预编译产物里主色是写死的 #409EFF，
// 无法在运行期覆盖，导致本站组件库默认蓝与自研组件的品牌蓝 #3b82f6 不一致。
// 生成物由 scripts/gen-element-theme.mjs 产出，勿手改。
import './styles/element-theme.generated.scss'
import './assets/design-tokens.css'
import './assets/docs-content.css'
import './assets/docs-layout.css'
import './assets/docs-chrome.css'
// 三站统一页脚外观（docs/theme/docs-footer.css → scripts/sync-theme.mjs 分发）
import './assets/docs-footer.css'
// 三站统一 404 外观（docs/theme/docs-notfound.css → scripts/sync-theme.mjs 分发）
import './assets/docs-notfound.css'
// 可访问性基线（docs/theme/docs-a11y.css → scripts/sync-theme.mjs 分发）
import './assets/docs-a11y.css'
// Element UI 按需注册：站点模板 + @es-plus/vue2 模板/渲染函数用到的 44 个组件与四个服务
// （清单与守卫都在 utils/install-element.js）。
// **不要**换回 `Vue.use(ElementUI)`：那是 216 KB gz 的主入口（含 Calendar / Carousel /
// Timeline 等一张页面都没用过的组件），Element UI 的主入口是 CommonJS，tree-shake 不掉。
import installElement from '@/utils/install-element'
installElement(Vue)
// vxe-table 3.x —— es-table 的 engine:'vxe' 高性能引擎依赖此库。
// **插件**不在这里静态引入：全量注册会让 vxe 进 `chunk-vendors`，每一页都先付这笔钱，
// 而真正渲染 engine:'vxe' 的只有 /component/vxetable 与 /ai-gallery/<id>。
// 按需加载见 utils/vxe-loader.js（下面的 router 门；注册顺序的坑写在 vxe-install.js 里）。
// 样式保留在首屏：它是 CSS，不进 JS 预算；挪进懒加载块会让注入顺序排到站点覆盖规则之后。
import 'vxe-pc-ui/lib/style.css'
import 'vxe-table/lib/style.css'
// es-eui 使用 Vue 2.6.x，原生不支持 Composition API —— 需要手动注册 polyfill。
// @es-plus/vue2 1.1.0+ 的 install() 内置了 alreadyInstalled 检测，不会重复注册。
// Vue.use(VueCompositionAPI)
import EsPlus from '@es-plus/vue2'
import '@es-plus/vue2/dist/style.css'
import { demoHttpRequest } from '@/utils/demo-http'
import { ensureVxe, needsVxe } from '@/utils/vxe-loader'

// 站点自己的请求：axios 实例（保留拦截器、Token 注入等既有能力）。
// 演示接口走本地 mock，其余地址照旧走这里 —— 两条路合起来就是「一个入口函数」。
function siteHttpRequest({ url, headers, formParams, ...options }) {
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
}

const isDemoUrl = (params) => String((params && params.url) || '').indexOf('/api/demo/') === 0

Vue.use(EsPlus, {
    // 全局请求：整个应用只配这一处。表格 / 表单只声明 apiParams，不再各自写 $httpRequest。
    // 组件级 httpRequest 仍然优先（个别页面要签名 / 重试就在那一页覆盖）。
    httpRequest: (params) => (isDemoUrl(params) ? demoHttpRequest(params) : siteHttpRequest(params)),
    EsTable: {
        paginationLayout: {
            layout: 'total, sizes, prev, pager, next, jumper',
            pageSizes: [10, 20, 50, 100],
            isSmall: true,
            background: false
        },
        // 配置自动查询字段输出
        configQueryFieldOutput: {
            total: 'total',
            pageSize: 'pageSize',
            current: 'pageIndex',
            tableData: 'data'
        }
    },
    EsForm: {
        // 配置自动查询字段输出
        fieldFieldOutput: {
            total: 'total',
            pageSize: 'pageSize',
            current: 'pageIndex',
            listData: 'data'
        }
    }
})
Vue.config.productionTip = false

// vxe 引擎按需加载：导航到真的要渲染 engine:'vxe' 的页面前再拉那几百 KB。
// 守在 beforeEach 而不是组件里，是因为 Vue.use 必须在子组件创建**之前**完成 ——
// 晚一步 EsTable 会拿着未注册的引擎渲染「未安装 vxe」的提示。
router.beforeEach((to, from, next) => {
    if (!needsVxe(to)) return next()
    ensureVxe(Vue)
        .then(() => next())
        .catch((err) => {
            // 产物缺块 / 离线：照常进页面，让 EsTable 的既有提示去说这件事，别白屏
            console.error('[vxe] 按需加载失败，engine:"vxe" 的表格将显示未安装提示', err)
            next()
        })
})

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
