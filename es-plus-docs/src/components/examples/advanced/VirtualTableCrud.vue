<template>
  <div class="virtual-crud-demo">
    <h4 style="margin-bottom: 12px; color: #606266;">虚拟表格 — 完整 CRUD 场景（httpRequest + 分页 + useDialog）</h4>
    <es-table
      ref="tableRef"
      :columns="columns"
      :options="tableOptions"
      v-model:data-source="tableData"
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
import { ref, reactive, h } from 'vue'
import { ElMessage, ElTag } from 'element-plus'
import { EsTable, EsForm, useDialog } from 'es-plus'

const tableRef = ref<InstanceType<typeof EsTable> | null>(null)
const dialog = useDialog()

// =========== 模拟后端数据 ===========
const departments = ['技术部', '产品部', '设计部', '市场部', '运营部']
const positions = ['工程师', '高级工程师', '架构师', '经理', '总监', '实习生']
const statusList = ['在职', '离职', '试用期']
const cities = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '西安']

const mockDatabase: Record<string, unknown>[] = []
for (let i = 1; i <= 10000; i++) {
  mockDatabase.push({
    id: i,
    name: `员工${i}`,
    department: departments[i % departments.length],
    position: positions[i % positions.length],
    status: statusList[i % 5 === 0 ? 1 : i % 7 === 0 ? 2 : 0],
    phone: `138${String(10000000 + i).slice(-8)}`,
    email: `employee${i}@company.com`,
    joinDate: `2020-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
    salary: 8000 + ((i * 137) % 30000),
    address: `${cities[i % cities.length]}市`,
  })
}

function mockApiRequest(params: Record<string, unknown>): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const { formParams, pageIndex, pageSize } = params as any
      let filtered = [...mockDatabase]
      if (formParams?.name) {
        filtered = filtered.filter(r => (r.name as string).includes(formParams.name))
      }
      if (formParams?.department) {
        filtered = filtered.filter(r => r.department === formParams.department)
      }
      if (formParams?.status) {
        filtered = filtered.filter(r => r.status === formParams.status)
      }
      const start = ((pageIndex || 1) - 1) * (pageSize || 200)
      const rows = filtered.slice(start, start + (pageSize || 200))
      resolve({
        records: filtered.length,
        rows,
        pageSize: pageSize || 200,
        pageNo: pageIndex || 1,
      })
    }, 300)
  })
}

// =========== 查询表单 ===========
const queryForm = reactive({
  name: '',
  department: '',
  status: '',
})

const formItems = [
  { prop: 'name', label: '姓名', formtype: 'Input', span: 6, attrs: { placeholder: '请输入姓名' } },
  { prop: 'department', label: '部门', formtype: 'Select', span: 6,
    attrs: { placeholder: '请选择部门', clearable: true },
    dataOptions: departments.map(d => ({ label: d, value: d })),
  },
  { prop: 'status', label: '状态', formtype: 'Select', span: 6,
    attrs: { placeholder: '请选择状态', clearable: true },
    dataOptions: statusList.map(s => ({ label: s, value: s })),
  },
] as any[]

const formBtns = [
  { name: '查询', type: 'primary' as const, key: 'query', triggerEvent: true },
  { name: '重置', key: 'rest', triggerEvent: true },
]

// =========== 表格配置 ===========
// 列宽合计 ~1310px，故意大于 CodePlayground 预览区（1000~1100），
// 这样可以演示横向滚动能力。配合 virtual-engine.vue 的
// `scrollbarAlwaysOn:true`，横滚条会常驻底部，用户立刻可见可拖。
// fixed:'right' 操作列在横滚时贴在右侧不动。
const columns = [
  { type: 'selection', width: 50 },
  { type: 'index', label: '#', width: 60 },
  { prop: 'name', label: '姓名', width: 100 },
  { prop: 'department', label: '部门', width: 100 },
  { prop: 'position', label: '职位', width: 120 },
  { prop: 'status', label: '状态', width: 90,
    render: (_h: any, { row }: any) => {
      const map: Record<string, string> = { '在职': 'success', '离职': 'danger', '试用期': 'warning' }
      return h(ElTag, { type: (map[row.status as string] || 'info') as any, size: 'small' }, () => row.status)
    }
  },
  { prop: 'phone', label: '联系电话', width: 140 },
  { prop: 'email', label: '邮箱', width: 220, ellipsis: true },
  { prop: 'joinDate', label: '入职日期', width: 130 },
  { prop: 'salary', label: '薪资 (¥)', width: 120, align: 'right' as const },
  { prop: 'address', label: '所在地', width: 130, ellipsis: true },
  { prop: 'operate', label: '操作', width: 150, fixed: 'right',
    btns: [
      { name: '编辑', type: 'primary', clickEvent: (row: any) => openEditDialog(row) },
      { name: '删除', type: 'danger', clickEvent: (row: any) => handleDelete(row) },
    ]
  },
]

const tableOptions = {
  virtual: true,
  border: true,
  rowkey: 'id',
  rowHeight: 48,
  heightType: 'height' as const,
  tabHeight: 500,
  httpRequest: mockApiRequest,
  apiParams: { url: '/api/employees', method: 'GET' },
  configTableOut: { total: 'records', tableData: 'rows', pageSize: 'pageSize', current: 'pageNo' },
  configBtn: [
    { name: '新增', type: 'primary' as const, code: 1, click: () => openAddDialog() },
    { name: '批量删除', type: 'danger' as const, code: 1, click: () => handleBatchDelete() },
    { name: '导出', type: 'primary' as const, code: 2, click: () => {} },
  ],
}

const tableData = ref<Record<string, unknown>[]>([])
const pagination = ref({ pageSize: 200, current: 1, total: 0 })

// =========== 弹窗操作 ===========
function openAddDialog() {
  const formData = reactive({ name: '', department: '', position: '', phone: '', email: '' })
  dialog({
    title: '新增员工',
    width: '500px',
    render: (h: any, { registerRef }: any) => h(EsForm, {
      ref: (el: any) => { if (el) registerRef('formRef', el) },
      model: formData,
      formItemList: [
        { prop: 'name', label: '姓名', formtype: 'Input', span: 24, formItemOptions: { rules: [{ required: true, message: '请输入姓名' }] } },
        { prop: 'department', label: '部门', formtype: 'Select', span: 24, dataOptions: departments.map(d => ({ label: d, value: d })) },
        { prop: 'position', label: '职位', formtype: 'Input', span: 24 },
        { prop: 'phone', label: '电话', formtype: 'Input', span: 24 },
        { prop: 'email', label: '邮箱', formtype: 'Input', span: 24 },
      ],
      layoutFormProps: { fromLayProps: { isBtnHidden: true, labelWidth: '50px' } },
    } as any),
    configBtn: [
      { name: '取消', click: (_: any, { close }: any) => close() },
      { name: '确定', type: 'primary', click: (_: any, { close, getRefs }: any) => {
        getRefs('formRef')?.validate().then(() => {
          ElMessage.success('新增成功')
          tableRef.value?.httpRequestInstance()
          close()
        })
      }},
    ],
  })
}

function openEditDialog(row: Record<string, unknown>) {
  const formData = reactive({ ...row })
  dialog({
    title: `编辑 — ${row.name}`,
    width: '500px',
    render: (h: any) => h(EsForm, {
      model: formData,
      formItemList: [
        { prop: 'name', label: '姓名', formtype: 'Input', span: 24 },
        { prop: 'department', label: '部门', formtype: 'Select', span: 24, dataOptions: departments.map(d => ({ label: d, value: d })) },
        { prop: 'position', label: '职位', formtype: 'Input', span: 24 },
        { prop: 'phone', label: '电话', formtype: 'Input', span: 24 },
      ],
      layoutFormProps: { fromLayProps: { isBtnHidden: true } },
    } as any),
    configBtn: [
      { name: '取消', click: (_: any, { close }: any) => close() },
      { name: '保存', type: 'primary', click: (_: any, { close }: any) => {
        ElMessage.success('修改成功')
        tableRef.value?.httpRequestInstance()
        close()
      }},
    ],
  })
}

function handleDelete(row: Record<string, unknown>) {
  dialog({
    title: '确认删除',
    width: '400px',
    render: () => h('p', `确定要删除 ${row.name} 吗？此操作不可撤销。`),
    configBtn: [
      { name: '取消', click: (_: any, { close }: any) => close() },
      { name: '确定删除', type: 'danger', click: (_: any, { close }: any) => {
        ElMessage.success('删除成功')
        tableRef.value?.httpRequestInstance()
        close()
      }},
    ],
  })
}

function handleBatchDelete() {
  const rows = tableRef.value?.getSelectionRows() || []
  if (!rows.length) {
    ElMessage.warning('请先选择数据')
    return
  }
  ElMessage.success(`批量删除 ${rows.length} 条数据`)
  tableRef.value?.httpRequestInstance()
}
</script>

<style scoped>
.virtual-crud-demo {
  padding: 0;
}
</style>
