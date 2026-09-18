<template>
  <div class="user-manage">
    <!-- 查询表单 + 表格：字段 / 列 / 按钮全部来自配置；查询·重置·翻页·请求由 triggerEvent 接管 -->
    <es-table
      ref="tableRef"
      :columns="columns"
      :options="tableOptions"
      v-model:data-source="tableData"
      v-model:pagination="pagination"
    >
      <es-form
        :model="query"
        :form-item-list="queryItems"
        :config-btn="queryBtns"
        :layout-form-props="layoutProps"
      />
    </es-table>
  </div>
</template>

<script setup lang="jsx">
import { ref, reactive } from 'vue'
import { ElTag, ElMessage, ElMessageBox } from 'element-plus'
import { EsForm, EsTable } from 'es-plus'

const tableRef = ref()
const tableData = ref([])
const query = reactive({ name: '', status: '', deptId: '', createdAt: [] })
const pagination = ref({ current: 1, pageSize: 10, total: 0, pageSizes: [10, 20, 50] })
const statusOptions = [{ label: '启用', value: '1' }, { label: '禁用', value: '0' }]

// 查询表单：声明字段即表单（含远程下拉：部门选项由 apiParams 自动拉取）
const queryItems = [
  { prop: 'name', label: '姓名', formtype: 'Input', span: 6, attrs: { placeholder: '请输入姓名', clearable: true } },
  { prop: 'status', label: '状态', formtype: 'Select', span: 6, dataOptions: statusOptions, attrs: { placeholder: '请选择状态', clearable: true } },
  { prop: 'deptId', label: '部门', formtype: 'Select', span: 6, apiParams: { url: '/api/depts', method: 'GET' }, attrs: { placeholder: '请选择部门', clearable: true, filterable: true } },
  { prop: 'createdAt', label: '创建时间', formtype: 'DatePicker', span: 6, attrs: { type: 'daterange', valueFormat: 'YYYY-MM-DD' } },
]

// triggerEvent: true → 查询 / 重置自动联动表格（含「拿最新表单值」「重置回第一页」）
const queryBtns = [
  { name: '查询', type: 'primary', key: 'query', triggerEvent: true },
  { name: '重置', key: 'rest', triggerEvent: true },
]

const layoutProps = { fromLayProps: { labelWidth: '80px' }, rowLayProps: { gutter: 16 } }

// 列声明（状态列的 Tag 与操作列按钮走 render / tableBtns 逃生舱，这部分不是零成本）
const columns = [
  { prop: 'name', label: '姓名', minWidth: 120 },
  {
    prop: 'status', label: '状态', width: 100,
    render: (_, { row }) => (
      <ElTag type={row.status === '1' ? 'success' : 'info'}>
        {row.status === '1' ? '启用' : '禁用'}
      </ElTag>
    ),
  },
  { prop: 'deptName', label: '部门', minWidth: 140 },
  { prop: 'createdAt', label: '创建时间', minWidth: 170 },
]

const tableOptions = {
  border: true,
  stripe: true,
  rowkey: 'id',
  apiParams: { url: '/api/users', method: 'POST', model: query },
  configTableOut: { total: 'total', tableData: 'data', current: 'current', pageSize: 'pageSize' },
  tableBtns: [
    { title: '编辑', code: 2, props: { link: true, type: 'primary' }, fn: (row) => handleEdit(row) },
    { title: '删除', code: 2, props: { link: true, type: 'danger' }, fn: (row) => handleDelete(row) },
  ],
}

const handleEdit = (row) => {
  ElMessage.info(`编辑 ${row.name}`)
}

const handleDelete = async (row) => {
  await ElMessageBox.confirm(`确认删除「${row.name}」？`, '提示', { type: 'warning' })
  await fetch(`/api/users/${row.id}`, { method: 'DELETE' })
  ElMessage.success('删除成功')
  tableRef.value.refresh()
}
</script>
