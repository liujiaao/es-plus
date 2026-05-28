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
  (dialogOptions: DialogOptions): unknown
  close: () => void
}

export interface DialogCallableWithDestroy extends DialogCallable {
  destroy: () => void
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

const initInstance = (
  Component: any,
  options: DialogOptions,
  appendTo?: string | HTMLElement
) => {
  const { propsData, events } = extractEventHandlers(options as Record<string, unknown>)

  // Vue.extend(Component) 把组件定义转为构造函数
  const Ctor = (Vue as any).extend(Component)
  const vm = new Ctor({ propsData })

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

  if (options.onlyInstance) {
    // ─── 多实例模式：每次调用都创建新弹窗 ───
    let lastVm: any = null

    const close = () => {
      if (lastVm) {
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
    }

    const DialogComponent = (dialogOptions: DialogOptions) => {
      if (dialogOptions.visible === undefined) {
        dialogOptions.visible = true
      }

      const originalOnClosed = (dialogOptions as Record<string, unknown>).onClosed as
        | Function
        | undefined
      const originalOnSubmit = (dialogOptions as Record<string, unknown>).onSubmit as
        | Function
        | undefined

      ;(dialogOptions as Record<string, unknown>).onClosed = (...args: unknown[]) => {
        originalOnClosed?.(...args)
        close()
      }

      ;(dialogOptions as Record<string, unknown>).onSubmit = (closeFn: Function = close) => {
        originalOnSubmit?.(closeFn)
      }

      lastVm = initInstance(Component, dialogOptions, dialogOptions.appendTo)
      return lastVm
    }

    DialogComponent.close = close
    return DialogComponent
  } else {
    // ─── 单例模式：复用同一弹窗实例 ───
    let vm: any = null

    const close = () => {
      if (vm) {
        vm.visible = false
      }
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

    const DialogComponent = (dialogOptions: DialogOptions) => {
      // 已有实例 → 复用并更新 props
      if (vm) {
        Object.entries(dialogOptions).forEach(([key, value]) => {
          if (!key.startsWith('on')) {
            vm[key] = value
          }
        })
        vm.visible = true
        return vm
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
        close()
      }

      ;(mergedOptions as Record<string, unknown>).onSubmit = (closeFn: Function = close) => {
        originalOnSubmit?.(closeFn)
      }

      vm = initInstance(Component, mergedOptions, mergedOptions.appendTo)
      return vm
    }

    DialogComponent.close = close
    DialogComponent.destroy = destroy
    return DialogComponent
  }
}

export default useDialog
