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
  onMounted,
  onUpdated,
} from '../../vue-compat'

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
    const refsObject =
      props.refs && typeof props.refs === 'object'
        ? (props.refs as Record<string, unknown>)
        : reactive<Record<string, unknown>>({})

    let componentVNode: any = null

    /**
     * Vue 2 vnode 结构：
     *   - 组件 vnode: vnode.componentInstance 是组件实例（即 vm）
     *   - 普通元素: vnode.elm 是 DOM
     */
    function flushRef() {
      if (!componentVNode) return
      const inst = componentVNode.componentInstance
      if (!inst) return
      ;(refsObject as Record<string, unknown>).currentRef = inst
    }

    onMounted(() => flushRef())
    onUpdated(() => flushRef())

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
