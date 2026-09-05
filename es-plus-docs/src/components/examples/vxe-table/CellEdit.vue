<template>
  <div>
    <div style="margin-bottom: 10px; display: flex; gap: 8px; align-items: center;">
      <el-button size="small" type="primary" @click="saveChanges">保存修改</el-button>
      <el-button size="small" @click="revertAll">撤销全部</el-button>
      <span v-if="updateCount > 0" style="font-size: 13px; color: #e6a23c;">
        {{ updateCount }} 条待保存
      </span>
    </div>
    <el-alert
      type="info"
      :closable="false"
      style="margin-bottom: 10px;"
      description="单击单元格进入编辑模式（cell 模式）；部门列为下拉选择，其余为文本输入"
    />
    <es-table
      ref="tableRef"
      :columns="columns"
      :options="tableOptions"
      v-model:data-source="pagedData"
      v-model:pagination="pagination"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { EsTable } from 'es-plus'

const tableRef = ref<InstanceType<typeof EsTable> | null>(null)

const deptOptions = [
  { label: '技术部', value: '技术部' },
  { label: '产品部', value: '产品部' },
  { label: '设计部', value: '设计部' },
  { label: '市场部', value: '市场部' },
  { label: '运营部', value: '运营部' },
]

const columns = [
  { prop: 'id', label: 'ID', width: 70 },
  {
    prop: 'name', label: '姓名', minWidth: 130,
    editRender: { name: '$input', props: { placeholder: '请输入姓名' } },
  },
  {
    prop: 'department', label: '部门', width: 130,
    editRender: { name: '$select', options: deptOptions },
  },
  {
    prop: 'salary', label: '薪资', width: 130,
    editRender: { name: '$input', props: { type: 'number', min: 0 } },
  },
  { prop: 'joinDate', label: '入职日期', width: 130 },
]

// updateCount 无法用 computed 响应 vxe 内部 store 变化，改用 ref + vxeOn 事件驱动更新
const updateCount = ref(0)

const tableOptions = {
  engine: 'vxe' as const,
  border: true,
  rowkey: 'id',
  // keepSource 让 vxe 保存原始数据快照，getUpdateRecords() 才能正确返回已改行
  keepSource: true,
  editConfig: { mode: 'cell' as const, trigger: 'click' as const },
  vxeOn: {
    'edit-closed': () => {
      // 直接从内部 table 获取更新行数
      const grid = (tableRef.value as any)?.vxeInstance?.()
      const $table = grid?.getRefMaps?.()?.refTable?.value
      updateCount.value = $table?.getUpdateRecords?.()?.length ?? 0
    },
  },
}

const pagination = ref({ pageSize: 10, current: 1, total: 0 })
const departments = ['技术部', '产品部', '设计部', '市场部', '运营部']

const allData = Array.from({ length: 15 }, (_, i) => ({
  id: i + 1,
  name: `员工${i + 1}`,
  department: departments[i % departments.length],
  salary: 8000 + i * 500,
  joinDate: `2021-${String((i % 12) + 1).padStart(2, '0')}-01`,
}))
pagination.value.total = allData.length

const pagedData = computed(() => {
  const start = (pagination.value.current - 1) * pagination.value.pageSize
  return allData.slice(start, start + pagination.value.pageSize)
})

async function saveChanges() {
  // 1. 获取 EsTable 实例
  const esTable = tableRef.value as any
  if (!esTable) { ElMessage.warning('表格实例未就绪'); return }

  // 2. 获取 vxe-grid 实例
  const grid = esTable.vxeInstance?.()
  if (!grid) { ElMessage.warning('vxe 引擎未就绪'); return }

  // 3. 获取内部 <vxe-table> 实例（grid.getRefMaps().refTable）
  const refMaps = grid.getRefMaps?.()
  const refTable = refMaps?.refTable
  const $table = refTable?.value ?? refTable  // refTable 是 Vue ref，unwarp .value
  if (!$table) { ElMessage.warning('内部 table 未就绪'); return }

  // 4. 提交当前编辑中的单元格
  await $table.clearEdit?.()

  // 5. 从内部 table 直接获取已修改行
  const rows = $table.getUpdateRecords?.() ?? []

  if (!rows.length) {
    ElMessage.info('没有修改的数据')
    return
  }
  ElMessage.success(`已保存 ${rows.length} 条修改`)
}

async function revertAll() {
  const grid = (tableRef.value as any)?.vxeInstance?.()
  const $table = grid?.getRefMaps?.()?.refTable?.value
  await $table?.revertData?.()
  updateCount.value = 0
  ElMessage.info('已撤销所有修改')
}
</script>
