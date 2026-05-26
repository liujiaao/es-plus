<template>
  <div class="example-crud-dynamic-title">
    <es-crud-page
      :schema="schema"
      @dialog-confirm="handleDialogConfirm"
    />
  </div>
</template>

<script setup>
import { EsCrudPage } from 'es-plus'
import { ElMessage } from 'element-plus'

const mockData = [
  { id: 1, name: '张三', age: 28, email: 'zhangsan@example.com', role: '前端工程师' },
  { id: 2, name: '李四', age: 32, email: 'lisi@example.com', role: '后端工程师' },
  { id: 3, name: '王五', age: 25, email: 'wangwu@example.com', role: '产品经理' },
  { id: 4, name: '赵六', age: 30, email: 'zhaoliu@example.com', role: '测试工程师' },
  { id: 5, name: '孙七', age: 27, email: 'sunqi@example.com', role: 'UI 设计师' }
]

const schema = {
  formItems: [
    { prop: 'name', label: '姓名', formtype: 'Input' }
  ],
  columns: [
    { prop: 'name', label: '姓名', width: 100 },
    { prop: 'age', label: '年龄', width: 80 },
    { prop: 'email', label: '邮箱', width: 200 },
    { prop: 'role', label: '职位' }
  ],
  tableOptions: {
    border: true,
    apiParams: { url: '/api/mock' },
    httpRequest: async () => ({ data: mockData, total: mockData.length, pageSize: 10, pageIndex: 1 }),
    configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' }
  },
  toolbarBtns: [
    { name: '新增', type: 'primary', icon: 'Plus', dialogKey: 'add' }
  ],
  operationColumn: {
    width: 160,
    btns: [
      { name: '编辑', type: 'primary', dialogKey: 'edit' },
      { name: '查看', dialogKey: 'view' }
    ]
  },
  dialogs: {
    add: {
      title: '新增成员',
      width: '500px',
      formItems: [
        { prop: 'name', label: '姓名', formtype: 'Input',
          formItemOptions: { rules: [{ required: true, message: '请输入姓名' }] } },
        { prop: 'age', label: '年龄', formtype: 'Input', attrs: { type: 'number' } },
        { prop: 'email', label: '邮箱', formtype: 'Input' },
        { prop: 'role', label: '职位', formtype: 'Select',
          dataOptions: [
            { label: '前端工程师', value: '前端工程师' },
            { label: '后端工程师', value: '后端工程师' },
            { label: '产品经理', value: '产品经理' },
            { label: '测试工程师', value: '测试工程师' },
            { label: 'UI 设计师', value: 'UI 设计师' }
          ] }
      ]
    },
    edit: {
      title: (row) => `编辑 — ${row?.name || ''}`,
      width: '500px',
      formItems: [
        { prop: 'name', label: '姓名', formtype: 'Input' },
        { prop: 'age', label: '年龄', formtype: 'Input', attrs: { type: 'number' } },
        { prop: 'email', label: '邮箱', formtype: 'Input' },
        { prop: 'role', label: '职位', formtype: 'Select',
          dataOptions: [
            { label: '前端工程师', value: '前端工程师' },
            { label: '后端工程师', value: '后端工程师' },
            { label: '产品经理', value: '产品经理' },
            { label: '测试工程师', value: '测试工程师' },
            { label: 'UI 设计师', value: 'UI 设计师' }
          ] }
      ]
    },
    view: {
      title: (row) => `${row?.name} 的详细信息`,
      width: '400px',
      isHiddenFooter: true,
      formItems: [
        { prop: 'name', label: '姓名', formtype: 'Input', attrs: { disabled: true } },
        { prop: 'age', label: '年龄', formtype: 'Input', attrs: { disabled: true } },
        { prop: 'email', label: '邮箱', formtype: 'Input', attrs: { disabled: true } },
        { prop: 'role', label: '职位', formtype: 'Input', attrs: { disabled: true } }
      ]
    }
  }
}

const handleDialogConfirm = (dialogKey, data) => {
  ElMessage.success(`[${dialogKey}] 保存: ${data.name}`)
}
</script>

<style scoped>
.example-crud-dynamic-title { padding: 0; }
</style>
