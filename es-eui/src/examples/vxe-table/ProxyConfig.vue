<template>
  <div>
    <el-alert
      type="info"
      :closable="false"
      style="margin-bottom: 10px;"
      description="proxyConfig 服务端分页：vxe 自管分页状态；EsForm 与 EsTable 兄弟结构，查询按钮 click 回调调用 commitProxy('query') 触发刷新"
    />
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

<script lang="jsx">
/**
 * 服务端分页 —— proxyConfig.ajax.query + commitProxy('query')
 *
 * vxe 3.x 访问路径（关键）：commitProxy 由 grid 直接代理，
 *   grid = tableRef.value.vxeEngineRef.vxeInstance()。
 *   兄弟结构下 EsForm 无法 inject 父表格，必须在按钮 click 里手动 commitProxy。
 */
import { defineComponent, ref, reactive } from '@vue/composition-api'

export default defineComponent({
  name: 'VxeTableProxyConfig',
  setup() {
    const tableRef = ref(null)
    const getGrid = () => tableRef.value?.vxeEngineRef?.vxeInstance?.()

    const queryForm = reactive({ keyword: '', department: '' })

    const formItems = [
      { prop: 'keyword', label: '关键词', formtype: 'Input', placeholder: '搜索姓名', span: 6, attrs: { clearable: true } },
      {
        prop: 'department', label: '部门', formtype: 'Select', span: 6,
        attrs: { clearable: true, placeholder: '全部' },
        dataOptions: [
          { label: '全部', value: '' },
          { label: '技术部', value: '技术部' },
          { label: '产品部', value: '产品部' },
          { label: '市场部', value: '市场部' }
        ]
      }
    ]

    const formBtns = [
      { name: '查询', type: 'primary', click: () => getGrid()?.commitProxy?.('query') },
      {
        name: '重置', click: () => {
          queryForm.keyword = ''
          queryForm.department = ''
          getGrid()?.commitProxy?.('query')
        }
      }
    ]

    const columns = [
      { type: 'index', label: '序号', width: 70 },
      { prop: 'name', label: '姓名', minWidth: 120 },
      { prop: 'department', label: '部门', width: 120 },
      { prop: 'position', label: '职位', width: 130 },
      { prop: 'salary', label: '薪资', width: 120, align: 'right' }
    ]

    // 模拟后端数据
    const allData = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      name: `员工${i + 1}`,
      department: ['技术部', '产品部', '市场部', '设计部'][i % 4],
      position: ['工程师', '高级工程师', '经理', '架构师'][i % 4],
      salary: `¥${(8000 + i * 300).toLocaleString()}`
    }))

    const tableOptions = {
      engine: 'vxe',
      border: true,
      rowkey: 'id',
      proxyConfig: {
        autoLoad: true,
        response: { result: 'result', total: 'page.total' },
        ajax: {
          query: ({ page }) => new Promise((resolve) => {
            setTimeout(() => {
              const kw = queryForm.keyword.toLowerCase()
              const dept = queryForm.department
              const filtered = allData.filter(row =>
                (!kw || row.name.toLowerCase().includes(kw)) &&
                (!dept || row.department === dept)
              )
              const start = (page.currentPage - 1) * page.pageSize
              resolve({
                result: filtered.slice(start, start + page.pageSize),
                page: { total: filtered.length }
              })
            }, 300)
          })
        }
      },
      // vxe 3.x：pagerConfig 通过 vxeConfig 传入（引擎仅在 proxyConfig 下启用分页器）
      vxeConfig: { pagerConfig: { pageSize: 10, pageSizes: [10, 20, 50] } }
    }

    return { tableRef, queryForm, formItems, formBtns, columns, tableOptions }
  }
})
</script>
