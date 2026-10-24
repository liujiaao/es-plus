<template>
  <div class="example-crud-basic">
    <es-crud-page
      ref="crudRef"
      :schema="schema"
      @dialog-open="handleDialogOpen"
      @btn-click="handleBtnClick"
      @delete="handleDelete"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { EsCrudPage } from '@es-plus/adapter-antdv'
import { message } from 'ant-design-vue'

const crudRef = ref(null)

// 本地数据源：模拟后端存储。httpRequest 每次从这个数组取，增删改才真的能看见
const allData = Array.from({ length: 46 }, (_, i) => ({
  id: i + 1,
  name: ['张三', '李四', '王五', '赵六', '孙七'][i % 5],
  phone: `138${String(i).padStart(8, '0')}`,
  status: i % 3 === 0 ? 0 : 1,
  createTime: `2024-0${(i % 9) + 1}-${String((i % 28) + 1).padStart(2, '0')}`
}))

const schema = {
  formItems: [
    { prop: 'name', label: '姓名', formtype: 'Input' },
    { prop: 'status', label: '状态', formtype: 'Select',
      dataOptions: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] }
  ],
  columns: [
    { prop: 'name', label: '姓名', width: 120 },
    { prop: 'phone', label: '手机号', width: 140 },
    { prop: 'status', label: '状态', width: 100,
      formatter: (row) => (row.status === 1 ? '启用' : '禁用') },
    { prop: 'createTime', label: '创建时间' }
  ],
  tableOptions: {
    border: true,
    apiParams: { url: '/api/mock' },
    httpRequest: async ({ pageIndex, pageSize, formParams }) => {
      let filtered = allData
      if (formParams?.name) filtered = filtered.filter((d) => d.name.includes(formParams.name))
      if (formParams?.status !== '' && formParams?.status !== undefined) {
        filtered = filtered.filter((d) => d.status === formParams.status)
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
  // actions 模式：工具栏/操作列/弹窗都由这一行推导，不需要手写按钮面
  actions: ['add', 'edit', 'delete']
}

// 弹窗表单只包含 dialogFormItems 的字段（没有 id），编辑时靠打开弹窗的那一行定位
let editingRow = null
const handleDialogOpen = (key, row) => {
  if (key === 'edit') editingRow = row || null
}

// actions 模式下：add-confirm / edit-confirm 由组件在表单校验通过后发出，随后自动关闭并刷新
const handleBtnClick = (key, data) => {
  if (key === 'add-confirm') {
    allData.unshift({
      id: Math.max(0, ...allData.map((d) => d.id)) + 1,
      ...data,
      createTime: new Date().toISOString().slice(0, 10)
    })
    message.success(`已新增: ${data.name}`)
  }
  if (key === 'edit-confirm' && editingRow) {
    Object.assign(editingRow, data)
    message.success(`已保存: ${data.name}`)
  }
}

// 删除由组件先做二次确认；刷新要自己发起
const handleDelete = (row) => {
  const index = allData.findIndex((d) => d.id === row.id)
  if (index > -1) allData.splice(index, 1)
  crudRef.value?.refresh?.()
  message.warning(`已删除: ${row.name}`)
}
</script>

<style scoped>
.example-crud-basic { padding: 0; }
</style>
