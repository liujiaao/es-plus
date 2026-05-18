<template>
  <div class="example-form-buttons">
    <es-form
      :model="formModel"
      :form-item-list="formItems"
      :config-btn="configBtn"
      :layout-form-props="layoutProps"
    />
  </div>
</template>

<script setup>
import { EsForm } from 'es-plus'
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'

const formModel = reactive({
  keyword: '',
  status: '',
  dateRange: []
})

const formItems = [
  {
    prop: 'keyword',
    label: '关键词',
    formtype: 'Input',
    span: 8,
    attrs: { placeholder: '请输入关键词', clearable: true }
  },
  {
    prop: 'status',
    label: '状态',
    formtype: 'Select',
    span: 8,
    dataOptions: [
      { label: '全部', value: '' },
      { label: '启用', value: 'active' },
      { label: '禁用', value: 'inactive' }
    ],
    attrs: { placeholder: '请选择状态', clearable: true }
  },
  {
    prop: 'dateRange',
    label: '日期范围',
    formtype: 'datePicker',
    span: 8,
    attrs: { type: 'daterange', placeholder: '选择日期范围', clearable: true }
  }
]

const configBtn = [
  {
    name: '导出',
    key: 'export',
    direction: 'left',
    icon: 'Download',
    click: (model) => {
      ElMessage.success('导出数据: ' + JSON.stringify(model))
    }
  },
  {
    name: '查询',
    key: 'query',
    type: 'primary',
    direction: 'right',
    icon: 'Search',
    click: (model) => {
      ElMessage.success('查询: ' + JSON.stringify(model))
    }
  },
  {
    name: '重置',
    key: 'rest',
    direction: 'right',
    icon: 'RefreshLeft',
    click: (_, formRef) => {
      formRef?.resetFields()
      ElMessage.info('已重置')
    }
  }
]

const layoutProps = {
  fromLayProps: {
    labelWidth: '80px',
    btnColSpan: 24
  }
}
</script>

<style scoped>
.example-form-buttons {
  padding: 20px;
}
</style>
