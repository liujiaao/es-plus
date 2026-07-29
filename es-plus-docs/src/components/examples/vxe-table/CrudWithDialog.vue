<template>
  <div>
    <!-- EsForm 搜索区 -->
    <es-table
      ref="tableRef"
      :columns="columns"
      :options="tableOptions"
      v-model:data-source="pagedData"
      v-model:pagination="pagination"
    >
      <es-form
        :model="queryForm"
        :form-item-list="formItems"
        :config-btn="formBtns"
        :layout-form-props="{ fromLayProps: { minFoldRows: 1 } }"
      />
    </es-table>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, h } from 'vue'
import { ElMessage, ElMessageBox, ElTag } from 'element-plus'
import { EsTable, EsForm, useDialog } from 'es-plus'

const tableRef = ref<InstanceType<typeof EsTable> | null>(null)
const dialog = useDialog()
let idSeq = 20

// ─── 搜索区 ────────────────────────────────────────────────────
const queryForm = reactive({ keyword: '', department: '', status: '',  salary: '', position: ''})

const formItems = [
  { prop: 'keyword', label: '姓名', formtype: 'Input', placeholder: '模糊搜索' },
  { prop: 'department', label: '部门', formtype: 'Select',dataOptions: [{ label: '全部', value: '' }, { label: '技术部', value: '技术部' }, { label: '产品部', value: '产品部' }, { label: '市场部', value: '市场部' }] },
  { prop: 'status', label: '状态', formtype: 'Select',dataOptions: [{ label: '全部', value: '' }, { label: '在职', value: 'active' }, { label: '离职', value: 'leave' }] },
  { prop: 'salary', label: '薪资', formtype: 'Input', placeholder: '模糊搜索'},
  { prop: 'position', label: '职位', formtype: 'Input'}
]

const formBtns = [
  { name: '查询', type: 'primary', click: loadData },
  { name: '重置', click: () => { Object.assign(queryForm, { keyword: '', department: '', status: '' }); loadData() } },
  { name: '新增', type: 'success', click: () => openForm(null) },
]

// ─── 表格区 ────────────────────────────────────────────────────
const statusMap: Record<string, any> = { active: ['在职', 'success'], leave: ['离职', 'danger'] }

const columns = [
  { type: 'selection', width: 50 },
  { type: 'snIndex', label: '序号', width: 70 },
  { prop: 'name', label: '姓名', minWidth: 120 },
  { prop: 'department', label: '部门', width: 120 },
  { prop: 'position', label: '职位', width: 120 },
  { prop: 'salary', label: '薪资', width: 120, align: 'right' as const,
    formatter: (row: any) => `¥${Number(row.salary).toLocaleString()}` },
  { prop: 'status', label: '状态', width: 90,
    render: (_h: any, { value }: any) => {
      const [label, type] = statusMap[value] ?? [value, '']
      return h(ElTag, { type, size: 'small' }, () => label)
    }
  },
  {
    label: '操作', width: 160, fixed: 'right' as const,
    btns: [
      { name: '编辑', type: 'primary', clickEvent: ({ row }: any) => openForm(row) },
      { name: '删除', type: 'danger', clickEvent: ({ row }: any) => deleteRow(row) },
    ],
  },
]

const tableOptions = {
  engine: 'vxe' as const,
  border: true,
  rowkey: 'id',
  // multiSelect: true,
  // snIndex: true,
  toolbarConfig: { zoom: true },
}

// ─── 数据层 ────────────────────────────────────────────────────
const departments = ['技术部', '产品部', '市场部', '设计部']
const positions = ['工程师', '高级工程师', '架构师', '经理']

const allData = reactive(
  Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    name: `员工${i + 1}`,
    department: departments[i % departments.length],
    position: positions[i % positions.length],
    salary: 8000 + i * 700,
    status: i % 5 === 0 ? 'leave' : 'active',
  }))
)

const filteredData = ref<any[]>([])
const pagination = ref({ pageSize: 10, current: 1, total: 0 })

const pagedData = computed(() => {
  const start = (pagination.value.current - 1) * pagination.value.pageSize
  return filteredData.value.slice(start, start + pagination.value.pageSize)
})

function loadData() {
  const filtered = allData.filter(r => {
    const kw = queryForm.keyword.toLowerCase()
    return (!kw || r.name.includes(kw))
      && (!queryForm.department || r.department === queryForm.department)
      && (!queryForm.status || r.status === queryForm.status)
  })
  filteredData.value = filtered
  pagination.value.total = filtered.length
  pagination.value.current = 1
}

loadData()

// ─── CRUD 操作 ─────────────────────────────────────────────────
function openForm(row: any) {
  const isEdit = !!row
  const model = reactive(isEdit ? { ...row } : { name: '', department: '技术部', position: '工程师', salary: 8000, status: 'active' })

  const formRef = ref<any>(null)

  dialog.open({
    title: isEdit ? '编辑员工' : '新增员工',
    width: '480px',
    render: (_h: any) => h(EsForm, {
      model,
      ref: formRef,
      'formItemList': [
        { prop: 'name', label: '姓名', type: 'input', required: true },
        { prop: 'department', label: '部门', type: 'select',
          options: departments.map(d => ({ label: d, value: d })) },
        { prop: 'position', label: '职位', type: 'select',
          options: positions.map(p => ({ label: p, value: p })) },
        { prop: 'salary', label: '薪资', type: 'input', inputType: 'number' },
        { prop: 'status', label: '状态', type: 'select',
          options: [{ label: '在职', value: 'active' }, { label: '离职', value: 'leave' }] },
      ],
    }),
    configBtn: [
      {
        text: '确定', type: 'primary',
        click: async (_instance: any, { close }: any) => {
          const valid = await formRef.value?.validate?.().catch(() => false)
          if (!valid) return
          if (isEdit) {
            Object.assign(row, model)
          } else {
            allData.push({ ...model, id: ++idSeq })
          }
          loadData()
          close()
          ElMessage.success(isEdit ? '编辑成功' : '新增成功')
        },
      },
      { text: '取消', click: (_: any, { close }: any) => close() },
    ],
  })
}

async function deleteRow(row: any) {
  await ElMessageBox.confirm(`确定删除「${row.name}」？`, '提示', { type: 'warning' })
  const idx = allData.findIndex(r => r.id === row.id)
  if (idx > -1) allData.splice(idx, 1)
  loadData()
  ElMessage.success('删除成功')
}
</script>
