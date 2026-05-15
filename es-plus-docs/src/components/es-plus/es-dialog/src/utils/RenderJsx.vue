<script >
import { defineComponent, h, getCurrentInstance, isVNode, reactive, toRaw } from 'vue'
import { ElConfigProvider } from "element-plus"
import zhCn from 'element-plus/es/locale/lang/zh-cn'

export default defineComponent({
  name: 'RenderJsx',
  props: {
    // 定义组件的props
    refs: { type: [Function, Object], default: null },
    row: { type: Object, default: () => ({}) },
    render: { type: Function, default: () => {} },
    model: { type: Object, default: () => ({}) },
    instance: { type: Object, default: () => ({}) },
    components: { type: Object, default: () => ({}) },
    locale: { type: Object, default: null }
  },
  setup(props) {
    return () => {
      const { refs, instance } = props
      
      // 创建一个响应式对象来存储所有子组件的 refs
      // 优先使用外部传入的 refs 对象
      const refsObject = (refs && typeof refs === 'object') ? refs : reactive({})
      const currentRef = {}
      // 将 setter 注入到 instance 中，供 JSX 使用
      const enhancedInstance = {
        ...instance,
        // 提供一个注册 ref 的方法
        registerRef: (name, el) => {
          // 存储到 refsObject 中
          if (el !== null && el !== undefined) {
            refsObject[name] = el
          }
        },
        // 获取所有已注册的 refs
        getRefs: () => refsObject
      }
      
      const renderContent = props.render( h, enhancedInstance || {}, props.components || {}) || ''
      const Element = typeof renderContent === 'string' ? h('span', renderContent) : renderContent
      
      return h(ElConfigProvider, {
        locale: props.locale || zhCn
      }, () => h(Element,  {
          ref: (e) => {
            refsObject.currentRef = e
          }
        }))
    }
  }
})
</script>
