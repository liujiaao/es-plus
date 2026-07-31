<template>
  <div>
    <div style="margin-bottom: 10px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
      <el-button size="small" type="primary" @click="addRow">新增行</el-button>
      <el-button size="small" type="success" @click="validateAndSave">校验并保存</el-button>
      <el-button size="small" @click="revertAll">撤销</el-button>
      <el-tag v-if="insertCount > 0" size="small" type="success">新增 {{ insertCount }}</el-tag>
      <el-tag v-if="updateCount > 0" size="small" type="warning">修改 {{ updateCount }}</el-tag>
      <el-tag v-if="deleteCount > 0" size="small" type="danger">删除 {{ deleteCount }}</el-tag>
    </div>
    <el-alert type="info" :closable="false" style="margin-bottom:10px"
      description="行模式编辑：点击行激活整行编辑；btns 列提供行内删除按钮；校验通过后批量提交" />
    <es-table
      ref="tableRef"
      :columns="columns"
      :options="tableOptions"
      v-model:data-source="tableData"
      v-model:pagination="pagination"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { EsTable } from 'es-plus'

const tableRef = ref<InstanceType<typeof EsTable> | null>(null)

const deptOptions = [
  { label: '技术部', value: '技术部' },
  { label: '产品部', value: '产品部' },
  { label: '设计部', value: '设计部' },
  { label: '市场部', value: '市场部' },
]

const columns = [
  { prop: 'name', label: '姓名', minWidth: 120,
    editRender: { name: '$input', props: { placeholder: '必填' } },
    vxeColumn: { rules: [{ required: true, message: '姓名必填' }] } },
  { prop: 'department', label: '部门', width: 130,
    editRender: { name: '$select', options: deptOptions } },
  { prop: 'salary', label: '薪资', width: 120,
    editRender: { name: '$input', props: { type: 'number', min: 0 } },
    vxeColumn: { rules: [{ required: true, type: 'number', min: 1, message: '薪资必须 > 0' }] } },
  {
    label: '操作', width: 90,
    btns: [{ text: '删除', type: 'danger', click: ({ row }: any) => deleteRow(row) }],
  },
]

const tableOptions = {
  engine: 'vxe' as const,
  border: true,
  rowkey: 'id',
   keepSource: true,  // keepSource 让 vxe 保存原始数据快照，getUpdateRecords() 才能正确返回已改行
  editConfig: { mode: 'row' as const, trigger: 'click' as const, showStatus: true },
  validConfig: { autoPos: true },
  vxeOn: { 'edit-closed': refreshCounts },
}

const pagination = ref({ pageSize: 10, current: 1, total: 0 })
let idSeq = 20

const tableData = ref(
  Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    name: `员工${i + 1}`,
    department: ['技术部', '产品部'][i % 2],
    salary: 8000 + i * 500,
  }))
)
pagination.value.total = tableData.value.length

// 获取内部 <vxe-table> 实例（insertAt / remove / getUpdateRecords 等 CRUD 方法都在内部 table 上）
const vxe = () => {
  const grid = (tableRef.value as any)?.vxeInstance?.()
  return grid?.getRefMaps?.()?.refTable?.value
}

const insertCount = ref(0)
const updateCount = ref(0)
const deleteCount = ref(0)

function refreshCounts() {
  const v = vxe()
  insertCount.value = v?.getInsertRecords?.()?.length ?? 0
  updateCount.value = v?.getUpdateRecords?.()?.length ?? 0
  deleteCount.value = v?.getRemoveRecords?.()?.length ?? 0
}

async function addRow() {
  await vxe()?.insertAt?.({ id: ++idSeq, name: '', department: '技术部', salary: 8000 }, -1)
  refreshCounts()
}

async function deleteRow(row: any) {
  await vxe()?.remove?.(row)
  refreshCounts()
}

async function validateAndSave() {
  const errMap = await vxe()?.validate?.()
  if (errMap) {
    ElMessage.error('校验失败，请修正错误')
    return
  }
  const inserts = vxe()?.getInsertRecords?.() ?? []
  const updates = vxe()?.getUpdateRecords?.() ?? []
  ElMessage.success(`保存成功：新增 ${inserts.length}，修改 ${updates.length}`)
}

function revertAll() {
  vxe()?.revertData?.()
  refreshCounts()
  ElMessage.info('已撤销所有修改')
}
</script>
