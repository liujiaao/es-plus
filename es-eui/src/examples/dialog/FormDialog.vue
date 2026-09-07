<template>
  <div>
    <el-button @click="openFormDialog">表单弹窗</el-button>
  </div>
</template>

<script>
import { useDialog } from '@es-plus/vue2'

export default {
  data() {
    return {
      formData: {
        name: '',
        age: '',
        email: ''
      }
    }
  },
  methods: {
    openFormDialog() {
      const { close } = useDialog()({
        title: '编辑信息',
        width: '600px',
        // 使用 JSX 直接渲染 EsForm 组件
        render: (h, ctx) => (
          <es-form
            form-item-list={[
              { prop: 'name', label: '姓名', span: 12, formtype: 'Input', attrs: { placeholder: '请输入姓名' } },
              { prop: 'age', label: '年龄', span: 12, formtype: 'Input', attrs: { placeholder: '请输入年龄' } },
              { prop: 'email', label: '邮箱', span: 24, formtype: 'Input', attrs: { placeholder: '请输入邮箱' } }
            ]}
            model={this.formData}
            layout-form-props={{
              fromLayProps: { labelWidth: '80px' },
              rowLayProps: { gutter: 20 }
            }}
          />
        ),
        configBtn: [
          {
            name: '取消',
            key: 'cancel',
            click: (_, { close }) => close()
          },
          {
            name: '保存',
            type: 'primary',
            key: 'save',
            click: (_, { close }) => {
              console.log('表单数据：', this.formData)
              this.$message.success('保存成功')
              close()
            }
          }
        ]
      })
    }
  }
}
</script>
