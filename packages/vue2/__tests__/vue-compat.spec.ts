/**
 * vue-compat.ts 测试
 *
 * 测试环境使用 Vue 2.7，所以 isVue27Plus = true，
 * 所有 Composition API 导出来自 vue 原生（VueNative）。
 */
import { describe, it, expect } from 'vitest'
import {
  isVue27Plus,
  VueCompositionAPIPlugin,
  Vue,
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
} from '../src/vue-compat'

describe('isVue27Plus', () => {
  it('测试环境 Vue 2.7 → isVue27Plus = true', () => {
    expect(isVue27Plus).toBe(true)
  })
})

describe('Composition API 导出均为函数', () => {
  const fns: [string, unknown][] = [
    ['ref', ref],
    ['reactive', reactive],
    ['computed', computed],
    ['watch', watch],
    ['watchEffect', watchEffect],
    ['onMounted', onMounted],
    ['onUnmounted', onUnmounted],
    ['onBeforeUnmount', onBeforeUnmount],
    ['onBeforeMount', onBeforeMount],
    ['onUpdated', onUpdated],
    ['onActivated', onActivated],
    ['onDeactivated', onDeactivated],
    ['defineComponent', defineComponent],
    ['inject', inject],
    ['provide', provide],
    ['nextTick', nextTick],
    ['getCurrentInstance', getCurrentInstance],
    ['toRefs', toRefs],
    ['toRef', toRef],
    ['unref', unref],
    ['isRef', isRef],
    ['h', h],
  ]

  for (const [name, fn] of fns) {
    it(`${name} 是函数`, () => {
      expect(typeof fn).toBe('function')
    })
  }
})

describe('ref / isRef / unref', () => {
  it('ref(0) 创建响应式引用', () => {
    const r = ref(0)
    expect(isRef(r)).toBe(true)
    expect(r.value).toBe(0)
  })

  it('ref.value 赋值生效', () => {
    const r = ref(1)
    r.value = 42
    expect(r.value).toBe(42)
  })

  it('isRef(ref(...)) → true', () => {
    expect(isRef(ref('x'))).toBe(true)
  })

  it('isRef(普通对象) → false', () => {
    expect(isRef({ value: 1 })).toBe(false)
  })

  it('unref(ref(5)) → 5', () => {
    expect(unref(ref(5))).toBe(5)
  })

  it('unref(原始值) → 原始值', () => {
    expect(unref(99)).toBe(99)
  })
})

describe('reactive', () => {
  it('reactive({}) 返回响应式对象', () => {
    const obj = reactive({ count: 0 })
    expect(obj.count).toBe(0)
    obj.count = 1
    expect(obj.count).toBe(1)
  })
})

describe('computed', () => {
  it('computed(() => ...) 返回计算值', () => {
    const r = ref(2)
    const doubled = computed(() => r.value * 2)
    expect(doubled.value).toBe(4)
  })
})

describe('toRefs / toRef', () => {
  it('toRefs 将 reactive 拆解为 ref 集合', () => {
    const state = reactive({ x: 1, y: 2 })
    const { x, y } = toRefs(state)
    expect(isRef(x)).toBe(true)
    expect(x.value).toBe(1)
    expect(y.value).toBe(2)
  })

  it('toRef 从 reactive 对象创建单个 ref', () => {
    const state = reactive({ name: 'Alice' })
    const name = toRef(state, 'name')
    expect(isRef(name)).toBe(true)
    expect(name.value).toBe('Alice')
  })
})

describe('h — createElement', () => {
  it('h 是函数（Vue 2.7 要求在组件上下文内调用，此处仅验证类型）', () => {
    expect(typeof h).toBe('function')
  })
})

describe('VueCompositionAPIPlugin', () => {
  it('VueCompositionAPIPlugin 不为 null/undefined', () => {
    expect(VueCompositionAPIPlugin).toBeDefined()
    expect(VueCompositionAPIPlugin).not.toBeNull()
  })
})

describe('Vue 构造器导出', () => {
  it('Vue 是函数（构造器）', () => {
    expect(typeof Vue).toBe('function')
  })

  it('Vue.version 为 "2.x.x" 格式', () => {
    const v = (Vue as any).version as string
    expect(v).toMatch(/^2\./)
  })

  it('Vue.extend 存在（静态方法完整）', () => {
    expect(typeof (Vue as any).extend).toBe('function')
  })

  it('Vue.component 存在', () => {
    expect(typeof (Vue as any).component).toBe('function')
  })
})
