<template>
  <div>
    <el-button @click="openComponentDialog">EsForm 表单弹窗</el-button>
  </div>
</template>

<script>
import { useDialog } from '@es-plus/vue2'

export default {
  data() {
    return {
      userFormData: {
        name: '张三',
        email: 'zhangsan@example.com',
        phone: '',
        address: ''
      }
    }
  },
  methods: {
    openComponentDialog() {
      const { close } = useDialog()({
        title: '用户信息',
        width: '600px',
        // 使用 JSX 渲染 EsForm，代码简洁直观
        render: (h, ctx) => (
          <es-form
            ref="userForm"
            form-item-list={[
              {
                prop: 'name',
                label: '姓名',
                span: 12,
                formtype: 'Input',
                formItemOptions: {
                  rules: [{ required: true, message: '请输入姓名' }]
                }
              },
              {
                prop: 'email',
                label: '邮箱',
                span: 12,
                formtype: 'Input',
                formItemOptions: {
                  rules: [
                    { required: true, message: '请输入邮箱' },
                    { type: 'email', message: '邮箱格式错误' }
                  ]
                }
              },
              { prop: 'phone', label: '电话', span: 12, formtype: 'Input' },
              {
                prop: 'address',
                label: '地址',
                span: 24,
                formtype: 'Input',
                attrs: { type: 'textarea', rows: 3 }
              }
            ]}
            model={this.userFormData}
            layout-form-props={{
              fromLayProps: { labelWidth: '80px', size: 'small' },
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
            // 使用 getRefs 获取表单组件引用；EsForm.validate() 返回 Promise<boolean>
            click: async (_, { close, getRefs }) => {
              const formRef = getRefs('userForm')
              const valid = await formRef.validate()
              if (valid) {
                console.log('表单数据：', this.userFormData)
                this.$message.success('保存成功')
                close()
              }
            }
          }
        ]
      })
    }
  }
}
</script>
