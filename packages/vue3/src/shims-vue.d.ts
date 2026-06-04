/**
 * `*.vue` 文件的 TypeScript 模块声明（Vue 3 SFC）
 *
 * 作用：让 tsc / vue-tsc 能正确解析对 .vue 文件的 import：
 *   import EsForm from './es-form.vue'
 *
 * Vue 3 的 SFC 默认导出 DefineComponent 实例。
 * 实际类型由 Volar / vue-tsc plugin 在编译时增强，此处为兜底声明。
 */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component: DefineComponent<{}, {}, any>
  export default component
}
