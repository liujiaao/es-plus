/**
 * ADV useDialog — 对齐 @es-plus/vue3 的双模式实现
 *
 * - onlyInstance: false（默认）→ 复用容器，适合单弹窗场景
 * - onlyInstance: true → 每次创建新容器，适合并发多弹窗
 */
import { createVNode, getCurrentInstance, render } from 'vue'
import EsDialog from './component.vue'
import type { DialogOptions } from '../../../types'

export interface DialogCallable {
  (dialogOptions: DialogOptions): any
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
    if (!vNode.appContext.provides) {
      vNode.appContext.provides = {}
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
    return DialogComponent
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
  return DialogComponent
}

export default useDialog
