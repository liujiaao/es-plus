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

const initInstance = (Component: any, props: DialogOptions, container: HTMLElement, appContext: any) => {
  const vNode = createVNode(Component, props)

  if (appContext) {
    vNode.appContext = appContext

    if (!vNode.appContext.provides) {
      vNode.appContext.provides = {}
    }

    // 注入语言环境（如果父应用有提供）
    const injectedLocale = appContext.provides?.elLocale
    if (injectedLocale) {
      vNode.appContext.provides['elLocale'] = injectedLocale
    }

    if (!vNode.appContext.config) {
      vNode.appContext.config = {} as any
    }
    if (!vNode.appContext.config.globalProperties) {
      vNode.appContext.config.globalProperties = {}
    }
  }

  render(vNode, container)

  const target = getAppendToElement(props.appendTo)
  target.appendChild(container)
  return vNode
}

export function useDialog(Component?: any, opt?: { onlyInstance?: false }): DialogCallableWithDestroy
export function useDialog(Component?: any, opt?: { onlyInstance: true }): DialogCallable
export function useDialog(Component?: any, opt: { onlyInstance?: boolean } = {}) {
  Component = Component || EsDialog
  const options = Object.assign({ onlyInstance: false }, opt)

  if (options.onlyInstance) {
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

    DialogComponent.close = close
    return DialogComponent
  } else {
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
        ...dialogOptions
      }

      const { onClosed: originalOnClosed, onSubmit: originalOnSubmit } = mergedOptions

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

    DialogComponent.close = close
    DialogComponent.destroy = destroy
    return DialogComponent
  }
}

export default useDialog
