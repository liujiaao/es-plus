<template>
  <div class="example-advanced-form-table">
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
        :config-btn="configBtn"
        :layout-form-props="layoutFormProps"
      />
    </es-table>
  </div>
</template>

<script setup lang="jsx">
import { EsTable, EsForm } from 'es-plus'
import { ref, reactive } from 'vue'
import { ElTag } from 'element-plus'
import { fetchProducts } from '@/utils/mock-api'

const tableRef = ref(null)
const tableData = ref([])
const pagination = ref({ pageSize: 5, current: 1, total: 0, pageSizes: [5, 10, 20] })

const queryModel = reactive({ keyword: '', category: '', priceRange: '', rating: '', sortBy: '' })

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
  { label: '$100 - $500', value: '100-500' },
  { label: '$500+', value: '500+' }
]

const ratingOptions = [
  { label: '全部评分', value: '' },
  { label: '4星以上', value: '4' },
  { label: '3星以上', value: '3' },
  { label: '2星以下', value: '2' }
]

const sortOptions = [
  { label: '默认排序', value: '' },
  { label: '价格升序', value: 'price_asc' },
  { label: '价格降序', value: 'price_desc' },
  { label: '评分升序', value: 'rating_asc' },
  { label: '评分降序', value: 'rating_desc' }
]

const queryItems = [
  { prop: 'keyword', label: '关键词', formtype: 'Input', span: 6, attrs: { placeholder: '搜索商品名称', clearable: true } },
  { prop: 'category', label: '分类', formtype: 'Select', span: 6, dataOptions: categoryOptions, attrs: { clearable: true } },
  { prop: 'priceRange', label: '价格区间', formtype: 'Select', span: 6, dataOptions: priceOptions, attrs: { clearable: true } },
  { prop: 'rating', label: '评分', formtype: 'Select', span: 6, dataOptions: ratingOptions, attrs: { clearable: true } },
  { prop: 'sortBy', label: '排序', formtype: 'Select', span: 6, dataOptions: sortOptions, attrs: { clearable: true } }
]

const layoutFormProps = {
  fromLayProps: { labelWidth: '70px', minFoldRows: 1 },
  rowLayProps: { gutter: 16 }
}

const configBtn = [
  { name: '查询', key: 'query', type: 'primary', icon: 'Search',
     triggerEvent: true
    // click: (model, refs, httpRequestInstance) => {
    //   httpRequestInstance?.(model)
    // }
  },
  { name: '重置', key: 'rest', icon: 'RefreshLeft',
        triggerEvent: true
    // click: (model, refs, httpRequestInstance) => {
    //   refs?.resetFields()
    //   setTimeout(() => httpRequestInstance?.(), 0)
    // }
  }
]

const columns = [
  { type: 'selection', width: 55 },
  { prop: 'id', label: 'ID', width: 60 },
  { prop: 'title', label: '商品名称', minWidth: 200 },
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
  }
]

const mockRequest = async (params) => {
  const { formParams, ...rest } = params || {}
  const { pageIndex = 1, pageSize = 5, keyword, category, priceRange, rating, sortBy } = { ...formParams, ...rest }

  let filtered = await fetchProducts()

  if (keyword) {
    filtered = filtered.filter(item => item.title.toLowerCase().includes(keyword.toLowerCase()))
  }
  if (category) {
    filtered = filtered.filter(item => item.category === category)
  }
  if (priceRange) {
    if (priceRange === '500+') {
      filtered = filtered.filter(item => item.price >= 500)
    } else {
      const [min, max] = priceRange.split('-').map(Number)
      filtered = filtered.filter(item => item.price >= min && item.price <= max)
    }
  }
  if (rating) {
    const minRate = Number(rating)
    if (minRate <= 2) {
      filtered = filtered.filter(item => (item.rating?.rate ?? 0) < minRate)
    } else {
      filtered = filtered.filter(item => (item.rating?.rate ?? 0) >= minRate)
    }
  }
  if (sortBy) {
    const [field, dir] = sortBy.split('_')
    filtered.sort((a, b) => {
      const va = field === 'price' ? a.price : (a.rating?.rate ?? 0)
      const vb = field === 'price' ? b.price : (b.rating?.rate ?? 0)
      return dir === 'asc' ? va - vb : vb - va
    })
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
  tabHeight: 350
}
</script>

<style scoped>
.example-advanced-form-table {
  padding: 0;
}
</style>
