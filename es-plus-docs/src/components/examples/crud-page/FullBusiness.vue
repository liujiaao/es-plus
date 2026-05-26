<template>
  <div class="example-crud-full-business">
    <es-crud-page
      ref="crudRef"
      :schema="schema"
      @dialog-confirm="handleDialogConfirm"
      @btn-click="handleBtnClick"
    />
  </div>
</template>

<script setup>
import { EsCrudPage } from 'es-plus'
import { h, ref } from 'vue'
import { ElMessage, ElTag, ElDescriptions, ElDescriptionsItem } from 'element-plus'

const crudRef = ref(null)

const mockUsers = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1,
  name: ['张三', '李四', '王五', '赵六', '孙七', '周八', '吴九', '郑十'][i % 8],
  email: `user${i + 1}@company.com`,
  dept: ['技术部', '产品部', '运营部', '市场部'][i % 4],
  role: ['管理员', '开发者', '编辑', '访客'][i % 4],
  status: i % 5 === 0 ? 'disabled' : 'active',
  createTime: `2024-0${(i % 9) + 1}-${String((i % 28) + 1).padStart(2, '0')}`
}))

const schema = {
  formItems: [
    { prop: 'name', label: '姓名', formtype: 'Input' },
    { prop: 'dept', label: '部门', formtype: 'Select',
      dataOptions: [
        { label: '技术部', value: '技术部' },
        { label: '产品部', value: '产品部' },
        { label: '运营部', value: '运营部' },
        { label: '市场部', value: '市场部' }
      ] },
    { prop: 'status', label: '状态', formtype: 'Select',
      dataOptions: [
        { label: '正常', value: 'active' },
        { label: '禁用', value: 'disabled' }
      ] }
  ],
  columns: [
    { prop: 'name', label: '姓名', width: 80 },
    { prop: 'email', label: '邮箱', minWidth: 160 },
    { prop: 'dept', label: '部门', width: 90 },
    { prop: 'role', label: '角色', width: 80 },
    { prop: 'status', label: '状态', width: 80 },
    { prop: 'createTime', label: '创建日期', width: 120 }
  ],
  tableOptions: {
    border: true,
    apiParams: { url: '/api/mock' },
    httpRequest: async ({ pageIndex, pageSize }) => {
      const start = (pageIndex - 1) * pageSize
      return { data: mockUsers.slice(start, start + pageSize), total: mockUsers.length, pageSize, pageIndex }
    },
    configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' }
  },
  toolbarBtns: [
    { name: '新增用户', type: 'primary', icon: 'Plus', dialogKey: 'add' },
    { name: '批量启用', type: 'success', confirm: '确定批量启用选中用户？', actionType: 'batchEnable' },
    { name: '导出', icon: 'Download', actionType: 'export' }
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
          dataOptions: [
            { label: '技术部', value: '技术部' },
            { label: '产品部', value: '产品部' },
            { label: '运营部', value: '运营部' },
            { label: '市场部', value: '市场部' }
          ] },
        { prop: 'role', label: '角色', formtype: 'Select',
          dataOptions: [
            { label: '管理员', value: '管理员' },
            { label: '开发者', value: '开发者' },
            { label: '编辑', value: '编辑' },
            { label: '访客', value: '访客' }
          ] }
      ]
    },
    edit: {
      title: (row) => `编辑用户 — ${row?.name || ''}`,
      width: '550px',
      formItems: [
        { prop: 'name', label: '姓名', formtype: 'Input' },
        { prop: 'email', label: '邮箱', formtype: 'Input' },
        { prop: 'dept', label: '部门', formtype: 'Select',
          dataOptions: [
            { label: '技术部', value: '技术部' },
            { label: '产品部', value: '产品部' },
            { label: '运营部', value: '运营部' },
            { label: '市场部', value: '市场部' }
          ] },
        { prop: 'role', label: '角色', formtype: 'Select',
          dataOptions: [
            { label: '管理员', value: '管理员' },
            { label: '开发者', value: '开发者' },
            { label: '编辑', value: '编辑' },
            { label: '访客', value: '访客' }
          ] },
        { prop: 'status', label: '状态', formtype: 'Select',
          dataOptions: [
            { label: '正常', value: 'active' },
            { label: '禁用', value: 'disabled' }
          ] }
      ]
    },
    detail: {
      title: (row) => `用户详情 — ${row?.name || ''}`,
      width: '500px',
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

const handleDialogConfirm = (key, data) => {
  ElMessage.success(`[${key}] 保存成功: ${data.name || data.email}`)
}

const handleBtnClick = (key, payload) => {
  if (key === 'delete') ElMessage.success(`已删除用户: ${payload?.name}`)
  if (key === 'export') ElMessage.info('正在导出用户列表...')
  if (key === 'batchEnable') ElMessage.success('批量启用完成')
}
</script>

<style scoped>
.example-crud-full-business { padding: 0; }
</style>
