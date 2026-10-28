/**
 * vxe 引擎的注册——**只有这个模块静态 import vxe-table**。
 *
 * 它必须经 `vxe-loader.ts` 动态加载：直接 import 会让 344 KB gz 的 vxe 回到入口，
 * 跟着每一页下载（包括首页与全部指南），而真正会渲染 `engine: 'vxe'` 的只有
 * `/advanced/vxe-table`（19 个示例）、`/ai-gallery`（engine-lab 案例）与 `/playground`
 * （用户可以粘一份 engine 为 vxe 的配置）。
 *
 * 为什么不按需引入 vxe 的子模块：EsTable 的 vxe 引擎（vxeFirstClass）用的是一整族
 * grid / column / edit 能力，逐个子模块引的收益有限，而漏引的表现是「某个交互静默失灵」。
 * 把整棵依赖挪出首屏，收益已经有 344 KB。
 */
import type { App } from 'vue'
import VxeUI from 'vxe-pc-ui'
import VxeTable from 'vxe-table'

/** 把 vxe 的两个插件注册到某个 app（主应用与文档内示例子应用各注册一次） */
export function installVxe(app: App): void {
  app.use(VxeUI)
  app.use(VxeTable)
}
