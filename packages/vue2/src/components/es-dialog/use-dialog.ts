/**
 * useDialog 编程式弹窗 —— Vue 2 版本
 *
 * 与 Vue 3 实现的核心差异：
 *   Vue 3: createVNode(Component, props) → render(vNode, container) → 通过 vNode.component.props 修改
 *   Vue 2: Vue.extend(Component) → new Ctor({ propsData }) → $mount() → 实例方法/$props 修改
 *
 * 实现策略：
 *   1. Vue.extend 把组件定义转为可实例化的构造函数
 *   2. new Ctor({ propsData }) 创建实例
 *   3. $mount() 后把 $el 追加到 appendTo 元素（默认 document.body）
 *   4. 关闭时通过设置 dialogInstance.visible = false 触发动画 + emit closed
 *   5. destroy 时调用 $destroy() 并 remove DOM 节点
 *
 * 与 Vue 3 版本保持一致的对外 API：
 *   useDialog()(opts)   → 默认模式：单例式，重复调用复用同一实例
 *   useDialog(comp, { onlyInstance: true })(opts) → 每次都创建新实例
 *
 * 兼容性说明：
 *   - Vue 2 没有 appContext，但 Vue.extend 创建的实例会继承全局 plugin（如 Vue.use(ElementUI)）
 *   - 依赖注入：useDialog 创建的弹窗组件 与 父组件没有 provide/inject 关系
 *     若需要 i18n / 全局配置注入，请通过 props 显式传入
 */

import { Vue, getCurrentInstance } from '../../vue-compat'
import EsDialog from './component.vue'
import type { DialogOptions } from '@es-plus/core'

export interface DialogCallable {
  (dialogOptions: DialogOptions & { cacheKey?: string }): unknown
  close: () => void
  /** 销毁：传 cacheKey 只销毁该缓存实例；不传则销毁当前实例与全部缓存 */
  destroy: (cacheKey?: string) => void
}

export type DialogCallableWithDestroy = DialogCallable

/** 缓存实例的延迟自动销毁时长：关闭后 10 分钟未重新打开则回收 */
const CACHE_TTL = 10 * 60 * 1000

/** 从调用参数中提取「会作为 prop 下发」的键（排除 onXxx 事件与 cacheKey 本身） */
const pickProps = (opts: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  Object.keys(opts).forEach((k) => {
    if (!k.startsWith('on') && k !== 'cacheKey') out[k] = opts[k]
  })
  return out
}

const getAppendToElement = (appendTo?: string | HTMLElement): HTMLElement => {
  if (typeof appendTo === 'string') {
    return (document.querySelector(appendTo) as HTMLElement) || document.body
  }
  return appendTo instanceof HTMLElement ? appendTo : document.body
}

/**
 * Vue 2 中将 Vue 3 风格的 onXxx 事件回调转为 propsData/$on 监听
 *
 * Vue 3 用户写法：useDialog()({ onClosed: () => {}, onSubmit: () => {} })
 * Vue 2 中需要：把 onClosed → 监听 'closed' 事件，onSubmit → 监听 'submit' 事件
 */
const extractEventHandlers = (
  options: Record<string, unknown>
): { propsData: Record<string, unknown>; events: Record<string, Function> } => {
  const events: Record<string, Function> = {}
  const propsData: Record<string, unknown> = {}

  Object.entries(options).forEach(([key, value]) => {
    if (key.startsWith('on') && typeof value === 'function' && key.length > 2) {
      // 'onClosed' → 'closed', 'onSubmit' → 'submit', 'onUpdate:visible' → 'update:visible'
      const eventName = key.slice(2)
      // 'Closed' → 'closed', 保留 'update:visible' 中的 ':'
      const normalized = eventName.charAt(0).toLowerCase() + eventName.slice(1)
      events[normalized] = value as Function
    } else {
      propsData[key] = value
    }
  })

  return { propsData, events }
}

/** kebab-case / snake → camelCase（用于把 options key 归一化后与声明的 props 名匹配） */
const camelize = (str: string): string => str.replace(/-(\w)/g, (_, c: string) => (c ? c.toUpperCase() : ''))

/** 取构造函数上「已声明的 props 名」集合（Vue 已归一化为 camelCase 键） */
const getDeclaredPropNames = (Ctor: any): Set<string> => {
  const declared = (Ctor && Ctor.options && Ctor.options.props) || {}
  return new Set(Object.keys(declared))
}

/**
 * 把 propsData 按「组件是否声明该 prop」拆成 props / attrs 两部分。
 *
 * 背景：Vue 2 里 `new Ctor({ propsData })` 只有「已声明的 prop」会被消费，
 * 未声明的键不会像模板用法那样落进 $attrs（编程式创建没有 parentVnode）。
 * 于是 el-dialog 的透传属性（customClass/top/center…）会被静默丢弃。
 * 拆出的 attrs 交给 EsDialog 的 passThroughAttrs prop，再在组件内 v-bind 到 el-dialog，
 * 行为对齐 Vue 3（createVNode 会把未声明 prop 归入 attrs）。
 */
const splitProps = (
  Ctor: any,
  propsData: Record<string, unknown>
): { props: Record<string, unknown>; attrs: Record<string, unknown> } => {
  const names = getDeclaredPropNames(Ctor)
  const props: Record<string, unknown> = {}
  const attrs: Record<string, unknown> = {}
  Object.keys(propsData).forEach((k) => {
    if (names.has(k) || names.has(camelize(k))) props[k] = propsData[k]
    else attrs[k] = propsData[k]
  })
  return { props, attrs }
}

/**
 * 复用已存在实例时应用新 options：已声明 prop 直接写 vm[k]；
 * 未声明的透传属性汇入 vm.passThroughAttrs（若该组件声明了此 prop）。
 * 跳过 on* 事件键与 cacheKey。
 */
const applyOptionsToVm = (vm: any, opts: Record<string, unknown>) => {
  const declared = new Set(Object.keys((vm && vm.$options && vm.$options.props) || {}))
  const attrs: Record<string, unknown> = {}
  Object.keys(opts).forEach((k) => {
    if (k.startsWith('on') || k === 'cacheKey' || k === 'passThroughAttrs') return
    if (declared.has(k) || declared.has(camelize(k))) {
      vm[k] = opts[k]
    } else {
      attrs[k] = opts[k]
    }
  })
  if (declared.has('passThroughAttrs')) {
    vm.passThroughAttrs = attrs
  }
}

const initInstance = (
  Component: any,
  options: DialogOptions,
  appendTo?: string | HTMLElement
) => {
  const { propsData, events } = extractEventHandlers(options as Record<string, unknown>)

  // Vue.extend(Component) 把组件定义转为构造函数
  const Ctor = (Vue as any).extend(Component)

  // 拆分「已声明 prop」与「未声明透传属性」；仅当组件声明了 passThroughAttrs 时才走透传，
  // 否则维持原行为（未声明键随 propsData 传入，由 Vue 自行忽略）。
  const declared = getDeclaredPropNames(Ctor)
  let finalPropsData: Record<string, unknown> = propsData
  if (declared.has('passThroughAttrs')) {
    const { props, attrs } = splitProps(Ctor, propsData)
    finalPropsData = { ...props, passThroughAttrs: attrs }
  }

  const vm = new Ctor({ propsData: finalPropsData })

  // 编程式实例没有父级 :visible.sync / v-model:visible 来回写 visible。
  // es-dialog 关闭（X/取消/遮罩/ESC）只 emit('update:visible', false)，自身不改 props.visible；
  // 若无人回写，props.visible 恒为 true、弹窗关不掉（尤其 cacheKey 复用实例——onClosed 提前 return
  // 不销毁，又没有 destroy 兜底藏 DOM）。此处桥接 update:visible → vm.visible，等价父级 .sync 回写，
  // 使组件自身的关闭链路真正翻转 visible。用户显式传 onUpdate:visible 时以其为准，不覆盖。
  if (!events['update:visible']) {
    vm.$on('update:visible', (val: boolean) => {
      vm.visible = val
    })
  }

  // 注册事件监听（注意：Vue 2 中通过 $on 监听）
  Object.entries(events).forEach(([eventName, handler]) => {
    vm.$on(eventName, handler)
  })

  // $mount() 不传参数 = 创建一个游离的 $el（不挂到 DOM 树）
  // 然后我们手工 appendChild 到目标节点
  vm.$mount()
  const target = getAppendToElement(appendTo)
  target.appendChild(vm.$el)

  return vm
}

export function useDialog(
  Component?: any,
  opt?: { onlyInstance?: false }
): DialogCallableWithDestroy
export function useDialog(Component?: any, opt?: { onlyInstance: true }): DialogCallable
export function useDialog(Component?: any, opt: { onlyInstance?: boolean } = {}) {
  Component = Component || EsDialog
  const options = Object.assign({ onlyInstance: false }, opt)

  // ─── cacheKey → 实例缓存（跨多次调用的状态保持）───
  const instanceCache = new Map<string, any>()

  /** 尝试从 cacheKey 获取已缓存实例，命中则更新 props 并显示 */
  const tryCacheHit = (opts: Record<string, unknown>): any | null => {
    const cacheKey = opts.cacheKey as string | undefined
    if (!cacheKey) return null
    const cached = instanceCache.get(cacheKey)
    if (!cached) return null
    if (cached._isDestroyed) {
      // 陈旧条目（已被销毁）——清理后视为未命中
      instanceCache.delete(cacheKey)
      return null
    }
    // 重新打开：取消上一轮关闭时武装的「延迟自动销毁」定时器
    clearTimeout((cached as any).__cacheTimeout)
    // props 覆盖：以创建时的基线 props 为底叠加本次 opts，
    // 使本次省略的 prop 回退到基线值，而非残留上一次调用的值
    const nextProps = { ...((cached as any).__baseProps || {}), ...pickProps(opts) }
    applyOptionsToVm(cached, nextProps)
    cached.visible = true
    return cached
  }

  /** 将新实例写入缓存，关闭后延迟自动销毁（每次关闭都重新计时） */
  const cacheInstance = (cacheKey: string, vm: any, baseProps: Record<string, unknown>) => {
    instanceCache.set(cacheKey, vm)
    // 记录创建时的基线 props，供 tryCacheHit 做「省略即回退」的 props 覆盖
    ;(vm as any).__baseProps = baseProps
    // 用 $on（非 $once）：实例复用后每次关闭都会重新武装定时器，避免只生效一次导致泄漏
    const armDestroyTimer = () => {
      clearTimeout((vm as any).__cacheTimeout)
      ;(vm as any).__cacheTimeout = setTimeout(() => {
        if (vm.visible === false && instanceCache.get(cacheKey) === vm) {
          instanceCache.delete(cacheKey)
          vm.$destroy()
          if (vm.$el?.parentNode) vm.$el.parentNode.removeChild(vm.$el)
        }
      }, CACHE_TTL)
    }
    vm.$on('closed', armDestroyTimer)
  }

  /** 销毁指定/全部缓存实例 */
  const destroyCache = (cacheKey?: string) => {
    if (cacheKey) {
      const vm = instanceCache.get(cacheKey)
      if (vm) {
        clearTimeout((vm as any).__cacheTimeout)
        vm.$destroy()
        if (vm.$el?.parentNode) vm.$el.parentNode.removeChild(vm.$el)
        instanceCache.delete(cacheKey)
      }
    } else {
      instanceCache.forEach((vm, key) => {
        clearTimeout((vm as any).__cacheTimeout)
        vm.$destroy()
        if (vm.$el?.parentNode) vm.$el.parentNode.removeChild(vm.$el)
        instanceCache.delete(key)
      })
    }
  }

  if (options.onlyInstance) {
    // ─── 多实例模式：每次调用都创建新弹窗 ───
    let lastVm: any = null

    const close = () => {
      if (!lastVm || lastVm.visible === false) return
      lastVm.visible = false
      // 等动画结束后销毁
      setTimeout(() => {
        if (lastVm) {
          lastVm.$destroy()
          if (lastVm.$el && lastVm.$el.parentNode) {
            lastVm.$el.parentNode.removeChild(lastVm.$el)
          }
          lastVm = null
        }
      }, 300)
    }

    /** 统一对外返回结构（多实例模式），语义同单例分支 */
    const buildResult = (dialogVm: any) => ({
      instance: dialogVm,
      close,
      destroy: (k?: string) => DialogComponent.destroy(k),
    })

    const DialogComponent = (dialogOptions: DialogOptions) => {
      // ── cacheKey 快速路径 ──
      const cached = tryCacheHit(dialogOptions as Record<string, unknown>)
      if (cached) return buildResult(cached)

      if (dialogOptions.visible === undefined) {
        dialogOptions.visible = true
      }

      const cacheKey = (dialogOptions as Record<string, unknown>).cacheKey as string | undefined
      const originalOnClosed = (dialogOptions as Record<string, unknown>).onClosed as
        | Function
        | undefined
      const originalOnSubmit = (dialogOptions as Record<string, unknown>).onSubmit as
        | Function
        | undefined

      ;(dialogOptions as Record<string, unknown>).onClosed = (...args: unknown[]) => {
        originalOnClosed?.(...args)
        if (cacheKey) return // 缓存实例不销毁，保留在 cache 中
        setTimeout(() => {
          if (lastVm) {
            lastVm.$destroy()
            if (lastVm.$el && lastVm.$el.parentNode) {
              lastVm.$el.parentNode.removeChild(lastVm.$el)
            }
            lastVm = null
          }
        }, 300)
      }

      ;(dialogOptions as Record<string, unknown>).onSubmit = (closeFn: Function = close) => {
        originalOnSubmit?.(closeFn)
      }

      lastVm = initInstance(Component, dialogOptions, dialogOptions.appendTo)
      if (cacheKey) {
        cacheInstance(cacheKey, lastVm, pickProps(dialogOptions as Record<string, unknown>))
      }
      return buildResult(lastVm)
    }

    DialogComponent.close = close
    DialogComponent.destroy = (k?: string) => {
      if (k) {
        destroyCache(k)
        return
      }
      // 无参：销毁当前实例 + 全部缓存
      if (lastVm) {
        lastVm.$destroy()
        if (lastVm.$el && lastVm.$el.parentNode) {
          lastVm.$el.parentNode.removeChild(lastVm.$el)
        }
        lastVm = null
      }
      destroyCache()
    }
    return DialogComponent
  } else {
    // ─── 单例模式：复用同一弹窗实例 ───
    let vm: any = null

    const close = () => {
      if (!vm || vm.visible === false) return
      vm.visible = false
    }

    const destroy = () => {
      if (vm) {
        vm.$destroy()
        if (vm.$el && vm.$el.parentNode) {
          vm.$el.parentNode.removeChild(vm.$el)
        }
        vm = null
      }
    }

    /**
     * 统一的对外返回结构：{ instance, close, destroy }
     * - instance：本次弹窗的组件实例（可直接读写其响应式 prop，如 instance.loading = false）
     * - close/destroy：与 DialogComponent.close/destroy 行为一致
     * 使调用处 `const { instance } = useDialog()(opts)` / `const { close } = ...` 均成立。
     */
    const buildResult = (dialogVm: any) => ({ instance: dialogVm, close, destroy })

    const DialogComponent = (dialogOptions: DialogOptions) => {
      // ── cacheKey 快速路径（独立于单例 vm）──
      const cacheKey = (dialogOptions as Record<string, unknown>).cacheKey as string | undefined
      if (cacheKey) {
        const cached = tryCacheHit(dialogOptions as Record<string, unknown>)
        if (cached) return buildResult(cached)
      }

      // 单例模式（无 cacheKey）：已有实例 → 复用
      if (!cacheKey && vm) {
        applyOptionsToVm(vm, dialogOptions as Record<string, unknown>)
        vm.visible = true
        return buildResult(vm)
      }

      const mergedOptions: DialogOptions = {
        visible: true,
        width: '50%',
        destroyOnClose: true,
        ...dialogOptions,
      } as DialogOptions

      const originalOnClosed = (mergedOptions as Record<string, unknown>).onClosed as
        | Function
        | undefined
      const originalOnSubmit = (mergedOptions as Record<string, unknown>).onSubmit as
        | Function
        | undefined

      ;(mergedOptions as Record<string, unknown>).onClosed = () => {
        originalOnClosed?.()
        if (cacheKey) return // 缓存实例不销毁
        if (mergedOptions.destroyOnClose) {
          setTimeout(() => destroy(), 300)
        }
      }

      ;(mergedOptions as Record<string, unknown>).onSubmit = (closeFn: Function = close) => {
        originalOnSubmit?.(closeFn)
      }

      const newVm = initInstance(Component, mergedOptions, mergedOptions.appendTo)
      if (cacheKey) {
        cacheInstance(cacheKey, newVm, pickProps(mergedOptions as Record<string, unknown>))
      } else {
        vm = newVm
      }
      return buildResult(newVm)
    }

    DialogComponent.close = close
    DialogComponent.destroy = (k?: string) => {
      // 传 cacheKey 只销毁该缓存实例，不误伤单例 vm；不传则单例 + 全部缓存一起销毁
      if (k) {
        destroyCache(k)
        return
      }
      destroy()
      destroyCache()
    }
    return DialogComponent
  }
}

export default useDialog
