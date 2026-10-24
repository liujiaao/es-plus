<template>
  <div class="example-dialog-table">
    <a-button type="primary" @click="openProductPicker">商品选择弹窗</a-button>
    <!-- 把弹窗里选中的结果回显出来，才能看出「弹窗内表格 + 跨页选择」真的把数据带回来了 -->
    <div v-if="selectedProducts.length" class="picked">
      <span class="picked-label">已选 {{ selectedProducts.length }} 个商品：</span>
      <a-tag v-for="p in selectedProducts" :key="p.id" color="blue">{{ p.title }}</a-tag>
      <a-button type="link" size="small" @click="selectedProducts = []">清空</a-button>
    </div>
  </div>
</template>

<script setup lang="jsx">
import { ref } from 'vue'
import { message, Tag } from 'ant-design-vue'
import { EsTable,  useDialog } from '@es-plus/adapter-antdv'
import { fetchProducts } from '@/utils/mock-api'

const dialog = useDialog()
const selectedProducts = ref([])

const columns = [
   {
    type: 'selection',
    width: 55
   },
  { prop: 'id', label: 'ID', width: 60 },
  { prop: 'title', label: '标题' },
  {
    prop: 'category',
    label: '分类',
    width: 120,
    render: (_, { row }) => {
      const typeMap = { 'electronics': 'error', 'jewelery': 'warning', "men's clothing": 'default', "women's clothing": 'success' }
      return <Tag color={typeMap[row.category] || 'processing'}>{row.category}</Tag>
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
  const { pageIndex = 1, pageSize = 5 } = params || {}
  const allData = await fetchProducts()
  const total = allData.length
  const start = (pageIndex - 1) * pageSize
  return { data: allData.slice(start, start + pageSize), total, pageSize, pageIndex }
}

const tableOptions = {
  border: true,
  cachePageSelection: true,
  rowkey: 'id',
  leftText: '商品列表',
  httpRequest: mockRequest,
  apiParams: { url: '/products', method: 'GET' },
  configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' },
  heightType: 'height',
  tabHeight: 380
}

const openProductPicker = () => {
  const tableData = ref([])
  const pagination = ref({ pageSize: 5, current: 1, total: 0, pageSizes: [5, 10] })
  // Use closure variable as reliable fallback for capturing the EsTable instance
  let tableInstance = null

  dialog({
    title: '选择商品',
    width: '750px',
    render: (h, { registerRef }) => (
      <EsTable
        ref={(el) => {
          if (el) {
            tableInstance = el
            registerRef('tableRef', el)
          }
        }}
        v-model:data-source={tableData.value}
        v-model:pagination={pagination.value}
        columns={columns}
        options={tableOptions}
      />
    ),
    configBtn: [
      { name: '取消', click: (_, { close }) => close() },
      {
        name: '确认选择',
        type: 'primary',
        icon: 'Check',
        click: (instance, { close, getRefs }) => {
          const refFromGetRefs = getRefs('tableRef')
          const tableRef = tableInstance || refFromGetRefs
          const selection = tableRef?.getSelectionRows?.() || []
          if (!selection.length) {
            message.warning('请至少选择一个商品')
            return
          }
          selectedProducts.value = selection
          message.success(`已选择 ${selection.length} 个商品`)
          close()
        }
      }
    ]
  })
}
</script>

<style scoped>
.example-dialog-table {
  padding: 20px;
}
.picked {
  margin-top: 16px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.picked-label {
  font-size: 13px;
  color: #606266;
}
</style>
