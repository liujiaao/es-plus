<template>
  <div class="example-crud-basic">
    <es-crud-page
      :schema="schema"
      @btn-click="handleBtnClick"
      @delete="handleDelete"
    />
  </div>
</template>

<script setup>
import { EsCrudPage } from 'es-plus'
import { ElMessage } from 'element-plus'

const schema = {
  formItems: [
    { prop: 'name', label: '姓名', formtype: 'Input' },
    { prop: 'status', label: '状态', formtype: 'Select',
      dataOptions: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] }
  ],
  columns: [
    { prop: 'name', label: '姓名', width: 120 },
    { prop: 'phone', label: '手机号', width: 140 },
    { prop: 'status', label: '状态', width: 100 },
    { prop: 'createTime', label: '创建时间' }
  ],
  tableOptions: {
    border: true,
    apiParams: { url: '/api/mock' },
    httpRequest: async ({ pageIndex, pageSize, formParams }) => {
      const allData = Array.from({ length: 46 }, (_, i) => ({
        id: i + 1,
        name: ['张三', '李四', '王五', '赵六', '孙七'][i % 5],
        phone: `138${String(i).padStart(8, '0')}`,
        status: i % 3 === 0 ? 0 : 1,
        createTime: `2024-0${(i % 9) + 1}-${String((i % 28) + 1).padStart(2, '0')}`
      }))
      let filtered = allData
      if (formParams?.name) filtered = filtered.filter(d => d.name.includes(formParams.name))
      if (formParams?.status !== '' && formParams?.status !== undefined) {
        filtered = filtered.filter(d => d.status === formParams.status)
      }
      const start = (pageIndex - 1) * pageSize
      return { data: filtered.slice(start, start + pageSize), total: filtered.length, pageSize, pageIndex }
    },
    configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' }
  },
  dialogFormItems: [
    { prop: 'name', label: '姓名', formtype: 'Input',
      formItemOptions: { rules: [{ required: true, message: '请输入姓名' }] } },
    { prop: 'phone', label: '手机号', formtype: 'Input' },
    { prop: 'status', label: '状态', formtype: 'Select',
      dataOptions: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] }
  ],
  actions: ['add', 'edit', 'delete']
}

const handleBtnClick = (key, data) => {
  if (key === 'add-confirm') ElMessage.success(`新增: ${JSON.stringify(data)}`)
  if (key === 'edit-confirm') ElMessage.success(`编辑: ${JSON.stringify(data)}`)
}

const handleDelete = (row) => {
  ElMessage.warning(`删除: ${row.name}`)
}
</script>

<style scoped>
.example-crud-basic { padding: 0; }
</style>
