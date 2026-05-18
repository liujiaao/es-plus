<template>
  <div class="example-advanced-step-form">
    <el-steps :active="currentStep" finish-status="success" simple>
      <el-step title="基本信息" />
      <el-step title="配置信息" />
      <el-step title="确认提交" />
    </el-steps>
    
    <div class="step-content">
      <es-form
        v-if="currentStep === 0"
        ref="step1Ref"
        :model="formData"
        :form-item-list="step1Items"
        :layout-form-props="{ fromLayProps: { labelWidth: '100px' } }"
      />
      <es-form
        v-if="currentStep === 1"
        ref="step2Ref"
        :model="formData"
        :form-item-list="step2Items"
        :layout-form-props="{ fromLayProps: { labelWidth: '100px' } }"
      />
      <div v-if="currentStep === 2" class="review-section">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="项目名称">{{ formData.name }}</el-descriptions-item>
          <el-descriptions-item label="项目类型">{{ formData.type }}</el-descriptions-item>
          <el-descriptions-item label="负责人">{{ formData.manager }}</el-descriptions-item>
          <el-descriptions-item label="优先级">{{ formData.priority }}</el-descriptions-item>
          <el-descriptions-item label="开始日期">{{ formData.startDate }}</el-descriptions-item>
          <el-descriptions-item label="预计结束">{{ formData.endDate }}</el-descriptions-item>
          <el-descriptions-item label="项目描述" :span="2">{{ formData.desc || '-' }}</el-descriptions-item>
        </el-descriptions>
      </div>
    </div>
    
    <div class="step-actions">
      <el-button v-if="currentStep > 0" @click="currentStep--">上一步</el-button>
      <el-button v-if="currentStep < 2" type="primary" @click="handleNext">下一步</el-button>
      <el-button v-if="currentStep === 2" type="success" @click="submitForm">提交</el-button>
    </div>
  </div>
</template>

<script setup>
import { EsForm } from 'es-plus'
import { ref, h, nextTick } from 'vue'
import { ElMessage, ElSteps, ElStep, ElDescriptions, ElDescriptionsItem } from 'element-plus'

const currentStep = ref(0)

const formData = ref({
  name: '',
  type: '',
  manager: '',
  priority: 'normal',
  startDate: '',
  endDate: '',
  desc: ''
})

const step1Items = [
  { prop: 'name', label: '项目名称', formtype: 'Input', span: 12, attrs: { placeholder: '请输入项目名称' }, rules: [{ required: true, message: '请输入项目名称', trigger: 'blur' }] },
  {
    prop: 'type',
    label: '项目类型',
    formtype: 'Select',
    span: 12,
    dataOptions: [
      { label: '研发项目', value: 'rd' },
      { label: '市场项目', value: 'marketing' },
      { label: '运营项目', value: 'operation' }
    ],
    attrs: { placeholder: '请选择项目类型' },
    rules: [{ required: true, message: '请选择项目类型', trigger: 'change' }]
  },
  { prop: 'manager', label: '负责人', formtype: 'Input', span: 12, attrs: { placeholder: '请输入负责人' }, rules: [{ required: true, message: '请输入负责人', trigger: 'blur' }] },
  {
    prop: 'priority',
    label: '优先级',
    formtype: 'Radio',
    span: 12,
    dataOptions: [
      { label: '高', value: 'high' },
      { label: '中', value: 'normal' },
      { label: '低', value: 'low' }
    ]
  }
]

const step2Items = [
  { prop: 'startDate', label: '开始日期', formtype: 'datePicker', span: 12, attrs: { placeholder: '选择开始日期' }, rules: [{ required: true, message: '请选择开始日期', trigger: 'change' }] },
  { prop: 'endDate', label: '结束日期', formtype: 'datePicker', span: 12, attrs: { placeholder: '选择结束日期' }, rules: [
    { required: true, message: '请选择结束日期', trigger: 'change' },
    {
      validator: (rule, value, callback) => {
        if (value && formData.value.startDate && value < formData.value.startDate) {
          callback(new Error('结束日期不能早于开始日期'))
        } else {
          callback()
        }
      },
      trigger: 'change'
    }
  ]},
  { prop: 'desc', label: '项目描述', formtype: 'Input', span: 24, attrs: { type: 'textarea', rows: 4, placeholder: '请输入项目描述' } }
]

const step1Ref = ref(null)
const step2Ref = ref(null)

const handleNext = async () => {
  if (currentStep.value === 0) {
    await nextTick()
    const valid = await step1Ref.value?.validate?.()
    if (valid) currentStep.value++
  } else if (currentStep.value === 1) {
    await nextTick()
    const valid = await step2Ref.value?.validate?.()
    if (valid) currentStep.value++
  }
}

const submitForm = () => {
  ElMessage.success('项目创建成功！')
  currentStep.value = 0
  formData.value = {
    name: '', type: '', manager: '', priority: 'normal',
    startDate: '', endDate: '', desc: ''
  }
}
</script>

<style scoped>
.example-advanced-step-form {
  padding: 20px;
}
.step-content {
  margin: 32px 0;
  min-height: 200px;
}
.review-section {
  padding: 20px;
  background-color: #f5f7fa;
  border-radius: 4px;
}
.step-actions {
  display: flex;
  justify-content: center;
  gap: 16px;
}
</style>
