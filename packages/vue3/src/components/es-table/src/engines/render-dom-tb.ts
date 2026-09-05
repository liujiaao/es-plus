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
        const result = render(h, { value, row, index })
        if (typeof result === 'string') return h('span', result)
        return result
      } catch {
        return h('span', '-')
      }
    }
  },
})

export default RenderDomTb
