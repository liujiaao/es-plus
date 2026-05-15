<template>
  <div class="example-step-import">
    <el-button type="primary" @click="openImportDialog">导入数据</el-button>
  </div>
</template>

<script setup lang="jsx">
import { ref, reactive } from 'vue'
import { ElMessage, ElSteps, ElStep } from 'element-plus'
import EsForm from 'es-plus/components/es-form'
import EsTable from 'es-plus/components/es-table'
import { useDialog } from 'es-plus'

const dialog = useDialog()

const generateMockImportData = (count, type) => {
  const names = ['张三', '李四', '王五', '赵六', '孙七', '周八', '吴九', '郑十']
  const depts = ['技术部', '产品部', '市场部', '财务部']
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: names[i % names.length],
    dept: depts[i % depts.length],
    type,
    salary: [8000, 12000, 18000, 25000][i % 4],
    valid: i % 7 !== 0,
    error: i % 7 === 0 ? '姓名格式错误' : ''
  }))
}

const openImportDialog = () => {
  const currentStep = ref(0)
  const step1Model = reactive({ importType: 'employee', source: 'excel', sheet: 'Sheet1' })
  const step2Model = reactive({ data: [] })
  const step3Model = reactive({ confirmName: '', remark: '' })

  const step1Items = [
    { prop: 'importType', label: '导入类型', formtype: 'Select', span: 24,
      dataOptions: [
        { label: '员工数据', value: 'employee' },
        { label: '薪资数据', value: 'salary' },
        { label: '考勤数据', value: 'attendance' }
      ],
      attrs: { placeholder: '选择导入类型' }
    },
    { prop: 'source', label: '数据来源', formtype: 'Radio', span: 24,
      dataOptions: [
        { label: 'Excel文件', value: 'excel' },
        { label: 'CSV文件', value: 'csv' },
        { label: '手动输入', value: 'manual' }
      ]
    },
    { prop: 'sheet', label: '工作表', formtype: 'Input', span: 24,
      isHidden: (model) => model.source !== 'excel',
      attrs: { placeholder: '工作表名称' }
    }
  ]

  const previewColumns = [
    { prop: 'id', label: '序号', width: 60 },
    { prop: 'name', label: '姓名', width: 80 },
    { prop: 'dept', label: '部门', width: 90 },
    { prop: 'type', label: '类型', width: 80 },
    { prop: 'salary', label: '薪资', width: 100, formatter: (r) => `¥${r.salary.toLocaleString()}` },
    {
      prop: 'valid', label: '校验', width: 80,
      render: (_, { row }) => row.valid
        ? <span style="color: #67c23a">通过</span>
        : <span style="color: #f56c6c">{row.error}</span>
    }
  ]

  const step3Items = [
    { prop: 'confirmName', label: '确认人', formtype: 'Input', span: 24, attrs: { placeholder: '请输入确认人姓名' } },
    { prop: 'remark', label: '备注', formtype: 'Input', span: 24, attrs: { placeholder: '导入备注（选填）', type: 'textarea', rows: 2 } }
  ]

  const loadPreviewData = () => {
    step2Model.data = generateMockImportData(12, step1Model.importType)
  }

  dialog({
    title: '数据导入向导',
    width: '800px',
    render: (h, { registerRef }) => {
      const stepsEl = (
        <ElSteps active={currentStep.value} finishStatus="success" simple style="margin-bottom: 20px">
          <ElStep title="配置" />
          <ElStep title="预览" />
          <ElStep title="确认" />
        </ElSteps>
      )

      if (currentStep.value === 0) {
        return (
          <div>
            {stepsEl}
            <EsForm
              ref={(el) => { if (el) registerRef('step1Form', el) }}
              model={step1Model}
              formItemList={step1Items}
              layoutFormProps={{ fromLayProps: { labelWidth: '100px' } }}
            />
          </div>
        )
      }

      if (currentStep.value === 1) {
        return (
          <div>
            {stepsEl}
            <div style={{ marginBottom: '8px', color: '#909399', fontSize: '13px' }}>
              共 {step2Model.data.length} 条数据，
              有效 {step2Model.data.filter(d => d.valid).length} 条，
              异常 {step2Model.data.filter(d => !d.valid).length} 条
            </div>
            <EsTable
              dataSource={step2Model.data}
              columns={previewColumns}
              options={{ border: true, size: 'small', heightType: 'height', tabHeight: 300 }}
            />
          </div>
        )
      }

      return (
        <div>
          {stepsEl}
          <el-descriptions column={2} border size="small" style="margin-bottom: 16px">
            <el-descriptions-item label="导入类型">{step1Model.importType === 'employee' ? '员工数据' : step1Model.importType}</el-descriptions-item>
            <el-descriptions-item label="数据来源">{step1Model.source === 'excel' ? 'Excel文件' : step1Model.source}</el-descriptions-item>
            <el-descriptions-item label="数据条数">{step2Model.data.length}</el-descriptions-item>
            <el-descriptions-item label="有效数据">{step2Model.data.filter(d => d.valid).length}</el-descriptions-item>
          </el-descriptions>
          <EsForm
            ref={(el) => { if (el) registerRef('step3Form', el) }}
            model={step3Model}
            formItemList={step3Items}
            layoutFormProps={{ fromLayProps: { labelWidth: '100px' } }}
          />
        </div>
      )
    },
    configBtn: [
      { name: '取消', click: (_, { close }) => close() },
      {
        name: '上一步', disabled: () => currentStep.value === 0,
        click: () => { if (currentStep.value > 0) currentStep.value-- }
      },
      {
        name: '下一步', type: 'primary',
        disabled: () => currentStep.value >= 2,
        click: () => {
          if (currentStep.value === 0) {
            loadPreviewData()
            currentStep.value = 1
          } else if (currentStep.value === 1) {
            currentStep.value = 2
          }
        }
      },
      {
        name: '确认导入', type: 'success',
        disabled: () => currentStep.value !== 2,
        click: (_, { close }) => {
          ElMessage.success(`成功导入 ${step2Model.data.filter(d => d.valid).length} 条数据（模拟）`)
          close()
        }
      }
    ]
  })
}
</script>

<style scoped>
.example-step-import {
  padding: 0;
}
</style>
