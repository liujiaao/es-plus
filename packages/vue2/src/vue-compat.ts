/**
 * Vue 2 兼容层 —— 直接从 @vue/composition-api 导入
 *
 * @vue/composition-api 在不同环境下的行为：
 *   - Vue 2.7+：@vue/composition-api@1.7+ 的 postinstall 会自动 redirect 到 vue 原生 Composition API
 *   - Vue 2.6：提供完整的 Composition API polyfill
 *
 * 用户只需：
 *   1. npm install @vue/composition-api
 *   2. main.js 中 Vue.use(VueCompositionAPI)（Vue 2.6 必须，Vue 2.7 可选）
 *
 * 不使用 vue-demi 的原因：
 *   vue-demi 在嵌套 node_modules 安装时（monorepo / npm workspace），其 postinstall
 *   会解析到 @es-plus/vue2 的 devDependency vue@2.7 而非用户项目的 vue@2.6，
 *   导致生成了错误的 lib 版本（尝试从 vue 导入 getCurrentInstance），
 *   在 Vue 2.6 环境下产生 "export 'xxx' was not found in 'vue'" 错误。
 */

// Composition API 全部从 @vue/composition-api 导入：
// - Vue 2.7+：@vue/composition-api 自动 redirect 到 vue 原生 API
// - Vue 2.6：提供完整 polyfill
export {
  ref,
  reactive,
  computed,
  watch,
  watchEffect,
  onMounted,
  onUnmounted,
  onBeforeUnmount,
  onBeforeMount,
  onUpdated,
  onActivated,
  onDeactivated,
  defineComponent,
  inject,
  provide,
  nextTick,
  getCurrentInstance,
  toRefs,
  toRef,
  unref,
  isRef,
  h,
} from '@vue/composition-api'

// Vue 构造器必须从 'vue' 直接导入：
// @vue/composition-api 的 default export 是 plugin（{ install }），
// 没有 .extend / .component 等静态方法，useDialog 内部 Vue.extend(...) 会报错。
export { default as Vue } from 'vue'

export type { PropType, Ref, ComputedRef, WatchSource } from '@vue/composition-api'

/**
 * Vue 2 constructor type that includes static methods
 * (component, mixin, use, prototype) which @vue/composition-api's
 * type definitions omit.
 *
 * Use this instead of `typeof Vue` in install function signatures.
 */
export interface Vue2Constructor {
  component(name: string, component?: any): any
  mixin(mixin: Record<string, any>): void
  use(plugin: any, ...options: any[]): any
  prototype: Record<string, any>
}
