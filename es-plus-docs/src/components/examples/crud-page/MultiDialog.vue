<template>
  <div class="example-crud-multi-dialog">
    <es-crud-page
      :schema="schema"
      @dialog-confirm="handleDialogConfirm"
      @btn-click="handleBtnClick"
    />
  </div>
</template>

<script setup>
import { EsCrudPage } from 'es-plus'
import { ElMessage } from 'element-plus'

const mockData = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1,
  name: ['张三', '李四', '王五', '赵六', '孙七'][i % 5],
  phone: `139${String(i).padStart(8, '0')}`,
  dept: ['技术部', '产品部', '运营部'][i % 3],
  status: i % 4 === 0 ? 0 : 1
}))

const schema = {
  formItems: [
    { prop: 'name', label: '姓名', formtype: 'Input' },
    { prop: 'dept', label: '部门', formtype: 'Select',
      dataOptions: [
        { label: '技术部', value: '技术部' },
        { label: '产品部', value: '产品部' },
        { label: '运营部', value: '运营部' }
      ] }
  ],
  columns: [
    { prop: 'name', label: '姓名', width: 100 },
    { prop: 'phone', label: '手机号', width: 140 },
    { prop: 'dept', label: '部门', width: 100 },
    { prop: 'status', label: '状态', width: 80 }
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
        { prop: 'dept', label: '部门', formtype: 'Select',
          dataOptions: [
            { label: '技术部', value: '技术部' },
            { label: '产品部', value: '产品部' },
            { label: '运营部', value: '运营部' }
          ] }
      ]
    },
    edit: {
      title: '编辑员工',
      width: '500px',
      formItems: [
        { prop: 'name', label: '姓名', formtype: 'Input' },
        { prop: 'phone', label: '手机号', formtype: 'Input' },
        { prop: 'dept', label: '部门', formtype: 'Select',
          dataOptions: [
            { label: '技术部', value: '技术部' },
            { label: '产品部', value: '产品部' },
            { label: '运营部', value: '运营部' }
          ] }
      ]
    },
    assign: {
      title: '批量分配部门',
      width: '400px',
      formItems: [
        { prop: 'targetDept', label: '目标部门', formtype: 'Select',
          formItemOptions: { rules: [{ required: true, message: '请选择部门' }] },
          dataOptions: [
            { label: '技术部', value: '技术部' },
            { label: '产品部', value: '产品部' },
            { label: '运营部', value: '运营部' }
          ] }
      ]
    }
  }
}

const handleDialogConfirm = (dialogKey, data) => {
  ElMessage.success(`[${dialogKey}] 确认: ${JSON.stringify(data)}`)
}

const handleBtnClick = (key, payload) => {
  if (key === 'export') ElMessage.info('导出当前查询结果')
  if (key === 'delete') ElMessage.warning(`删除 ID: ${payload?.id}`)
}
</script>

<style scoped>
.example-crud-multi-dialog { padding: 0; }
</style>
