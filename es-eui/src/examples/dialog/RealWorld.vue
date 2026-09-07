<template>
  <div>
    <el-button type="primary" @click="openAddDialog">新增</el-button>
    <el-button @click="openEditDialog">编辑</el-button>
  </div>
</template>

<script>
import { useDialog } from '@es-plus/vue2'

// 预先创建 dialog 实例（推荐）
const policyDialog = useDialog()

export default {
  data() {
    return {
      realWorldFormData: {
        policyName: '',
        policyAbstract: '',
        effectiveTimeRange: '',
        invalidTimeRange: '',
        policyTag: '',
        policyStatus: '0',
        policyReleaseType: '1',
        policyReleaseDate: '',
        coverImage: '',
        policyLinkContent: '',
        policyEitorContent: '',
        policyContentType: '1'
      }
    }
  },
  methods: {
    resetForm() {
      this.realWorldFormData = {
        policyName: '',
        policyAbstract: '',
        effectiveTimeRange: '',
        invalidTimeRange: '',
        policyTag: '',
        policyStatus: '0',
        policyReleaseType: '1',
        policyReleaseDate: '',
        coverImage: '',
        policyLinkContent: '',
        policyEitorContent: '',
        policyContentType: '1'
      }
    },
    openAddDialog() {
      this.resetForm()
      policyDialog({
        title: '新增政策',
        width: '75%',
        cacheKey: 'realWorldDialog',
        isDraggable: true,
        closeOnClickModal: false,
        hiddenFullBtn: false,
        fullscreen: false,
        configBtn: [
          {
            icon: 'el-icon-check',
            key: 'save',
            type: 'primary',
            size: 'mini',
            name: '提交',
            click: async (instance, { close, getRefs }) => {
              const formRef = getRefs('policyform')
              const valid = await formRef.validate()
              if (valid) {
                this.$message.success('提交成功！')
                console.log('表单数据：', this.realWorldFormData)
                close()
              }
            }
          },
          {
            icon: 'el-icon-close',
            key: 'cancel',
            size: 'mini',
            name: '取消',
            click: (instance, { close }) => close()
          }
        ],
        render: (h, ctx) => (
          <div>
            <es-form
              ref="policyform"
              form-item-list={[
                {
                  prop: 'policyName',
                  label: '政策名称',
                  span: 12,
                  formtype: 'Input',
                  formItemOptions: {
                    rules: [{ required: true, message: '请输入政策名称' }]
                  }
                },
                {
                  prop: 'policyStatus',
                  label: '政策状态',
                  span: 12,
                  formtype: 'Select',
                  attrs: { style: 'width:100%' },
                  dataOptions: [
                    { label: '待发布', value: '0' },
                    { label: '已发布', value: '1' },
                    { label: '已下架', value: '2' }
                  ]
                },
                {
                  prop: 'effectiveTimeRange',
                  label: '生效时间',
                  span: 12,
                  formtype: 'DatePicker',
                  attrs: {
                    type: 'date',
                    placeholder: '选择生效时间',
                    valueFormat: 'yyyy-MM-dd',
                    style: 'width: 100%'
                  }
                },
                {
                  prop: 'invalidTimeRange',
                  label: '失效时间',
                  span: 12,
                  formtype: 'DatePicker',
                  attrs: {
                    type: 'date',
                    placeholder: '选择失效时间',
                    valueFormat: 'yyyy-MM-dd',
                    style: 'width: 100%'
                  }
                },
                {
                  prop: 'policyTag',
                  label: '政策标签',
                  span: 24,
                  formtype: 'Input',
                  attrs: { placeholder: '多个标签用逗号分隔' }
                },
                {
                  prop: 'policyAbstract',
                  label: '政策摘要',
                  span: 24,
                  formtype: 'Input',
                  attrs: { type: 'textarea', rows: 4 }
                }
              ]}
              model={this.realWorldFormData}
              layout-form-props={{
                fromLayProps: { labelWidth: '100px', size: 'small' },
                rowLayProps: { gutter: 20 }
              }}
            />
          </div>
        )
      })
    },
    openEditDialog() {
      this.resetForm()
      policyDialog({
        title: '编辑政策',
        width: '75%',
        cacheKey: 'realWorldDialog',
        isDraggable: true,
        closeOnClickModal: false,
        configBtn: [
          {
            icon: 'el-icon-check',
            key: 'save',
            type: 'primary',
            size: 'mini',
            name: '保存',
            click: async (instance, { close, getRefs }) => {
              const formRef = getRefs('policyform')
              const valid = await formRef.validate()
              if (valid) {
                this.$message.success('保存成功！')
                console.log('编辑数据：', this.realWorldFormData)
                close()
              }
            }
          },
          {
            icon: 'el-icon-close',
            key: 'cancel',
            size: 'mini',
            name: '取消',
            click: (instance, { close }) => close()
          }
        ],
        render: (h, ctx) => (
          <div>
            <es-form
              ref="policyform"
              form-item-list={[
                {
                  prop: 'policyName',
                  label: '政策名称',
                  span: 12,
                  formtype: 'Input',
                  formItemOptions: {
                    rules: [{ required: true, message: '请输入政策名称' }]
                  }
                },
                {
                  prop: 'policyStatus',
                  label: '政策状态',
                  span: 12,
                  formtype: 'Select',
                  attrs: { style: 'width:100%' },
                  dataOptions: [
                    { label: '待发布', value: '0' },
                    { label: '已发布', value: '1' },
                    { label: '已下架', value: '2' }
                  ]
                },
                {
                  prop: 'effectiveTimeRange',
                  label: '生效时间',
                  span: 12,
                  formtype: 'DatePicker',
                  attrs: {
                    type: 'date',
                    placeholder: '选择生效时间',
                    valueFormat: 'yyyy-MM-dd',
                    style: 'width: 100%'
                  }
                },
                {
                  prop: 'invalidTimeRange',
                  label: '失效时间',
                  span: 12,
                  formtype: 'DatePicker',
                  attrs: {
                    type: 'date',
                    placeholder: '选择失效时间',
                    valueFormat: 'yyyy-MM-dd',
                    style: 'width: 100%'
                  }
                },
                {
                  prop: 'policyTag',
                  label: '政策标签',
                  span: 24,
                  formtype: 'Input',
                  attrs: { placeholder: '多个标签用逗号分隔' }
                },
                {
                  prop: 'policyAbstract',
                  label: '政策摘要',
                  span: 24,
                  formtype: 'Input',
                  attrs: { type: 'textarea', rows: 4 }
                }
              ]}
              model={this.realWorldFormData}
              layout-form-props={{
                fromLayProps: { labelWidth: '100px', size: 'small' },
                rowLayProps: { gutter: 20 }
              }}
            />
          </div>
        )
      })
    }
  }
}
</script>
