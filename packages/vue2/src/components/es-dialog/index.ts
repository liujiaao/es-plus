/**
 * EsDialog 组件入口
 *
 * 使用方式：
 *   1. 默认导入：import EsDialog, { useDialog } from '@es-plus/vue2/es-dialog'
 *   2. install 安装：通过 Vue.use(EsPlus) 全局注册（同时会通过 Vue.prototype.$useDialog 暴露）
 */

import EsDialog from './component.vue'
import useDialog from './use-dialog'
import type { Vue } from '../../vue-compat'

;(EsDialog as unknown as { install: (V: typeof Vue) => void }).install = function (Vue) {
  Vue.component((EsDialog as unknown as { name: string }).name || 'EsDialog', EsDialog)
  // 同时挂载到 Vue.prototype，方便 Options API 中通过 this.$useDialog() 调用
  ;(Vue as unknown as { prototype: Record<string, unknown> }).prototype.$useDialog = useDialog
}

export default EsDialog
export { EsDialog, useDialog }
