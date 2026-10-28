/**
 * vxe 引擎的注册 —— **只有这个模块静态 import vxe-table / vxe-pc-ui**。
 *
 * 它必须经 `vxe-loader.js` 动态加载：直接 import 会让 vxe 回到 `chunk-vendors`，
 * 跟着每一页下载（含首页与全部指南），而真正渲染 `engine: 'vxe'` 的只有
 * `/component/vxetable` 与 `/ai-gallery/<id>`（engine-lab 案例）。
 *
 * 与主站 es-plus-docs、子站 es-pc 同构（那边用 `app.use`，这里 Vue 2 是 `Vue.use`）。
 */
import VxeUIAll from 'vxe-pc-ui'
import VxeTable from 'vxe-table'

/** 把 vxe 的两个插件注册到 Vue 构造器上（Vue 2 的 `Vue.use` 会把构造器传进来） */
export function installVxe(Vue) {
    // 顺序不能反：VxeTable 内部的 VxePager / VxeInput 等要从 VxeUI 注册表里取，
    // 否则分页器/编辑框/导出按钮不渲染（与 main.js 里的历史注释同一件事）。
    Vue.use(VxeUIAll)
    Vue.use(VxeTable)
}
