<template>
  <div>
    <div style="margin-bottom: 10px; display: flex; gap: 12px; align-items: center;">
      <span style="font-size: 13px; color: #606266;">表格引擎：</span>
      <el-radio-group v-model="engine" size="mini">
        <el-radio-button label="default">默认 (el-table)</el-radio-button>
        <el-radio-button label="vxe">高性能 (vxe-grid)</el-radio-button>
      </el-radio-group>
    </div>
    <el-alert
      type="info"
      :closable="false"
      style="margin-bottom: 10px;"
      description="同一份 columns / data-source，仅通过 options.engine 在 el-table 与 vxe-grid 之间切换，业务代码零改动"
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
 * 引擎切换 —— options.engine 在 'default'(el-table) / 'vxe'(vxe-grid) 间切换
 *
 * 关键点：engine 用 radio 切换，tableOptions 用 computed 依赖 engine.value，
 * 切换后同一 columns/data 渲染到不同引擎，交互与 API 保持一致。
 */
import { defineComponent, ref, computed } from '@vue/composition-api'

const statusMap = { active: '在职', leave: '离职', probation: '试用期' }

export default defineComponent({
  name: 'VxeTableBasicSwitch',
  setup() {
    const engine = ref('vxe')

    // 客户端分页状态：total 有值才会点亮分页器
    const pagination = ref({ pageSize: 10, current: 1, total: 0 })

    const columns = [
      { prop: 'id', label: 'ID', width: 70 },
      { prop: 'name', label: '姓名', minWidth: 120 },
      { prop: 'department', label: '部门', width: 120 },
      {
        prop: 'status',
        label: '状态',
        width: 110,
        render: (h, { row }) => {
          const type = { active: 'success', leave: 'danger', probation: 'warning' }[row.status] || ''
          return <el-tag type={type} size="small">{statusMap[row.status] || row.status}</el-tag>
        }
      },
      { prop: 'joinDate', label: '入职日期', width: 130 }
    ]

    const departments = ['技术部', '产品部', '设计部', '市场部']
    const statuses = ['active', 'leave', 'probation']
    const tableData = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      name: `员工${i + 1}`,
      department: departments[i % departments.length],
      status: statuses[i % statuses.length],
      joinDate: `2022-${String((i % 12) + 1).padStart(2, '0')}-15`
    }))
    pagination.value.total = tableData.length

    // 客户端分页：按当前页切片
    const pagedData = computed(() => {
      const start = (pagination.value.current - 1) * pagination.value.pageSize
      return tableData.slice(start, start + pagination.value.pageSize)
    })
    // es-table 的 pagination-current-change / size-change 回传的是完整 paginationConfig 对象，
    // 需从中取 current / pageSize（直接当数字用会得到对象 → slice(NaN) → 数据被置空）
    const onCurrentChange = (pager) => { pagination.value.current = pager.current }
    const onSizeChange = (pager) => { pagination.value.pageSize = pager.pageSize; pagination.value.current = pager.current }

    const tableOptions = computed(() => ({
      engine: engine.value,
      border: true,
      stripe: true,
      rowkey: 'id',
      // 固定高度：表体超出后内部滚动（heightType:'height' 才把固定高度传给引擎）
      height: 420,
      heightType: 'height'
    }))

    return { engine, columns, tableOptions, pagedData, pagination, onCurrentChange, onSizeChange }
  }
})
</script>
