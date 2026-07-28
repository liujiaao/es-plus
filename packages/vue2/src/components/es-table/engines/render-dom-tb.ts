import { h, defineComponent } from '../../../vue-compat'

// Vue 2 版本：直接使用 defineComponent 的 render 选项，避免 setup() 返回渲染函数
// 在 Vue 2.6 + @vue/composition-api 中该模式最稳定
const RenderDomTb = defineComponent({
  name: 'RenderDomTb',
  props: {
    row: { type: Object as () => Record<string, unknown>, default: () => ({}) },
    index: { type: Number, default: 0 },
    dataKey: { type: String, default: '' },
    render: { type: Function as unknown as () => (...args: unknown[]) => unknown, required: true },
  },
  render(this: any) {
    const { row, index, dataKey, render } = this.$props
    if (!row || !render) return h('span', ['-'])
    const value = dataKey ? (row as Record<string, unknown>)[dataKey] : null
    try {
      const result = render(h, { value, row, index })
      if (typeof result === 'string') return h('span', [result])
      return result as any
    } catch {
      return h('span', ['-'])
    }
  },
})

// Vue 2 中 <component :is="fn"> 不支持渲染函数作为组件，需要用包装组件来调用 slotFn(slotProps)
export const RenderSlotBridge = defineComponent({
  name: 'RenderSlotBridge',
  props: {
    slotFn: {
      type: Function as unknown as () => (...args: any[]) => any,
      required: true,
    },
    slotProps: {
      type: Object as () => Record<string, unknown>,
      default: () => ({}),
    },
  },
  render(this: any) {
    try {
      const vnode = this.$props.slotFn(this.$props.slotProps)
      return vnode || h('span')
    } catch {
      return h('span')
    }
  },
})

export default RenderDomTb
