<template>
  <div class="example-toolbar-table">
    <es-table
      :data-source="tableData"
      :columns="columns"
      :options="tableOptions"
    >
      <template #default>
        <a-button type="primary" size="small" @click="handleExport">
          <DownloadOutlined /> 导出
        </a-button>
        <a-button size="small" @click="handlePrint">
          <PrinterOutlined /> 打印
        </a-button>
        <a-button size="small" @click="handleRefresh">
          <ReloadOutlined /> 刷新
        </a-button>
      </template>
    </es-table>
  </div>
</template>

<script setup>
import { EsTable } from '@es-plus/adapter-antdv'
import { ref } from 'vue'
import { message } from 'ant-design-vue'
import { DownloadOutlined, PrinterOutlined, ReloadOutlined } from '@ant-design/icons-vue'

// 原始数据：刷新 = 从这份「后端快照」重新取一遍，改动（新增）随之回滚
const originData = [
  { id: 1, name: '产品A', category: '电子', price: 299, stock: 100 },
  { id: 2, name: '产品B', category: '家居', price: 159, stock: 50 },
  { id: 3, name: '产品C', category: '电子', price: 499, stock: 30 },
  { id: 4, name: '产品D', category: '服装', price: 89, stock: 200 }
]
const tableData = ref(originData.map((r) => ({ ...r })))

const columns = [
  { prop: 'id', label: 'ID', width: 60 },
  { prop: 'name', label: '产品名称', minWidth: 150 },
  { prop: 'category', label: '分类', width: 100 },
  { prop: 'price', label: '价格', width: 100, formatter: (row) => `¥${row.price}` },
  { prop: 'stock', label: '库存', width: 100 }
]

const tableOptions = {
  border: true,
  stripe: true,
  configBtn: [
    {
      name: '新增', type: 'primary', icon: 'Plus', code: 2,
      click: () => {
        tableData.value.push({
          id: Math.max(...tableData.value.map((r) => r.id)) + 1,
          name: '产品E', category: '电子', price: 199, stock: 10
        })
        message.success('已新增一行')
      }
    },
    { name: '批量删除', type: 'danger', icon: 'Delete', code: 2, click: () => message.warning('点击了批量删除') }
  ],
  leftText: '产品列表'
}

// 刷新 = 丢弃本地改动、回到「后端」那一份数据（有 httpRequest 时这里换成 httpRequestInstance()）
const handleRefresh = () => {
  tableData.value = originData.map((r) => ({ ...r }))
  message.success('已刷新')
}

// 工具栏插槽里的按钮由使用方自己决定行为：
// 默认 a-table 引擎不自带导出/打印（那是 vxe 引擎的 exportConfig/printConfig），
// 这里用最小的浏览器能力补上，保证每个按钮都真的可用。
const handleExport = () => {
  const lines = [
    columns.map(c => c.label).join(','),
    ...tableData.value.map(row => columns.map(c => row[c.prop]).join(','))
  ]
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '产品列表.csv'
  a.click()
  URL.revokeObjectURL(url)
  message.success('已导出 CSV')
}

const handlePrint = () => {
  const head = columns.map(c => `<th>${c.label}</th>`).join('')
  const body = tableData.value
    .map(row => `<tr>${columns.map(c => `<td>${row[c.prop]}</td>`).join('')}</tr>`)
    .join('')
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(
    `<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;font-family:sans-serif">` +
    `<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
  )
  win.document.close()
  win.print()
}
</script>

<style scoped>
.example-toolbar-table {
  padding: 0;
}
</style>
