<template>
  <div class="example-form-datetime">
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

const formRef = ref(null)
import { ElMessage } from 'element-plus'
import EsForm from 'es-plus/components/es-form'

const formModel = reactive({
  date: '',
  dateRange: [],
  time: '',
  timeRange: [],
  datetime: '',
  datetimeRange: []
})

const formItems = [
  {
    prop: 'date',
    label: '日期',
    formtype: 'datePicker',
    span: 8,
    attrs: {
      type: 'date',
      placeholder: '选择日期',
      format: 'YYYY-MM-DD',
      valueFormat: 'YYYY-MM-DD'
    }
  },
  {
    prop: 'dateRange',
    label: '日期范围',
    formtype: 'datePicker',
    span: 8,
    attrs: {
      type: 'daterange',
      rangeSeparator: '至',
      startPlaceholder: '开始日期',
      endPlaceholder: '结束日期',
      format: 'YYYY-MM-DD',
      valueFormat: 'YYYY-MM-DD'
    }
  },
  {
    prop: 'time',
    label: '时间',
    formtype: 'timePicker',
    span: 8,
    attrs: {
      placeholder: '选择时间',
      format: 'HH:mm:ss',
      valueFormat: 'HH:mm:ss'
    }
  },
  {
    prop: 'timeRange',
    label: '时间范围',
    formtype: 'timePicker',
    span: 8,
    attrs: {
      isRange: true,
      rangeSeparator: '至',
      startPlaceholder: '开始时间',
      endPlaceholder: '结束时间',
      format: 'HH:mm:ss',
      valueFormat: 'HH:mm:ss'
    }
  },
  {
    prop: 'datetime',
    label: '日期时间',
    formtype: 'datePicker',
    span: 8,
    attrs: {
      type: 'datetime',
      placeholder: '选择日期时间',
      format: 'YYYY-MM-DD HH:mm:ss',
      valueFormat: 'YYYY-MM-DD HH:mm:ss'
    }
  },
  {
    prop: 'datetimeRange',
    label: '日期时间范围',
    formtype: 'datePicker',
    span: 8,
    attrs: {
      type: 'datetimerange',
      rangeSeparator: '至',
      startPlaceholder: '开始时间',
      endPlaceholder: '结束时间',
      format: 'YYYY-MM-DD HH:mm:ss',
      valueFormat: 'YYYY-MM-DD HH:mm:ss'
    }
  }
]

const configBtn = [
  {
    name: '提交',
    type: 'primary',
    click: (model) => {
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
.example-form-datetime {
  padding: 20px;
}
</style>
