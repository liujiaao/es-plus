/**
 * `element-ui/lib/message-box` 的类型声明。
 *
 * 为什么要有这个文件：`@es-plus/vue2` 需要用 MessageBox 服务，而 Element UI 2.x 的
 * **主入口是 CommonJS 全量包**（`lib/element-ui.common.js`，216 KB gz，80 个组件），
 * `import { MessageBox } from 'element-ui'` 会把整包塞进消费方首屏，且 tree-shake 不掉。
 * 因此源码走子路径模块 —— 它只有运行时，没有随包发 .d.ts（`types/` 里是另一套按
 * 组件组织的声明）。
 *
 * 类型直接复用官方 `types/message-box` 里的 `ElMessageBox` 接口：它描述的正是这个
 * 服务对象（`alert` / `confirm` / `prompt` / `setDefaults` / `close`），与运行时形状一致。
 */
declare module 'element-ui/lib/message-box' {
  import type { ElMessageBox } from 'element-ui/types/message-box'
  const MessageBox: ElMessageBox
  export default MessageBox
}
