<template>
  <div class="admin-page">
    <es-table
      ref="tableRef"
      :columns="columns"
      :options="tableOptions"
      v-model:data-source="tableData"
      v-model:pagination="pagination"
    >
      <es-form
        :model="queryModel"
        :form-item-list="queryItems"
        :config-btn="queryBtns"
        :layout-form-props="{ fromLayProps: { labelWidth: '80px', minFoldRows: 1 } }"
      />
    </es-table>
  </div>
</template>

<script setup lang="jsx">
import { ref, reactive, h } from 'vue'
import { ElMessage, ElTag, ElButton } from 'element-plus'
import { EsForm, EsTable, useDialog } from 'es-plus'

const tableRef = ref(null)
const dialog = useDialog()

// --- Mock data ---
let idCounter = 100
const generateData = (pageIndex = 1, pageSize = 10, keyword = '', status = '') => {
  const allData = Array.from({ length: 57 }, (_, i) => ({
    id: i + 1,
    name: `用户${i + 1}`,
    email: `user${i + 1}@example.com`,
    role: ['管理员', '编辑', '访客'][i % 3],
    status: ['active', 'inactive', 'banned'][i % 3],
    createdAt: `2025-0${(i % 9) + 1}-${String((i % 28) + 1).padStart(2, '0')}`
  }))
  let filtered = allData
  if (keyword) filtered = filtered.filter(r => r.name.includes(keyword) || r.email.includes(keyword))
  if (status) filtered = filtered.filter(r => r.status === status)
  const start = (pageIndex - 1) * pageSize
  return {
    data: filtered.slice(start, start + pageSize),
    total: filtered.length,
    pageSize,
    pageIndex
  }
}

const mockRequest = async (params) => {
  const { formParams, ...rest } = params || {}
  const { pageIndex = 1, pageSize = 10, keyword = '', status = '' } = { ...formParams, ...rest }
  await new Promise(r => setTimeout(r, 300))
  return generateData(pageIndex, pageSize, keyword, status)
}

// --- Query form ---
const queryModel = reactive({ keyword: '', status: '' })
const queryItems = [
  { prop: 'keyword', label: '关键词', formtype: 'Input', span: 6, attrs: { placeholder: '姓名/邮箱', clearable: true } },
  {
    prop: 'status', label: '状态', formtype: 'Select', span: 6,
    dataOptions: [
      { label: '激活', value: 'active' },
      { label: '停用', value: 'inactive' },
      { label: '封禁', value: 'banned' }
    ],
    attrs: { clearable: true, placeholder: '全部' }
  }
]
const queryBtns = [
  { name: '查询', type: 'primary', key: 'query', triggerEvent: true, icon: 'Search' },
  { name: '重置', key: 'rest', triggerEvent: true, icon: 'RefreshLeft' },
  {
    name: '新增', type: 'success', icon: 'Plus',
    click: () => openEditDialog(null)
  }
]

// --- Table ---
const tableData = ref([])
const pagination = ref({ pageSize: 10, current: 1, total: 0 })

const statusMap = { active: 'success', inactive: 'info', banned: 'danger' }
const statusText = { active: '激活', inactive: '停用', banned: '封禁' }

const columns = [
  { prop: 'id', label: 'ID', width: 70 },
  { prop: 'name', label: '姓名', width: 120 },
  { prop: 'email', label: '邮箱', width: 220 },
  { prop: 'role', label: '角色', width: 100 },
  {
    prop: 'status', label: '状态', width: 90,
    render: (_, { row }) => h(ElTag, { type: statusMap[row.status], size: 'small' }, () => statusText[row.status])
  },
  { prop: 'createdAt', label: '创建日期', width: 130 },
  {
    prop: 'operate', label: '操作', width: 180,
    btns: [
      { name: '编辑', type: 'primary', clickEvent: (row) => openEditDialog(row) },
      { name: '删除', type: 'danger', clickEvent: (row) => handleDelete(row) }
    ]
  }
]

const tableOptions = {
  border: true,
  httpRequest: mockRequest,
  apiParams: { url: '/api/users', method: 'GET', model: queryModel },
  configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' },
  rowkey: 'id',
  heightType: 'height',
  tabHeight: 520
}

// --- CRUD Dialog ---
const openEditDialog = (row) => {
  const isEdit = !!row
  const formData = reactive(isEdit ? { ...row } : { id: '', name: '', email: '', role: '访客', status: 'active' })
  const formItems = [
    { prop: 'name', label: '姓名', formtype: 'Input', span: 24, formItemOptions: { rules: [{ required: true, message: '请输入姓名' }] } },
    { prop: 'email', label: '邮箱', formtype: 'Input', span: 24, attrs: { type: 'email' } },
    {
      prop: 'role', label: '角色', formtype: 'Select', span: 12,
      dataOptions: [{ label: '管理员', value: '管理员' }, { label: '编辑', value: '编辑' }, { label: '访客', value: '访客' }]
    },
    {
      prop: 'status', label: '状态', formtype: 'Select', span: 12,
      dataOptions: [{ label: '激活', value: 'active' }, { label: '停用', value: 'inactive' }, { label: '封禁', value: 'banned' }]
    }
  ]

  dialog({
    title: isEdit ? '编辑用户' : '新增用户',
    width: '520px',
    render: (h, { registerRef }) => (
      <es-form
        ref={(el) => { if (el) registerRef('formRef', el) }}
        model={formData}
        formItemList={formItems}
        layoutFormProps={{ fromLayProps: { labelWidth: '80px' } }}
      />
    ),
    configBtn: [
      { name: '取消', click: (_, { close }) => close() },
      {
        name: '保存', type: 'primary', icon: 'Check',
        click: (_, { close, getRefs }) => {
          const formRef = getRefs('formRef')
          formRef?.validate().then(() => {
            if (!isEdit) {
              formData.id = ++idCounter
              formData.createdAt = new Date().toISOString().slice(0, 10)
            }
            ElMessage.success(isEdit ? '保存成功' : '新增成功')
            close()
            tableRef.value?.httpRequestInstance()
          })
        }
      }
    ]
  })
}

const handleDelete = (row) => {
  dialog({
    title: '确认删除',
    width: '400px',
    render: () => h('div', { style: 'padding: 10px 0; font-size: 15px' }, `确定删除用户「${row.name}」吗？`),
    configBtn: [
      { name: '取消', click: (_, { close }) => close() },
      {
        name: '删除', type: 'danger', icon: 'Delete',
        click: (_, { close }) => {
          ElMessage.success('删除成功')
          close()
          tableRef.value?.httpRequestInstance()
        }
      }
    ]
  })
}
</script>

<style lang="scss" scoped>
.admin-page {
  padding: 0;
}
</style>
