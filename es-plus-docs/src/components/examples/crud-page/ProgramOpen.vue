<template>
  <div class="example-crud-program-open">
    <div style="margin-bottom: 12px; display: flex; gap: 8px;">
      <el-button type="primary" @click="openAdd">程序化打开「新增」</el-button>
      <el-button @click="openEditRow">程序化打开「编辑」(模拟行)</el-button>
    </div>
    <es-crud-page
      ref="crudRef"
      :schema="schema"
      @dialog-confirm="handleDialogConfirm"
      @dialog-open="handleDialogOpen"
    />
  </div>
</template>

<script setup>
import { EsCrudPage } from 'es-plus'
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

const crudRef = ref(null)

const mockData = [
  { id: 1, name: '项目 A', owner: '张三', progress: 80 },
  { id: 2, name: '项目 B', owner: '李四', progress: 45 },
  { id: 3, name: '项目 C', owner: '王五', progress: 100 },
  { id: 4, name: '项目 D', owner: '赵六', progress: 20 }
]

const schema = {
  formItems: [
    { prop: 'name', label: '项目名', formtype: 'Input' }
  ],
  columns: [
    { prop: 'name', label: '项目名', width: 160 },
    { prop: 'owner', label: '负责人', width: 100 },
    { prop: 'progress', label: '进度(%)', width: 100 }
  ],
  tableOptions: {
    border: true,
    apiParams: { url: '/api/mock' },
    httpRequest: async () => ({ data: mockData, total: mockData.length, pageSize: 10, pageIndex: 1 }),
    configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' }
  },
  toolbarBtns: [
    { name: '新增项目', type: 'primary', icon: 'Plus', dialogKey: 'add' }
  ],
  operationColumn: {
    width: 160,
    btns: [
      { name: '编辑', type: 'primary', dialogKey: 'edit' },
      { name: '删除', type: 'danger', key: 'delete', confirm: '确定删除？' }
    ]
  },
  dialogs: {
    add: {
      title: '新增项目',
      width: '450px',
      formItems: [
        { prop: 'name', label: '项目名', formtype: 'Input',
          formItemOptions: { rules: [{ required: true, message: '请输入项目名' }] } },
        { prop: 'owner', label: '负责人', formtype: 'Input' },
        { prop: 'progress', label: '进度', formtype: 'Input', attrs: { type: 'number', min: 0, max: 100 } }
      ]
    },
    edit: {
      title: (row) => `编辑 — ${row?.name || ''}`,
      width: '450px',
      formItems: [
        { prop: 'name', label: '项目名', formtype: 'Input' },
        { prop: 'owner', label: '负责人', formtype: 'Input' },
        { prop: 'progress', label: '进度', formtype: 'Input', attrs: { type: 'number', min: 0, max: 100 } }
      ]
    }
  }
}

const openAdd = () => {
  crudRef.value?.openDialog('add')
}

const openEditRow = () => {
  crudRef.value?.openDialog('edit', { id: 99, name: '模拟项目', owner: '程序调用', progress: 60 })
}

const handleDialogConfirm = (key, data) => {
  ElMessage.success(`[${key}] 保存: ${data.name}, 进度: ${data.progress}%`)
}

const handleDialogOpen = (key, row) => {
  ElMessage.info(`弹窗打开: ${key}${row ? ` (行: ${row.name})` : ''}`)
}
</script>

<style scoped>
.example-crud-program-open { padding: 0; }
</style>
