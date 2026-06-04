/**
 * EsTable 组件入口
 *
 * 使用方式：
 *   1. 默认导入：import EsTable from '@es-plus/vue2/es-table'
 *   2. install 安装：通过 Vue.use(EsPlus) 全局注册
 *
 * Element UI 组件（el-table / el-pagination 等）作为 EsTable 的依赖，
 * 由用户在 main.js 中通过 Vue.use(ElementUI) 全局注册。
 */

import EsTable from './component.vue'
import type { Vue2Constructor } from '../../vue-compat'

;(EsTable as unknown as { install: (V: Vue2Constructor) => void }).install = function (Vue) {
  Vue.component((EsTable as unknown as { name: string }).name || 'EsTable', EsTable)
}

export default EsTable
export { EsTable }
