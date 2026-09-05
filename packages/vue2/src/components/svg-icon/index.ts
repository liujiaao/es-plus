import type { Vue2Constructor } from '../../vue-compat'
import SvgIcon from './src/svg-icon.vue'

// Vue 2 的 install 走 Vue.component（而非 Vue 3 的 app.component）。
;(SvgIcon as unknown as { install?: (Vue: Vue2Constructor) => void }).install = function (
  Vue: Vue2Constructor,
) {
  const name = (SvgIcon as unknown as { name?: string }).name
  if (name) Vue.component(name, SvgIcon as unknown as never)
}

export default SvgIcon
