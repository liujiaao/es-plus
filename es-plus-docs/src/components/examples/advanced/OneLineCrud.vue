<template>
  <div class="example-one-line-crud">
    <es-table
      ref="tableRef"
      :columns="columns"
      :options="tableOptions"
      v-model:data-source="tableData"
      v-model:pagination="pagination"
    >
      <template #default>
        <div class="toolbar">
          <el-button type="primary" icon="Plus" @click="openDialog()">新增</el-button>
        </div>
      </template>
    </es-table>
    <div class="hint">
      <ElAlert type="success" :closable="false" show-icon>
        <template #title>
          <b>useDialog + EsForm JSX render</b> — 弹窗表单无需模板声明，registerRef 获取表单实例进行验证，
          整个 CRUD 弹窗仅需一个函数调用。
        </template>
      </ElAlert>
    </div>
  </div>
</template>

<script setup lang="jsx">
import { ref, reactive } from 'vue'
import { ElMessage, ElTag, ElMessageBox, ElAlert } from 'element-plus'
import EsTable from 'es-plus/components/es-table'
import EsForm from 'es-plus/components/es-form'
import { useDialog } from 'es-plus'

const tableRef = ref(null)
const dialog = useDialog()
const tableData = ref([])
const pagination = ref({ pageSize: 5, current: 1, total: 0, pageSizes: [5, 10, 20] })

const categoryOptions = [
  { label: '电子产品', value: 'electronics' },
  { label: '珠宝', value: 'jewelery' },
  { label: '男装', value: "men's clothing" },
  { label: '女装', value: "women's clothing" }
]

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
    prop: 'operate', label: '操作', width: 140,
    btns: [
      { name: '编辑', type: 'primary', clickEvent: (row) => openDialog(row) },
      { name: '删除', type: 'danger', clickEvent: (row) => handleDelete(row) }
    ]
  }
]

const mockRequest = async (params) => {
  const { pageIndex = 1, pageSize = 5 } = params || {}
  const res = await fetch('https://fakestoreapi.com/products')
  const all = await res.json()
  const total = all.length
  const start = (pageIndex - 1) * pageSize
  return { data: all.slice(start, start + pageSize), total, pageSize, pageIndex }
}

const tableOptions = {
  border: true,
  httpRequest: mockRequest,
  apiParams: { url: '/products', method: 'GET' },
  configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' },
  rowkey: 'id',
  heightType: 'height',
  tabHeight: 380
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(`确定删除 "${row.title}"？`, '提示', { type: 'warning' })
    ElMessage.success('删除成功（模拟）')
    tableRef.value?.httpRequestInstance()
  } catch {}
}

// 一个函数完成 CRUD 弹窗：新增传空，编辑传 row
const openDialog = (row) => {
  const isEdit = !!row
  const formModel = reactive(isEdit ? { ...row } : { title: '', price: '', category: 'electronics', description: '' })

  dialog({
    title: isEdit ? '编辑商品' : '新增商品',
    width: '550px',
    render: (h, { registerRef }) => (
      <EsForm
        ref={(el) => { if (el) registerRef('crudForm', el) }}
        model={formModel}
        formItemList={[
          { prop: 'title', label: '名称', formtype: 'Input', span: 24, attrs: { placeholder: '请输入名称' } },
          { prop: 'price', label: '价格', formtype: 'Input', span: 12, attrs: { placeholder: '价格', type: 'number' } },
          { prop: 'category', label: '分类', formtype: 'Select', span: 12, dataOptions: categoryOptions },
          { prop: 'description', label: '描述', formtype: 'Input', span: 24, attrs: { type: 'textarea', rows: 3, placeholder: '描述' } }
        ]}
      />
    ),
    configBtn: [
      { name: '取消', click: (_, { close }) => close() },
      { name: '提交', type: 'primary', click: (_, { close, getRefs }) => {
        ElMessage.success(`${isEdit ? '编辑' : '新增'}成功（模拟）`)
        close()
        tableRef.value?.httpRequestInstance()
      }}
    ]
  })
}
</script>

<style scoped>
.example-one-line-crud {
  padding: 0;
}
.toolbar {
  padding-bottom: 10px;
}
.hint {
  margin-top: 12px;
}
</style>
