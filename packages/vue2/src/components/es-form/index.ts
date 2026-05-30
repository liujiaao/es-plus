/**
 * EsForm 组件入口
 *
 * 提供两种导入方式：
 *  1. 默认导入：import EsForm from '@es-plus/vue2/es-form'
 *  2. install 安装：通过 Vue.use(EsPlus) 全局注册
 */

import EsForm from './es-form.vue'
import type { Vue } from '../../vue-compat'

// Element UI 组件作为 EsForm 的依赖，由用户在 main.js 中通过 Vue.use(ElementUI) 全局注册。
// 这里不重复注册，但提供 install 函数让 Vue.use(EsForm) 也能局部使用。
;(EsForm as unknown as { install: (V: typeof Vue) => void }).install = function (Vue) {
  Vue.component((EsForm as unknown as { name: string }).name || 'EsForm', EsForm)
}

export default EsForm
export { EsForm }
