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

    function flushRef() {
      if (!componentVNode) return
      const inst = componentVNode.component
      if (!inst) return
      const comp = inst.exposed || inst.proxy
      if (!comp) return
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
            h(
              'span',
              { ref: (e: unknown) => { refsObject.currentRef = e } },
              renderContent,
            ),
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
            h('div', { ref: (e: unknown) => { refsObject.currentRef = e } }, [
              renderContent,
            ]),
        )
      }

      componentVNode = null
      return h(
        ConfigProvider,
        { locale: (props.locale as any) || zhCN },
        () =>
          h(renderContent, { ref: (e: unknown) => { refsObject.currentRef = e } }),
      )
    }
  },
})
</script>
