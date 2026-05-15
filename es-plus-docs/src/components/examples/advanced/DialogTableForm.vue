<template>
  <div class="example-dialog-table-form">
    <el-button type="primary" @click="openSelectDialog">选择商品</el-button>
    <div v-if="selectedProducts.length" class="selected-section">
      <h4>已选商品</h4>
      <es-table
        :data-source="selectedProducts"
        :columns="selectedColumns"
        :options="{ border: true, size: 'small' }"
      />
    </div>
  </div>
</template>

<script setup lang="jsx">
import { ref, reactive } from 'vue'
import { ElMessage, ElTag } from 'element-plus'
import EsTable from 'es-plus/components/es-table'
import EsForm from 'es-plus/components/es-form'
import { useDialog } from 'es-plus'

const selectDialog = useDialog()
const editDialog = useDialog()
const selectedProducts = ref([])

const categoryMap = {
  'electronics': { text: '电子产品', type: 'danger' },
  'jewelery': { text: '珠宝', type: 'warning' },
  "men's clothing": { text: '男装', type: '' },
  "women's clothing": { text: '女装', type: 'success' }
}

const allProducts = ref([])
const fetchProducts = async () => {
  const res = await fetch('https://fakestoreapi.com/products')
  allProducts.value = await res.json()
}

const selectColumns = [
  { prop: 'id', label: 'ID', width: 50 },
  { prop: 'title', label: '商品名称', minWidth: 180 },
  {
    prop: 'category', label: '分类', width: 100,
    render: (_, { row }) => {
      const c = categoryMap[row.category] || { text: row.category, type: 'info' }
      return <ElTag type={c.type} size="small">{c.text}</ElTag>
    }
  },
  { prop: 'price', label: '价格', width: 80, formatter: (r) => `$${r.price}` },
  {
    prop: 'operate', label: '操作', width: 120,
    btns: [
      { name: '编辑', type: 'primary', clickEvent: (row) => openEditDialog(row) },
      { name: '选择', type: 'success', clickEvent: (row) => addProduct(row) }
    ]
  }
]

const selectedColumns = [
  { prop: 'id', label: 'ID', width: 50 },
  { prop: 'title', label: '商品名称', minWidth: 160 },
  { prop: 'price', label: '价格', width: 80, formatter: (r) => `$${r.price}` },
  { prop: 'quantity', label: '数量', width: 80 },
  {
    prop: 'operate', label: '操作', width: 80,
    btns: [
      { name: '移除', type: 'danger', clickEvent: (row) => {
        selectedProducts.value = selectedProducts.value.filter(p => p.id !== row.id)
      }}
    ]
  }
]

const addProduct = (row) => {
  if (selectedProducts.value.find(p => p.id === row.id)) {
    ElMessage.warning('该商品已选择')
    return
  }
  selectedProducts.value.push({ ...row, quantity: 1 })
  ElMessage.success(`已选择: ${row.title}`)
}

const openSelectDialog = async () => {
  await fetchProducts()
  selectDialog({
    title: '选择商品',
    width: '800px',
    render: () => (
      <EsTable
        dataSource={allProducts.value}
        columns={selectColumns}
        options={{ border: true, size: 'small', heightType: 'height', tabHeight: 400 }}
      />
    ),
    configBtn: [
      { name: '关闭', click: (_, { close }) => close() }
    ]
  })
}

const openEditDialog = (row) => {
  const formModel = reactive({ ...row })

  editDialog({
    title: `编辑 — ${row.title}`,
    width: '500px',
    render: (h, { registerRef }) => (
      <EsForm
        ref={(el) => { if (el) registerRef('editForm', el) }}
        model={formModel}
        formItemList={[
          { prop: 'title', label: '名称', formtype: 'Input', span: 24, attrs: { placeholder: '商品名称' } },
          { prop: 'price', label: '价格', formtype: 'Input', span: 12, attrs: { placeholder: '价格', type: 'number' } },
          { prop: 'category', label: '分类', formtype: 'Input', span: 12, attrs: { placeholder: '分类', disabled: true } },
          { prop: 'description', label: '描述', formtype: 'Input', span: 24, attrs: { placeholder: '描述', type: 'textarea', rows: 3 } }
        ]}
      />
    ),
    configBtn: [
      { name: '取消', click: (_, { close }) => close() },
      { name: '保存', type: 'primary', click: (_, { close }) => {
        Object.assign(row, formModel)
        ElMessage.success('保存成功（模拟）')
        close()
      }}
    ]
  })
}
</script>

<style scoped>
.example-dialog-table-form {
  padding: 0;
}
.selected-section {
  margin-top: 16px;
}
.selected-section h4 {
  margin-bottom: 8px;
  color: #606266;
  font-size: 14px;
}
</style>
