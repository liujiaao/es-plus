<template>
  <es-form
    :form-item-list="formItemList"
    :model="formData"
  />
</template>

<script>
export default {
  name: 'FormCustomRender',
  data() {
    return {
      formData: {
        title: '',
        content: '',
        themeColor: '#409eff',
        showTags: false,
        tags: []
      },
      formItemList: [
        {
          prop: 'title',
          label: '标题',
          span: 24,
          formtype: 'Input',
          attrs: { placeholder: '请输入标题' }
        },
        {
          prop: 'content',
          label: '富文本内容',
          span: 24,
          render: (h, model, { row }) => {
            return h('div', {
              style: {
                border: '1px solid #dcdfe6',
                borderRadius: '4px',
                padding: '10px',
                minHeight: '100px'
              }
            }, [
              h('div', {
                style: {
                  borderBottom: '1px solid #ebeef5',
                  paddingBottom: '5px',
                  marginBottom: '10px'
                }
              }, [
                h('el-button', { props: { size: 'mini' } }, 'B'),
                h('el-button', { props: { size: 'mini' } }, 'I'),
                h('el-button', { props: { size: 'mini' } }, 'U')
              ]),
              h('div', {
                attrs: { contenteditable: true },
                style: { minHeight: '60px', outline: 'none' },
                on: {
                  input: (e) => {
                    model[row.prop] = e.target.innerText
                  }
                }
              }, model[row.prop] || '')
            ])
          }
        },
        {
          prop: 'themeColor',
          label: '主题色',
          span: 12,
          render: (h, model, { row }) => {
            const colors = ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399']
            return h('div', {
              style: { display: 'flex', gap: '10px' }
            }, colors.map(color =>
              h('div', {
                style: {
                  width: '30px',
                  height: '30px',
                  borderRadius: '4px',
                  backgroundColor: color,
                  cursor: 'pointer',
                  border: model[row.prop] === color
                    ? '2px solid #000'
                    : '1px solid #dcdfe6'
                },
                on: {
                  click: () => {
                    model[row.prop] = color
                  }
                }
              })
            ))
          }
        },
        {
          prop: 'showTags',
          label: '显示标签',
          span: 12,
          formtype: 'Switch',
          on: {
            change: () => {
              this.dynamicRuleKey = Date.now()
            }
          }
        }
      ]
    }
  }
}
</script>
