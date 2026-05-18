<template>
  <div class="example-auto-fit-height">
    <div class="demo-controls">
      <el-radio-group v-model="heightMode" size="small">
        <el-radio-button label="fixed">固定高度 400px</el-radio-button>
        <el-radio-button label="fixed600">固定高度 600px</el-radio-button>
      </el-radio-group>
      <span class="mode-hint">切换后表格自动重算高度，表单展开/收起也会触发重算</span>
    </div>
    <es-table
      :key="heightMode"
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
    <div class="hint">
      <ElAlert type="success" :closable="false" show-icon>
        <template #title>
          <b>heightType: 'height' + tabHeight</b> — el-table 高度自动 = 容器 - 表单 - 分页。
          表单展开/收起时 ResizeObserver 自动触发高度重算，无需手动监听。
        </template>
      </ElAlert>
    </div>
  </div>
</template>

<script setup lang="jsx">
import { EsTable, EsForm } from 'es-plus'
import { ref, reactive, computed } from 'vue'
import { ElTag, ElAlert } from 'element-plus'

const heightMode = ref('fixed')
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

// minFoldRows: 1 → 默认只显示1行，展开/收起触发高度重算
const queryItems = [
  { prop: 'keyword', label: '关键词', formtype: 'Input', span: 6, attrs: { placeholder: '搜索商品', clearable: true } },
  { prop: 'category', label: '分类', formtype: 'Select', span: 6, dataOptions: categoryOptions, attrs: { clearable: true } },
  { prop: 'rating', label: '评分', formtype: 'Select', span: 6,
    dataOptions: [{ label: '全部', value: '' }, { label: '4星以上', value: '4' }, { label: '3星以上', value: '3' }],
    attrs: { clearable: true }
  },
  { prop: 'sortBy', label: '排序', formtype: 'Select', span: 6,
    dataOptions: [{ label: '默认', value: '' }, { label: '价格升序', value: 'price_asc' }, { label: '价格降序', value: 'price_desc' }],
    attrs: { clearable: true }
  }
]

const layoutFormProps = {
  fromLayProps: { labelWidth: '70px', minFoldRows: 1 },
  rowLayProps: { gutter: 16 }
}

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
  const { pageIndex = 1, pageSize = 5, keyword, category } = { ...formParams, ...rest }
  const res = await fetch('https://fakestoreapi.com/products')
  let filtered = await res.json()
  if (keyword) filtered = filtered.filter(item => item.title.toLowerCase().includes(keyword.toLowerCase()))
  if (category) filtered = filtered.filter(item => item.category === category)
  const total = filtered.length
  const start = (pageIndex - 1) * pageSize
  return { data: filtered.slice(start, start + pageSize), total, pageSize, pageIndex }
}

const tableOptions = computed(() => ({
  border: true,
  httpRequest: mockRequest,
  apiParams: { url: '/products', method: 'GET', model: queryModel },
  configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' },
  rowkey: 'id',
  heightType: 'height',
  tabHeight: heightMode.value === 'fixed600' ? 600 : 400
}))
</script>

<style scoped>
.example-auto-fit-height {
  padding: 0;
}
.demo-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 10px;
}
.mode-hint {
  font-size: 12px;
  color: #909399;
}
.hint {
  margin-top: 12px;
}
</style>
