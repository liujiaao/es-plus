<template>
  <div class="example-table-fixed">
    <es-table
      ref="tableRef"
      :data-source="tableData"
      :columns="columns"
      :options="{
        border: true,
        stripe: true,
        height: 400,
        heightType: 'height'
      }"
    />
  </div>
</template>

<script setup lang="jsx">
import { ref } from 'vue'
import { ElTag } from 'element-plus'
import EsTable from 'es-plus/components/es-table'

const tableRef = ref(null)

const tableData = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  name: `用户${i + 1}`,
  age: 20 + (i % 50),
  gender: i%2  == 0 ? '男' : '女',
  email: `user${i + 1}@example.com`,
  status: ['active', 'inactive', 'pending'][i % 3]
}))

const columns = [
  { prop: 'id', label: 'ID', width: 80, fixed: 'left' },
  { prop: 'name', label: '姓名', width: 120, fixed: 'left' },
  { prop: 'age', label: '年龄', width: 100 },
  { prop: 'email', label: '邮箱', minWidth: 200 },
   { prop: 'gender', label: '性别', minWidth: 200 },
    { prop: 'hobby', label: '爱好', minWidth: 200 },
     { prop: 'specialty', label: '特长', minWidth: 200 },
  { 
    prop: 'status', 
    label: '状态', 
    width: 120,
    fixed: 'right',
    // JSX写法示例
    render: (h, { row }) => {
      const statusMap = {
        active: { text: '活跃', type: 'success' },
        inactive: { text: '不活跃', type: 'info' },
        pending: { text: '待处理', type: 'warning' }
      }
      const status = statusMap[row.status] || statusMap.pending
      // 使用 JSX 写法
      return <ElTag type={status.type} size="small">{status.text}</ElTag>
    }
  }
]
</script>

<style scoped>
.example-table-fixed {
  padding: 0;
}
</style>
