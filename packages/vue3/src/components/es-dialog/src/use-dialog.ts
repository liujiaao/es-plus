import { createVNode, getCurrentInstance, render } from 'vue'
import EsDialog from './component.vue'
import type { DialogOptions } from '../../../types'

/**
 * useDialog 每次调用（DialogComponent(opts)）的统一返回结构。
 * 与 Vue 2 版本对齐：{ instance, close, destroy }。
 * - instance：本次弹窗的 vNode（Vue 3 中经 `instance.component.props.xxx = ...` 做响应式更新，
 *   如 `instance.component.props.loading = false`；对齐 Vue 2 的 `instance.loading = false`）。
 * - close：关闭本次（或该 cacheKey）弹窗。
 * - destroy：销毁——传 cacheKey 只销毁该缓存实例；不传则销毁当前实例与全部缓存。
 */
export interface DialogResult {
  instance: any
  close: () => void
  destroy: (cacheKey?: string) => void
}

export interface DialogCallable {
  (dialogOptions: DialogOptions & { cacheKey?: string }): DialogResult
  close: () => void
  /** 销毁：传 cacheKey 只销毁该缓存实例；不传则销毁当前实例与全部缓存 */
  destroy: (cacheKey?: string) => void
}

export type DialogCallableWithDestroy = DialogCallable

/** 缓存实例的延迟自动销毁时长：关闭后 10 分钟未重新打开则回收（对齐 Vue 2 版本） */
const CACHE_TTL = 10 * 60 * 1000

const getAppendToElement = (appendTo?: string | HTMLElement) => {
  if (typeof appendTo === 'string') {
    return document.querySelector(appendTo) || document.body
  }
  return appendTo instanceof HTMLElement ? appendTo : document.body
}

/** 从调用参数中提取「会作为 prop 下发」的键（排除 onXxx 事件与 cacheKey 本身） */
const pickProps = (opts: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  Object.keys(opts).forEach((k) => {
    if (!k.startsWith('on') && k !== 'cacheKey') out[k] = opts[k]
  })
  return out
}

const initInstance = (Component: any, props: DialogOptions, container: HTMLElement, appContext: any) => {
  const vNode = createVNode(Component, props)

  if (appContext) {
    vNode.appContext = appContext

    // 用局部 appContext 而非 vNode.appContext：vNode.appContext 类型为 AppContext | null，
    // 此处已赋值非空，直接用 appContext 可避免 null 断言噪音
    if (!appContext.provides) {
      appContext.provides = {}
    }

    // 注入语言环境（如果父应用有提供）
    const injectedLocale = appContext.provides?.elLocale
    if (injectedLocale) {
      appContext.provides['elLocale'] = injectedLocale
    }

    if (!appContext.config) {
      appContext.config = {} as any
    }
    if (!appContext.config.globalProperties) {
      appContext.config.globalProperties = {}
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
  const instance = getCurrentInstance()
  const appContext = instance?.appContext || null

  // ─── cacheKey → 实例缓存（跨多次调用的状态保持，两分支共用）───
  // 每个 cacheKey 拥有独立 container；关闭时不卸载，改武装 TTL 延迟回收。
  const instanceCache = new Map<string, { vNode: any; container: HTMLElement; baseProps: Record<string, unknown>; timer: any }>()

  /** 尝试从 cacheKey 获取已缓存实例，命中则以「基线 props + 本次 opts」覆盖并显示 */
  const tryCacheHit = (opts: Record<string, unknown>): { vNode: any } | null => {
    const cacheKey = opts.cacheKey as string | undefined
    if (!cacheKey) return null
    const cached = instanceCache.get(cacheKey)
    if (!cached) return null
    // vNode.component 为空视为已卸载 —— 清理后视为未命中
    if (!cached.vNode || !cached.vNode.component) {
      instanceCache.delete(cacheKey)
      return null
    }
    // 重新打开：取消上一轮关闭时武装的「延迟自动销毁」定时器
    clearTimeout(cached.timer)
    // props 覆盖：以创建时的基线 props 为底叠加本次 opts，
    // 使本次省略的 prop 回退到基线值，而非残留上一次调用的值
    const nextProps = { ...(cached.baseProps || {}), ...pickProps(opts) }
    Object.assign(cached.vNode.component.props, nextProps)
    cached.vNode.component.props.visible = true
    return cached
  }

  /** 关闭指定 cacheKey 缓存实例（翻转其 vNode 的 visible） */
  const closeCache = (cacheKey: string) => {
    const cached = instanceCache.get(cacheKey)
    if (cached && cached.vNode?.component) {
      cached.vNode.component.props.visible = false
    }
  }

  /** 关闭后武装延迟自动销毁定时器（每次关闭都重新计时，避免只生效一次） */
  const armCacheDestroy = (cacheKey: string) => {
    const cached = instanceCache.get(cacheKey)
    if (!cached) return
    clearTimeout(cached.timer)
    cached.timer = setTimeout(() => {
      const c = instanceCache.get(cacheKey)
      if (c && c.vNode?.component?.props?.visible === false) {
        render(null, c.container)
        c.container.remove()
        instanceCache.delete(cacheKey)
      }
    }, CACHE_TTL)
  }

  /** 销毁指定/全部缓存实例 */
  const destroyCache = (cacheKey?: string) => {
    const drop = (key: string, c: { container: HTMLElement; timer: any }) => {
      clearTimeout(c.timer)
      render(null, c.container)
      c.container.remove()
      instanceCache.delete(key)
    }
    if (cacheKey) {
      const c = instanceCache.get(cacheKey)
      if (c) drop(cacheKey, c)
    } else {
      instanceCache.forEach((c, key) => drop(key, c))
    }
  }

  /** 为一次 cacheKey 打开创建独立缓存条目（独立 container，关闭不卸载） */
  const openCached = (cacheKey: string, dialogOptions: DialogOptions) => {
    const cacheContainer = document.createElement('div')
    cacheContainer.className = 'dialog-containers'

    const originalOnClosed = (dialogOptions as Record<string, unknown>).onClosed as Function | undefined
    const originalOnSubmit = (dialogOptions as Record<string, unknown>).onSubmit as Function | undefined

    ;(dialogOptions as Record<string, unknown>).onClosed = (...args: unknown[]) => {
      originalOnClosed?.(...args)
      armCacheDestroy(cacheKey) // 缓存实例不立即销毁，武装 TTL
    }
    ;(dialogOptions as Record<string, unknown>).onSubmit = (closeFn: Function = () => closeCache(cacheKey)) => {
      originalOnSubmit?.(closeFn)
    }

    const cVNode = initInstance(Component, dialogOptions, cacheContainer, appContext)
    instanceCache.set(cacheKey, {
      vNode: cVNode,
      container: cacheContainer,
      baseProps: pickProps(dialogOptions as Record<string, unknown>),
      timer: null,
    })
    return cVNode
  }

  if (options.onlyInstance) {
    // ─── 多实例模式：每次调用（非缓存）都创建新弹窗，close 卸载 ───
    const container = document.createElement('div')
    container.className = 'dialog-containers'

    const close = () => {
      render(null, container)
      container.remove()
    }

    const destroy = (cacheKey?: string) => {
      if (cacheKey) {
        destroyCache(cacheKey)
        return
      }
      // 无参：销毁当前实例 + 全部缓存
      close()
      destroyCache()
    }

    const DialogComponent = (dialogOptions: DialogOptions) => {
      const cacheKey = (dialogOptions as Record<string, unknown>).cacheKey as string | undefined

      // ── cacheKey 快速路径 ──
      const cached = tryCacheHit(dialogOptions as Record<string, unknown>)
      if (cached) {
        return { instance: cached.vNode, close: () => closeCache(cacheKey as string), destroy }
      }

      if (dialogOptions.visible === undefined) {
        dialogOptions.visible = true
      }

      if (cacheKey) {
        const cVNode = openCached(cacheKey, dialogOptions)
        return { instance: cVNode, close: () => closeCache(cacheKey), destroy }
      }

      const originalOnClosed = (dialogOptions as Record<string, unknown>).onClosed as Function | undefined
      const originalOnSubmit = (dialogOptions as Record<string, unknown>).onSubmit as Function | undefined

      ;(dialogOptions as Record<string, unknown>).onClosed = (...args: unknown[]) => {
        ;(originalOnClosed as Function)?.(...args)
        close()
      }
      ;(dialogOptions as Record<string, unknown>).onSubmit = (closeFn: Function = close) => {
        originalOnSubmit?.(closeFn)
      }

      const vNode = initInstance(Component, dialogOptions, container, appContext)
      return { instance: vNode, close, destroy }
    }

    DialogComponent.close = close
    DialogComponent.destroy = destroy
    return DialogComponent
  } else {
    // ─── 单例模式：复用同一弹窗实例（无 cacheKey）───
    const container = document.createElement('div')
    container.className = 'dialog-containers'
    let vNode: any = null

    const close = () => {
      if (vNode && vNode.component) {
        vNode.component.props.visible = false
      }
    }

    const destroy = (cacheKey?: string) => {
      // 传 cacheKey 只销毁该缓存实例，不误伤单例 vNode；不传则单例 + 全部缓存一起销毁
      if (cacheKey) {
        destroyCache(cacheKey)
        return
      }
      if (vNode) {
        render(null, container)
        container.remove()
        vNode = null
      }
      destroyCache()
    }

    const DialogComponent = (dialogOptions: DialogOptions) => {
      const cacheKey = (dialogOptions as Record<string, unknown>).cacheKey as string | undefined

      // ── cacheKey 快速路径（独立于单例 vNode）──
      if (cacheKey) {
        const cached = tryCacheHit(dialogOptions as Record<string, unknown>)
        if (cached) {
          return { instance: cached.vNode, close: () => closeCache(cacheKey), destroy }
        }
      }

      // 单例模式（无 cacheKey）：已有实例 → 复用
      if (!cacheKey && vNode && vNode.component) {
        Object.assign(vNode.component.props, dialogOptions)
        vNode.component.props.visible = true
        return { instance: vNode, close, destroy }
      }

      const mergedOptions: DialogOptions = {
        visible: true,
        width: '50%',
        destroyOnClose: true,
        ...dialogOptions,
      }

      if (cacheKey) {
        const cVNode = openCached(cacheKey, mergedOptions)
        return { instance: cVNode, close: () => closeCache(cacheKey), destroy }
      }

      const { onClosed: originalOnClosed, onSubmit: originalOnSubmit } = mergedOptions as Record<string, any>

      ;(mergedOptions as Record<string, unknown>).onClosed = () => {
        originalOnClosed?.()
        close()
      }
      ;(mergedOptions as Record<string, unknown>).onSubmit = (closeFn = close) => {
        originalOnSubmit?.(closeFn)
      }

      vNode = initInstance(Component, mergedOptions, container, appContext)
      return { instance: vNode, close, destroy }
    }

    DialogComponent.close = close
    DialogComponent.destroy = destroy
    return DialogComponent
  }
}

export default useDialog
