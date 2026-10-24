<template>
  <es-form
    ref="policyForm"
    :form-item-list="formItemList"
    :model="formData"
    :config-btn="configBtn"
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
        isPolicyTag: 'always',
        policyStatus: '0',
        policyReleaseType: '1',
        policyReleaseDate: '',
        coverImage: '',
        policyLinkContent: '',
        policyEditorContent: '',
        policyContentType: '1'
      },
      configBtn: [
        { name: '校验并提交', type: 'primary', click: () => this.validateForm() },
        { name: '重置', click: () => this.$refs.policyForm.resetFields() }
      ],
      layoutProps: {
        formLayProps: {
          isBtnHidden: true,
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
        formtype: 'DatePicker',
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
                <el-radio-group v-model={model.isPolicyTag}>
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
    async validateForm() {
      // EsForm.validate() 校验不通过是 reject（与 Element Plus / AntD 同语义），
      // 不是回调风格，也不是 resolve(false) —— 必须 catch 才能拿到「不通过」
      const ok = await this.$refs.policyForm.validate().catch(() => false)
      if (!ok) {
        this.$message.warning('请先补全必填项')
        return
      }
      this.$message.success(`校验通过：${this.formData.policyName}`)
    }
  }
}
</script>
