<template>
  <div class="example-crud-multi-dialog">
    <es-crud-page
      ref="crudRef"
      :schema="schema"
      @dialog-open="handleDialogOpen"
      @dialog-confirm="handleDialogConfirm"
      @btn-click="handleBtnClick"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { EsCrudPage } from '@es-plus/vue3'
import { ElMessage } from 'element-plus'

const crudRef = ref(null)

const DEPTS = ['技术部', '产品部', '运营部']

const mockData = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1,
  name: ['张三', '李四', '王五', '赵六', '孙七'][i % 5],
  phone: `139${String(i).padStart(8, '0')}`,
  dept: DEPTS[i % 3],
  status: i % 4 === 0 ? 0 : 1
}))

const deptOptions = DEPTS.map((d) => ({ label: d, value: d }))

const schema = {
  formItems: [
    { prop: 'name', label: '姓名', formtype: 'Input' },
    { prop: 'dept', label: '部门', formtype: 'Select', dataOptions: deptOptions }
  ],
  columns: [
    // 分配部门是批量操作，靠勾选框驱动
    { type: 'selection', width: 50 },
    { prop: 'name', label: '姓名', width: 100 },
    { prop: 'phone', label: '手机号', width: 140 },
    { prop: 'dept', label: '部门', width: 100 },
    { prop: 'status', label: '状态', width: 80,
      formatter: (row) => (row.status === 1 ? '在职' : '离职') }
  ],
  tableOptions: {
    border: true,
    apiParams: { url: '/api/mock' },
    httpRequest: async ({ pageIndex, pageSize }) => {
      const start = (pageIndex - 1) * pageSize
      return { data: mockData.slice(start, start + pageSize), total: mockData.length, pageSize, pageIndex }
    },
    configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' }
  },
  toolbarBtns: [
    { name: '新增', type: 'primary', icon: 'Plus', dialogKey: 'add' },
    { name: '分配部门', icon: 'Setting', dialogKey: 'assign' },
    { name: '导出', icon: 'Download', actionType: 'export' }
  ],
  operationColumn: {
    label: '操作',
    width: 200,
    fixed: 'right',
    btns: [
      { name: '编辑', type: 'primary', dialogKey: 'edit' },
      { name: '删除', type: 'danger', key: 'delete', confirm: '确定删除吗？' }
    ]
  },
  dialogs: {
    add: {
      title: '新增员工',
      width: '500px',
      formItems: [
        { prop: 'name', label: '姓名', formtype: 'Input',
          formItemOptions: { rules: [{ required: true, message: '请输入姓名' }] } },
        { prop: 'phone', label: '手机号', formtype: 'Input' },
        { prop: 'dept', label: '部门', formtype: 'Select', dataOptions: deptOptions }
      ]
    },
    edit: {
      title: '编辑员工',
      width: '500px',
      formItems: [
        { prop: 'name', label: '姓名', formtype: 'Input' },
        { prop: 'phone', label: '手机号', formtype: 'Input' },
        { prop: 'dept', label: '部门', formtype: 'Select', dataOptions: deptOptions }
      ]
    },
    assign: {
      title: '批量分配部门',
      width: '400px',
      formItems: [
        { prop: 'targetDept', label: '目标部门', formtype: 'Select',
          formItemOptions: { rules: [{ required: true, message: '请选择部门' }] },
          dataOptions: deptOptions }
      ]
    }
  }
}

// 编辑弹窗的表单不含 id，靠打开弹窗的那一行定位
let editingRow = null
const handleDialogOpen = (key, row) => {
  if (key === 'edit') editingRow = row || null
}

const handleDialogConfirm = (dialogKey, data) => {
  if (dialogKey === 'add') {
    mockData.unshift({
      id: mockData.reduce((max, r) => Math.max(max, r.id), 0) + 1,
      name: data.name || '-',
      phone: data.phone || '-',
      dept: data.dept || DEPTS[0],
      status: 1
    })
    ElMessage.success(`已新增: ${data.name}`)
  }
  if (dialogKey === 'edit' && editingRow) {
    Object.assign(editingRow, data)
    ElMessage.success(`已保存: ${data.name}`)
  }
  if (dialogKey === 'assign') {
    const selected = crudRef.value?.getSelectedRows?.() ?? []
    if (!selected.length) return ElMessage.warning('请先勾选要分配的员工')
    selected.forEach((row) => { row.dept = data.targetDept })
    ElMessage.success(`已将 ${selected.length} 人调整到 ${data.targetDept}`)
  }
  crudRef.value?.refresh?.()
}

const handleBtnClick = (key, payload) => {
  if (key === 'export') {
    const header = ['姓名', '手机号', '部门', '状态']
    const rows = mockData.map((r) => [r.name, r.phone, r.dept, r.status === 1 ? '在职' : '离职'])
    const csv = '\uFEFF' + [header, ...rows].map((cols) => cols.join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = '员工列表.csv'
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success(`已导出 ${mockData.length} 条`)
  }
  if (key === 'delete') {
    const index = mockData.findIndex((r) => r.id === payload?.id)
    if (index > -1) mockData.splice(index, 1)
    crudRef.value?.refresh?.()
    ElMessage.warning(`已删除: ${payload?.name}`)
  }
}
</script>

<style scoped>
.example-crud-multi-dialog { padding: 0; }
</style>
