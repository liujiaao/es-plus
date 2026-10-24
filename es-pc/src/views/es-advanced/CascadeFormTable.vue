<template>
  <div class="example-cascade-form-table">
    <es-table
      :columns="columns"
      :options="tableOptions"
      v-model:data-source="tableData"
      v-model:pagination="pagination"
    >
      <es-form
        :model="queryModel"
        :form-item-list="queryItems"
        :config-btn="queryBtns"
        :layout-form-props="layoutFormProps"
      />
    </es-table>
  </div>
</template>

<script setup lang="jsx">
import { EsTable, EsForm } from '@es-plus/adapter-antdv'
import { ref, reactive, watch, computed } from 'vue'
import { Tag } from 'ant-design-vue'
import { fetchProducts } from '@/utils/mock-api'
import { tagColor } from '@/utils/antdv-colors'

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
  { prop: 'keyword', label: '关键词', formtype: 'Input', span: 6, attrs: { placeholder: '搜索商品', allowClear: true } },
  { prop: 'category', label: '主分类', formtype: 'Select', span: 6, dataOptions: categoryOptions, attrs: { placeholder: '选择分类', allowClear: true } },
  {
    prop: 'subCategory', label: '子分类', formtype: 'Select', span: 6,
    dataOptions: subCategoryOptions,
    isHidden: (model) => !model.category,
    attrs: { placeholder: '选择子分类', allowClear: true }
  },
  {
    prop: 'brand', label: '品牌', formtype: 'Select', span: 6,
    dataOptions: brandOptions,
    isHidden: (model) => !model.subCategory,
    attrs: { placeholder: '选择品牌', allowClear: true }
  }
])

const layoutFormProps = {
  formLayProps: { labelWidth: '70px' },
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
    prop: 'category', label: '主分类', width: 100,
    render: (_, { row }) => {
      const typeMap = { electronics: 'danger', clothing: 'success', jewelery: 'warning' }
      const labelMap = { electronics: '电子产品', clothing: '服装', jewelery: '珠宝' }
      return <Tag color={tagColor(typeMap[row.category] || 'info')}>{labelMap[row.category] || row.category}</Tag>
    }
  },
  { prop: 'subCategory', label: '子分类', width: 90, formatter: (r) => subLabel[r.subCategory] || r.subCategory },
  { prop: 'brand', label: '品牌', width: 100, formatter: (r) => brandLabel[r.brand] || r.brand },
  { prop: 'price', label: '价格', width: 100, formatter: (r) => `$${r.price}` },
  {
    prop: 'rating', label: '评分', width: 80,
    render: (_, { row }) => <span style="color: #e6a23c">{row.rating?.rate ?? '-'}</span>
  }
]

// 级联选择的值要能真正落到数据上：Fake Store 的分类只有
// electronics / jewelery / men's clothing / women's clothing，先归一成三分法，
// 再按索引派生属于当前分类的子分类与品牌，三级筛选才都有命中项。
const mainCategoryOf = (category) =>
  category === 'electronics' || category === 'jewelery' ? category : 'clothing'

const enrichProducts = (list) => list.map((p, i) => {
  const category = mainCategoryOf(p.category)
  const subs = subCategoryMap[category].map((s) => s.value)
  const subCategory = subs[i % subs.length]
  const brands = brandMap[subCategory]
  return { ...p, category, subCategory, brand: brands[i % brands.length].value }
})

const subLabel = {}
const brandLabel = {}
Object.values(subCategoryMap).flat().forEach((o) => { subLabel[o.value] = o.label })
Object.values(brandMap).flat().forEach((o) => { brandLabel[o.value] = o.label })

const mockRequest = async (params) => {
  const { formParams, ...rest } = params || {}
  const { pageIndex = 1, pageSize = 5, keyword, category, subCategory, brand } = { ...formParams, ...rest }

  let filtered = enrichProducts(await fetchProducts())

  if (keyword) filtered = filtered.filter(item => item.title.toLowerCase().includes(keyword.toLowerCase()))
  if (category) filtered = filtered.filter(item => item.category === category)
  if (subCategory) filtered = filtered.filter(item => item.subCategory === subCategory)
  if (brand) filtered = filtered.filter(item => item.brand === brand)

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
