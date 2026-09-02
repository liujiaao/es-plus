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
        :layout-form-props="{ fromLayProps: { minFoldRows: 1, labelWidth: '70px' } }"
      />
    </es-table>
  </div>
</template>

<script setup>
import { ref, reactive, h } from 'vue'
import { message, Tag } from 'ant-design-vue'
import { EsTable, EsForm, useDialog } from '@es-plus/adapter-antdv'

const tableRef = ref(null)
const dialog = useDialog()
let idSeq = 20

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
function mockRequest(params) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const { formParams, pageIndex = 1, pageSize = 10 } = params || {}
      let filtered = [...mockDatabase]
      if (formParams?.keyword) filtered = filtered.filter((r) => r.name.includes(formParams.keyword))
      if (formParams?.department) filtered = filtered.filter((r) => r.department === formParams.department)
      if (formParams?.status) filtered = filtered.filter((r) => r.status === formParams.status)
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
  { prop: 'keyword', label: '姓名', formtype: 'Input', placeholder: '模糊搜索', attrs: { allowClear: true } },
  {
    prop: 'department', label: '部门', formtype: 'Select',
    dataOptions: [{ label: '全部', value: '' }, ...departments.map((d) => ({ label: d, value: d }))],
    attrs: { allowClear: true, placeholder: '全部' },
  },
  {
    prop: 'status', label: '状态', formtype: 'Select',
    dataOptions: [{ label: '全部', value: '' }, { label: '在职', value: 'active' }, { label: '离职', value: 'leave' }],
    attrs: { allowClear: true, placeholder: '全部' },
  },
]

const formBtns = [
  { name: '查询', type: 'primary', key: 'query', triggerEvent: true, icon: 'Search' },
  { name: '重置', key: 'rest', triggerEvent: true, icon: 'RefreshLeft' },
  { name: '新增', type: 'success', icon: 'Plus', click: () => openForm(null) },
]

// 表格区
const statusMap = { active: ['在职', 'success'], leave: ['离职', 'error'] }

const columns = [
  { type: 'selection', width: 50 },
  { type: 'index', label: '序号', width: 70 },
  { prop: 'name', label: '姓名', minWidth: 120 },
  { prop: 'department', label: '部门', width: 120 },
  { prop: 'position', label: '职位', width: 120 },
  { prop: 'salary', label: '薪资', width: 120, align: 'right', formatter: (row) => `¥${Number(row.salary).toLocaleString()}` },
  {
    prop: 'status', label: '状态', width: 90,
    render: (_h, { value }) => {
      const [label, color] = statusMap[value] ?? [value, 'default']
      return h(Tag, { color }, () => label)
    },
  },
  {
    prop: 'operate', label: '操作', width: 160, fixed: 'right',
    btns: [
      { name: '编辑', type: 'primary', clickEvent: (row) => openForm(row) },
      { name: '删除', type: 'danger', clickEvent: (row) => deleteRow(row) },
    ],
  },
]

const tableOptions = {
  height: 560,
  heightType: 'height',
  engine: 'vxe',
  border: true,
  rowkey: 'id',
  httpRequest: mockRequest,
  apiParams: { url: '/api/employees', method: 'GET', model: queryForm },
  configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' },
  // vxe 工具栏：缩放/全屏/列设置/导出/打印（内置能力）
  toolbarConfig: { zoom: true, custom: true, export: true, print: true, refresh: false },
  printConfig: true,
  exportConfig: { type: 'csv', filename: '员工数据' },
}

const tableData = ref([])
const pagination = ref({ pageSize: 10, current: 1, total: 0 })

// ─── CRUD 操作 ─────────────────────────────────────────────────
function openForm(row) {
  const isEdit = !!row
  const formData = reactive(isEdit ? { ...row } : { name: '', department: '技术部', position: '工程师', salary: 8000, status: 'active' })

  dialog({
    title: isEdit ? '编辑员工' : '新增员工',
    width: '480px',
    render: (rh, { registerRef }) =>
      rh(EsForm, {
        ref: (el) => { if (el) registerRef('formRef', el) },
        model: formData,
        formItemList: [
          { prop: 'name', label: '姓名', formtype: 'Input', span: 24, formItemOptions: { rules: [{ required: true, message: '请输入姓名' }] } },
          { prop: 'department', label: '部门', formtype: 'Select', span: 24, dataOptions: departments.map((d) => ({ label: d, value: d })) },
          { prop: 'position', label: '职位', formtype: 'Select', span: 24, dataOptions: positions.map((p) => ({ label: p, value: p })) },
          { prop: 'salary', label: '薪资', formtype: 'InputNumber', span: 24, attrs: { min: 0 } },
          { prop: 'status', label: '状态', formtype: 'Select', span: 24, dataOptions: [{ label: '在职', value: 'active' }, { label: '离职', value: 'leave' }] },
        ],
        layoutFormProps: { fromLayProps: { isBtnHidden: true, labelWidth: '80px' } },
      }),
    configBtn: [
      { name: '取消', click: (_, { close }) => close() },
      {
        name: '确定', type: 'primary',
        click: async (_instance, { close, getRefs }) => {
          const valid = await getRefs('formRef')?.validate?.().catch(() => false)
          if (!valid) return
          if (isEdit) {
            const idx = mockDatabase.findIndex((r) => r.id === row.id)
            if (idx > -1) Object.assign(mockDatabase[idx], formData)
          } else {
            mockDatabase.unshift({ ...formData, id: ++idSeq })
          }
          tableRef.value?.httpRequestInstance()
          close()
          message.success(isEdit ? '编辑成功' : '新增成功')
        },
      },
    ],
  })
}

function deleteRow(row) {
  dialog({
    title: '确认删除',
    width: '400px',
    render: (rh) => rh('div', { style: 'padding:10px 0;font-size:15px' }, `确定删除「${row.name}」？`),
    configBtn: [
      { name: '取消', click: (_, { close }) => close() },
      {
        name: '删除', type: 'danger',
        click: (_, { close }) => {
          const idx = mockDatabase.findIndex((r) => r.id === row.id)
          if (idx > -1) mockDatabase.splice(idx, 1)
          tableRef.value?.httpRequestInstance()
          close()
          message.success('删除成功')
        },
      },
    ],
  })
}
</script>
