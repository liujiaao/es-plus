/**
 * `*.vue` 文件的 TypeScript 模块声明（Vue 2 SFC）
 *
 * 作用：让 tsc / vue-tsc 能正确解析对 .vue 文件的 import：
 *   import EsForm from './es-form.vue'
 *
 * Vue 2 的 SFC 默认导出是一个 ComponentOptions（与 Vue 3 的 DefineComponent 不同），
 * 这里类型留宽以保证消费方调用 .install / .name 等成员时不会报 TS 错误。
 *
 * 注意：实际类型由 Volar / vue-tsc 的 plugin 在编译时增强，运行时不受影响。
 */
declare module '*.vue' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component: any
  export default component
}
