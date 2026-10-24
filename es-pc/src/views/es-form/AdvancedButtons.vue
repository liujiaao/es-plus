<template>
  <div class="example-form-buttons">
    <es-form
      :model="formModel"
      :form-item-list="formItems"
      :config-btn="configBtn"
      :layout-form-props="layoutProps"
    />
    <div class="result-panel">
      <div class="result-title">
        查询结果 <em>{{ results.length }}</em> 条
        <span class="result-hint">导出按钮导出的是当前结果集，不是表单值</span>
      </div>
      <a-table
        :data-source="results"
        :columns="resultColumns"
        :pagination="false"
        size="small"
        bordered
      />
    </div>
  </div>
</template>

<script setup>
import { EsForm } from '@es-plus/adapter-antdv'
import { ref, reactive } from 'vue'
import { message } from 'ant-design-vue'

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
    attrs: { placeholder: '请输入关键词', allowClear: true }
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
    attrs: { placeholder: '请选择状态', allowClear: true }
  },
  {
    prop: 'dateRange',
    label: '日期范围',
    formtype: 'DatePicker',
    span: 8,
    attrs: {
      type: 'daterange',
      valueFormat: 'YYYY-MM-DD',
      'start-placeholder': '开始日期',
      'end-placeholder': '结束日期',
      allowClear: true
    }
  }
]

// 演示数据：查询与导出都作用在这份结果集上，按钮不是空壳
const allRows = [
  { name: '华东仓储扩容', status: 'active', statusText: '启用', date: '2024-05-12' },
  { name: '华南渠道返点', status: 'inactive', statusText: '禁用', date: '2024-05-18' },
  { name: '北方仓配一体', status: 'active', statusText: '启用', date: '2024-06-02' },
  { name: '西南门店改造', status: 'inactive', statusText: '禁用', date: '2024-06-15' },
  { name: '总部数据中台', status: 'active', statusText: '启用', date: '2024-07-01' },
  { name: '海外仓试运营', status: 'active', statusText: '启用', date: '2024-07-21' }
]

const results = ref([...allRows])

const resultColumns = [
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '状态', dataIndex: 'statusText', key: 'statusText', width: 90 },
  { title: '日期', dataIndex: 'date', key: 'date', width: 120 }
]

const inRange = (date, range) => {
  if (!Array.isArray(range) || range.length !== 2 || !range[0]) return true
  return date >= range[0] && date <= range[1]
}

const applyQuery = (model) => {
  const keyword = (model.keyword || '').trim()
  results.value = allRows.filter((row) =>
    (!keyword || row.name.includes(keyword)) &&
    (!model.status || row.status === model.status) &&
    inRange(row.date, model.dateRange)
  )
  message.success(`查询完成：${results.value.length} 条`)
}

const exportCsv = (rows) => {
  if (!rows.length) {
    message.warning('没有可导出的数据')
    return
  }
  const header = ['name', 'statusText', 'date']
  const lines = [
    header.join(','),
    ...rows.map((row) => header.map((key) => row[key] ?? '').join(','))
  ]
  // BOM 让 Excel 正确识别 UTF-8 中文
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = '查询结果.csv'
  link.click()
  URL.revokeObjectURL(url)
  message.success(`已导出 ${rows.length} 条`)
}

const configBtn = [
  {
    name: '导出',
    key: 'export',
    direction: 'left',
    icon: 'DownloadOutlined',
    click: () => exportCsv(results.value)
  },
  {
    name: '查询',
    key: 'query',
    type: 'primary',
    direction: 'right',
    icon: 'Search',
    click: (model) => applyQuery(model)
  },
  {
    name: '重置',
    key: 'rest',
    direction: 'right',
    icon: 'ReloadOutlined',
    click: (_, formRef) => {
      formRef?.resetFields()
      results.value = [...allRows]
      message.info('已重置')
    }
  }
]

const layoutProps = {
  formLayProps: {
    labelWidth: '80px'
    // 按钮区默认独占一行（btnColSpanRow 默认 true），
    // 行内再按 direction: 'left' | 'right' 把按钮分到两端
  }
}
</script>

<style scoped>
.example-form-buttons {
  padding: 20px;
}
.result-panel {
  margin-top: 12px;
}
.result-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 14px;
  color: #606266;
}
.result-title em {
  font-style: normal;
  font-weight: 700;
  color: #1677ff;
}
.result-hint {
  margin-left: auto;
  font-size: 12px;
  color: #909399;
}
</style>
