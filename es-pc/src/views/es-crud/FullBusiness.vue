<template>
  <div class="example-crud-full-business">
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
import { EsCrudPage } from '@es-plus/adapter-antdv'
import { message } from 'ant-design-vue'

const crudRef = ref(null)

const DEPTS = ['技术部', '产品部', '运营部', '市场部']
const ROLES = ['管理员', '开发者', '编辑', '访客']

const mockUsers = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1,
  name: ['张三', '李四', '王五', '赵六', '孙七', '周八', '吴九', '郑十'][i % 8],
  email: `user${i + 1}@company.com`,
  dept: DEPTS[i % 4],
  role: ROLES[i % 4],
  status: i % 5 === 0 ? 'disabled' : 'active',
  createTime: `2024-0${(i % 9) + 1}-${String((i % 28) + 1).padStart(2, '0')}`
}))

const toOptions = (list) => list.map((v) => ({ label: v, value: v }))
const deptOptions = toOptions(DEPTS)
const roleOptions = toOptions(ROLES)
const statusOptions = [
  { label: '正常', value: 'active' },
  { label: '禁用', value: 'disabled' }
]

const schema = {
  formItems: [
    { prop: 'name', label: '姓名', formtype: 'Input' },
    { prop: 'dept', label: '部门', formtype: 'Select', dataOptions: deptOptions },
    { prop: 'status', label: '状态', formtype: 'Select', dataOptions: statusOptions }
  ],
  columns: [
    { type: 'selection', width: 50 },
    { prop: 'name', label: '姓名', width: 80 },
    { prop: 'email', label: '邮箱', minWidth: 160 },
    { prop: 'dept', label: '部门', width: 90 },
    { prop: 'role', label: '角色', width: 80 },
    { prop: 'status', label: '状态', width: 80,
      formatter: (row) => (row.status === 'active' ? '正常' : '禁用') },
    { prop: 'createTime', label: '创建日期', width: 120 }
  ],
  tableOptions: {
    border: true,
    apiParams: { url: '/api/mock' },
    httpRequest: async ({ pageIndex, pageSize, formParams }) => {
      let filtered = mockUsers
      if (formParams?.name) filtered = filtered.filter((u) => u.name.includes(formParams.name))
      if (formParams?.dept) filtered = filtered.filter((u) => u.dept === formParams.dept)
      if (formParams?.status) {
        // 注意：Select 清空后值是 ''，不能被当成「筛 status === ''」
        filtered = filtered.filter((u) => u.status === formParams.status)
      }
      const start = (pageIndex - 1) * pageSize
      return { data: filtered.slice(start, start + pageSize), total: filtered.length, pageSize, pageIndex }
    },
    configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' }
  },
  toolbarBtns: [
    { name: '新增用户', type: 'primary', icon: 'PlusOutlined', dialogKey: 'add' },
    { name: '批量启用', type: 'primary', confirm: '确定批量启用选中用户？', actionType: 'batchEnable' },
    { name: '导出', icon: 'DownloadOutlined', actionType: 'export' }
  ],
  operationColumn: {
    label: '操作',
    width: 220,
    fixed: 'right',
    btns: [
      { name: '编辑', type: 'primary', dialogKey: 'edit' },
      { name: '详情', dialogKey: 'detail' },
      { name: '删除', type: 'danger', key: 'delete', confirm: '确定删除该用户？删除后不可恢复。' }
    ]
  },
  dialogs: {
    add: {
      title: '新增用户',
      width: '550px',
      formItems: [
        { prop: 'name', label: '姓名', formtype: 'Input',
          formItemOptions: { rules: [{ required: true, message: '请输入姓名' }] } },
        { prop: 'email', label: '邮箱', formtype: 'Input',
          formItemOptions: { rules: [{ required: true, message: '请输入邮箱' }] } },
        { prop: 'dept', label: '部门', formtype: 'Select',
          formItemOptions: { rules: [{ required: true, message: '请选择部门' }] },
          dataOptions: deptOptions },
        { prop: 'role', label: '角色', formtype: 'Select', dataOptions: roleOptions }
      ]
    },
    edit: {
      // 函数式标题：拿到当前行，标题跟着数据走
      title: (row) => `编辑用户 — ${row?.name || ''}`,
      width: '550px',
      formItems: [
        { prop: 'name', label: '姓名', formtype: 'Input' },
        { prop: 'email', label: '邮箱', formtype: 'Input' },
        { prop: 'dept', label: '部门', formtype: 'Select', dataOptions: deptOptions },
        { prop: 'role', label: '角色', formtype: 'Select', dataOptions: roleOptions },
        { prop: 'status', label: '状态', formtype: 'Select', dataOptions: statusOptions }
      ]
    },
    detail: {
      title: (row) => `用户详情 — ${row?.name || ''}`,
      width: '500px',
      // 只读详情：render 完全接管内容，且不需要底部按钮
      isHiddenFooter: true,
      render: (h, { row }) => {
        return h('div', { style: 'padding: 10px 0;' }, [
          h('div', { style: 'display: grid; grid-template-columns: 80px 1fr; gap: 12px 16px; font-size: 14px;' }, [
            h('span', { style: 'color: #909399;' }, 'ID'),
            h('span', null, String(row.id)),
            h('span', { style: 'color: #909399;' }, '姓名'),
            h('span', null, row.name),
            h('span', { style: 'color: #909399;' }, '邮箱'),
            h('span', null, row.email),
            h('span', { style: 'color: #909399;' }, '部门'),
            h('span', null, row.dept),
            h('span', { style: 'color: #909399;' }, '角色'),
            h('span', null, row.role),
            h('span', { style: 'color: #909399;' }, '状态'),
            h('span', { style: row.status === 'active' ? 'color: #67c23a;' : 'color: #f56c6c;' },
              row.status === 'active' ? '正常' : '禁用'),
            h('span', { style: 'color: #909399;' }, '创建日期'),
            h('span', null, row.createTime)
          ])
        ])
      }
    }
  }
}

// 编辑弹窗的表单不含 id，靠打开弹窗的那一行定位
let editingRow = null
const handleDialogOpen = (key, row) => {
  if (key === 'edit') editingRow = row || null
}

const handleDialogConfirm = (key, data) => {
  if (key === 'add') {
    mockUsers.unshift({
      id: mockUsers.reduce((max, u) => Math.max(max, u.id), 0) + 1,
      name: data.name,
      email: data.email,
      dept: data.dept,
      role: data.role || '访客',
      status: 'active',
      createTime: new Date().toISOString().slice(0, 10)
    })
    message.success(`已新增用户: ${data.name}`)
  }
  if (key === 'edit' && editingRow) {
    Object.assign(editingRow, data)
    message.success(`已保存用户: ${data.name}`)
  }
  crudRef.value?.refresh?.()
}

const handleBtnClick = (key, payload) => {
  if (key === 'delete') {
    const index = mockUsers.findIndex((u) => u.id === payload?.id)
    if (index > -1) mockUsers.splice(index, 1)
    crudRef.value?.refresh?.()
    message.success(`已删除用户: ${payload?.name}`)
  }
  if (key === 'batchEnable') {
    const selected = crudRef.value?.getSelectedRows?.() ?? []
    if (!selected.length) return message.warning('请先勾选要启用的用户')
    selected.forEach((u) => { u.status = 'active' })
    crudRef.value?.refresh?.()
    message.success(`已启用 ${selected.length} 个用户`)
  }
  if (key === 'export') {
    const header = ['ID', '姓名', '邮箱', '部门', '角色', '状态', '创建日期']
    const rows = mockUsers.map((u) => [
      u.id, u.name, u.email, u.dept, u.role, u.status === 'active' ? '正常' : '禁用', u.createTime
    ])
    const csv = '\uFEFF' + [header, ...rows].map((cols) => cols.join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = '用户列表.csv'
    a.click()
    URL.revokeObjectURL(url)
    message.success(`已导出 ${mockUsers.length} 个用户`)
  }
}
</script>

<style scoped>
.example-crud-full-business { padding: 0; }
</style>
