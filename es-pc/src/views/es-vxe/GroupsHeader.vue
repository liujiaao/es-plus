<template>
  <div class="example-vxe-groups">
    <es-table
      :data-source="tableData"
      :columns="columns"
      :options="{ engine: 'vxe', border: true, rowkey: 'id' }"
    />
  </div>
</template>

<script setup>
import { EsTable } from '@es-plus/adapter-antdv'

const tableData = [
  { id: 1, name: '张三', gender: '男', dept: '技术部', team: '前端组', position: '工程师' },
  { id: 2, name: '李四', gender: '女', dept: '技术部', team: '后端组', position: '架构师' },
  { id: 3, name: '王五', gender: '男', dept: '产品部', team: 'B端组', position: '产品经理' },
  { id: 4, name: '赵六', gender: '女', dept: '设计部', team: '视觉组', position: '设计师' },
]

const columns = [
  {
    label: '基本信息',
    groups: [
      { prop: 'name', label: '姓名', minWidth: 100 },
      { prop: 'gender', label: '性别', width: 70, align: 'center' },
    ],
  },
  {
    label: '工作信息',
    groups: [
      { prop: 'dept', label: '部门', minWidth: 110 },
      { prop: 'team', label: '团队', width: 90 },
      { prop: 'position', label: '职位', minWidth: 110 },
    ],
  },
]
</script>
