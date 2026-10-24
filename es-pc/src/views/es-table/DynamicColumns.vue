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

const toggleOptions = [
  { label: 'Q1', value: 'q1' },
  { label: 'Q2', value: 'q2' },
  { label: 'Q3', value: 'q3' },
  { label: 'Q4', value: 'q4' },
  { label: '年度合计', value: 'year' }
]

const visibleColumns = ref(['q1', 'q2', 'q3', 'q4', 'year'])

const formatMoney = (val) => val ? `¥${(val / 10000).toFixed(1)}万` : '-'

const tableData = [
  { region: '华东区', q1: 120000, q2: 135000, q3: 148000, q4: 162000, year: 565000 },
  { region: '华南区', q1: 98000, q2: 112000, q3: 125000, q4: 138000, year: 473000 },
  { region: '华北区', q1: 86000, q2: 95000, q3: 102000, q4: 118000, year: 401000 },
  { region: '西南区', q1: 65000, q2: 78000, q3: 88000, q4: 95000, year: 326000 },
  { region: '西北区', q1: 52000, q2: 63000, q3: 71000, q4: 82000, year: 268000 }
]

// 动态列用 hidCol「隐藏」而不是重建数组：
// 列身份（顺序/宽度/固定位）保持不变，a-table 只做列的显隐，不会整表重排。
const dynamicColumns = computed(() => [
  { prop: 'region', label: '区域', fixed: 'left' },
  { prop: 'q1', label: 'Q1营收', hidCol: !visibleColumns.value.includes('q1'), formatter: (r) => formatMoney(r.q1) },
  { prop: 'q2', label: 'Q2营收', hidCol: !visibleColumns.value.includes('q2'), formatter: (r) => formatMoney(r.q2) },
  { prop: 'q3', label: 'Q3营收', hidCol: !visibleColumns.value.includes('q3'), formatter: (r) => formatMoney(r.q3) },
  { prop: 'q4', label: 'Q4营收', hidCol: !visibleColumns.value.includes('q4'), formatter: (r) => formatMoney(r.q4) },
  { prop: 'year', label: '年度合计', hidCol: !visibleColumns.value.includes('year'), formatter: (r) => formatMoney(r.year) }
])

const tableOptions = {
  border: true,
  // a-table 没有 summary-method，合计行请用列 footer 或独立统计条（el-table 端有 showSummary）
  headerCellStyle: { background: '#f0f5ff', color: '#303133', fontWeight: '600' }
}
</script>

<style scoped>
.example-dynamic-columns {
  padding: 0;
}
.column-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 10px;
}
.toggle-label {
  font-size: 14px;
  color: #606266;
  white-space: nowrap;
}
</style>
