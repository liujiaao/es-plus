<template>
  <div>
    <div class="demo-toolbar">
      <a-button size="small" type="primary" @click="showSelected">获取选中行</a-button>
      <a-button size="small" @click="clearAll">清空选择</a-button>
      <span class="demo-hint">
        跨页已选 {{ totalCount }} 行 · 上次 selection-change 载荷 {{ eventCount }} 行（当前页）
      </span>
    </div>
    <es-table
      ref="tableRef"
      :columns="columns"
      :options="tableOptions"
      v-model:data-source="pagedData"
      v-model:pagination="pagination"
      @selection-change="onSelectionChange"
    />
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch } from 'vue'
import { message } from 'ant-design-vue'
import { EsTable } from '@es-plus/adapter-antdv'

const tableRef = ref(null)
// 两个数刻意分开：selection-change 只给「当前页」，getSelectionRows 给「跨页全集」。
const eventCount = ref(0)
const totalCount = ref(0)

const columns = [
  { type: 'selection', width: 50 },
  { type: 'index', label: '序号', width: 70 },
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'name', label: '姓名', minWidth: 120 },
  { prop: 'department', label: '部门', width: 130 },
  { prop: 'salary', label: '薪资', width: 110, align: 'right' },
]

const tableOptions = {
  engine: 'vxe',
  border: true,
  // rowkey 是跨页勾选的唯一依据；显式 type:'selection' 列与 multiSelect:true 等价。
  rowkey: 'id',
}

const pagination = ref({ pageSize: 10, current: 1, total: 0 })
const departments = ['技术部', '产品部', '设计部', '市场部', '运营部']

const allData = Array.from({ length: 23 }, (_, i) => ({
  id: i + 1,
  name: `员工${i + 1}`,
  department: departments[i % departments.length],
  salary: 8000 + i * 500,
}))
pagination.value.total = allData.length

const pagedData = computed(() => {
  const start = (pagination.value.current - 1) * pagination.value.pageSize
  return allData.slice(start, start + pagination.value.pageSize)
})

// 事件载荷只有当前页 —— 与 el-table / a-table 同一口径；跨页全集等下一轮再读
// （vxe 的 reserve 记录在事件之后才落进内部集合）。
function onSelectionChange(rows) {
  eventCount.value = rows?.length || 0
  nextTick(refreshTotal)
}

// 翻页不触发 selection-change，但回到含已选行的页时 reserve 会重新勾上
watch(() => pagination.value.current, () => nextTick(refreshTotal))

function refreshTotal() {
  totalCount.value = tableRef.value?.getSelectionRows?.()?.length || 0
}

function showSelected() {
  const rows = tableRef.value?.getSelectionRows?.() || []
  totalCount.value = rows.length
  if (!rows.length) {
    message.info('尚未选择任何数据')
    return
  }
  message.success(`跨页已选 ${rows.length} 行：${rows.map((r) => r.name).join('、')}`)
}

function clearAll() {
  tableRef.value?.clearSelection?.()
  eventCount.value = 0
  totalCount.value = 0
}
</script>

<style scoped>
.demo-toolbar {
  margin-bottom: 10px;
  display: flex;
  gap: 8px;
  align-items: center;
}
.demo-hint {
  font-size: 13px;
  color: #909399;
}
</style>
