<template>
  <div>
    <el-alert
      type="info"
      :closable="false"
      style="margin-bottom: 10px;"
      description="toolbarConfig 工具栏（缩放/自定义列/导出/打印）+ exportConfig 导出 CSV；printConfig 打印配置"
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
 * 工具栏 + 导出 —— toolbarConfig 内置工具栏 + exportConfig 导出 + printConfig 打印
 *
 * 关键点：vxe-grid 原生工具栏由 toolbarConfig 驱动（zoom/custom/export/print），
 *   导出走 exportConfig（CSV），无需手写按钮。
 */
import { defineComponent, ref, computed } from '@vue/composition-api'

export default defineComponent({
  name: 'VxeTableToolbarExport',
  setup() {
    const columns = [
      { type: 'index', label: '序号', width: 70 },
      { prop: 'name', label: '姓名', minWidth: 120 },
      { prop: 'department', label: '部门', width: 120 },
      { prop: 'position', label: '职位', width: 130 },
      {
        prop: 'salary',
        label: '薪资',
        width: 130,
        align: 'right',
        formatter: (row) => `¥${Number(row.salary).toLocaleString()}`
      }
    ]

    const departments = ['技术部', '产品部', '设计部', '市场部']
    const positions = ['工程师', '高级工程师', '架构师', '经理']
    const tableData = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      name: `员工${i + 1}`,
      department: departments[i % departments.length],
      position: positions[i % positions.length],
      salary: 8000 + i * 600
    }))

    const tableOptions = {
      engine: 'vxe',
      border: true,
      rowkey: 'id',
      height: 420,
      heightType: 'height',
      toolbarConfig: {
        zoom: true,
        custom: true,
        refresh: false,
        export: true,
        print: true
      },
      printConfig: true,
      exportConfig: { type: 'csv', filename: '员工数据' }
    }

    // 客户端分页：total 有值才点亮分页器；事件回传完整 paginationConfig 对象
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
