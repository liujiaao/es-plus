<template>
  <div class="example-form-conditional">
    <es-form
      ref="formRef"
      :model="formModel"
      :form-item-list="formItems"
      :config-btn="configBtn"
    />
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import EsForm from 'es-plus/components/es-form'

const formRef = ref(null)
const formModel = reactive({
  userType: '',
  companyName: '',
  companyScale: '',
  personalName: '',
  personalIdCard: ''
})

const formItems = [
  {
    prop: 'userType',
    label: '用户类型',
    formtype: 'Select',
    span: 24,
    attrs: { placeholder: '请选择用户类型' },
    dataOptions: [
      { label: '企业用户', value: 'company' },
      { label: '个人用户', value: 'personal' }
    ]
  },
  // 企业用户专用字段
  {
    prop: 'companyName',
    label: '公司名称',
    formtype: 'Input',
    span: 12,
    attrs: { placeholder: '请输入公司名称' },
    isHidden: (model) => model.userType !== 'company'
  },
  {
    prop: 'companyScale',
    label: '公司规模',
    formtype: 'Select',
    span: 12,
    attrs: { placeholder: '请选择公司规模' },
    dataOptions: [
      { label: '小型(1-50人)', value: 'small' },
      { label: '中型(51-500人)', value: 'medium' },
      { label: '大型(500人以上)', value: 'large' }
    ],
    isHidden: (model) => model.userType !== 'company'
  },
  // 个人用户专用字段
  {
    prop: 'personalName',
    label: '姓名',
    formtype: 'Input',
    span: 12,
    attrs: { placeholder: '请输入姓名' },
    isHidden: (model) => model.userType !== 'personal'
  },
  {
    prop: 'personalIdCard',
    label: '身份证号',
    formtype: 'Input',
    span: 12,
    attrs: { placeholder: '请输入身份证号' },
    isHidden: (model) => model.userType !== 'personal'
  }
]

const configBtn = [
  {
    name: '提交',
    type: 'primary',
    click: (model, formRef) => {
      ElMessage.success('提交成功: ' + JSON.stringify(model))
    }
  },
  {
    name: '重置',
    click: (model, formRef) => {
      formRef.resetFields()
    }
  }
]
</script>

<style scoped>
.example-form-conditional {
  padding: 20px;
}
</style>
