<template>
  <div>
    <el-alert
      type="info"
      :closable="false"
      style="margin-bottom: 10px;"
      description="vxeConfig 深度合并原生 vxe-grid 配置（逃生舱，不经过 es-plus 适配层）；vxeOn 注入原生事件（cell-click / sort-change）"
    />
    <div style="margin-bottom: 8px; font-size: 13px; color: #606266;">
      单击单元格：<el-tag v-if="clickInfo" size="mini" type="info">{{ clickInfo }}</el-tag>
      <span style="margin-left: 12px;">点表头排序：<el-tag v-if="sortInfo" size="mini" type="success">{{ sortInfo }}</el-tag></span>
    </div>
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
 * 逃生舱 —— vxeConfig 透传原生 vxe-grid 配置 + vxeOn 注入原生事件
 *
 * 关键点：es-plus 不理解的原生 vxe 配置都放 vxeConfig（深合并）；
 *   vxeOn 以 kebab-case 事件名注入原生监听。客户端分页用 @pagination-current-change / @size-change 维护。
 */
import { defineComponent, ref, computed } from '@vue/composition-api'

const levels = ['P5', 'P6', 'P7', 'P8']
const departments = ['技术部', '产品部', '设计部', '市场部']

export default defineComponent({
  name: 'VxeTableEscapeHatch',
  setup() {
    const clickInfo = ref('')
    const sortInfo = ref('')
    const pagination = ref({ pageSize: 10, current: 1, total: 0 })

    const columns = [
      { prop: 'id', label: 'ID', width: 70, sortable: true },
      { prop: 'name', label: '姓名', minWidth: 120 },
      {
        prop: 'level', label: '级别', width: 100,
        // sortable 是 vxeOn['sort-change'] 能触发的**前提**：没有可排序列时那个监听器
        // 永远不会被调用（此前就是「监听器写好了但没人能触发」的死代码）
        sortable: true,
        render: (h, { value }) => {
          const colors = { P5: '', P6: 'warning', P7: 'success', P8: 'danger' }
          return <el-tag type={colors[value] || ''} size="small">{value}</el-tag>
        }
      },
      { prop: 'department', label: '部门', width: 120 }
    ]

    const tableOptions = {
      engine: 'vxe',
      border: true,
      rowkey: 'id',
      // vxeConfig：深度合并原生 vxe-grid 配置（逃生舱）
      vxeConfig: {
        rowConfig: { isHover: true, isCurrent: true },
        columnConfig: { resizable: true, minWidth: 60 },
        scrollX: { enabled: true, gt: 10 },
        scrollY: { enabled: true, gt: 100 }
      },
      // vxeOn：原生事件注入（kebab-case 事件名）
      vxeOn: {
        'cell-click': ({ row, column }) => {
          clickInfo.value = `行:${row.name} 列:${column.title || column.field}`
        },
        'sort-change': ({ field, order }) => {
          // 结论要**看得见**：示例页的验收口径是「0 处 console.log」——
          // 事件载荷直接渲染到页面上，胜过去控制台里找一行日志
          sortInfo.value = `字段:${field} 方向:${order || '默认'}`
        }
      }
    }

    const allData = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      name: `员工${i + 1}`,
      level: levels[i % levels.length],
      department: departments[i % departments.length]
    }))
    pagination.value.total = allData.length

    const pagedData = computed(() => {
      const start = (pagination.value.current - 1) * pagination.value.pageSize
      return allData.slice(start, start + pagination.value.pageSize)
    })

    // es-table 的 pagination-current-change / size-change 回传完整 paginationConfig 对象
    const onCurrentChange = (pager) => { pagination.value.current = pager.current }
    const onSizeChange = (pager) => { pagination.value.pageSize = pager.pageSize; pagination.value.current = pager.current }

    return { clickInfo, sortInfo, columns, tableOptions, pagedData, pagination, onCurrentChange, onSizeChange }
  }
})
</script>
