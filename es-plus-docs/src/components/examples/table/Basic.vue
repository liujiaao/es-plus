<template>
  <div class="example-basic-table">
    <es-table
      :data-source="tableData"
      :columns="columns"
      :options="{ border: true, stripe: true }"
    />
  </div>
</template>

<script setup>
import EsTable from 'es-plus/components/es-table'

const tableData = [
  { name: '张三', age: 28, address: '北京市朝阳区', email: 'zhangsan@example.com' },
  { name: '李四', age: 32, address: '上海市浦东新区', email: 'lisi@example.com' },
  { name: '王五', age: 24, address: '广州市天河区', email: 'wangwu@example.com' },
  { name: '赵六', age: 30, address: '深圳市南山区', email: 'zhaoliu@example.com' }
]

const columns = [
  { prop: 'name', label: '姓名', width: 100 },
  { prop: 'age', label: '年龄', width: 80, align: 'center' },
  { prop: 'address', label: '地址', minWidth: 150 },
  { prop: 'email', label: '邮箱', minWidth: 180 }
]
</script>

<style scoped>
.example-basic-table {
  padding: 0;
}
</style>
