<template>
  <div class="example-crud-permission">
    <div style="margin-bottom: 12px; padding: 8px 12px; background: var(--es-fill); border-radius: 4px;">
      <span style="margin-right: 12px; font-size: 13px; color: var(--es-text-regular);">当前角色：</span>
      <el-radio-group v-model="currentRole" size="small" @change="handleRoleChange">
        <el-radio-button value="admin">管理员</el-radio-button>
        <el-radio-button value="editor">编辑员</el-radio-button>
        <el-radio-button value="viewer">访客</el-radio-button>
      </el-radio-group>
      <span style="margin-left: 12px; font-size: 12px; color: var(--es-text-secondary);">
        权限: {{ rolePermissions[currentRole].join(', ') }}
      </span>
    </div>
    <es-crud-page
      :key="currentRole"
      ref="crudRef"
      :schema="schema"
      @dialog-open="handleDialogOpen"
      @dialog-confirm="handleConfirm"
      @btn-click="handleBtn"
    />
  </div>
</template>

<script setup>
import { EsCrudPage, configureEsPlus } from '@es-plus/vue3'
import { ref, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'

const currentRole = ref('admin')
const crudRef = ref(null)

// 编辑弹窗的表单不含 id，靠打开弹窗的那一行定位
let editingRow = null
const handleDialogOpen = (key, row) => {
  if (key === 'edit') editingRow = row || null
}

const rolePermissions = {
  admin: ['user:add', 'user:edit', 'user:delete', 'user:export'],
  editor: ['user:edit'],
  viewer: []
}

const applyPermission = (role) => {
  // 写入模块级单例：组件内部 inject('$EsPlus') 拿到的是「读时回落」视图，
  // 因此这里改完，已挂载的表格/按钮在下一次渲染时就能读到新判定函数。
  configureEsPlus({
    permission: (value) => rolePermissions[role].includes(value)
  })
}
applyPermission('admin')

const handleRoleChange = (role) => {
  applyPermission(role)
}

// 离开示例时恢复「全部放行」，避免权限状态泄漏给其它示例页
onUnmounted(() => configureEsPlus({ permission: () => true }))

const mockData = [
  { id: 1, name: '张三', dept: '技术部', level: '高级' },
  { id: 2, name: '李四', dept: '产品部', level: '中级' },
  { id: 3, name: '王五', dept: '运营部', level: '初级' }
]

const schema = {
  formItems: [
    { prop: 'name', label: '姓名', formtype: 'Input' }
  ],
  columns: [
    { prop: 'name', label: '姓名', width: 100 },
    { prop: 'dept', label: '部门', width: 100 },
    { prop: 'level', label: '级别' }
  ],
  tableOptions: {
    border: true,
    apiParams: { url: '/api/mock' },
    httpRequest: async () => ({ data: mockData, total: mockData.length, pageSize: 10, pageIndex: 1 }),
    configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' }
  },
  toolbarBtns: [
    { name: '新增', type: 'primary', icon: 'Plus', dialogKey: 'add', permissionValue: 'user:add' },
    { name: '导出', icon: 'Download', actionType: 'export', permissionValue: 'user:export' }
  ],
  operationColumn: {
    width: 200,
    btns: [
      { name: '编辑', type: 'primary', dialogKey: 'edit', permissionValue: 'user:edit' },
      { name: '删除', type: 'danger', key: 'delete', confirm: '确定删除？', permissionValue: 'user:delete' }
    ]
  },
  dialogs: {
    add: {
      title: '新增人员',
      width: '400px',
      formItems: [
        { prop: 'name', label: '姓名', formtype: 'Input',
          formItemOptions: { rules: [{ required: true, message: '请输入' }] } },
        { prop: 'dept', label: '部门', formtype: 'Input' }
      ]
    },
    edit: {
      title: '编辑人员',
      width: '400px',
      formItems: [
        { prop: 'name', label: '姓名', formtype: 'Input' },
        { prop: 'dept', label: '部门', formtype: 'Input' }
      ]
    }
  }
}

const handleConfirm = (key, data) => {
  if (key === 'add') {
    mockData.unshift({
      id: mockData.reduce((max, r) => Math.max(max, r.id), 0) + 1,
      name: data.name || '-',
      dept: data.dept || '-',
      level: '初级'
    })
  } else if (key === 'edit' && editingRow) {
    Object.assign(editingRow, data)
  }
  crudRef.value?.refresh?.()
  ElMessage.success(key === 'add' ? `已新增 ${data.name}` : `已保存 ${data.name}`)
}

const handleBtn = (key, row) => {
  if (key === 'delete') {
    const index = mockData.findIndex((r) => r.id === row?.id)
    if (index > -1) mockData.splice(index, 1)
    crudRef.value?.refresh?.()
    ElMessage.success(`已删除: ${row?.name}`)
    return
  }
  // actionType:'export' 的工具栏按钮会同时 emit 'export' 与 btn-click('export', queryModel)，
  // 这里接住后者把当前数据集真正导成 CSV（无后端也能核对导出内容）
  if (key === 'export') {
    const header = ['id', 'name', 'dept', 'level']
    const lines = [header.join(','), ...mockData.map((r) => header.map((k) => r[k]).join(','))]
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '人员列表.csv'
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success(`已导出 ${mockData.length} 条`)
  }
}
</script>

<style scoped>
.example-crud-permission { padding: 0; }
</style>
