<template>
  <div class="example-table-height">
    <div class="height-controls">
      <span>容器高度：</span>
      <el-radio-group v-model="containerHeight" size="small">
        <el-radio-button label="300px" />
        <el-radio-button label="500px" />
        <el-radio-button label="100%" />
      </el-radio-group>
    </div>
    <div class="table-wrapper" :style="{ height: containerHeight }">
      <es-table
        v-model:data-source="tableData"
        v-model:pagination="pagination"
        :columns="columns"
        :options="tableOptions"
      />
    </div>
  </div>
</template>

<script setup>
import { EsTable } from 'es-plus'
import { ref, h } from 'vue'
import { ElTag } from 'element-plus'

const containerHeight = ref('500px')

const tableData = ref([])
const pagination = ref({ pageSize: 10, current: 1, total: 0, pageSizes: [10, 20, 50] })

const mockRequest = async (params) => {
  const { pageIndex = 1, pageSize = 10 } = params || {}
  const allData = Array.from({ length: 86 }, (_, i) => ({
    id: i + 1,
    name: `用户${i + 1}`,
    department: ['技术部', '产品部', '设计部', '市场部'][i % 4],
    status: ['active', 'inactive'][i % 2],
    email: `user${i + 1}@example.com`
  }))
  const total = allData.length
  const start = (pageIndex - 1) * pageSize
  return { data: allData.slice(start, start + pageSize), total, pageSize, pageIndex }
}

const columns = [
  { prop: 'id', label: 'ID', width: 60 },
  { prop: 'name', label: '姓名' },
  { prop: 'department', label: '部门' },
  {
    prop: 'status',
    label: '状态',
    width: 100,
    render: (_, { row }) => h(ElTag, { type: row.status === 'active' ? 'success' : 'info', size: 'small' }, () => row.status === 'active' ? '在职' : '离职')
  },
  { prop: 'email', label: '邮箱' }
]

// heightType: 'height' 让表格继承父容器高度，ResizeObserver 自动计算表格可用高度
const tableOptions = {
  border: true,
  heightType: 'height',
  httpRequest: mockRequest,
  apiParams: { url: '/api/users', method: 'GET' },
  configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' }
}
</script>

<style scoped>
.example-table-height {
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}
.height-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.table-wrapper {
  width: 100%;
  min-height: 300px;
  overflow: hidden;
}
</style>
