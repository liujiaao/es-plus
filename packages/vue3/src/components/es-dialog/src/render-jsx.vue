<script >
import { defineComponent, h, reactive, isVNode, onMounted, onUpdated } from 'vue'
import { ElConfigProvider } from "element-plus"
import zhCn from 'element-plus/es/locale/lang/zh-cn'

export default defineComponent({
  name: 'RenderJsx',
  props: {
    refs: { type: [Function, Object], default: null },
    row: { type: Object, default: () => ({}) },
    render: { type: Function, default: () => {} },
    model: { type: Object, default: () => ({}) },
    instance: { type: Object, default: () => ({}) },
    components: { type: Object, default: () => ({}) },
    locale: { type: Object, default: null }
  },
  setup(props) {
    const refsObject = (props.refs && typeof props.refs === 'object') ? props.refs : reactive({})

    function getRawRef(vnodeRef) {
      if (!vnodeRef) return null
      if (typeof vnodeRef === 'function') return vnodeRef
      if (vnodeRef.r) {
        if (typeof vnodeRef.r === 'function') return vnodeRef.r
        if (vnodeRef.r && typeof vnodeRef.r === 'object' && 'value' in vnodeRef.r) {
          const refObj = vnodeRef.r
          return (val) => { refObj.value = val }
        }
      }
      return null
    }

    // Store the component VNode and user ref callback to use after mount
    let componentVNode = null
    let userRefCallback = null

    function flushRef() {
      if (!componentVNode) return
      const instance = componentVNode.component
      if (!instance) return
      // Use .exposed first — template refs on components with defineExpose
      // receive instance.exposed, not instance.proxy
      const comp = instance.exposed || instance.proxy
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
        ...instance,
        registerRef: (name, el) => {
          if (el !== null && el !== undefined) {
            refsObject[name] = el
          }
        },
        getRefs: () => refsObject
      }

      const renderContent = props.render(h, enhancedInstance, props.components || {}) || ''

      if (typeof renderContent === 'string') {
        componentVNode = null
        return h(ElConfigProvider, {
          locale: props.locale || zhCn
        }, () => h('span', {
          ref: (e) => { refsObject.currentRef = e }
        }, renderContent))
      }

      if (isVNode(renderContent)) {
        const isComponent = typeof renderContent.type !== 'string'
        if (isComponent) {
          componentVNode = renderContent
          userRefCallback = getRawRef(renderContent.ref) || getRawRef(renderContent.props?.ref)
          return renderContent
        }
        componentVNode = null
        return h(ElConfigProvider, {
          locale: props.locale || zhCn
        }, () => h('div', {
          ref: (e) => { refsObject.currentRef = e }
        }, [renderContent]))
      }

      componentVNode = null
      return h(ElConfigProvider, {
        locale: props.locale || zhCn
      }, () => h(renderContent, {
        ref: (e) => { refsObject.currentRef = e }
      }))
    }
  }
})
</script>
