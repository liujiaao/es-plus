<template>
  <div>
    <el-alert
      type="info"
      :closable="false"
      style="margin-bottom: 10px;"
      description="render(h,{row}) 自定义列渲染：头像 + 标签 + 进度条，任意 JSX 组件都可返回"
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
 * 自定义渲染 —— render 函数返回任意 JSX（头像 / 标签 / 进度条）
 *
 * 关键点：render(h,{row,value}) 内可自由组合 element-ui 组件，vxe 引擎与
 *   默认引擎共用同一套 render 契约。
 */
import { defineComponent, ref, computed } from '@vue/composition-api'

const statusType = { active: 'success', leave: 'danger', probation: 'warning' }
const statusLabel = { active: '在职', leave: '离职', probation: '试用期' }

export default defineComponent({
  name: 'VxeTableCustomRender',
  setup() {
    const scoreColor = (score) => (score >= 90 ? '#67c23a' : score >= 75 ? '#e6a23c' : '#f56c6c')

    const columns = [
      {
        prop: 'name',
        label: '员工',
        minWidth: 180,
        render: (h, { row }) => (
          <div style="display:flex;align-items:center;gap:10px;">
            <el-avatar size={32} style={`background:${row.color}`}>{row.name.slice(0, 1)}</el-avatar>
            <span>{row.name}</span>
          </div>
        )
      },
      { prop: 'department', label: '部门', width: 120 },
      {
        prop: 'status',
        label: '状态',
        width: 110,
        render: (h, { value }) => (
          <el-tag type={statusType[value] || ''} size="small">{statusLabel[value] || value}</el-tag>
        )
      },
      {
        prop: 'score',
        label: '绩效',
        minWidth: 200,
        render: (h, { row }) => (
          <el-progress
            percentage={row.score}
            color={scoreColor(row.score)}
            stroke-width={14}
            text-inside
          />
        )
      }
    ]

    const departments = ['技术部', '产品部', '设计部', '市场部']
    const statuses = ['active', 'leave', 'probation']
    const colors = ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399']
    const tableData = Array.from({ length: 18 }, (_, i) => ({
      id: i + 1,
      name: `员工${i + 1}`,
      department: departments[i % departments.length],
      status: statuses[i % statuses.length],
      score: 60 + ((i * 13) % 40),
      color: colors[i % colors.length]
    }))

    const tableOptions = { engine: 'vxe', border: true, rowkey: 'id', height: 420, heightType: 'height' }

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
