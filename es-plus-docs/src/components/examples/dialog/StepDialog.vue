<template>
  <div class="example-dialog-step">
    <el-button type="primary" @click="openStepDialog">分步创建向导</el-button>
  </div>
</template>

<script setup lang="jsx">
import { ref, computed } from 'vue'
import { ElMessage, ElSteps, ElStep, ElResult, ElButton } from 'element-plus'
import { EsForm,  useDialog } from 'es-plus'

const dialog = useDialog()

const stepSchemas = [
  {
    title: '基本信息',
    items: [
      { prop: 'name', label: '项目名称', formtype: 'Input', span: 24, attrs: { placeholder: '请输入项目名称' } },
      { prop: 'type', label: '项目类型', formtype: 'Select', span: 12, dataOptions: [
        { label: 'Web 应用', value: 'web' }, { label: '移动端', value: 'mobile' }, { label: '桌面端', value: 'desktop' }
      ], attrs: { placeholder: '请选择' } },
      { prop: 'priority', label: '优先级', formtype: 'Select', span: 12, dataOptions: [
        { label: '高', value: 'high' }, { label: '中', value: 'medium' }, { label: '低', value: 'low' }
      ] }
    ],
    rules: {
      name: [{ required: true, message: '请输入项目名称', trigger: 'blur' }],
      type: [{ required: true, message: '请选择项目类型', trigger: 'change' }],
      priority: [{ required: true, message: '请选择优先级', trigger: 'change' }]
    }
  },
  {
    title: '配置参数',
    items: [
      { prop: 'framework', label: '技术框架', formtype: 'Select', span: 12, dataOptions: [
        { label: 'Vue 3', value: 'vue3' }, { label: 'React 18', value: 'react' }, { label: 'Angular', value: 'angular' }
      ] },
      { prop: 'version', label: '版本号', formtype: 'Input', span: 12, attrs: { placeholder: '如 1.0.0' } },
      { prop: 'desc', label: '项目描述', formtype: 'Input', span: 24, attrs: { type: 'textarea', rows: 3, placeholder: '请描述项目目标' } }
    ],
    rules: {
      framework: [{ required: true, message: '请选择技术框架', trigger: 'change' }]
    }
  },
  {
    title: '团队成员',
    items: [
      { prop: 'leader', label: '负责人', formtype: 'Input', span: 12, attrs: { placeholder: '请输入负责人' } },
      { prop: 'members', label: '团队人数', formtype: 'Select', span: 12, dataOptions: [
        { label: '1-3 人', value: 'small' }, { label: '4-10 人', value: 'medium' }, { label: '10+ 人', value: 'large' }
      ] },
      { prop: 'startDate', label: '启动日期', formtype: 'datePicker', span: 12, attrs: { placeholder: '选择日期', valueFormat: 'YYYY-MM-DD' } },
      { prop: 'deadline', label: '截止日期', formtype: 'datePicker', span: 12, attrs: { placeholder: '选择日期', valueFormat: 'YYYY-MM-DD' } }
    ],
    rules: {
      leader: [{ required: true, message: '请输入负责人', trigger: 'blur' }],
      startDate: [{ required: true, message: '请选择启动日期', trigger: 'change' }]
    }
  }
]

const openStepDialog = () => {
  const currentStep = ref(0)
  const formData = ref({ name: '', type: '', priority: '', framework: '', version: '', desc: '', leader: '', members: '', startDate: '', deadline: '' })
  const isDone = ref(false)
  let formRef = null

  const schema = computed(() => stepSchemas[currentStep.value])
  const isLastStep = computed(() => currentStep.value === stepSchemas.length - 1)

  dialog({
    title: '创建项目',
    width: '620px',
    render: (h, { registerRef }) => (
      <div style="padding: 10px 20px">
        <ElSteps active={currentStep.value} finishStatus="success" alignCenter style="margin-bottom: 24px">
          {stepSchemas.map((s) => <ElStep title={s.title} />)}
        </ElSteps>
        {isDone.value
          ? <ElResult icon="success" title="项目创建成功" subTitle={`项目「${formData.value.name}」已成功创建`} />
          : <EsForm
              ref={(el) => { formRef = el }}
              model={formData.value}
              formItemList={schema.value.items}
              rules={schema.value.rules}
              layoutFormProps={{ fromLayProps: { labelWidth: '90px' } }}
            />
        }
      </div>
    ),
    isHiddenFooter: true,
    renderFooter: (h, { close }) => (
      <div style="display: flex; justify-content: flex-end; gap: 12px; padding: 10px 20px; width: 100%">
        {isDone.value
          ? <ElButton type="primary" onClick={() => close()}>完成</ElButton>
          : [
              currentStep.value > 0 && <ElButton onClick={() => { currentStep.value--; formRef?.clearValidate() }}>上一步</ElButton>,
              <ElButton type="primary" onClick={() => {
                formRef?.validate()
                  .then(() => {
                    if (isLastStep.value) {
                      isDone.value = true
                      ElMessage.success('项目创建成功')
                    } else {
                      currentStep.value++
                      formRef?.clearValidate()
                    }
                  })
                  .catch(() => {})
              }}>
                {isLastStep.value ? '提交创建' : '下一步'}
              </ElButton>
            ]
        }
      </div>
    )
  })
}
</script>

<style scoped>
.example-dialog-step {
  padding: 20px;
}
</style>
