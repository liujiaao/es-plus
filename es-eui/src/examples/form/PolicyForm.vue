<template>
  <es-form
    ref="policyForm"
    :form-item-list="formItemList"
    :model="formData"
    :layout-form-props="layoutProps"
  />
</template>

<script>
export default {
  name: 'FormPolicyForm',
  data() {
    return {
      formData: {
        policyName: '',
        policyAbstract: '',
        effectiveTimeRange: '',
        invalidTimeRange: '',
        policyTag: '',
        ispolicyTag: 'always',
        policyStatus: '0',
        policyReleaseType: '1',
        policyReleaseDate: '',
        coverImage: '',
        policyLinkContent: '',
        policyEitorContent: '',
        policyContentType: '1'
      },
      layoutProps: {
        fromLayProps: {
          isBtnHiden: true,
          labelWidth: '120px',
          size: 'small'
        },
        rowLayProps: { gutter: 20 }
      },
      formItemList: []
    }
  },
  created() {
    this.formItemList = [
      {
        prop: 'policyName',
        label: '政策名称',
        span: 24,
        formtype: 'Input',
        formItemOptions: {
          labelWidth: '150px',
          style: { width: '65%' },
          rules: [
            { required: true, message: '政策名称不能为空', trigger: 'blur' }
          ]
        },
        attrs: { placeholder: '请输入政策名称', clearable: true }
      },
      {
        prop: 'policyAbstract',
        label: '摘要',
        span: 24,
        formtype: 'Input',
        formItemOptions: {
          labelWidth: '150px',
          style: { width: '65%' },
          rules: [
            { required: true, message: '摘要不能为空', trigger: 'blur' }
          ]
        },
        attrs: { placeholder: '请输入政策摘要', type: 'textarea', rows: 3 }
      },
      {
        label: '政策生效时间',
        span: 24,
        formItemOptions: {
          labelWidth: '150px',
          style: { width: '65%' },
          rules: [
            { required: true, message: '政策生效时间不能为空', trigger: 'change' }
          ]
        },
        prop: 'effectiveTimeRange',
        formtype: 'datePicker',
        attrs: {
          valueFormat: 'yyyy-MM-dd HH:mm:ss',
          type: 'datetime',
          placeholder: '选择日期时间',
          style: 'width: 100%'
        }
      },
      {
        prop: 'policyTag',
        label: '政策标签',
        span: 24,
        formItemOptions: { labelWidth: '150px' },
        render: (h, model, row) => {
          return (
            <el-row gutter={20}>
              <el-col span={8} style="padding-left: 0;">
                <el-input v-model={model.policyTag} placeholder="请输入政策标签" />
              </el-col>
              <el-col span={10}>
                <el-radio-group v-model={model.ispolicyTag}>
                  <el-radio label="always">显示</el-radio>
                  <el-radio label="hide">隐藏</el-radio>
                </el-radio-group>
              </el-col>
            </el-row>
          )
        }
      },
      {
        prop: 'policyStatus',
        label: '文章状态',
        span: 24,
        formItemOptions: {
          labelWidth: '150px',
          rules: [
            { required: true, message: '文章状态不能为空', trigger: 'change' }
          ]
        },
        formtype: 'Radio',
        attrs: { disabled: () => false },
        dataOptions: [
          { label: '草稿', value: '0' },
          { label: '上架', value: '1' },
          { label: '下架', value: '2' }
        ]
      },
      {
        prop: 'policyReleaseType',
        label: '发布方式',
        span: 24,
        formItemOptions: { labelWidth: '150px' },
        render: (h, model, row) => {
          return (
            <el-row gutter={20}>
              {model.policyReleaseType === '1' && (
                <el-col span={8} style="padding-left: 0;">
                  <el-date-picker
                    v-model={model.policyReleaseDate}
                    value-format="yyyy-MM-dd HH:mm:ss"
                    type="datetime"
                    placeholder="选择发布日期"
                    style="width: 100%;"
                  />
                </el-col>
              )}
              <el-col span={10}>
                <el-radio-group v-model={model.policyReleaseType}>
                  <el-radio label="0">立即发布</el-radio>
                  <el-radio label="1">定时发布</el-radio>
                </el-radio-group>
              </el-col>
            </el-row>
          )
        }
      }
    ]
  },
  methods: {
    validateForm() {
      this.$refs.policyForm.validate((valid) => {
        if (valid) {
          console.log('验证通过', this.formData)
        }
      })
    }
  }
}
</script>
