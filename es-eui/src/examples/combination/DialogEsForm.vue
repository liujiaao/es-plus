<template>
  <div>
    <el-button type="primary" @click="openEsFormDialog">打开 EsForm 弹窗</el-button>
  </div>
</template>

<script>
import Vue from 'vue'
import { useDialog } from '@es-plus/vue2'

const dialog = useDialog()

export default {
  methods: {
    openEsFormDialog() {
      const formData = Vue.observable({
        name: '',
        status: '',
        remark: ''
      })

      dialog({
        title: 'EsForm 弹窗',
        width: '600px',
        render: (h, ctx) => (
          <es-form
            ref="esFormInDialog"
            form-item-list={[
              {
                prop: 'name',
                label: '名称',
                span: 12,
                formtype: 'Input',
                formItemOptions: {
                  rules: [{ required: true, message: '请输入名称' }]
                }
              },
              {
                prop: 'status',
                label: '状态',
                span: 12,
                formtype: 'Select',
                attrs: { style: 'width: 100%' },
                dataOptions: [
                  { label: '启用', value: '1' },
                  { label: '禁用', value: '0' }
                ]
              },
              {
                prop: 'remark',
                label: '备注',
                span: 24,
                formtype: 'Input',
                attrs: { type: 'textarea', rows: 3 }
              }
            ]}
            model={formData}
          />
        ),
        configBtn: [
          {
            name: '取消',
            key: 'cancel',
            click: (instance, { close }) => close()
          },
          {
            name: '保存',
            type: 'primary',
            key: 'save',
            click: async (instance, { close, getRefs }) => {
              const formRef = getRefs('esFormInDialog')
              const valid = await formRef.validate()
              if (valid) {
                console.log('表单数据:', formData)
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
