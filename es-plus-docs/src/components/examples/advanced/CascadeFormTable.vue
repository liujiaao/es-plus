<template>
  <div class="example-cascade-form-table">
    <es-table
      ref="tableRef"
      :columns="columns"
      :options="tableOptions"
      v-model:data-source="tableData"
      v-model:pagination="pagination"
    >
      <es-form
        ref="formRef"
        :model="queryModel"
        :form-item-list="queryItems"
        :config-btn="queryBtns"
        :layout-form-props="layoutFormProps"
      />
    </es-table>
  </div>
</template>

<script setup lang="jsx">
import { ref, reactive, watch, computed } from 'vue'
import { ElMessage, ElTag } from 'element-plus'
import EsForm from 'es-plus/components/es-form'
import EsTable from 'es-plus/components/es-table'

const tableRef = ref(null)
const formRef = ref(null)
const tableData = ref([])
const pagination = ref({ pageSize: 5, current: 1, total: 0, pageSizes: [5, 10, 20] })

const queryModel = reactive({ keyword: '', category: '', subCategory: '', brand: '' })

const categoryOptions = [
  { label: '电子产品', value: 'electronics' },
  { label: '服装', value: 'clothing' },
  { label: '珠宝', value: 'jewelery' }
]

const subCategoryMap = {
  electronics: [
    { label: '手机', value: 'phone' },
    { label: '电脑', value: 'computer' },
    { label: '配件', value: 'accessory' }
  ],
  clothing: [
    { label: '男装', value: 'men' },
    { label: '女装', value: 'women' }
  ],
  jewelery: [
    { label: '戒指', value: 'ring' },
    { label: '项链', value: 'necklace' }
  ]
}

const brandMap = {
  phone: [
    { label: 'Apple', value: 'apple' },
    { label: 'Samsung', value: 'samsung' }
  ],
  computer: [
    { label: 'MacBook', value: 'macbook' },
    { label: 'ThinkPad', value: 'thinkpad' }
  ],
  accessory: [
    { label: 'Logitech', value: 'logitech' },
    { label: 'Anker', value: 'anker' }
  ],
  men: [{ label: 'Nike', value: 'nike' }, { label: 'Adidas', value: 'adidas' }],
  women: [{ label: 'ZARA', value: 'zara' }, { label: 'H&M', value: 'hm' }],
  ring: [{ label: 'Tiffany', value: 'tiffany' }],
  necklace: [{ label: 'Cartier', value: 'cartier' }]
}

const subCategoryOptions = ref([])
const brandOptions = ref([])

watch(() => queryModel.category, (val) => {
  queryModel.subCategory = ''
  queryModel.brand = ''
  subCategoryOptions.value = subCategoryMap[val] || []
  brandOptions.value = []
})

watch(() => queryModel.subCategory, (val) => {
  queryModel.brand = ''
  brandOptions.value = brandMap[val] || []
})

const queryItems = computed(() => [
  { prop: 'keyword', label: '关键词', formtype: 'Input', span: 6, attrs: { placeholder: '搜索商品', clearable: true } },
  { prop: 'category', label: '主分类', formtype: 'Select', span: 6, dataOptions: categoryOptions, attrs: { placeholder: '选择分类', clearable: true } },
  {
    prop: 'subCategory', label: '子分类', formtype: 'Select', span: 6,
    dataOptions: subCategoryOptions,
    isHidden: (model) => !model.category,
    attrs: { placeholder: '选择子分类', clearable: true }
  },
  {
    prop: 'brand', label: '品牌', formtype: 'Select', span: 6,
    dataOptions: brandOptions,
    isHidden: (model) => !model.subCategory,
    attrs: { placeholder: '选择品牌', clearable: true }
  }
])

const layoutFormProps = {
  fromLayProps: { labelWidth: '70px' },
  rowLayProps: { gutter: 16 }
}

const queryBtns = [
  { name: '查询', type: 'primary', key: 'query', icon: 'Search', triggerEvent: true },
  { name: '重置', key: 'rest', icon: 'RefreshLeft', triggerEvent: true }
]

const columns = [
  { prop: 'id', label: 'ID', width: 60 },
  { prop: 'title', label: '商品名称', minWidth: 180 },
  {
    prop: 'category', label: '分类', width: 120,
    render: (_, { row }) => {
      const typeMap = { 'electronics': 'danger', 'jewelery': 'warning', "men's clothing": '', "women's clothing": 'success' }
      return <ElTag type={typeMap[row.category] || 'info'} size="small">{row.category}</ElTag>
    }
  },
  { prop: 'price', label: '价格', width: 100, formatter: (r) => `$${r.price}` },
  {
    prop: 'rating', label: '评分', width: 80,
    render: (_, { row }) => <span style="color: #e6a23c">{row.rating?.rate ?? '-'}</span>
  }
]

const mockRequest = async (params) => {
  const { formParams, ...rest } = params || {}
  const { pageIndex = 1, pageSize = 5, keyword, category } = { ...formParams, ...rest }

  const res = await fetch('https://fakestoreapi.com/products')
  let filtered = await res.json()

  if (keyword) filtered = filtered.filter(item => item.title.toLowerCase().includes(keyword.toLowerCase()))
  if (category) filtered = filtered.filter(item => item.category === category)

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
  tabHeight: 400
}
</script>

<style scoped>
.example-cascade-form-table {
  padding: 0;
}
</style>
