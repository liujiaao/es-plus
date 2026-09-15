/**
 * ADV useDialog — 对齐 @es-plus/vue3 的双模式实现
 *
 * - onlyInstance: false（默认）→ 复用容器，适合单弹窗场景
 * - onlyInstance: true → 每次创建新容器，适合并发多弹窗
 */
import { createVNode, getCurrentInstance, render } from 'vue'
import EsDialog from './component.vue'
import type { DialogOptions } from '../../../types'

/**
 * 单次调用返回值 —— 与 @es-plus/vue3 / @es-plus/vue2 的 `DialogResult` 同构。
 *
 * 此前本端直接返回 vNode，导致同一份业务代码在三端表现不同：
 *   const { instance, close } = useDialog()({ ... })   // vue3/vue2 可用，antdv 得到 undefined
 * es-eui（Vue2 站）的官方示例正是这种解构写法，即文档教的三端通用写法在本端会挂。
 */
export interface DialogResult {
  /** 本次弹窗的 vNode（与 vue3 语义一致：可经 `instance.component.props.xxx` 响应式更新） */
  instance: any
  close: () => void
  destroy: () => void
}

export interface DialogCallable {
  (dialogOptions: DialogOptions): DialogResult
  close: () => void
}

export interface DialogCallableWithDestroy extends DialogCallable {
  destroy: () => void
}

const getAppendToElement = (appendTo?: string | HTMLElement) => {
  if (typeof appendTo === 'string') {
    return document.querySelector(appendTo) || document.body
  }
  return appendTo instanceof HTMLElement ? appendTo : document.body
}

const initInstance = (
  Component: any,
  props: DialogOptions,
  container: HTMLElement,
  appContext: any,
) => {
  const vNode = createVNode(Component, props)

  if (appContext) {
    vNode.appContext = appContext
    // 对齐 vue3：保证 provides / config / globalProperties 存在，
    // 使弹窗子树能访问全局属性与注入（如 $EsPlus、$useDialog 等）
    if (vNode.appContext) {
      if (!vNode.appContext.provides) vNode.appContext.provides = {}
      if (!vNode.appContext.config) vNode.appContext.config = {} as any
      if (!vNode.appContext.config.globalProperties) {
        ;(vNode.appContext.config as any).globalProperties = {}
      }
    }
  }

  render(vNode, container)

  const target = getAppendToElement(props.appendTo)
  target.appendChild(container)
  return vNode
}

export function useDialog(
  Component?: any,
  opt?: { onlyInstance?: false },
): DialogCallableWithDestroy
export function useDialog(
  Component?: any,
  opt?: { onlyInstance: true },
): DialogCallable
export function useDialog(
  Component?: any,
  opt: { onlyInstance?: boolean } = {},
) {
  Component = Component || EsDialog
  const options = Object.assign({ onlyInstance: false }, opt)

  if (options.onlyInstance) {
    // 模式1：每次创建新容器（多弹窗）
    const instance = getCurrentInstance()
    const appContext = instance?.appContext || null
    const container = document.createElement('div')

    const close = () => {
      render(null, container)
      container.remove()
    }

    const DialogComponent = (dialogOptions: DialogOptions) => {
      if (dialogOptions.visible === undefined) {
        dialogOptions.visible = true
      }
      const originalOnClosed = dialogOptions.onClosed
      const originalOnSubmit = dialogOptions.onSubmit

      dialogOptions.onClosed = (...args: any[]) => {
        ;(originalOnClosed as Function)?.(...args)
        close()
      }

      dialogOptions.onSubmit = (closeFn = close) => {
        originalOnSubmit?.(closeFn)
      }

      return initInstance(Component, dialogOptions, container, appContext)
    }

    ;(DialogComponent as any).close = close
    // 该模式下不存在独立销毁语义：close() 已卸载并移除容器，destroy 与 close 等价
    ;(DialogComponent as any).destroy = close

    const callable = ((dialogOptions: DialogOptions) => {
      const vNode = DialogComponent(dialogOptions)
      return { instance: vNode, close, destroy: close }
    }) as DialogCallableWithDestroy
    callable.close = close
    callable.destroy = close
    return callable
  }

  // 模式2：复用容器（默认，单弹窗）
  const container = document.createElement('div')
  container.className = 'dialog-containers'
  const instance = getCurrentInstance()
  const appContext = instance?.appContext || null
  let vNode: any = null

  const close = () => {
    if (vNode && vNode.component) {
      vNode.component.props.visible = false
    }
  }

  const destroy = () => {
    if (vNode) {
      render(null, container)
      container.remove()
      vNode = null
    }
  }

  const DialogComponent = (dialogOptions: DialogOptions) => {
    if (vNode && vNode.component) {
      Object.assign(vNode.component.props, dialogOptions)
      vNode.component.props.visible = true
      return vNode
    }

    const mergedOptions: DialogOptions = {
      visible: true,
      width: '50%',
      destroyOnClose: true,
      ...dialogOptions,
    }

    const { onClosed: originalOnClosed, onSubmit: originalOnSubmit } =
      mergedOptions

    mergedOptions.onClosed = () => {
      originalOnClosed?.()
      close()
    }

    mergedOptions.onSubmit = (closeFn = close) => {
      originalOnSubmit?.(closeFn)
    }

    vNode = initInstance(Component, mergedOptions, container, appContext)
    return vNode
  }

  ;(DialogComponent as any).close = close
  ;(DialogComponent as any).destroy = destroy

  // 返回值形态与 vue3/vue2 的 DialogResult 对齐；同时保留 callable 上的 close/destroy
  // （既有 `dialog.close()` 写法不受影响，属于纯增量变更）。
  const callable = ((dialogOptions: DialogOptions) => {
    const vNode = DialogComponent(dialogOptions)
    return { instance: vNode, close, destroy }
  }) as DialogCallableWithDestroy
  callable.close = close
  callable.destroy = destroy
  return callable
}

export default useDialog
