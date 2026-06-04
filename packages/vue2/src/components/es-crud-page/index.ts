/**
 * EsCrudPage 组件入口
 *
 * 使用方式：
 *   1. 默认导入：import EsCrudPage from '@es-plus/vue2/es-crud-page'
 *   2. install 安装：通过 Vue.use(EsPlus) 全局注册
 */

import EsCrudPage from './es-crud-page.vue'
import type { Vue2Constructor } from '../../vue-compat'

;(EsCrudPage as unknown as { install: (V: Vue2Constructor) => void }).install = function (Vue) {
  Vue.component(
    (EsCrudPage as unknown as { name: string }).name || 'EsCrudPage',
    EsCrudPage
  )
}

export default EsCrudPage
export { EsCrudPage }
export type {
  CrudPageSchema,
  CrudBtnConfig,
  TableBtnConfig,
  OperationColumnConfig,
  RowBtnConfig,
  RowBtnContext,
  CrudDialogConfig,
  DialogRenderContext,
  DialogBtnConfig,
  DialogActionContext,
  CrudAction,
} from './types'
