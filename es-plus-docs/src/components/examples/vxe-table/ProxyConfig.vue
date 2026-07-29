<template>
  <div>
    <el-alert type="info" :closable="false" style="margin-bottom:10px"
      description="proxyConfig 服务端分页：vxe 自管分页状态，EsForm 搜索条件直接与 proxyConfig.ajax 联动" />
    <!-- EsForm 搜索区 -->
    <es-form
      :model="queryForm"
      :form-item-list="formItems"
      :config-btn="formBtns"
      style="margin-bottom: 8px;"
    />
    <es-table
      ref="tableRef"
      :columns="columns"
      :options="tableOptions"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { EsTable, EsForm } from 'es-plus'

const tableRef = ref<InstanceType<typeof EsTable> | null>(null)

const queryForm = reactive({ keyword: '', department: '' })

const formItems = [
  { prop: 'keyword', label: '关键词', formtype: 'Input', placeholder: '搜索姓名' },
  {
    prop: 'department', label: '部门', formtype: 'Select',
    dataOptions: [
      { label: '全部', value: '' },
      { label: '技术部', value: '技术部' },
      { label: '产品部', value: '产品部' },
      { label: '市场部', value: '市场部' },
    ],
  },
]

const formBtns = [
  { name: '查询', type: 'primary', click: () => (tableRef.value as any)?.vxeInstance?.commitProxy?.('reload') },
  { name: '重置', click: () => { queryForm.keyword = ''; queryForm.department = '' } },
]

const columns = [
  { type: 'snIndex', label: '序号', width: 70 },
  { prop: 'name', label: '姓名', minWidth: 120 },
  { prop: 'department', label: '部门', width: 120 },
  { prop: 'position', label: '职位', width: 130 },
  { prop: 'salary', label: '薪资', width: 120, align: 'right' as const },
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
  engine: 'vxe' as const,
  border: true,
  rowkey: 'id',
  proxyConfig: {
    autoLoad: true,
    props: { result: 'result', total: 'page.total' },
    ajax: {
      query: ({ page }: any) => {
        return new Promise<any>((resolve) => {
          setTimeout(() => {
            const filtered = allData.filter(row => {
              const kw = queryForm.keyword.toLowerCase()
              const dept = queryForm.department
              return (!kw || row.name.toLowerCase().includes(kw))
                && (!dept || row.department === dept)
            })
            const start = (page.currentPage - 1) * page.pageSize
            resolve({
              result: filtered.slice(start, start + page.pageSize),
              page: { total: filtered.length },
            })
          }, 300)
        })
      },
    },
  },
  pagerConfig: { pageSize: 10, pageSizes: [10, 20, 50] },
}
</script>
