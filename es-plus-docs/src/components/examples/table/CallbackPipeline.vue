<template>
  <div class="example-callback-pipeline">
    <div class="toolbar">
      <el-button type="primary" size="small" @click="tableRef?.httpRequestInstance()">刷新数据</el-button>
      <el-button size="small" @click="tableRef?.httpRequestInstance({ department: '技术部' })">筛选技术部</el-button>
    </div>
    <es-table
      ref="tableRef"
      v-model:data-source="tableData"
      v-model:pagination="pagination"
      :columns="columns"
      :options="tableOptions"
    />
  </div>
</template>

<script setup>
import { EsTable } from 'es-plus'
import { ref, h } from 'vue'
import { ElTag } from 'element-plus'

const tableRef = ref()
const tableData = ref([])
const pagination = ref({ pageSize: 5, current: 1, total: 0, pageSizes: [5, 10] })

// 模拟后端接口（字段名与前端不同）
// brcb 转换后的字段在 formParams 中，顶层仍有 pageIndex/pageSize
const mockBackendRequest = async (params) => {
  const fp = params.formParams || {}
  const { pageNum = params.pageIndex || 1, pageSize = params.pageSize || 5, deptName, typeCode } = fp
  const allData = Array.from({ length: 28 }, (_, i) => ({
    user_id: i + 1,
    user_name: `员工${i + 1}`,
    dept_name: ['技术部', '产品部', '设计部', '市场部'][i % 4],
    type_code: i % 3 === 0 ? 0 : 1,
    create_time: `2024-0${(i % 9) + 1}-${String((i % 28) + 1).padStart(2, '0')}`
  }))
  let filtered = allData
  if (deptName) filtered = filtered.filter(d => d.dept_name === deptName)
  if (typeCode !== undefined && typeCode !== null) filtered = filtered.filter(d => d.type_code === typeCode)
  const total = filtered.length
  const start = (pageNum - 1) * pageSize
  return {
    result_data: filtered.slice(start, start + pageSize),
    total_count: total,
    page_size: pageSize,
    page_num: pageNum
  }
}

const columns = [
  { prop: 'id', label: 'ID', width: 60 },
  { prop: 'name', label: '姓名' },
  { prop: 'department', label: '部门' },
  {
    prop: 'active',
    label: '状态',
    width: 80,
    render: (_, { row }) => h(ElTag, { type: row.active ? 'success' : 'info', size: 'small' }, () => row.active ? '在职' : '离职')
  },
  { prop: 'joinDate', label: '入职日期' }
]

const tableOptions = {
  border: true,
  // 默认参数：每次请求自动携带
  // entryQuery: { typeCode: 1 },
  httpRequest: mockBackendRequest,
  apiParams: { url: '/api/employees', method: 'GET', model: { typeCode: 1 } },
  // 字段映射：后端字段 → 前端字段
  configTableOut: {
    total: 'total_count',
    tableData: 'result_data',
    pageSize: 'page_size',
    current: 'page_num'
  },
  // 请求回调管线
  listenToCallBack: {
    // 请求前拦截：前端字段 → 后端字段
    brcb: (params) => ({
      ...params,
      pageNum: params.pageIndex,
      deptName: params.department
    }),
    // 响应后拦截：后端数据 → 前端格式
    qrcb: (res) => {
      if (res?.result_data) {
        res.result_data = res.result_data.map(d => ({
          id: d.user_id,
          name: d.user_name,
          department: d.dept_name,
          active: d.type_code === 1,
          joinDate: d.create_time
        }))
      }
      return res
    }
  }
}
</script>

<style scoped>
.example-callback-pipeline {
  padding: 0;
}
.toolbar {
  display: flex;
  gap: 8px;
  padding-bottom: 10px;
}
</style>
