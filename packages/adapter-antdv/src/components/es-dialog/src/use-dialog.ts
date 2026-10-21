/**
 * ADV useDialog — 对齐 @es-plus/vue3 的双模式实现
 *
 * - onlyInstance: false（默认）→ 复用容器，适合单弹窗场景
 * - onlyInstance: true → 每次创建新容器，适合并发多弹窗
 * - cacheKey → 实例缓存（两模式共用）：同一 cacheKey 跨多次调用复用同一弹窗实例，
 *   关闭后延迟 10 分钟自动回收。本端此前**没有**这条通道，cacheKey 被静默丢弃
 *   （`check-type-exports.mjs` 的 MEMBER_DEVIATIONS 曾把它登记为「有意缺项」）；
 *   现按 Wave 5 的「修，对齐 vue3/vue2」落地，登记行同步删除。
 */
import { createVNode, getCurrentInstance, getCurrentScope, onScopeDispose, render } from 'vue'
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
  /** 销毁：传 cacheKey 只销毁该缓存实例；不传则销毁当前实例与全部缓存 */
  destroy: (cacheKey?: string) => void
}

export interface DialogCallable {
  (dialogOptions: DialogOptions): DialogResult
  close: () => void
  /** 销毁：传 cacheKey 只销毁该缓存实例；不传则销毁当前实例与全部缓存 */
  destroy: (cacheKey?: string) => void
  /**
   * 只销毁**当前**实例（单例 vNode / 本次容器），**不动**任何 cacheKey 缓存。
   * `destroy()` 无参会连带清空别人的缓存（对齐 vue3/vue2）。
   */
  destroyCurrent: () => void
}

export type DialogCallableWithDestroy = DialogCallable

/** 缓存实例的延迟自动销毁时长：关闭后 10 分钟未重新打开则回收（对齐 vue3/vue2） */
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
 * 分两条通道（与 vue3 同因）：已声明 prop 走 `component.props`；`onXxx` 事件不在
 * `component.props` 里 —— 本组件没把 onClosed 声明为 prop，Vue 的 emit 查的是
 * `vNode.props`，只写 component.props 等于写进一个无人读取的槽。
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
  // 真实 vNode 的 props 可能为 null（无任何 prop 时），先补一个对象再写入
  if (!vNode.component.props) vNode.component.props = {}
  if (!vNode.props) vNode.props = {}
  Object.assign(vNode.component.props, declared)
  Object.assign(vNode.props, listeners)
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
   * 首次创建与缓存命中都要过这里 —— 命中路径若不重新包装，缓存实例收不到新回调，
   * TTL 也只在首次创建那次挂得上。
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
      appContext,
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
    // 模式1：每次创建新容器（多弹窗）
    const container = document.createElement('div')

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

    // 只销毁本次容器，不动缓存（见 DialogCallable.destroyCurrent）
    const destroyCurrent = () => close()

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

      const originalOnClosed = dialogOptions.onClosed

      dialogOptions.onClosed = (...args: any[]) => {
        ;(originalOnClosed as Function)?.(...args)
        close()
      }

      const vNode = initInstance(Component, dialogOptions, container, appContext)
      return { instance: vNode, close, destroy }
    }

    ;(DialogComponent as any).close = close
    ;(DialogComponent as any).destroy = destroy

    const callable = ((dialogOptions: DialogOptions) => DialogComponent(dialogOptions)) as DialogCallableWithDestroy
    callable.close = close
    callable.destroy = destroy
    callable.destroyCurrent = destroyCurrent

    // 宿主组件作用域销毁（卸载）时回收：弹窗容器是**手工**追加到 appendTo 的，
    // 不属于任何组件子树，宿主卸载不会连带移除它；缓存实例的 TTL 定时器同理。
    if (getCurrentScope()) onScopeDispose(() => destroy())
    return callable
  }

  // 模式2：复用容器（默认，单弹窗）
  const container = document.createElement('div')
  container.className = 'dialog-containers'
  let vNode: any = null

  const close = () => {
    if (vNode && vNode.component) {
      vNode.component.props.visible = false
    }
  }

  // 只销毁单例 vNode，不动任何 cacheKey 缓存（见 DialogCallable.destroyCurrent）
  const destroyCurrent = () => {
    if (vNode) {
      render(null, container)
      container.remove()
      vNode = null
    }
  }

  const destroy = (cacheKey?: string) => {
    // 传 cacheKey 只销毁该缓存实例，不误伤单例 vNode；不传则单例 + 全部缓存一起销毁
    if (cacheKey) {
      destroyCache(cacheKey)
      return
    }
    destroyCurrent()
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
      Object.assign(vNode.component.props, pickProps(dialogOptions as Record<string, unknown>))
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

    const { onClosed: originalOnClosed } = mergedOptions

    mergedOptions.onClosed = () => {
      originalOnClosed?.()
      close()
    }

    vNode = initInstance(Component, mergedOptions, container, appContext)
    return { instance: vNode, close, destroy }
  }

  ;(DialogComponent as any).close = close
  ;(DialogComponent as any).destroy = destroy

  // 返回值形态与 vue3/vue2 的 DialogResult 对齐；同时保留 callable 上的 close/destroy
  // （既有 `dialog.close()` 写法不受影响，属于纯增量变更）。
  const callable = ((dialogOptions: DialogOptions) => DialogComponent(dialogOptions)) as DialogCallableWithDestroy
  callable.close = close
  callable.destroy = destroy
  callable.destroyCurrent = destroyCurrent

  // 同上：destroy() = 卸载 vNode 并移除手工追加到 appendTo 的 container
  if (getCurrentScope()) onScopeDispose(() => destroy())
  return callable
}

export default useDialog
