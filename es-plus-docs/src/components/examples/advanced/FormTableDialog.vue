<template>
  <div class="example-advanced-form-table">
    <es-form
      ref="queryFormRef"
      :model="queryModel"
      :form-item-list="queryItems"
      :config-btn="queryBtns"
      :layout-form-props="layoutFormProps"
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

<script setup lang="jsx">
import { ref, reactive, h } from 'vue'
import { ElMessage, ElTag, ElMessageBox } from 'element-plus'
import { EsTable, EsForm,  useDialog } from 'es-plus'
import { fetchProducts } from '@/utils/mock-api'

const queryFormRef = ref(null)
const tableRef = ref(null)
const dialog = useDialog()

const tableData = ref([])
const pagination = ref({ pageSize: 5, current: 1, total: 0, pageSizes: [5, 10, 20] })

const queryModel = reactive({ keyword: '', category: '', priceRange: '' })

const categoryOptions = [
  { label: '全部分类', value: '' },
  { label: '电子产品', value: 'electronics' },
  { label: '珠宝', value: 'jewelery' },
  { label: '男装', value: "men's clothing" },
  { label: '女装', value: "women's clothing" }
]

const priceOptions = [
  { label: '全部价格', value: '' },
  { label: '$0 - $50', value: '0-50' },
  { label: '$50 - $100', value: '50-100' },
  { label: '$100+', value: '100+' }
]

const queryItems = [
  { prop: 'keyword', label: '关键词', formtype: 'Input', span: 6, attrs: { placeholder: '搜索商品名称', clearable: true } },
  { prop: 'category', label: '分类', formtype: 'Select', span: 6, dataOptions: categoryOptions, attrs: { clearable: true } },
  { prop: 'priceRange', label: '价格', formtype: 'Select', span: 6, dataOptions: priceOptions, attrs: { clearable: true } }
]

const layoutFormProps = {
  fromLayProps: { labelWidth: '70px', minFoldRows: 1 },
  rowLayProps: { gutter: 16 }
}

const queryBtns = [
  {
    name: '查询', type: 'primary', key: 'query', icon: 'Search', size: 'small',
    click: () => {
      pagination.value.current = 1
      tableRef.value?.httpRequestInstance()
    }
  },
  {
    name: '重置', key: 'rest', size: 'small', icon: 'RefreshLeft',
    click: (model, formRef) => {
      formRef?.resetFields()
      pagination.value.current = 1
      tableRef.value?.httpRequestInstance()
    }
  },
  {
    name: '新增', type: 'success', size: 'small', icon: 'Plus',
    click: () => openAddDialog()
  },
  {
    name: '批量删除', type: 'danger', icon: 'Delete', size: 'small',
    click: () => handleBatchDelete()
  }
]

const columns = [
  { type: 'selection', width: 50 },
  { prop: 'id', label: 'ID', width: 60 },
  { prop: 'title', label: '商品名称', minWidth: 180 },
  {
    prop: 'category',
    label: '分类',
    width: 120,
    render: (_, { row }) => {
      const typeMap = { 'electronics': 'danger', 'jewelery': 'warning', "men's clothing": '', "women's clothing": 'success' }
      return <ElTag type={typeMap[row.category] || 'info'} size="small">{row.category}</ElTag>
    }
  },
  { prop: 'price', label: '价格', width: 100, formatter: (r) => `$${r.price}` },
  {
    prop: 'rating',
    label: '评分',
    width: 80,
    render: (_, { row }) => <span style="color: #e6a23c">{row.rating?.rate ?? '-'}</span>
  },
  {
    label: '操作',
    width: 160,
    render: (_, { row }) => {
      return <div>
        <el-button type="primary" size="small" text onClick={() => openEditDialog(row)}>编辑</el-button>
        <el-button type="danger" size="small" text onClick={() => handleDelete(row)} style="margin-left: 8px">删除</el-button>
      </div>
    }
  }
]

const mockRequest = async (params) => {
  const { formParams, ...rest } = params || {}
  const { pageIndex = 1, pageSize = 5, keyword, category, priceRange } = { ...formParams, ...rest }

  let filtered = await fetchProducts()

  if (keyword) {
    filtered = filtered.filter(item => item.title.toLowerCase().includes(keyword.toLowerCase()))
  }
  if (category) {
    filtered = filtered.filter(item => item.category === category)
  }
  if (priceRange) {
    if (priceRange === '100+') {
      filtered = filtered.filter(item => item.price >= 100)
    } else {
      const [min, max] = priceRange.split('-').map(Number)
      filtered = filtered.filter(item => item.price >= min && item.price <= max)
    }
  }

  const total = filtered.length
  const start = (pageIndex - 1) * pageSize
  return { data: filtered.slice(start, start + pageSize), total, pageSize, pageIndex }
}

const tableOptions = {
  border: true,
  httpRequest: mockRequest,
  apiParams: { url: '/products', method: 'GET', model: queryModel },
  configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' },
  rowkey: 'id',
  heightType: 'height',
  tabHeight: 350,
  // showHeaderBar: false
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(`确定删除 "${row.title}" 吗？`, '提示', { type: 'warning' })
    ElMessage.success('删除成功（模拟）')
    tableRef.value?.httpRequestInstance()
  } catch {}
}

const handleBatchDelete = async () => {
  const selection = tableRef.value?.getSelectionRows?.() || []
  if (!selection.length) {
    ElMessage.warning('请先选择要删除的数据')
    return
  }
  try {
    await ElMessageBox.confirm(`确定删除选中的 ${selection.length} 条数据吗？`, '提示', { type: 'warning' })
    ElMessage.success('批量删除成功（模拟）')
    tableRef.value?.httpRequestInstance()
  } catch {}
}

const openAddDialog = () => {
  const formModel = reactive({ title: '', price: '', category: 'electronics', description: '' })

  dialog({
    title: '新增商品',
    width: '600px',
    render: () => h(EsForm, {
      model: formModel,
      formItemList: [
        { prop: 'title', label: '名称', formtype: 'Input', span: 24, attrs: { placeholder: '请输入名称' } },
        { prop: 'price', label: '价格', formtype: 'Input', span: 12, attrs: { placeholder: '请输入价格', type: 'number' } },
        { prop: 'category', label: '分类', formtype: 'Select', span: 12, dataOptions: categoryOptions.filter(o => o.value) },
        { prop: 'description', label: '描述', formtype: 'Input', span: 24, attrs: { placeholder: '请输入描述', type: 'textarea', rows: 3 } }
      ]
    }),
    configBtn: [
      { name: '取消', click: (_, { close }) => close() },
      { name: '提交', type: 'primary', click: (_, { close }) => {
        ElMessage.success('新增成功（模拟）')
        close()
        tableRef.value?.httpRequestInstance()
      }}
    ]
  })
}

const openEditDialog = (row) => {
  const formModel = reactive({ ...row })

  dialog({
    title: '编辑商品',
    width: '600px',
    render: () => h(EsForm, {
      model: formModel,
      formItemList: [
        { prop: 'title', label: '名称', formtype: 'Input', span: 24, attrs: { placeholder: '请输入名称' } },
        { prop: 'price', label: '价格', formtype: 'Input', span: 12, attrs: { placeholder: '请输入价格', type: 'number' } },
        { prop: 'category', label: '分类', formtype: 'Select', span: 12, dataOptions: categoryOptions.filter(o => o.value) },
        { prop: 'description', label: '描述', formtype: 'Input', span: 24, attrs: { placeholder: '请输入描述', type: 'textarea', rows: 3 } }
      ]
    }),
    configBtn: [
      { name: '取消', click: (_, { close }) => close() },
      { name: '提交', type: 'primary', click: (_, { close }) => {
        ElMessage.success('编辑成功（模拟）')
        close()
        tableRef.value?.httpRequestInstance()
      }}
    ]
  })
}
</script>

<style scoped>
.example-advanced-form-table {
  padding: 0;
}
</style>
