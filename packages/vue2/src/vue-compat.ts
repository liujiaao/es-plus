/**
 * Vue 2 兼容层 —— 单点 re-export
 *
 * 设计目标：
 *   - 源码统一 `import { ref } from './vue-compat'`，不直接从 'vue' 导入
 *   - 这样 Vue 2.6 / Vue 2.7 / 未来切换 vue-demi 都只改这一个文件
 *
 * 当前实现：从 'vue' 直接 re-export
 *   - Vue 2.7+：原生支持 Composition API，开箱即用
 *   - Vue 2.6：用户需在 main.js 调用 Vue.use(VueCompositionAPI)，
 *     并配置 bundler resolve.alias('vue', '@vue/composition-api')
 *     （或直接升级到 2.7+，更省事）
 *
 * Vue 实例本身（Vue.extend / Vue.component）也由本文件暴露，供 useDialog 编程式弹窗使用。
 */

export {
  default as Vue,
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
} from 'vue'

export type { PropType, Ref, ComputedRef, WatchSource } from 'vue'
