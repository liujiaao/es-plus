<template>
  <div class="example-edit-table">
    <div class="toolbar">
      <el-button type="primary" @click="saveAll">保存全部</el-button>
      <el-button @click="cancelAll">取消编辑</el-button>
    </div>
    <es-table
      :data-source="tableData"
      :columns="columns"
      :options="{ border: true, stripe: true }"
      @cell-click="handleCellClick"
    />
  </div>
</template>

<script setup>
import { ref, h } from 'vue'
import { ElMessage, ElInput, ElSelect, ElOption, ElButton } from 'element-plus'
import EsTable from 'es-plus/components/es-table'

const rawData = [
  { id: 1, name: '张三', age: 28, department: 'tech', editing: false },
  { id: 2, name: '李四', age: 32, department: 'product', editing: false },
  { id: 3, name: '王五', age: 24, department: 'design', editing: false }
]
const tableData = ref(rawData.map(item => ({ ...item })))
const originalData = JSON.parse(JSON.stringify(tableData.value))

const deptOptions = [
  { label: '技术部', value: 'tech' },
  { label: '产品部', value: 'product' },
  { label: '设计部', value: 'design' },
  { label: '市场部', value: 'marketing' }
]

const columns = [
  { prop: 'id', label: 'ID', width: 60 },
  {
    prop: 'name',
    label: '姓名',
    render: (_, { row }) => {
      if (row.editing) {
        return h(ElInput, {
          modelValue: row.name,
          'onUpdate:modelValue': (val) => row.name = val,
          size: 'small'
        })
      }
      return row.name
    }
  },
  {
    prop: 'age',
    label: '年龄',
    width: 120,
    render: (_, { row }) => {
      if (row.editing) {
        return h(ElInput, {
          modelValue: row.age,
          'onUpdate:modelValue': (val) => row.age = val,
          size: 'small',
          type: 'number'
        })
      }
      return row.age
    }
  },
  {
    prop: 'department',
    label: '部门',
    render: (_, { row }) => {
      if (row.editing) {
        return h(ElSelect, {
          modelValue: row.department,
          'onUpdate:modelValue': (val) => row.department = val,
          size: 'small',
          style: 'width: 120px'
        }, () => deptOptions.map(opt => h(ElOption, { label: opt.label, value: opt.value })))
      }
      const dept = deptOptions.find(d => d.value === row.department)
      return dept?.label || row.department
    }
  },
  {
    prop: 'action',
    label: '操作',
    width: 120,
    render: (_, { row }) => h('div', [
      h(ElButton, {
        link: true,
        type: 'primary',
        size: 'small',
        onClick: () => toggleEdit(row)
      }, row.editing ? '保存' : '编辑')
    ])
  }
]

const toggleEdit = (row) => {
  if (row.editing) {
    ElMessage.success(`已保存: ${row.name}`)
  }
  row.editing = !row.editing
}

const handleCellClick = (row, column, cell, event) => {
  if (column.label === '操作') return
  event.stopPropagation()
  if (!row.editing) {
    row.editing = true
  }
}

const saveAll = () => {
  tableData.value.forEach(row => row.editing = false)
  ElMessage.success('全部保存成功')
}

const cancelAll = () => {
  tableData.value = JSON.parse(JSON.stringify(originalData))
  ElMessage.info('已取消编辑')
}
</script>

<style scoped>
.example-edit-table {
  padding: 0;
}
.toolbar {
  margin-bottom: 16px;
  display: flex;
  gap: 12px;
}
</style>
