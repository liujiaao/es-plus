import { createVNode, getCurrentInstance, getCurrentScope, onScopeDispose, render } from 'vue'
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

/** 从调用参数中提取「会下发到弹窗组件」的键 —— 只剥掉 cacheKey（它只是本 hook 的缓存键） */
const pickProps = (opts: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  Object.keys(opts).forEach((k) => {
    if (k !== 'cacheKey') out[k] = opts[k]
  })
  return out
}

/**
 * 把一次调用的 props 写到**已挂载**的组件 vNode 上。
 *
 * 分两条通道是因为在 Vue 3 里两者是不同的容器（已实测）：
 * - 声明过的 prop（title / width / visible…）→ `component.props`，组件渲染读的是它；
 * - `onXxx` 事件 → **不在 component.props 里**：EsDialog 没把 onClosed 声明为 prop，
 *   写 `component.props.onClosed` 等于写进一个无人读取的槽（实测：写完再 emit 依然
 *   触发旧回调）；Vue 的 emit 查的是 `vNode.props`，只有写那里才生效。
 */
const applyPropsToVNode = (vNode: any, props: Record<string, unknown>) => {
  if (!vNode || !vNode.component) return
  const listeners: Record<string, unknown> = {}
  const declared: Record<string, unknown> = {}
  Object.keys(props).forEach((k) => {
    // 与 Vue 运行时判定事件键的规则一致（on + 非小写字母）
    if (/^on[^a-z]/.test(k)) listeners[k] = props[k]
    else declared[k] = props[k]
  })
  Object.assign(vNode.component.props, declared)
  Object.assign(vNode.props, listeners)
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
    const merged = { ...(cached.baseProps || {}), ...pickProps(opts) }
    applyPropsToVNode(cached.vNode, { ...toCacheProps(merged, cacheKey), visible: true })
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

  /**
   * 构造「一次调用真正要下发到缓存实例」的 props。
   *
   * onClosed 必须包一层：缓存实例关闭时**不卸载**，靠这里武装 TTL 回收。
   * 首次创建与缓存命中都要过这里 —— 命中路径此前既不下发 `on*`，也不重新包装，
   * 于是缓存实例收不到新回调，TTL 也只在首次创建那次挂得上。
   */
  const toCacheProps = (opts: Record<string, unknown>, cacheKey: string): Record<string, unknown> => {
    const out = pickProps(opts)
    const originalOnClosed = out.onClosed as Function | undefined
    out.onClosed = (...args: unknown[]) => {
      originalOnClosed?.(...args)
      armCacheDestroy(cacheKey)
    }
    return out
  }

  /** 为一次 cacheKey 打开创建独立缓存条目（独立 container，关闭不卸载） */
  const openCached = (cacheKey: string, dialogOptions: DialogOptions) => {
    const cacheContainer = document.createElement('div')
    cacheContainer.className = 'dialog-containers'

    const cVNode = initInstance(
      Component,
      toCacheProps(dialogOptions as Record<string, unknown>, cacheKey) as DialogOptions,
      cacheContainer,
      appContext
    )
    instanceCache.set(cacheKey, {
      vNode: cVNode,
      container: cacheContainer,
      // 基线存**原始** props（不含包装）：命中时以它为底叠加本次 opts，
      // 包装交给 toCacheProps 统一再套一层，避免基线里压着一层过期包装
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

      ;(dialogOptions as Record<string, unknown>).onClosed = (...args: unknown[]) => {
        ;(originalOnClosed as Function)?.(...args)
        close()
      }

      const vNode = initInstance(Component, dialogOptions, container, appContext)
      return { instance: vNode, close, destroy }
    }

    DialogComponent.close = close
    DialogComponent.destroy = destroy

    // 宿主组件作用域销毁（卸载）时回收本 hook 持有的一切：
    // 弹窗容器是**手工**追加到 body 的，不属于任何组件的子树，宿主卸载不会连带移除；
    // 缓存实例的 TTL 定时器同理。不注册的话，组件没了、弹窗与定时器还在。
    // destroy() 无参 = 销毁当前实例 + 全部缓存（含清 timer、移除 container）。
    if (getCurrentScope()) onScopeDispose(() => destroy())
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

      const { onClosed: originalOnClosed } = mergedOptions as Record<string, any>

      ;(mergedOptions as Record<string, unknown>).onClosed = () => {
        originalOnClosed?.()
        close()
      }

      vNode = initInstance(Component, mergedOptions, container, appContext)
      return { instance: vNode, close, destroy }
    }

    DialogComponent.close = close
    DialogComponent.destroy = destroy

    // 同上：destroy() 无参 = 拆掉单例 vNode 并移除它的 container + 清空全部缓存
    if (getCurrentScope()) onScopeDispose(() => destroy())
    return DialogComponent
  }
}

export default useDialog
