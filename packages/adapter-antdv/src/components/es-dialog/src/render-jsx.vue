<!--
  ADV 适配器：Dialog 内容渲染桥接

  对齐 @es-plus/vue3 的 render-jsx.vue：
  - refsObject 注册子组件引用
  - flushRef 在 onMounted/onUpdated 中同步组件实例
  - registerRef / getRefs API 暴露给 render 函数
  - ADV：ConfigProvider 替代 ElConfigProvider
-->
<script lang="ts">
import { defineComponent, h, reactive, isVNode, onMounted, onUpdated } from 'vue'
import { ConfigProvider } from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'

export default defineComponent({
  name: 'RenderJsx',
  props: {
    refs: { type: [Function, Object], default: null },
    row: { type: Object, default: () => ({}) },
    render: { type: Function, default: () => {} },
    model: { type: Object, default: () => ({}) },
    instance: { type: Object, default: () => ({}) },
    components: { type: Object, default: () => ({}) },
    locale: { type: Object, default: null },
    // 是否把渲染结果写入 refs.currentRef。仅 body 应为 true；
    // header/footer 为纯装饰，写入会与 body 争抢同一 currentRef 槽位造成抖动。
    trackRef: { type: Boolean, default: true },
  },
  setup(props) {
    const refsObject =
      props.refs && typeof props.refs === 'object'
        ? props.refs
        : reactive<Record<string, unknown>>({})

    function getRawRef(vnodeRef: any) {
      if (!vnodeRef) return null
      if (typeof vnodeRef === 'function') return vnodeRef
      if (vnodeRef.r) {
        if (typeof vnodeRef.r === 'function') return vnodeRef.r
        if (
          vnodeRef.r &&
          typeof vnodeRef.r === 'object' &&
          'value' in vnodeRef.r
        ) {
          const refObj = vnodeRef.r
          return (val: unknown) => { refObj.value = val }
        }
      }
      return null
    }

    let componentVNode: any = null
    let userRefCallback: any = null

    // 稳定的 ref 回调：非组件 render（如 <div> 包裹）时挂在包裹元素上。
    // 必须是稳定引用 + 变化才写入，否则每次渲染 Vue 会以 null→el 反复触发，
    // 翻转 refsObject.currentRef → getCurrentInstanceModel 重算 → instance prop 变化
    // → RenderJsx 重渲染 → ref 再触发，形成 "Maximum recursive updates" 死循环。
    const setCurrentRef = (e: unknown) => {
      if (!props.trackRef) return
      if (e && refsObject.currentRef !== e) refsObject.currentRef = e
    }

    function flushRef() {
      if (!props.trackRef) return
      if (!componentVNode) return
      const inst = componentVNode.component
      if (!inst) return
      const comp = inst.exposed || inst.proxy
      if (!comp) return
      // 仅当值变化时才写入，避免触发父组件 reactive 对象的依赖通知
      // 导致 getCurrentInstanceModel → RenderJsx instance prop → onUpdated → flushRef 循环
      if (refsObject.currentRef === comp) return
      refsObject.currentRef = comp
      if (typeof userRefCallback === 'function') {
        userRefCallback(comp)
      }
    }

    onMounted(() => flushRef())
    onUpdated(() => flushRef())

    return () => {
      const { instance } = props
      const enhancedInstance = {
        ...(instance as Record<string, unknown>),
        registerRef: (name: string, el: unknown) => {
          if (el !== null && el !== undefined) {
            refsObject[name] = el
          }
        },
        getRefs: () => refsObject,
      }

      const renderContent =
        props.render(h, enhancedInstance, props.components || {}) || ''

      if (typeof renderContent === 'string') {
        componentVNode = null
        return h(
          ConfigProvider,
          { locale: (props.locale as any) || zhCN },
          () =>
            h('span', { ref: setCurrentRef }, renderContent),
        )
      }

      if (isVNode(renderContent)) {
        const isComponent = typeof renderContent.type !== 'string'
        if (isComponent) {
          componentVNode = renderContent
          userRefCallback =
            getRawRef(renderContent.ref) ||
            getRawRef((renderContent.props as any)?.ref)
          return renderContent
        }
        componentVNode = null
        return h(
          ConfigProvider,
          { locale: (props.locale as any) || zhCN },
          () =>
            h('div', { ref: setCurrentRef }, [renderContent]),
        )
      }

      componentVNode = null
      return h(
        ConfigProvider,
        { locale: (props.locale as any) || zhCN },
        () =>
          h(renderContent, { ref: setCurrentRef }),
      )
    }
  },
})
</script>
