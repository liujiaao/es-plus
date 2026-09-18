/// <reference types="vite/client" />

// 本行声明 ImportMeta.env（vite/client 提供），是 `import.meta.env.DEV` 能被 tsc 识别的
// 前提 —— vue3 的 shims-vue.d.ts 一直有这一行，另两包此前没有，于是同样写法会报
// TS2339: Property 'env' does not exist on type 'ImportMeta'。三端保持一致。
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}
