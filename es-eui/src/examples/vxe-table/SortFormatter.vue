<template>
  <div>
    <el-alert
      type="info"
      :closable="false"
      style="margin-bottom: 10px;"
      description="sortable 启用列排序（vxe 本地排序）；formatter 格式化单元格显示：薪资千分位、状态映射"
    />
    <es-table
      :columns="columns"
      :options="tableOptions"
      :data-source="pagedData"
      :pagination="pagination"
      @pagination-current-change="onCurrentChange"
      @size-change="onSizeChange"
    />
  </div>
</template>

<script lang="jsx">
/**
 * 排序 + 格式化 —— sortable 列排序 + formatter 单元格格式化
 *
 * 关键点：列加 sortable:true 启用 vxe 本地排序；salary 用 formatter 千分位，
 *   status 用 vxeColumn.formatter 做值映射（{ cellValue } 为原始值）。
 */
import { defineComponent, ref, computed } from '@vue/composition-api'

const statusMap = { active: '在职', leave: '离职', probation: '试用期' }

export default defineComponent({
  name: 'VxeTableSortFormatter',
  setup() {
    const columns = [
      { prop: 'id', label: 'ID', width: 70, sortable: true },
      { prop: 'name', label: '姓名', minWidth: 120 },
      { prop: 'department', label: '部门', width: 120 },
      {
        prop: 'salary',
        label: '薪资',
        width: 140,
        align: 'right',
        sortable: true,
        formatter: (row) => `¥${Number(row.salary).toLocaleString()}`
      },
      {
        prop: 'status',
        label: '状态',
        width: 120,
        vxeColumn: { formatter: ({ cellValue }) => statusMap[cellValue] || cellValue }
      }
    ]

    const departments = ['技术部', '产品部', '设计部', '市场部']
    const statuses = ['active', 'leave', 'probation']
    const tableData = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      name: `员工${i + 1}`,
      department: departments[i % departments.length],
      salary: 8000 + ((i * 37) % 20) * 500,
      status: statuses[i % statuses.length]
    }))

    const tableOptions = {
      engine: 'vxe',
      border: true,
      rowkey: 'id',
      sortable: true,
      height: 420,
      heightType: 'height'
    }

    // 客户端分页：total 有值才点亮分页器；事件回传完整 paginationConfig 对象
    // 注：vxe 本地排序作用于传入的当前页数据，翻页后按原始顺序切片
    const pagination = ref({ pageSize: 10, current: 1, total: tableData.length })
    const pagedData = computed(() => {
      const start = (pagination.value.current - 1) * pagination.value.pageSize
      return tableData.slice(start, start + pagination.value.pageSize)
    })
    const onCurrentChange = (pager) => { pagination.value.current = pager.current }
    const onSizeChange = (pager) => { pagination.value.pageSize = pager.pageSize; pagination.value.current = pager.current }

    return { columns, tableOptions, pagedData, pagination, onCurrentChange, onSizeChange }
  }
})
</script>
