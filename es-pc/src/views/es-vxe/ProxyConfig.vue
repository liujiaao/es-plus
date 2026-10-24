<template>
  <div>
    <a-alert
      type="info"
      show-icon
      style="margin-bottom: 10px"
      message="proxyConfig 服务端分页：vxe 自管分页状态；EsForm 与 EsTable 为兄弟结构，按钮通过 click 回调调用 commitProxy('reload') 重置到第 1 页并重新请求"
    />
    <es-form
      :model="queryForm"
      :form-item-list="formItems"
      :config-btn="formBtns"
      style="margin-bottom: 8px"
    />
    <es-table ref="tableRef" :columns="columns" :options="tableOptions" />
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { EsTable, EsForm } from '@es-plus/adapter-antdv'

const tableRef = ref(null)

const queryForm = reactive({ keyword: '', department: '' })

const formItems = [
  { prop: 'keyword', label: '关键词', formtype: 'Input', placeholder: '搜索姓名', attrs: { allowClear: true } },
  {
    prop: 'department', label: '部门', formtype: 'Select',
    attrs: { allowClear: true, placeholder: '全部' },
    dataOptions: [
      { label: '全部', value: '' },
      { label: '技术部', value: '技术部' },
      { label: '产品部', value: '产品部' },
      { label: '市场部', value: '市场部' },
    ],
  },
]

// 查询/重置用 reload：它会把分页重置到第 1 页再请求；
// query 只沿用当前页码（适合删改后的原地刷新），在第 5 页搜索可能筛出空页。
const formBtns = [
  {
    name: '查询', type: 'primary', icon: 'Search',
    click: () => tableRef.value?.vxeInstance?.()?.commitProxy?.('reload'),
  },
  {
    name: '重置', type: 'default', icon: 'RefreshLeft',
    click: () => {
      queryForm.keyword = ''
      queryForm.department = ''
      tableRef.value?.vxeInstance?.()?.commitProxy?.('reload')
    },
  },
]

const columns = [
  { type: 'index', label: '序号', width: 70 },
  { prop: 'name', label: '姓名', minWidth: 120 },
  { prop: 'department', label: '部门', width: 120 },
  { prop: 'position', label: '职位', width: 130 },
  { prop: 'salary', label: '薪资', width: 120, align: 'right' },
]

// 模拟后端数据
const allData = Array.from({ length: 100 }, (_, i) => ({
  id: i + 1,
  name: `员工${i + 1}`,
  department: ['技术部', '产品部', '市场部', '设计部'][i % 4],
  position: ['工程师', '高级工程师', '经理', '架构师'][i % 4],
  salary: `¥${(8000 + i * 300).toLocaleString()}`,
}))

const tableOptions = {
  engine: 'vxe',
  border: true,
  rowkey: 'id',
  proxyConfig: {
    autoLoad: true,
    // vxe v4 使用 response 替代已废弃的 props 做响应字段映射
    response: { result: 'result', total: 'page.total' },
    ajax: {
      query: ({ page }) =>
        new Promise((resolve) => {
          setTimeout(() => {
            const kw = queryForm.keyword.toLowerCase()
            const dept = queryForm.department
            const filtered = allData.filter(
              (row) => (!kw || row.name.toLowerCase().includes(kw)) && (!dept || row.department === dept)
            )
            const start = (page.currentPage - 1) * page.pageSize
            resolve({
              result: filtered.slice(start, start + page.pageSize),
              page: { total: filtered.length },
            })
          }, 300)
        }),
    },
  },
  // pagerConfig 走 vxeConfig 逃生舱：引擎只在 proxyConfig 场景下按 vxeConfig.pagerConfig
  // 启用并配置分页器；写在 options 顶层不会被读取。
  vxeConfig: { pagerConfig: { pageSize: 10, pageSizes: [10, 20, 50] } },
}
</script>
