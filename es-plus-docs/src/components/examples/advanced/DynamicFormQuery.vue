<template>
  <div class="example-dynamic-form-query">
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
    <div class="hint">
      <ElAlert type="success" :closable="false" show-icon>
        <template #title>
          <b>isHidden + formItmeRequestInstance</b> — 表单项动态显隐零模板代码，
          级联选项按需加载，apiParams.model 自动同步表单值到请求。
        </template>
      </ElAlert>
    </div>
  </div>
</template>

<script setup lang="jsx">
import { EsTable, EsForm } from 'es-plus'
import { ref, reactive, watch, computed } from 'vue'
import { ElMessage, ElTag, ElAlert } from 'element-plus'

const tableRef = ref(null)
const formRef = ref(null)
const tableData = ref([])
const pagination = ref({ pageSize: 5, current: 1, total: 0, pageSizes: [5, 10, 20] })

const queryModel = reactive({
  keyword: '',
  category: '',
  subCategory: '',
  brand: '',
  priceRange: ''
})

const categoryOptions = [
  { label: '电子产品', value: 'electronics' },
  { label: '服装', value: 'clothing' },
  { label: '珠宝', value: 'jewelery' }
]

const subCategoryMap = {
  electronics: [{ label: '手机', value: 'phone' }, { label: '电脑', value: 'computer' }],
  clothing: [{ label: '男装', value: 'men' }, { label: '女装', value: 'women' }],
  jewelery: [{ label: '戒指', value: 'ring' }]
}

const brandMap = {
  phone: [{ label: 'Apple', value: 'apple' }, { label: 'Samsung', value: 'samsung' }],
  computer: [{ label: 'MacBook', value: 'macbook' }, { label: 'ThinkPad', value: 'thinkpad' }],
  men: [{ label: 'Nike', value: 'nike' }],
  women: [{ label: 'ZARA', value: 'zara' }],
  ring: [{ label: 'Tiffany', value: 'tiffany' }]
}

const subCategoryOptions = ref([])
const brandOptions = ref([])

// isHidden: 函数式声明显隐 — 无需 v-if，无需模板代码
const queryItems = computed(() => [
  { prop: 'keyword', label: '关键词', formtype: 'Input', span: 6, attrs: { placeholder: '搜索商品', clearable: true } },
  { prop: 'category', label: '分类', formtype: 'Select', span: 6, dataOptions: categoryOptions, attrs: { placeholder: '选择分类', clearable: true } },
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
  },
  {
    prop: 'priceRange', label: '价格', formtype: 'Select', span: 6,
    dataOptions: [
      { label: '全部', value: '' },
      { label: '$0-$50', value: '0-50' },
      { label: '$50-$100', value: '50-100' },
      { label: '$100+', value: '100+' }
    ],
    attrs: { clearable: true }
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

// watch 级联：选上级 → 清空下级 → 加载选项
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

const columns = [
  { prop: 'id', label: 'ID', width: 60 },
  { prop: 'title', label: '商品名称', minWidth: 180 },
  {
    prop: 'category', label: '分类', width: 120,
    render: (_, { row }) => {
      const map = { 'electronics': 'danger', 'jewelery': 'warning', "men's clothing": '', "women's clothing": 'success' }
      return <ElTag type={map[row.category] || 'info'} size="small">{row.category}</ElTag>
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
  const { pageIndex = 1, pageSize = 5, keyword, category, priceRange } = { ...formParams, ...rest }
  const res = await fetch('https://fakestoreapi.com/products')
  let filtered = await res.json()
  if (keyword) filtered = filtered.filter(item => item.title.toLowerCase().includes(keyword.toLowerCase()))
  if (category) filtered = filtered.filter(item => item.category === category)
  if (priceRange) {
    if (priceRange === '100+') filtered = filtered.filter(item => item.price >= 100)
    else {
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
  tabHeight: 400
}
</script>

<style scoped>
.example-dynamic-form-query {
  padding: 0;
}
.hint {
  margin-top: 12px;
}
</style>
