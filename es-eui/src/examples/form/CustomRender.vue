<template>
  <es-form
    :form-item-list="formItemList"
    :model="formData"
    :config-btn="configBtn"
  />
</template>

<script>
/**
 * 自定义渲染：表单项用 render(h, model, { row }) 接管，想放什么控件就放什么控件，
 * 校验 / 提交 / 布局仍归 EsForm 管（值直接写回 model[row.prop]）。
 *
 * 这里放两个内置表单类型覆盖不了的控件：富文本编辑器 + 色板。
 */
export default {
  name: 'FormCustomRender',
  data() {
    return {
      formData: {
        title: '',
        content: '',
        themeColor: 'var(--es-brand-primary)'
      },
      configBtn: [
        {
          name: '提交',
          type: 'primary',
          click: (model, formRef) => {
            formRef.validate((valid) => {
              if (!valid) {
                this.$message.error('请先填写标题')
                return
              }
              this.$message.success('已提交：' + JSON.stringify(model))
            })
          }
        }
      ],
      formItemList: [
        {
          prop: 'title',
          label: '标题',
          span: 24,
          formtype: 'Input',
          attrs: { placeholder: '请输入标题' },
          formItemOptions: {
            rules: [{ required: true, message: '请输入标题', trigger: 'blur' }]
          }
        },
        {
          prop: 'content',
          label: '富文本内容',
          span: 24,
          render: (h, model, { row }) => {
            // mousedown + preventDefault：保住 contenteditable 里的选区，
            // 否则点按钮时焦点先被抢走，execCommand 命令落不到选中文本上
            const tool = (cmd, text) =>
              h('el-button', {
                props: { size: 'mini' },
                on: { mousedown: (e) => { e.preventDefault(); document.execCommand(cmd) } }
              }, text)
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
              }, [tool('bold', 'B'), tool('italic', 'I'), tool('underline', 'U')]),
              h('div', {
                attrs: { contenteditable: true },
                style: { minHeight: '60px', outline: 'none' },
                on: {
                  input: (e) => {
                    model[row.prop] = e.target.innerText
                  }
                }
                // 刻意不给 children / innerHTML：Vue 每次重渲染都不会改写节点内容，
                // 光标和加粗等富文本格式才不会被冲掉（值只单向回写 model）
              })
            ])
          }
        },
        {
          prop: 'themeColor',
          label: '主题色',
          span: 24,
          render: (h, model, { row }) => {
            const colors = ['var(--es-brand-primary)', '#67c23a', '#e6a23c', '#f56c6c', '#909399']
            return h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, [
              ...colors.map(color =>
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
              ),
              // 预览条真的用选中的颜色，选择结果一眼可见
              h('span', {
                style: {
                  padding: '4px 12px',
                  borderRadius: '4px',
                  color: '#fff',
                  backgroundColor: model[row.prop]
                }
              }, '主题预览')
            ])
          }
        }
      ]
    }
  }
}
</script>
