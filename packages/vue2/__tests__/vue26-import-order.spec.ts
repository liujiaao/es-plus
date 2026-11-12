/**
 * Vue 2.6 导入顺序回归（1.6.0 空页面事故）
 *
 * 事故：`locale.ts` 在模块顶层调用 `ref(getLocaleVersion())`。用户 `main.js` 的
 * `import EsPlus from '@es-plus/vue2'` 会先求值整条依赖链（含 locale.ts），
 * 此时 `Vue.use(EsPlus)` 还没执行；Vue 2.6 上 @vue/composition-api 的 `ref`
 * 于是抛
 *   `[vue-composition-api] must call Vue.use(VueCompositionAPI) before using any function.`
 * 包体 import 即崩，esui 站点整页空白。
 *
 * 修复：vue-compat.ts 在模块求值阶段（导出 `ref` 之前）就给 Vue 2.6 装上 polyfill。
 * 本测试把 Vue 固定成 2.6.14，并用 polyfill 的「未安装即抛」行为当判据 ——
 * 如果修复被移回 `install()`，这里会直接红。
 */
import { describe, expect, it, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: { installed: false, refCalls: 0 },
}))

vi.mock('vue', () => {
  const Vue = function Vue() {} as unknown as Record<string, any>
  Vue.version = '2.6.14'
  Vue.__composition_api_installed__ = false
  Vue.use = (plugin: { install?: () => void }) => {
    plugin?.install?.()
    Vue.__composition_api_installed__ = true
  }
  Vue.component = () => {}
  Vue.mixin = () => {}
  Vue.extend = () => {}
  Vue.prototype = {}
  return { default: Vue, version: Vue.version }
})

vi.mock('@vue/composition-api', () => {
  const plugin = {
    install() {
      state.installed = true
    },
  }
  const ref = (value: unknown) => {
    if (!state.installed) {
      throw new Error(
        '[vue-composition-api] must call Vue.use(VueCompositionAPI) before using any function.'
      )
    }
    state.refCalls += 1
    return { value }
  }
  // vue-compat.ts 在模块求值时会读取全部 API 键；vitest 的 ESM mock 要求
  // 被访问的命名导出必须存在，否则报 "No xxx export is defined"。
  const noop = () => {}
  return {
    default: plugin,
    ref,
    reactive: noop,
    computed: noop,
    watch: noop,
    watchEffect: noop,
    onMounted: noop,
    onUnmounted: noop,
    onBeforeUnmount: noop,
    onBeforeMount: noop,
    onUpdated: noop,
    onActivated: noop,
    onDeactivated: noop,
    defineComponent: noop,
    inject: noop,
    provide: noop,
    nextTick: noop,
    getCurrentInstance: noop,
    toRefs: noop,
    toRef: noop,
    unref: noop,
    isRef: noop,
    markRaw: noop,
    set: noop,
    h: noop,
  }
})

describe('Vue 2.6 模块求值顺序', () => {
  it('导入 locale 模块时 polyfill 已安装（顶层 ref 不抛）', async () => {
    const locale = await import('../src/locale')

    expect(state.installed).toBe(true)
    expect(state.refCalls).toBeGreaterThan(0)
    expect(typeof locale.resolveBuiltinText).toBe('function')
  })
})
