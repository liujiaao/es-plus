<template>
  <div>
    <a-space style="margin-bottom: 10px" wrap>
      <a-button size="small" type="primary" @click="addRow">新增行</a-button>
      <a-button size="small" style="background:#52c41a;border-color:#52c41a;color:#fff" @click="validateAndSave">校验并保存</a-button>
      <a-button size="small" @click="revertAll">撤销</a-button>
      <a-tag v-if="insertCount > 0" color="success">新增 {{ insertCount }}</a-tag>
      <a-tag v-if="updateCount > 0" color="warning">修改 {{ updateCount }}</a-tag>
      <a-tag v-if="deleteCount > 0" color="error">删除 {{ deleteCount }}</a-tag>
    </a-space>
    <a-alert
      type="info"
      show-icon
      style="margin-bottom: 10px"
      message="行模式编辑：点击行激活整行编辑；btns 列提供行内删除按钮；校验通过后批量提交"
    />
    <es-table
      ref="tableRef"
      :columns="columns"
      :options="tableOptions"
      v-model:data-source="tableData"
      v-model:pagination="pagination"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { message } from 'ant-design-vue'
import { EsTable } from '@es-plus/adapter-antdv'

const tableRef = ref(null)

const deptOptions = [
  { label: '技术部', value: '技术部' },
  { label: '产品部', value: '产品部' },
  { label: '设计部', value: '设计部' },
  { label: '市场部', value: '市场部' },
]

const columns = [
  {
    prop: 'name', label: '姓名', minWidth: 120,
    editRender: { name: '$input', props: { placeholder: '必填' } },
    vxeColumn: { rules: [{ required: true, message: '姓名必填' }] },
  },
  {
    prop: 'department', label: '部门', width: 130,
    editRender: { name: '$select', options: deptOptions },
  },
  {
    prop: 'salary', label: '薪资', width: 120,
    editRender: { name: '$input', props: { type: 'number', min: 0 } },
    vxeColumn: { rules: [{ required: true, type: 'number', min: 1, message: '薪资必须 > 0' }] },
  },
  {
    label: '操作', width: 90,
    btns: [{ name: '删除', type: 'danger', clickEvent: (row) => deleteRow(row) }],
  },
]

const tableOptions = {
  engine: 'vxe',
  border: true,
  rowkey: 'id',
  keepSource: true, // keepSource 保存原始快照，getUpdateRecords() 才能正确返回已改行
  editConfig: { mode: 'row', trigger: 'click', showStatus: true },
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
  const grid = tableRef.value?.vxeInstance?.()
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

async function deleteRow(row) {
  await vxe()?.remove?.(row)
  refreshCounts()
}

async function validateAndSave() {
  const errMap = await vxe()?.validate?.()
  if (errMap) {
    message.error('校验失败，请修正错误')
    return
  }
  const inserts = vxe()?.getInsertRecords?.() ?? []
  const updates = vxe()?.getUpdateRecords?.() ?? []
  message.success(`保存成功：新增 ${inserts.length}，修改 ${updates.length}`)
}

function revertAll() {
  vxe()?.revertData?.()
  refreshCounts()
  message.info('已撤销所有修改')
}
</script>
