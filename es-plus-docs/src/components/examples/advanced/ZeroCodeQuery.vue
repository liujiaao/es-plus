<template>
  <div class="example-zero-code-query">
    <div class="comparison-header">
      <ElTag type="danger" size="large" effect="dark">传统写法 50+ 行</ElTag>
      <span class="arrow">→</span>
      <ElTag type="success" size="large" effect="dark">es-plus 配置 10 行</ElTag>
    </div>
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
        :layout-form-props="layoutFormProps"
      />
    </es-table>
    <div class="code-hint">
      <ElAlert type="success" :closable="false" show-icon>
        <template #title>
          无需手写：查询事件绑定、重置清空逻辑、分页请求、loading 状态、数据赋值。
          <b>triggerEvent + apiParams.model</b> 自动完成全部联动。
        </template>
      </ElAlert>
    </div>
  </div>
</template>

<script setup lang="jsx">
import { EsTable, EsForm } from 'es-plus'
import { ref, reactive } from 'vue'
import { ElTag, ElAlert } from 'element-plus'
import { fetchProducts } from '@/utils/mock-api'

const tableRef = ref(null)
const tableData = ref([])
const pagination = ref({ pageSize: 5, current: 1, total: 0, pageSizes: [5, 10, 20] })
const queryModel = reactive({ keyword: '', category: '' })

const categoryOptions = [
  { label: '全部分类', value: '' },
  { label: '电子产品', value: 'electronics' },
  { label: '珠宝', value: 'jewelery' },
  { label: '男装', value: "men's clothing" },
  { label: '女装', value: "women's clothing" }
]

// 仅声明表单项，无需绑定事件
const queryItems = [
  { prop: 'keyword', label: '关键词', formtype: 'Input', span: 8, attrs: { placeholder: '搜索商品', clearable: true } },
  { prop: 'category', label: '分类', formtype: 'Select', span: 8, dataOptions: categoryOptions, attrs: { clearable: true } }
]

const layoutFormProps = {
  fromLayProps: { labelWidth: '70px' },
  rowLayProps: { gutter: 16 }
}

// triggerEvent: true → 自动触发查询/重置，零手写事件代码
const queryBtns = [
  { name: '查询', type: 'primary', key: 'query', icon: 'Search', triggerEvent: true },
  { name: '重置', key: 'rest', icon: 'RefreshLeft', triggerEvent: true }
]

const columns = [
  { prop: 'id', label: 'ID', width: 60 },
  { prop: 'title', label: '商品名称', minWidth: 200 },
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
  let filtered = await fetchProducts()
  if (keyword) filtered = filtered.filter(item => item.title.toLowerCase().includes(keyword.toLowerCase()))
  if (category) filtered = filtered.filter(item => item.category === category)
  const total = filtered.length
  const start = (pageIndex - 1) * pageSize
  return { data: filtered.slice(start, start + pageSize), total, pageSize, pageIndex }
}

// apiParams.model → 表单数据自动合并到每次请求（含分页）
const tableOptions = {
  border: true,
  httpRequest: mockRequest,
  apiParams: { url: '/products', method: 'GET', model: queryModel },
  configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' },
  rowkey: 'id',
  heightType: 'height',
  tabHeight: 380
}
</script>

<style scoped>
.example-zero-code-query {
  padding: 0;
}
.comparison-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
}
.arrow {
  font-size: 20px;
  color: #67c23a;
  font-weight: bold;
}
.code-hint {
  margin-top: 12px;
}
</style>
