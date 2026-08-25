<template>
  <div class="example-dynamic-columns">
    <div class="column-toggle">
      <span class="toggle-label">显示列：</span>
      <a-checkbox-group v-model:value="visibleColumns" size="small">
        <a-checkbox v-for="c in toggleOptions" :key="c.value" :value="c.value">{{ c.label }}</a-checkbox>
      </a-checkbox-group>
    </div>
    <es-table
      :data-source="tableData"
      :columns="dynamicColumns"
      :options="tableOptions"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { EsTable } from '@es-plus/adapter-antdv'

const tableData = [
  { id: 1, name: '张三', age: 28, address: '北京市朝阳区', email: 'zhangsan@example.com' },
  { id: 2, name: '李四', age: 32, address: '上海市浦东新区', email: 'lisi@example.com' },
  { id: 3, name: '王五', age: 24, address: '广州市天河区', email: 'wangwu@example.com' },
  { id: 4, name: '赵六', age: 30, address: '深圳市南山区', email: 'zhaoliu@example.com' },
]

const toggleOptions = [
  { value: 'name', label: '姓名' },
  { value: 'age', label: '年龄' },
  { value: 'address', label: '地址' },
  { value: 'email', label: '邮箱' },
]

const visibleColumns = ref(['name', 'age', 'address', 'email'])

const allColumns = {
  name: { prop: 'name', label: '姓名', minWidth: 120 },
  age: { prop: 'age', label: '年龄', width: 80, align: 'center' },
  address: { prop: 'address', label: '地址', minWidth: 160 },
  email: { prop: 'email', label: '邮箱', minWidth: 200 },
}

const dynamicColumns = computed(() => visibleColumns.value.map((c) => allColumns[c]))

const tableOptions = { border: true, stripe: true }
</script>
