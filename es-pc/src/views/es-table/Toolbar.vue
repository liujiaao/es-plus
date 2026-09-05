<template>
  <div class="example-toolbar-table">
    <es-table
      :data-source="tableData"
      :columns="columns"
      :options="tableOptions"
    >
      <template #default>
        <a-button type="primary" size="small">
          <DownloadOutlined /> 导出
        </a-button>
        <a-button size="small">
          <PrinterOutlined /> 打印
        </a-button>
        <a-button size="small" @click="handleRefresh">
          <ReloadOutlined /> 刷新
        </a-button>
      </template>
    </es-table>
  </div>
</template>

<script setup>
import { EsTable } from '@es-plus/adapter-antdv'
import { ref } from 'vue'
import { message } from 'ant-design-vue'
import { DownloadOutlined, PrinterOutlined, ReloadOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons-vue'

const tableData = ref([
  { id: 1, name: '产品A', category: '电子', price: 299, stock: 100 },
  { id: 2, name: '产品B', category: '家居', price: 159, stock: 50 },
  { id: 3, name: '产品C', category: '电子', price: 499, stock: 30 },
  { id: 4, name: '产品D', category: '服装', price: 89, stock: 200 }
])

const columns = [
  { prop: 'id', label: 'ID', width: 60 },
  { prop: 'name', label: '产品名称', minWidth: 150 },
  { prop: 'category', label: '分类', width: 100 },
  { prop: 'price', label: '价格', width: 100, formatter: (row) => `¥${row.price}` },
  { prop: 'stock', label: '库存', width: 100 }
]

const tableOptions = {
  border: true,
  stripe: true,
  configBtn: [
    { name: '新增', type: 'primary', icon: 'Plus', code: 2, click: () => message.success('点击了新增') },
    { name: '批量删除', type: 'danger', icon: 'Delete', code: 2, click: () => message.warning('点击了批量删除') }
  ],
  leftText: '产品列表'
}

const handleRefresh = () => {
  message.success('已刷新')
}
</script>

<style scoped>
.example-toolbar-table {
  padding: 0;
}
</style>
