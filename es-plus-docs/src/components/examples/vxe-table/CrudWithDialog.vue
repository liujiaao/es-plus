<template>
  <div>
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
    <!-- 全屏缩放退出按钮：vxe-grid zoom() 会覆盖整个视口，configBtn 被遮挡，
         需用 fixed 定位浮动按钮在全屏下可见 -->
    <el-button
      v-if="isZoomed"
      style="position: fixed; top: 12px; right: 12px; z-index: 99999"
      type="warning"
      size="small"
      icon="Close"
      circle
      @click="exitZoom"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, h } from 'vue'
import { ElMessage, ElMessageBox, ElTag } from 'element-plus'
import { EsTable, EsForm, useDialog } from 'es-plus'

const tableRef = ref<InstanceType<typeof EsTable> | null>(null)
const dialog = useDialog()
let idSeq = 20

// 全屏缩放状态：vxe-grid zoom() 会切换全屏/还原，通过 vxeOn.zoom 事件追踪
const isZoomed = ref(false)
function exitZoom() {
  ;(tableRef.value as any)?.vxeInstance?.()?.zoom?.()
  isZoomed.value = false
}

// 模拟后端数据池
const departments = ['技术部', '产品部', '市场部', '设计部']
const positions = ['工程师', '高级工程师', '架构师', '经理']
const mockDatabase = Array.from({ length: 57 }, (_, i) => ({
  id: i + 1,
  name: `员工${i + 1}`,
  department: departments[i % departments.length],
  position: positions[i % positions.length],
  salary: 8000 + i * 700,
  status: i % 5 === 0 ? 'leave' : 'active',
}))

// 模拟真实接口：服务端过滤 + 服务端分页
function mockRequest(params: Record<string, unknown>): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const { formParams, pageIndex = 1, pageSize = 10 } = params as any
      let filtered = [...mockDatabase]
      if (formParams?.keyword) {
        filtered = filtered.filter(r => r.name.includes(formParams.keyword))
      }
      if (formParams?.department) {
        filtered = filtered.filter(r => r.department === formParams.department)
      }
      if (formParams?.status) {
        filtered = filtered.filter(r => r.status === formParams.status)
      }
      const start = ((pageIndex || 1) - 1) * (pageSize || 10)
      resolve({
        data: filtered.slice(start, start + (pageSize || 10)),
        total: filtered.length,
        pageIndex: pageIndex || 1,
        pageSize: pageSize || 10,
      })
    }, 300)
  })
}

// 搜索区
const queryForm = reactive({ keyword: '', department: '', status: '' })

const formItems = [
  { prop: 'keyword', label: '姓名', formtype: 'Input' as const, placeholder: '模糊搜索', attrs: { clearable: true } },
  {
    prop: 'department', label: '部门', formtype: 'Select' as const,
    dataOptions: [{ label: '全部', value: '' }, ...departments.map(d => ({ label: d, value: d }))],
    attrs: { clearable: true, placeholder: '全部' },
  },
  {
    prop: 'status', label: '状态', formtype: 'Select' as const,
    dataOptions: [{ label: '全部', value: '' }, { label: '在职', value: 'active' }, { label: '离职', value: 'leave' }],
    attrs: { clearable: true, placeholder: '全部' },
  },
  {prop: 'position', label: '职位', formtype: 'Input' as const, placeholder: '模糊搜索', attrs: { clearable: true }},
  {prop: 'salary', label: '薪资', formtype: 'Input' as const, placeholder: '模糊搜索', attrs: { clearable: true }}
]

const formBtns = [
  { name: '查询', type: 'primary' as const, key: 'query', triggerEvent: true, icon: 'Search' },
  { name: '重置', type: 'default' as const, key: 'rest', triggerEvent: true, icon: 'RefreshLeft' },
  // { name: '新增', type: 'success' as const, icon: 'Plus', click: () => openForm(null) },
]

// 表格区
const statusMap: Record<string, any> = { active: ['在职', 'success'], leave: ['离职', 'danger'] }

const columns = [
  { type: 'selection', width: 50 },
  { type: 'snIndex', label: '序号', width: 70 },
  { prop: 'name', label: '姓名', minWidth: 120 },
  { prop: 'department', label: '部门', width: 120 },
  { prop: 'position', label: '职位', width: 120 },
  {
    prop: 'salary', label: '薪资', width: 120, align: 'right' as const,
    formatter: (row: any) => `¥${Number(row.salary).toLocaleString()}`,
  },
  {
    prop: 'status', label: '状态', width: 90,
    render: (_h: any, { value }: any) => {
      const [label, type] = statusMap[value] ?? [value, '']
      return h(ElTag, { type, size: 'small' }, () => label)
    },
  },
  {
    prop: 'operate', label: '操作', width: 160, fixed: 'right' as const,
    btns: [
      { name: '编辑', type: 'primary', clickEvent: (row: any) => openForm(row) },
      { name: '删除', type: 'danger', clickEvent: (row: any) => deleteRow(row) },
    ],
  },
]

const tableOptions = {
     height:600,
   heightType: 'height',
  engine: 'vxe' as const,
  border: true,
  rowkey: 'id',
  httpRequest: mockRequest,
  apiParams: { url: '/api/employees', method: 'GET', model: queryForm },
  configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' },
  // printConfig: true 展开为 {}（vxe 必需，否则 print() 报错"缺少必要的 print-config 参数"）
  printConfig: true as const,
  // configBtn 工具栏：通过 getVxeGrid()（es-table 注入的惰性求值函数）获取 vxe-grid 实例
  // 全屏按钮点击时手动切换 isZoomed 状态，驱动浮动退出按钮显隐
  configBtn: [
    {
      name: '新增', type: 'success' as const, icon: 'Plus', code: 1 as const,
      click: () => openForm(null),
    },
    {
      name: '全屏', icon: 'FullScreen', code: 2 as const,
      click: ({ getVxeGrid }: any) => {
        getVxeGrid?.()?.zoom?.()
        isZoomed.value = true
      },
    },
    {
      name: '列设置', icon: 'Setting', code: 2 as const,
      click: ({ getVxeGrid }: any) => getVxeGrid?.()?.openCustom?.(),
    },
    {
      name: '导出', icon: 'Download', code: 2 as const,
      click: ({ getVxeGrid }: any) => getVxeGrid?.()?.exportData?.(),
    },
    {
      name: '打印', icon: 'Printer', code: 2 as const,
      click: ({ getVxeGrid }: any) => getVxeGrid?.()?.print?.(),
    },
  ] as any,
}

const tableData = ref<Record<string, unknown>[]>([])
const pagination = ref({ pageSize: 10, current: 1, total: 0 })

// ─── CRUD 操作 ─────────────────────────────────────────────────
function openForm(row: any) {
  const isEdit = !!row
  const formData = reactive(isEdit ? { ...row } : { name: '', department: '技术部', position: '工程师', salary: 8000, status: 'active' })

  dialog({
    title: isEdit ? '编辑员工' : '新增员工',
    width: '480px',
    render: (h, { registerRef }: any) => h(EsForm, {
      ref: (el: any) => { if (el) registerRef('formRef', el) },
      model: formData,
      formItemList: [
        { prop: 'name', label: '姓名', formtype: 'Input' as const, span: 24, formItemOptions: { rules: [{ required: true, message: '请输入姓名' }] } },
        { prop: 'department', label: '部门', formtype: 'Select' as const, span: 24, dataOptions: departments.map(d => ({ label: d, value: d })) },
        { prop: 'position', label: '职位', formtype: 'Select' as const, span: 24, dataOptions: positions.map(p => ({ label: p, value: p })) },
        { prop: 'salary', label: '薪资', formtype: 'Input' as const, span: 24, attrs: { type: 'number' } },
        { prop: 'status', label: '状态', formtype: 'Select' as const, span: 24, dataOptions: [{ label: '在职', value: 'active' }, { label: '离职', value: 'leave' }] },
      ],
      layoutFormProps: { fromLayProps: { isBtnHidden: true, labelWidth: '80px' } },
    } as any),
    configBtn: [
      {
        name: '取消', click: (_: any, { close }: any) => close(),
      },
      {
        name: '确定', type: 'primary' as const,
        click: async (_instance: any, { close, getRefs }: any) => {
          const valid = await getRefs('formRef')?.validate?.().catch(() => false)
          if (!valid) return
          if (isEdit) {
            Object.assign(row, formData)
          } else {
            mockDatabase.unshift({ ...formData, id: ++idSeq } as any)
          }
          tableRef.value?.httpRequestInstance()
          close()
          ElMessage.success(isEdit ? '编辑成功' : '新增成功')
        },
      },
    ],
  })
}

async function deleteRow(row: any) {
  await ElMessageBox.confirm(`确定删除「${row.name}」？`, '提示', { type: 'warning' })
  const idx = mockDatabase.findIndex(r => r.id === row.id)
  if (idx > -1) mockDatabase.splice(idx, 1)
  tableRef.value?.httpRequestInstance()
  ElMessage.success('删除成功')
}
</script>
