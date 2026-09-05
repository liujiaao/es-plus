<script lang="ts">
/**
 * EsDialog 内部内容渲染器 —— Vue 2 版本
 *
 * 与 Vue 3 版本的核心差异：
 *   - h(...) 是 createElement，签名 `h(tag, data, children)`，data 中区分 props/attrs/on/ref
 *   - vnode.componentInstance 取代 Vue 3 的 vnode.component（用于回填 currentRef）
 *   - Element UI 没有 ElConfigProvider，国际化由 Vue.use(ElementUI, { locale }) 全局配置
 *
 * 职责：
 *   - 调用用户传入的 render(h, instance, components) → VNode/字符串/组件
 *   - 把渲染结果挂到 refsObject.currentRef，供 EsDialog 工具栏按钮 click 回调取到
 */
import {
  defineComponent,
  h,
  reactive,
  markRaw,
  getCurrentInstance,
  onMounted,
  onUpdated,
} from '../../vue-compat'

/**
 * 递归剔除 vnode 树上「值为 undefined 的事件监听」。
 *
 * 场景：JSX 写 `<es-form model={formData} />` 时，@vue/babel-preset-jsx 把
 * `model` 放到 vnode data 根级，Vue 2 运行时的 transformModel 据此按 v-model
 * 处理，注入 `listeners.input = data.model.callback`。当 model 是普通数据对象
 * （无 callback）时该值为 undefined，Vue 在 updateListeners 里对 undefined 处理器
 * 抛出 `[Vue warn]: Invalid handler for event "input": got undefined`。
 *
 * 该警告纯属开发期噪音（运行时会跳过 undefined 处理器，不影响功能，es-form 通过
 * resolvedModel 读 $vnode.data.model 兜底取值）。这里在 vnode 交给 patch 前，把
 * componentOptions.listeners / data.on 上值为 undefined 的项删除，从源头消除警告。
 * 只删 `=== undefined` 的项，真实处理器不受影响；递归覆盖嵌套（如 Tabs 内的 EsForm）。
 */
function stripUndefinedListeners(vnode: any, depth = 0): void {
  if (!vnode || typeof vnode !== 'object' || depth > 30) return
  const co = vnode.componentOptions
  const listeners = co && co.listeners
  if (listeners && typeof listeners === 'object') {
    for (const k in listeners) {
      if (listeners[k] === undefined) delete listeners[k]
    }
  }
  const on = vnode.data && vnode.data.on
  if (on && typeof on === 'object') {
    for (const k in on) {
      if (on[k] === undefined) delete on[k]
    }
  }
  const kids = (co && co.children) || vnode.children
  if (Array.isArray(kids)) {
    for (const child of kids) stripUndefinedListeners(child, depth + 1)
  }
}

export default defineComponent({
  name: 'RenderJsx',
  props: {
    refs: { type: [Function, Object] as unknown as () => Function | Record<string, unknown>, default: null },
    row: { type: Object, default: () => ({}) },
    render: { type: Function, default: () => undefined },
    model: { type: Object, default: () => ({}) },
    instance: { type: Object, default: () => ({}) },
    components: { type: Object, default: () => ({}) },
  },
  setup(props) {
    const vm = getCurrentInstance()
    const proxy = (vm as unknown as { proxy?: { $refs?: Record<string, unknown> } })?.proxy

    const refsObject =
      props.refs && typeof props.refs === 'object'
        ? (props.refs as Record<string, unknown>)
        : reactive<Record<string, unknown>>({})

    let componentVNode: any = null

    /**
     * 把 RenderJsx 自身 $refs 里的命名引用同步进 refsObject，使
     * configBtn.click 的 getRefs('name') 能取到用户在 render 里写的
     * 字符串 ref（如 <es-form ref="esFormInDialog" />）。
     *
     * 背景：Vue 2 里 render 内的字符串 ref 只会登记到「渲染上下文 vm」的
     * $refs（即本 RenderJsx 实例），不会自动进入 refsObject；而 getRefs(name)
     * 读的是 refsObject。这里做一次单向同步补齐这条链路，行为对齐 Vue 3 的
     * getRefs(name)（Vue 3 用 registerRef，Vue 2 字符串 ref 落在 $refs 上）。
     *
     * markRaw：$refs 里多为活的 vm（含响应式数组），存进 reactive 的 refsObject
     * 前打 raw 标记，防止 polyfill customReactive 深度遍历触发无限更新循环。
     * 仅在值变化时写入，避免无谓的依赖通知。
     */
    function syncNamedRefs() {
      const $refs = proxy?.$refs
      if (!$refs) return
      for (const key in $refs) {
        const el = $refs[key]
        if (el === null || el === undefined) continue
        const val = typeof el === 'object' ? markRaw(el as object) : el
        if ((refsObject as Record<string, unknown>)[key] === val) continue
        ;(refsObject as Record<string, unknown>)[key] = val
      }
    }

    /**
     * Vue 2 vnode 结构：
     *   - 组件 vnode: vnode.componentInstance 是组件实例（即 vm）
     *   - 普通元素: vnode.elm 是 DOM
     */
    function flushRef() {
      if (!componentVNode) return
      const raw = componentVNode.componentInstance
      if (!raw) return
      // markRaw：body 组件（如 EsTable，含 columns/data 响应式数组）是活的 vm。
      // 存进 reactive 的 refsObject 前打 raw 标记，防止 polyfill customReactive
      // 深度遍历 vm 及其兄弟 el-dialog 内部，触发 EsDialog 无限更新循环。
      const inst =
        raw && typeof raw === 'object' ? markRaw(raw as object) : raw
      // 仅当值变化时才写入，避免触发父组件 reactive 对象的依赖通知
      const prev = (refsObject as Record<string, unknown>).currentRef
      if (prev === inst) return
      ;(refsObject as Record<string, unknown>).currentRef = inst
    }

    onMounted(() => {
      flushRef()
      syncNamedRefs()
    })
    onUpdated(() => {
      flushRef()
      syncNamedRefs()
    })

    return () => {
      const { instance } = props as { instance: Record<string, unknown> }
      const enhancedInstance = {
        ...instance,
        registerRef: (name: string, el: unknown) => {
          if (el !== null && el !== undefined) {
            ;(refsObject as Record<string, unknown>)[name] = el
          }
        },
        getRefs: () => refsObject,
      }

      // 调用用户的 render(h, instance, components)
      const renderFn = props.render as Function
      const renderContent =
        renderFn && typeof renderFn === 'function'
          ? renderFn(h, enhancedInstance, props.components || {})
          : ''

      // 字符串/数字 → 包成 span
      if (typeof renderContent === 'string' || typeof renderContent === 'number') {
        componentVNode = null
        return h(
          'span',
          {
            ref: 'currentRef',
            // Vue 2 的函数式 ref 通过 v-bind 不可直接传，用以下方式赋值
          },
          [String(renderContent)]
        )
      }

      // 交给 patch 前清理 JSX model= 引入的 undefined 事件处理器（含嵌套子树）
      if (renderContent && typeof renderContent === 'object' && 'tag' in renderContent) {
        stripUndefinedListeners(renderContent)
      }

      // VNode：判断是否为组件（type 不是 string 即视为组件 vnode）
      if (renderContent && typeof renderContent === 'object' && 'tag' in renderContent) {
        // Vue 2 的组件 vnode tag 形如 'vue-component-1-EsForm'，只要存在 componentOptions 就视为组件
        const isComponent = !!renderContent.componentOptions
        if (isComponent) {
          componentVNode = renderContent
          return renderContent
        }
        componentVNode = null
        return h('div', [renderContent])
      }

      componentVNode = null
      // 退化兜底
      return h('div', [String(renderContent || '')])
    }
  },
})
</script>
