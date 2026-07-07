/**
 * 表格单元格自定义渲染组件
 *
 * 将用户传入的 render(h, { row, value, index }) 函数转换为 VNode。
 * 逻辑与 @es-plus/vue3 的 column-item.vue 中 RenderDomTb 一致。
 */
import { h, defineComponent } from 'vue'

const RenderDomTb = defineComponent({
  name: 'RenderDomTb',
  props: {
    row: { type: Object, default: () => ({}) },
    index: { type: Number, default: 0 },
    dataKey: { type: String, default: '' },
    render: { type: Function, required: true },
  },
  setup(props) {
    return () => {
      const { row, index, dataKey, render } = props
      if (!row) return h('span', '-')
      const value = dataKey ? row[dataKey] : null
      try {
        const renderResult = render(h, { value, row, index })
        if (typeof renderResult === 'string') return h('span', renderResult)
        return renderResult
      } catch {
        return h('span', '-')
      }
    }
  },
})

export default RenderDomTb
