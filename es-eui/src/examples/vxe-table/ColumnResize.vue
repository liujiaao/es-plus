<template>
  <div>
    <el-alert
      type="info"
      :closable="false"
      style="margin-bottom: 10px;"
      description="columnConfig.resizable 拖拽列宽 + keyboardConfig 键盘导航 + mouseConfig.selected 单元格选中"
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
 * 列宽拖拽 + 键鼠 —— columnConfig.resizable + keyboardConfig + mouseConfig
 *
 * 关键点：拖动表头分隔线调整列宽；开启键盘上下左右导航与单元格选中，接近 Excel 体验。
 */
import { defineComponent, ref, computed } from '@vue/composition-api'

export default defineComponent({
  name: 'VxeTableColumnResize',
  setup() {
    const columns = [
      { prop: 'id', label: 'ID', width: 80 },
      { prop: 'name', label: '姓名', width: 130 },
      { prop: 'department', label: '部门', width: 130 },
      { prop: 'position', label: '职位', width: 140 },
      { prop: 'email', label: '邮箱', width: 200 },
      { prop: 'phone', label: '手机', width: 150 }
    ]

    const departments = ['技术部', '产品部', '设计部', '市场部']
    const positions = ['工程师', '高级工程师', '架构师', '经理']
    const tableData = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      name: `员工${i + 1}`,
      department: departments[i % departments.length],
      position: positions[i % positions.length],
      email: `user${i + 1}@example.com`,
      phone: `138${String(10000000 + i).slice(0, 8)}`
    }))

    const tableOptions = {
      engine: 'vxe',
      border: true,
      rowkey: 'id',
      height: 420,
      heightType: 'height',
      columnConfig: { resizable: true },
      keyboardConfig: { isArrow: true, isDel: false, isEnter: true, isTab: true, isEdit: false },
      mouseConfig: { selected: true }
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
