<template>
  <div class="example-edit-table">
    <div class="toolbar">
      <a-button type="primary" @click="saveAll">保存全部</a-button>
      <a-button @click="cancelAll">取消编辑</a-button>
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
import { EsTable } from '@es-plus/adapter-antdv'
import { ref, h } from 'vue'
import { Input, Select, Button, message } from 'ant-design-vue'

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
        return h(Input, {
          value: row.name,
          'onUpdate:value': (val) => row.name = val,
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
        return h(Input, {
          value: row.age,
          'onUpdate:value': (val) => row.age = val,
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
        return h(Select, {
          value: row.department,
          'onUpdate:value': (val) => row.department = val,
          size: 'small',
          style: 'width: 120px',
          options: deptOptions
        })
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
      h(Button, {
        type: 'link',
        size: 'small',
        onClick: () => toggleEdit(row)
      }, { default: () => row.editing ? '保存' : '编辑' })
    ])
  }
]

const toggleEdit = (row) => {
  if (row.editing) {
    message.success(`已保存: ${row.name}`)
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
  message.success('全部保存成功')
}

const cancelAll = () => {
  tableData.value = JSON.parse(JSON.stringify(originalData))
  message.info('已取消编辑')
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
