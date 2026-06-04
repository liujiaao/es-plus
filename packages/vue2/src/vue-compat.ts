/**
 * Vue 2 兼容层 —— 运行时按 Vue 版本动态切换 Composition API 来源
 *
 * 行为：
 *   - Vue 2.7+：使用 vue 原生导出的 Composition API（ref / reactive / inject / ...）
 *   - Vue 2.6.x：使用 @vue/composition-api 的 polyfill
 *
 * 为什么不直接从 '@vue/composition-api' 静态 re-export：
 *   官方说明里 @vue/composition-api 1.7+ 在 Vue 2.7 下应通过 postinstall 自动
 *   redirect 到原生 API，但在 monorepo / npm workspace / file: 协议安装时
 *   postinstall 经常不执行，导致 dist 仍然是完整 polyfill。结果在 Vue 2.7 项目里
 *   原生 setup 与 polyfill 的 wrappedData 双双激活，setup 被调用两次，触发：
 *     "[Vue warn]: The setup binding property xxx is already declared"
 *     "[Vue warn]: inject() can only be used inside setup() or functional components."
 *
 * 不使用 vue-demi 的原因：
 *   vue-demi 的 postinstall 在嵌套 node_modules 安装时会解析到本包的 devDependency
 *   vue@2.7 而非用户项目的 vue 版本，生成错误的 lib（在 Vue 2.6 项目里产生
 *   "export 'xxx' was not found in 'vue'" 报错）。
 *
 * 本文件的策略：在模块加载时读取 `Vue.version`，按 major.minor 选择正确的来源。
 * 两个候选源都通过静态 import 引入，构建器可以分析；运行时只有一份会被实际使用。
 */

import Vue from 'vue'
import * as VueNative from 'vue'
import * as CompositionApiPolyfill from '@vue/composition-api'

// 解析 Vue 版本
const versionString: string = (Vue as unknown as { version?: string }).version || ''
const [majorStr = '0', minorStr = '0'] = versionString.split('.')
const major = Number(majorStr)
const minor = Number(minorStr)

/** Vue 2.7+ 原生支持 Composition API，无需 polyfill */
export const isVue27Plus: boolean = major === 2 && minor >= 7

// 选择实际使用的 API 源：
//   Vue 2.7+ → 原生（VueNative.ref 等）
//   Vue 2.6  → polyfill（CompositionApiPolyfill.ref 等）
//
// 注意：在 Vue 2.6 环境里 VueNative 上不会有 ref / reactive 等键，但因为
// isVue27Plus 为 false，永远不会读到这些 undefined。反向同理。
const api: typeof CompositionApiPolyfill = (
  isVue27Plus ? VueNative : CompositionApiPolyfill
) as typeof CompositionApiPolyfill

// ─── Composition API 命名导出 ───
//
// 不能用 `export const ref = api.ref` 这种顶层重新声明，因为部分构建器
// （特别是 ES 模块 named export）只允许从单一静态源 re-export，不允许动态。
// 为此我们把每个 API 包成一个变量声明 + export 语句：
//
//   const _ref = api.ref
//   export { _ref as ref }
//
// 这样 TypeScript 不会做静态 re-export 树摇，但能正确通过类型检查。

const _ref = api.ref
const _reactive = api.reactive
const _computed = api.computed
const _watch = api.watch
const _watchEffect = api.watchEffect
const _onMounted = api.onMounted
const _onUnmounted = api.onUnmounted
const _onBeforeUnmount = api.onBeforeUnmount
const _onBeforeMount = api.onBeforeMount
const _onUpdated = api.onUpdated
const _onActivated = api.onActivated
const _onDeactivated = api.onDeactivated
const _defineComponent = api.defineComponent
const _inject = api.inject
const _provide = api.provide
const _nextTick = api.nextTick
const _getCurrentInstance = api.getCurrentInstance
const _toRefs = api.toRefs
const _toRef = api.toRef
const _unref = api.unref
const _isRef = api.isRef
// `h` 的类型在 @vue/composition-api 内部使用了未导出的命名空间 `H`，
// 直接 const _h = api.h 会触发 TS4023 (Exported variable uses unnameable type)。
// 用 typeof CompositionApiPolyfill.h 把类型固定到一个可命名的外部符号上。
const _h: typeof CompositionApiPolyfill.h = api.h

export {
  _ref as ref,
  _reactive as reactive,
  _computed as computed,
  _watch as watch,
  _watchEffect as watchEffect,
  _onMounted as onMounted,
  _onUnmounted as onUnmounted,
  _onBeforeUnmount as onBeforeUnmount,
  _onBeforeMount as onBeforeMount,
  _onUpdated as onUpdated,
  _onActivated as onActivated,
  _onDeactivated as onDeactivated,
  _defineComponent as defineComponent,
  _inject as inject,
  _provide as provide,
  _nextTick as nextTick,
  _getCurrentInstance as getCurrentInstance,
  _toRefs as toRefs,
  _toRef as toRef,
  _unref as unref,
  _isRef as isRef,
  _h as h,
}

/** 暴露 polyfill plugin（default export）给 install() 在 Vue 2.6 下按需安装 */
export const VueCompositionAPIPlugin: unknown =
  (CompositionApiPolyfill as unknown as { default?: unknown }).default ??
  CompositionApiPolyfill

// Vue 构造器必须从 'vue' 直接导入：
// @vue/composition-api 的 default export 是 plugin（{ install }），
// 没有 .extend / .component 等静态方法，useDialog 内部 Vue.extend(...) 会报错。
export { default as Vue } from 'vue'

// 类型导出：Vue 2.7+ 与 @vue/composition-api 的类型定义结构兼容，
// 这里统一从 polyfill 包导出，避免 Vue 2.6 下 'vue' 没有这些类型导致编译失败。
export type { PropType, Ref, ComputedRef, WatchSource } from '@vue/composition-api'

/**
 * Vue 2 constructor type that includes static methods
 * (component, mixin, use, prototype) which @vue/composition-api's
 * type definitions omit.
 *
 * Use this instead of `typeof Vue` in install function signatures.
 */
export interface Vue2Constructor {
  version?: string
  component(name: string, component?: any): any
  mixin(mixin: Record<string, any>): void
  use(plugin: any, ...options: any[]): any
  prototype: Record<string, any>
}
