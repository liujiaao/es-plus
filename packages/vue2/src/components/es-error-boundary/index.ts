/**
 * EsErrorBoundary 组件入口（Vue 2）
 *
 * 使用方式：
 *   1. 默认导入：import EsErrorBoundary from '@es-plus/vue2/es-error-boundary'
 *   2. install 安装：通过 Vue.use(EsPlus) 全局注册
 */

import EsErrorBoundary from './es-error-boundary.vue'
import type { Vue2Constructor } from '../../vue-compat'

;(EsErrorBoundary as unknown as { install: (V: Vue2Constructor) => void }).install = function (Vue) {
  Vue.component(
    (EsErrorBoundary as unknown as { name: string }).name || 'EsErrorBoundary',
    EsErrorBoundary
  )
}

export default EsErrorBoundary
export { EsErrorBoundary }
