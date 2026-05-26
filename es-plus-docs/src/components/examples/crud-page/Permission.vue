<template>
  <div class="example-crud-permission">
    <div style="margin-bottom: 12px; padding: 8px 12px; background: #f5f7fa; border-radius: 4px;">
      <span style="margin-right: 12px; font-size: 13px; color: #606266;">当前角色：</span>
      <el-radio-group v-model="currentRole" size="small" @change="handleRoleChange">
        <el-radio-button value="admin">管理员</el-radio-button>
        <el-radio-button value="editor">编辑员</el-radio-button>
        <el-radio-button value="viewer">访客</el-radio-button>
      </el-radio-group>
      <span style="margin-left: 12px; font-size: 12px; color: #909399;">
        权限: {{ rolePermissions[currentRole].join(', ') }}
      </span>
    </div>
    <es-crud-page :key="currentRole" :schema="schema" @dialog-confirm="handleConfirm" @btn-click="handleBtn" />
  </div>
</template>

<script setup>
import { EsCrudPage, configureEsPlus } from 'es-plus'
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

const currentRole = ref('admin')

const rolePermissions = {
  admin: ['user:add', 'user:edit', 'user:delete', 'user:export'],
  editor: ['user:edit'],
  viewer: []
}

const applyPermission = (role) => {
  configureEsPlus({
    permission: (value) => rolePermissions[role].includes(value)
  })
}
applyPermission('admin')

const handleRoleChange = (role) => {
  applyPermission(role)
}

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
    httpRequest: async () => ({ data: mockData, total: 3, pageSize: 10, pageIndex: 1 }),
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

const handleConfirm = (key, data) => ElMessage.success(`[${key}] ${data.name}`)
const handleBtn = (key) => ElMessage.info(`按钮: ${key}`)
</script>

<style scoped>
.example-crud-permission { padding: 0; }
</style>
