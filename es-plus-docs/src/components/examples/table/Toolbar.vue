<template>
  <div class="example-toolbar-table">
    <es-table
      ref="tableRef"
      :data-source="tableData"
      :columns="columns"
      :options="tableOptions"
    >
      <template #default>
        <el-button type="primary" :icon="Download" size="small" @click="handleExport">导出</el-button>
        <el-button type="success" :icon="Printer" size="small" @click="handlePrint">打印</el-button>
        <el-button :icon="Refresh" size="small" @click="handleRefresh">刷新</el-button>
      </template>
    </es-table>
  </div>
</template>

<script setup>
import { EsTable } from '@es-plus/vue3'
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, Printer, Refresh, Plus, Delete } from '@element-plus/icons-vue'

// 原始数据：刷新 = 从这份「后端快照」重新取一遍，改动（新增）随之回滚
const originData = [
  { id: 1, name: '产品A', category: '电子', price: 299, stock: 100 },
  { id: 2, name: '产品B', category: '家居', price: 159, stock: 50 },
  { id: 3, name: '产品C', category: '电子', price: 499, stock: 30 },
  { id: 4, name: '产品D', category: '服装', price: 89, stock: 200 }
]
const tableData = ref(originData.map((r) => ({ ...r })))
const tableRef = ref(null)

const columns = [
  { type: 'selection', width: 45 },
  { prop: 'id', label: 'ID', width: 60 },
  { prop: 'name', label: '产品名称', minWidth: 150 },
  { prop: 'category', label: '分类', width: 100 },
  { prop: 'price', label: '价格', width: 100, formatter: (row) => `¥${row.price}` },
  { prop: 'stock', label: '库存', width: 100 }
]

// 导出/打印只认有 prop 的列（选择列没有数据字段）
const dataColumns = columns.filter((c) => c.prop)

const handleBatchDelete = () => {
  const rows = tableRef.value?.getSelectionRows?.() || []
  if (!rows.length) {
    ElMessage.warning('请先勾选要删除的行')
    return
  }
  const ids = new Set(rows.map((r) => r.id))
  tableData.value = tableData.value.filter((r) => !ids.has(r.id))
  ElMessage.success(`已删除 ${rows.length} 行`)
}

const tableOptions = {
  border: true,
  stripe: true,
  configBtn: [
    {
      name: '新增', type: 'primary', icon: Plus, code: 2,
      click: () => {
        tableData.value.push({
          id: Math.max(...tableData.value.map((r) => r.id)) + 1,
          name: '产品E', category: '电子', price: 199, stock: 10
        })
        ElMessage.success('已新增一行')
      }
    },
    { name: '批量删除', type: 'danger', icon: Delete, code: 2, click: handleBatchDelete }
  ],
  leftText: '产品列表'
}

// 刷新 = 丢弃本地改动、回到「后端」那一份数据（有 httpRequest 时这里换成 httpRequestInstance()）
const handleRefresh = () => {
  tableData.value = originData.map((r) => ({ ...r }))
  ElMessage.success('已刷新')
}

// 工具栏插槽里的按钮由使用方自己决定行为：
// 默认 el-table 引擎不自带导出/打印（那是 vxe 引擎的 exportConfig/printConfig），
// 这里用最小的浏览器能力补上，保证每个按钮都真的可用。
const handleExport = () => {
  const lines = [
    dataColumns.map(c => c.label).join(','),
    ...tableData.value.map(row => dataColumns.map(c => row[c.prop]).join(','))
  ]
  // \uFEFF：BOM，让 Excel 按 UTF-8 打开中文不乱码
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '产品列表.csv'
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('已导出 CSV')
}

const handlePrint = () => {
  const head = dataColumns.map(c => `<th>${c.label}</th>`).join('')
  const body = tableData.value
    .map(row => `<tr>${dataColumns.map(c => `<td>${row[c.prop]}</td>`).join('')}</tr>`)
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
