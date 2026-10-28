/**
 * vxe 引擎的注册 —— **只有这个模块静态 import vxe-table / vxe-pc-ui**。
 *
 * 它必须经 `vxe-loader.js` 动态加载：直接 import 会让 344.2 KB gz 的 vxe 回到入口，
 * 跟着每一页下载（含首页与全部组件页），而真正渲染 `engine: 'vxe'` 的只有
 * `/es-vxe-table`（17 个示例）与 `/ai-gallery/<id>`（engine-lab 案例）。
 *
 * 为什么不按需引 vxe 的子模块：EsTable 的 vxe 引擎用的是一整族 grid / column / edit
 * 能力，逐个子模块引的收益有限，而漏引的表现是「某个交互静默失灵」——把整棵依赖挪出
 * 首屏，收益已经有 344 KB。
 */
import VxeUI from 'vxe-pc-ui'
import VxeTable from 'vxe-table'

/** 把 vxe 的两个插件注册到 app（本站只有一个 Vue 3 应用实例） */
export function installVxe(app) {
  // 顺序不能反：VxeTable 内部的 VxePager / VxeInput 等要从 VxeUI 注册表里取
  app.use(VxeUI)
  app.use(VxeTable)
}
