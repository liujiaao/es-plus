<template>
  <div class="crud-page-demo">
    <h4 style="margin-bottom: 12px; color: #606266;">EsCrudPage — 一个 schema 配置渲染完整 CRUD 页面</h4>
    <es-crud-page
      ref="crudRef"
      :schema="pageSchema"
      :http-request="fetchData"
      @add="handleAdd"
      @edit="handleEdit"
      @delete="handleDelete"
      @btn-click="handleBtnClick"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { EsCrudPage } from 'es-plus'
import { ElMessage, ElMessageBox } from 'element-plus'

const crudRef = ref(null)

const pageSchema = {
  formItems: [
    { prop: 'name', label: '姓名', formtype: 'Input', span: 6 },
    { prop: 'status', label: '状态', formtype: 'Select', span: 6, dataOptions: [
      { label: '启用', value: 1 },
      { label: '禁用', value: 0 }
    ]},
    { prop: 'date', label: '日期', formtype: 'datePicker', span: 8, attrs: { type: 'daterange', valueFormat: 'YYYY-MM-DD' } }
  ],
  columns: [
    { prop: 'id', label: 'ID', width: 60 },
    { prop: 'name', label: '姓名' },
    { prop: 'phone', label: '手机号' },
    { prop: 'email', label: '邮箱' },
    { prop: 'status', label: '状态', width: 80 },
    { prop: 'createTime', label: '创建时间', width: 160 }
  ],
  tableOptions: {
    border: true,
    multiSelect: true,
    configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' },
    rowkey: 'id'
  },
  dialogFormItems: [
    { prop: 'name', label: '姓名', formtype: 'Input', span: 24 },
    { prop: 'phone', label: '手机号', formtype: 'Input', span: 24 },
    { prop: 'email', label: '邮箱', formtype: 'Input', span: 24 },
    { prop: 'status', label: '状态', formtype: 'Switch', span: 24 }
  ],
  actions: ['add', 'edit', 'delete'],
  pagination: { pageSize: 5 }
}

const mockData = [
  { id: 1, name: '张三', phone: '13800138001', email: 'zhang@test.com', status: 1, createTime: '2024-01-15 09:30' },
  { id: 2, name: '李四', phone: '13800138002', email: 'li@test.com', status: 1, createTime: '2024-02-20 14:20' },
  { id: 3, name: '王五', phone: '13800138003', email: 'wang@test.com', status: 0, createTime: '2024-03-10 11:00' },
  { id: 4, name: '赵六', phone: '13800138004', email: 'zhao@test.com', status: 1, createTime: '2024-04-05 16:45' },
  { id: 5, name: '钱七', phone: '13800138005', email: 'qian@test.com', status: 0, createTime: '2024-05-12 08:15' },
  { id: 6, name: '孙八', phone: '13800138006', email: 'sun@test.com', status: 1, createTime: '2024-06-18 10:30' },
]

async function fetchData(params) {
  await new Promise(resolve => setTimeout(resolve, 300))
  const { formParams = {}, pageIndex = 1, pageSize = 5 } = params || {}
  let filtered = [...mockData]
  if (formParams.name) {
    filtered = filtered.filter(item => item.name.includes(formParams.name))
  }
  if (formParams.status !== '' && formParams.status !== undefined) {
    filtered = filtered.filter(item => item.status === formParams.status)
  }
  const start = (pageIndex - 1) * pageSize
  return {
    data: filtered.slice(start, start + pageSize),
    total: filtered.length,
    pageIndex,
    pageSize
  }
}

function handleAdd() {
  console.log('新增事件触发')
}

function handleEdit(row) {
  console.log('编辑行：', row)
}

function handleDelete(row) {
  ElMessageBox.confirm(`确定删除 ${row.name}？`, '提示', { type: 'warning' })
    .then(() => {
      ElMessage.success('删除成功')
      crudRef.value?.refresh()
    })
    .catch(() => {})
}

function handleBtnClick(key, data) {
  if (key === 'add-confirm') {
    ElMessage.success('新增成功：' + JSON.stringify(data))
    crudRef.value?.refresh()
  }
  if (key === 'edit-confirm') {
    ElMessage.success('编辑成功：' + JSON.stringify(data))
    crudRef.value?.refresh()
  }
}
</script>

<style scoped>
.crud-page-demo {
  padding: 0;
}
</style>
