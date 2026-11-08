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
import { onThemeApplied } from '@/stores/theme'

/**
 * vxe 的两个包在**模块求值**时都会 `setTheme('light')`（vxe-pc-ui/packages/components.ts
 * 底部），把 <html> 上已挂好的 data-vxe-ui-theme 覆盖回 light。本站 vxe 走懒加载，
 * 覆盖发生在 initTheme 之后 —— 不重设的话 /es-vxe-table 永远是整块白，即使 html 上
 * 有 `dark` 类、color-scheme 也是 dark。
 *
 * 登记在 onThemeApplied：模块加载完立刻设一次，之后每次切换主题再设一次。
 */
onThemeApplied((dark) => VxeUI.setTheme(dark ? 'dark' : 'light'))

/** 把 vxe 的两个插件注册到 app（本站只有一个 Vue 3 应用实例） */
export function installVxe(app) {
  // 顺序不能反：VxeTable 内部的 VxePager / VxeInput 等要从 VxeUI 注册表里取
  app.use(VxeUI)
  app.use(VxeTable)
}
