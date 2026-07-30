<template>
  <div>
    <el-alert type="info" :closable="false" style="margin-bottom:10px"
      description="proxyConfig 服务端分页：vxe 自管分页状态；EsForm 与 EsTable 为兄弟结构，按钮通过 click 回调调用 commitProxy('query') 触发表格刷新" />
    <!-- 注意：triggerEvent 仅对 EsForm 嵌套在 EsTable 内部的场景生效（依赖 inject 获取父表格实例），
         兄弟结构下必须手动 click 回调调用 tableRef.vxeInstance().commitProxy('query') -->
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
  { prop: 'keyword', label: '关键词', formtype: 'Input' as const, placeholder: '搜索姓名', attrs: { clearable: true } },
  {
    prop: 'department', label: '部门', formtype: 'Select' as const,
    attrs: { clearable: true, placeholder: '全部' },
    dataOptions: [
      { label: '全部', value: '' },
      { label: '技术部', value: '技术部' },
      { label: '产品部', value: '产品部' },
      { label: '市场部', value: '市场部' },
    ],
  },
]

// triggerEvent 依赖 EsForm 嵌套在 EsTable 内部（通过 inject 获取父表格实例），
// 兄弟结构下 inject 拿不到引用，必须用手动 click 回调。
// 在 proxyConfig 模式下，commitProxy('query') 会触发 vxe 重新请求分页数据。
const formBtns = [
  {
    name: '查询', type: 'primary' as const, icon: 'Search',
    click: () => {
      ;(tableRef.value as any)?.vxeInstance?.()?.commitProxy?.('query')
    },
  },
  {
    name: '重置', type: 'default' as const, icon: 'RefreshLeft',
    click: () => {
      queryForm.keyword = ''
      queryForm.department = ''
      ;(tableRef.value as any)?.vxeInstance?.()?.commitProxy?.('query')
    },
  },
]

const columns = [
  { type: 'index' as const, label: '序号', width: 70 },
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
    // vxe v4 使用 response 替代已废弃的 props 做响应字段映射
    response: { result: 'result', total: 'page.total' },
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
