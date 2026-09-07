<template>
  <div>
    <el-alert
      type="info"
      :closable="false"
      style="margin-bottom: 10px;"
      description="footerMethod 汇总行：vxe 原生支持多行 footer；配合动态数据可实时更新汇总值"
    />
    <div style="margin-bottom: 10px; display: flex; gap: 8px; align-items: center;">
      <el-button size="mini" type="primary" @click="addRandomRow">随机新增一行</el-button>
      <span style="font-size:13px;color:#606266">
        合计薪资：<strong style="color:#409eff">¥{{ totalSalary.toLocaleString() }}</strong>
        &nbsp;平均：<strong style="color:#67c23a">¥{{ avgSalary.toLocaleString() }}</strong>
      </span>
    </div>
    <es-table
      :columns="columns"
      :options="tableOptions"
      :data-source="tableData"
      :pagination.sync="pageSeed"
    />
  </div>
</template>

<script lang="jsx">
/**
 * 表尾合计 —— showFooter + footerMethod 计算合计行
 *
 * 关键点：
 *   1. footerMethod({ columns, data }) 返回二维数组（每行一个数组）；
 *      新增数据后浅拷贝 tableData 触发 vxe 重算表尾。
 *   2. 分页用组件内建客户端分页（options.localPagination:true）：直接把全量 tableData
 *      交给 es-table，翻页/切片/total 全部由组件内部消费，无需 pagedData / 事件监听。
 */
import { defineComponent, ref, computed } from '@vue/composition-api'

const departments = ['技术部', '产品部', '设计部', '市场部']

export default defineComponent({
  name: 'VxeTableFooterSummary',
  setup() {
    let seq = 10

    const tableData = ref(
      Array.from({ length: 8 }, (_, i) => ({
        id: i + 1,
        name: `员工${i + 1}`,
        department: departments[i % departments.length],
        salary: 8000 + i * 700,
        bonus: 1000 + i * 200
      }))
    )

    const totalSalary = computed(() => tableData.value.reduce((s, r) => s + r.salary, 0))
    const avgSalary = computed(() => Math.round(totalSalary.value / (tableData.value.length || 1)))

    // 客户端分页种子：pageSize=5，current 用 .sync 双向绑定，便于新增后跳到末页
    const pageSeed = ref({ pageSize: 5, current: 1 })

    const columns = [
      { prop: 'name', label: '姓名', minWidth: 120 },
      { prop: 'department', label: '部门', width: 120 },
      { prop: 'salary', label: '薪资(元)', width: 130, align: 'right', formatter: (row) => Number(row.salary).toLocaleString() },
      { prop: 'bonus', label: '奖金(元)', width: 120, align: 'right', formatter: (row) => Number(row.bonus).toLocaleString() }
    ]

    const tableOptions = computed(() => ({
      engine: 'vxe',
      border: true,
      rowkey: 'id',
      height: 420,
      heightType: 'height',
      // 内建客户端分页：全量数据交给组件，内部自动切片/翻页/维护 total
      localPagination: true,
      showFooter: true,
      // 表尾合计对全量数据求和（非当前页），与顶部合计/平均保持一致
      footerMethod: ({ columns: cols }) => [
        cols.map((col) => {
          if (col.field === 'name') return '合计'
          if (col.field === 'salary') return tableData.value.reduce((s, r) => s + (r.salary || 0), 0).toLocaleString()
          if (col.field === 'bonus') return tableData.value.reduce((s, r) => s + (r.bonus || 0), 0).toLocaleString()
          return ''
        })
      ]
    }))

    const addRandomRow = () => {
      // 更新数据源：total / 分页由组件内部随长度自动同步
      tableData.value = [
        ...tableData.value,
        {
          id: ++seq,
          name: `员工${seq}`,
          department: departments[seq % departments.length],
          salary: 8000 + Math.floor(Math.random() * 15000),
          bonus: 500 + Math.floor(Math.random() * 5000)
        }
      ]
      // 分页会把新增行放到末页 —— 主动跳到末页，让新增行立即可见
      // （否则停留在第 1 页只见到固定的 pageSize 行，看似"没有反应"，实则表尾合计已随全量数据更新）
      const lastPage = Math.ceil(tableData.value.length / pageSeed.value.pageSize)
      pageSeed.value = { ...pageSeed.value, current: lastPage }
    }

    return { columns, tableOptions, tableData, pageSeed, totalSalary, avgSalary, addRandomRow }
  }
})
</script>
