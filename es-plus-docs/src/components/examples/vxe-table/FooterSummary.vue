<template>
  <div>
    <el-alert type="info" :closable="false" style="margin-bottom:10px"
      description="footerMethod 汇总行：vxe 原生支持多行 footer；配合动态数据可实时更新汇总值" />
    <div style="margin-bottom: 10px; display: flex; gap: 8px; align-items: center;">
      <el-button size="small" type="primary" @click="addRandomRow">随机新增一行</el-button>
      <span style="font-size:13px;color:#606266">
        合计薪资：<strong style="color:#409eff">¥{{ totalSalary.toLocaleString() }}</strong>
        &nbsp;平均：<strong style="color:#67c23a">¥{{ avgSalary.toLocaleString() }}</strong>
      </span>
    </div>
    <es-table
      :columns="columns"
      :options="tableOptions"
      v-model:data-source="tableData"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { EsTable } from 'es-plus'

const departments = ['技术部', '产品部', '设计部', '市场部']
let seq = 10

const tableData = ref(
  Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    name: `员工${i + 1}`,
    department: departments[i % departments.length],
    salary: 8000 + i * 700,
    bonus: 1000 + i * 200,
  }))
)

const totalSalary = computed(() => tableData.value.reduce((s, r: any) => s + r.salary, 0))
const avgSalary = computed(() => Math.round(totalSalary.value / (tableData.value.length || 1)))

const columns = [
  { prop: 'name', label: '姓名', minWidth: 120 },
  { prop: 'department', label: '部门', width: 120 },
  {
    prop: 'salary', label: '薪资(元)', width: 130, align: 'right' as const,
    formatter: (row: any) => Number(row.salary).toLocaleString(),
  },
  {
    prop: 'bonus', label: '奖金(元)', width: 120, align: 'right' as const,
    formatter: (row: any) => Number(row.bonus).toLocaleString(),
  },
]

const tableOptions = computed(() => ({
  engine: 'vxe' as const,
  border: true,
  rowkey: 'id',
  showFooter: true,
  footerMethod: ({ columns: cols, data }: any) =>
    [cols.map((col: any) => {
      if (col.field === 'name') return '合计'
      if (col.field === 'salary') return data.reduce((s: number, r: any) => s + (r.salary || 0), 0).toLocaleString()
      if (col.field === 'bonus') return data.reduce((s: number, r: any) => s + (r.bonus || 0), 0).toLocaleString()
      return ''
    })],
}))

function addRandomRow() {
  tableData.value.push({
    id: ++seq,
    name: `员工${seq}`,
    department: departments[seq % departments.length],
    salary: 8000 + Math.floor(Math.random() * 15000),
    bonus: 500 + Math.floor(Math.random() * 5000),
  })
}
</script>
