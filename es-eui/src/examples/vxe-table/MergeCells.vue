<template>
  <div>
    <el-alert
      type="info"
      :closable="false"
      style="margin-bottom: 10px;"
      description="企业级复杂合并：三级表头 + spanMethod 行列混合动态合并 + vxeConfig.mergeHeaderItems 表头合并 + mergeFooterItems 多行表尾合并；表单联动切换合并模式 / 事业部筛选"
    />

    <es-form
      :model="queryForm"
      :form-item-list="formItems"
      style="margin-bottom: 8px;"
    />

    <div style="margin-bottom: 8px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
      <el-button size="mini" type="primary" icon="el-icon-printer" @click="handlePrintAll">打印全部</el-button>
      <el-button size="mini" @click="handlePrintDept('技术事业部')">打印技术事业部</el-button>
      <el-button size="mini" @click="handlePrintDept('产品事业部')">打印产品事业部</el-button>
      <span style="font-size: 12px; color: #909399;">分页打印时三级表头在每页自动重复（thead display:table-header-group）</span>
    </div>

    <es-table
      ref="tableRef"
      :columns="columns"
      :options="tableOptions"
      :data-source="tableData"
    />
  </div>
</template>

<script lang="jsx">
/**
 * 复杂合并单元格 —— 三级表头 + spanMethod 动态合并 + 表头/表尾静态合并
 *
 * 关键点（Vue2）：
 *   1. 三级表头用列 groups 嵌套表达；vxeConfig.mergeHeaderItems / mergeFooterItems 做静态合并。
 *   2. spanMethod({ rowIndex, column }) 从闭包 tableData.value 读数据按 column.field 做行合并
 *      （vxe 回调不传 data；多级表头下 columnIndex 是组内相对索引，故用 field 而非索引）；
 *      MERGE_ALWAYS 恒合并，MERGE_FULL 仅「全部合并」时合并。
 *   3. enableMerge / dept 变化时重建 tableData（新数组引用）触发 vxe-grid 重新执行 spanMethod。
 *   4. tableOptions 用 computed + _merge 注入 reactive 依赖，使合并模式切换时生成新配置对象。
 *   5. 打印：getPrintHtml 生成基础 HTML → patchHtmlRowSpans（@es-plus/core，纯 DOM 函数，
 *      vue2/vue3 通用）按 computeSpan 修正 tbody rowspan/colspan → grid.print({ html })；
 *      vxe 原生 print 不执行 spanMethod，故必须走 patch 才能与屏幕合并一致，thead 每页重复表头。
 */
import { defineComponent, ref, reactive, watch, computed } from '@vue/composition-api'
import { patchHtmlRowSpans } from '@es-plus/core'

const PRINT_STYLE = `
  @page { margin: 1.5cm; size: A4 landscape; }
  body { font-family: "Microsoft YaHei", Arial, sans-serif; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; table-layout: auto; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  tr { page-break-inside: avoid; }
  th, td { border: 1px solid #c0c4cc; padding: 5px 8px; text-align: center; vertical-align: middle; }
  th { background: #f5f7fa; font-weight: bold; }
  tfoot td { background: #fafafa; font-weight: bold; }
`

export default defineComponent({
  name: 'VxeTableMergeCells',
  setup() {
    const tableRef = ref(null)
    const getGrid = () => tableRef.value?.vxeEngineRef?.vxeInstance?.()

    // ─── 表单联动 ───────────────────────────────────────────────
    const queryForm = reactive({ enableMerge: true, dept: '' })

    const formItems = [
      {
        prop: 'enableMerge', label: '合并模式', formtype: 'Select', span: 6,
        dataOptions: [
          { label: '全部合并', value: true },
          { label: '仅行合并', value: 'row' },
          { label: '原始样式', value: false }
        ]
      },
      {
        prop: 'dept', label: '事业部', formtype: 'Select', span: 6,
        dataOptions: [
          { label: '全部', value: '' },
          { label: '技术事业部', value: '技术事业部' },
          { label: '产品事业部', value: '产品事业部' }
        ]
      }
    ]

    // ─── 数据：员工 KPI 绩效考核表 ──────────────────────────────
    const rawData = [
      { id: 1, dept: '技术事业部', team: '前端组', name: '张三', h1Target: 100, h1Actual: 120, h2Target: 110, h2Actual: 130 },
      { id: 2, dept: '技术事业部', team: '前端组', name: '李四', h1Target: 90, h1Actual: 85, h2Target: 100, h2Actual: 110 },
      { id: 3, dept: '技术事业部', team: '前端组', name: '王五', h1Target: 110, h1Actual: 115, h2Target: 120, h2Actual: 125 },
      { id: 4, dept: '技术事业部', team: '后端组', name: '赵六', h1Target: 80, h1Actual: 90, h2Target: 85, h2Actual: 95 },
      { id: 5, dept: '技术事业部', team: '后端组', name: '孙七', h1Target: 95, h1Actual: 105, h2Target: 100, h2Actual: 115 },
      { id: 6, dept: '产品事业部', team: '平台组', name: '周八', h1Target: 105, h1Actual: 110, h2Target: 110, h2Actual: 115 },
      { id: 7, dept: '产品事业部', team: '平台组', name: '吴九', h1Target: 85, h1Actual: 80, h2Target: 90, h2Actual: 95 },
      { id: 8, dept: '产品事业部', team: '增长组', name: '郑十', h1Target: 75, h1Actual: 90, h2Target: 85, h2Actual: 100 },
      { id: 9, dept: '产品事业部', team: '增长组', name: '钱A', h1Target: 100, h1Actual: 95, h2Target: 105, h2Actual: 108 },
      { id: 10, dept: '产品事业部', team: '增长组', name: '孙B', h1Target: 88, h1Actual: 92, h2Target: 95, h2Actual: 98 },
      { id: 11, dept: '技术事业部', team: '前端组', name: '张三1', h1Target: 100, h1Actual: 120, h2Target: 110, h2Actual: 130 },
      { id: 12, dept: '技术事业部', team: '前端组', name: '李四2', h1Target: 90, h1Actual: 85, h2Target: 100, h2Actual: 110 },
      { id: 13, dept: '技术事业部', team: '前端组', name: '王五3', h1Target: 110, h1Actual: 115, h2Target: 120, h2Actual: 125 },
      { id: 14, dept: '技术事业部', team: '后端组', name: '赵六4', h1Target: 80, h1Actual: 90, h2Target: 85, h2Actual: 95 },
      { id: 15, dept: '技术事业部', team: '后端组', name: '孙七5', h1Target: 95, h1Actual: 105, h2Target: 100, h2Actual: 115 },
      { id: 16, dept: '产品事业部', team: '平台组', name: '周八6', h1Target: 105, h1Actual: 110, h2Target: 110, h2Actual: 115 },
      { id: 17, dept: '产品事业部', team: '平台组', name: '吴九7', h1Target: 85, h1Actual: 80, h2Target: 90, h2Actual: 95 },
      { id: 18, dept: '产品事业部', team: '增长组', name: '郑十8', h1Target: 75, h1Actual: 90, h2Target: 85, h2Actual: 100 },
      { id: 19, dept: '产品事业部', team: '增长组', name: '钱A9', h1Target: 100, h1Actual: 95, h2Target: 105, h2Actual: 108 },
      { id: 20, dept: '产品事业部', team: '增长组', name: '孙B10', h1Target: 88, h1Actual: 92, h2Target: 95, h2Actual: 98 }
    ]

    const buildTableData = () => {
      let list = [...rawData]
      if (queryForm.dept) list = list.filter(r => r.dept === queryForm.dept)
      return list.map(r => ({
        ...r,
        h1Rate: Math.round((r.h1Actual / r.h1Target) * 100),
        h2Rate: Math.round((r.h2Actual / r.h2Target) * 100),
        totalTarget: r.h1Target + r.h2Target,
        totalActual: r.h1Actual + r.h2Actual
      }))
    }

    const tableData = ref(buildTableData())
    // enableMerge 变化也要重建 data，触发 vxe-grid 重新执行 spanMethod 读到新的合并模式
    watch(
      [() => queryForm.dept, () => queryForm.enableMerge],
      () => { tableData.value = buildTableData() }
    )

    // ─── 达成率彩色渲染 ─────────────────────────────────────────
    const rateColor = (value) => (value >= 100 ? '#67c23a' : value >= 90 ? '#e6a23c' : '#f56c6c')

    // ─── 列配置：三级表头结构 ───────────────────────────────────
    const columns = [
      {
        label: '组织架构',
        groups: [
          {
            prop: 'dept', label: '事业部', width: 110, align: 'center',
            render: (h, { value }) => <el-tag type={value === '技术事业部' ? '' : 'success'} size="small">{value}</el-tag>
          },
          { prop: 'team', label: '团队', width: 80, align: 'center' },
          { prop: 'name', label: '成员', width: 70, align: 'center' }
        ]
      },
      {
        label: 'H1 上半年',
        groups: [
          { prop: 'h1Target', label: '目标 KPI', width: 110, align: 'center', editRender: { name: '$input', props: { type: 'number', min: 0 } } },
          { prop: 'h1Actual', label: '实际完成', width: 100, align: 'center', editRender: { name: '$input', props: { type: 'number', min: 0 } } },
          {
            prop: 'h1Rate', label: '达成率', width: 80, align: 'center',
            render: (h, { value }) => <span style={{ color: rateColor(value), fontWeight: 'bold' }}>{value}%</span>
          }
        ]
      },
      {
        label: 'H2 下半年',
        groups: [
          { prop: 'h2Target', label: '目标 KPI', width: 110, align: 'center', editRender: { name: '$input', props: { type: 'number', min: 0 } } },
          { prop: 'h2Actual', label: '实际完成', width: 100, align: 'center', editRender: { name: '$input', props: { type: 'number', min: 0 } } },
          {
            prop: 'h2Rate', label: '达成率', width: 80, align: 'center',
            render: (h, { value }) => <span style={{ color: rateColor(value), fontWeight: 'bold' }}>{value}%</span>
          }
        ]
      },
      { prop: 'totalTarget', label: '年度目标', width: 100, align: 'center' },
      { prop: 'totalActual', label: '年度完成', width: 100, align: 'center' }
    ]

    // 从 columns 动态展开叶子列 field 顺序（colIndex → field），不手数下标
    const leafFields = columns.flatMap(col => (col.groups ? col.groups.map(g => g.prop) : [col.prop]))
    const MERGE_ALWAYS = ['dept', 'team']              // enableMerge 为真时都合并
    const MERGE_FULL = ['totalTarget', 'totalActual']  // enableMerge === true 时才合并

    const mergeRows = (data, rowIndex, field) => {
      const val = data[rowIndex]?.[field]
      if (rowIndex > 0 && data[rowIndex - 1]?.[field] === val) {
        return { rowspan: 0, colspan: 0 }
      }
      let count = 1
      while (rowIndex + count < data.length && data[rowIndex + count]?.[field] === val) {
        count++
      }
      return { rowspan: count, colspan: 1 }
    }

    const computeSpan = (data, rowIndex, field, enableMerge) => {
      if (!enableMerge) return { rowspan: 1, colspan: 1 }
      if (MERGE_ALWAYS.includes(field)) return mergeRows(data, rowIndex, field)
      if (enableMerge === true && MERGE_FULL.includes(field)) return mergeRows(data, rowIndex, field)
      return { rowspan: 1, colspan: 1 }
    }

    // vxe 的 spanMethod 回调不传 data，从闭包取 tableData.value
    // 注意：多级表头下 columnIndex 是「组内相对索引」（每组从 0 重新计数），不能按叶子列全局顺序索引；
    // 直接用 column.field 最稳妥。
    const spanMethod = ({ rowIndex, column }) => computeSpan(tableData.value, rowIndex, column.field, queryForm.enableMerge)

    // ─── 编辑完成后重算派生字段 ─────────────────────────────────
    const handleEditClosed = ({ row }) => {
      row.h1Target = Number(row.h1Target) || 0
      row.h1Actual = Number(row.h1Actual) || 0
      row.h2Target = Number(row.h2Target) || 0
      row.h2Actual = Number(row.h2Actual) || 0
      row.h1Rate = row.h1Target > 0 ? Math.round((row.h1Actual / row.h1Target) * 100) : 0
      row.h2Rate = row.h2Target > 0 ? Math.round((row.h2Actual / row.h2Target) * 100) : 0
      row.totalTarget = row.h1Target + row.h2Target
      row.totalActual = row.h1Actual + row.h2Actual
      // 浅拷贝数组触发 vxe-grid data 变化，驱动 footerMethod 重算表尾
      tableData.value = [...tableData.value]
    }

    // ─── 表尾合计：事业部小计 + 总计 ────────────────────────────
    const footerMethod = ({ columns: cols, data }) => {
      const isNum = (f) => ['h1Target', 'h1Actual', 'h2Target', 'h2Actual', 'totalTarget', 'totalActual'].includes(f)
      const sum = (list, f) => list.reduce((s, r) => s + (Number(r[f]) || 0), 0)
      const buildRow = (label, list) => cols.map((col, i) => {
        if (i === 0) return label
        if (isNum(col.field)) return sum(list, col.field).toLocaleString()
        return ''
      })
      const dept1 = data.filter(r => r.dept === '技术事业部')
      const dept2 = data.filter(r => r.dept === '产品事业部')
      return [
        buildRow('技术小计', dept1),
        buildRow('产品小计', dept2),
        buildRow('总计', data)
      ]
    }

    // computed 包裹：enableMerge 变化时生成新 options 引用，vxe-engine 侦测到后重渲染
    const tableOptions = computed(() => ({
      engine: 'vxe',
      border: true,
      rowkey: 'id',
      height: 600,
      heightType: 'height',
      spanMethod,
      editConfig: { trigger: 'click', mode: 'cell', showStatus: true },
      vxeOn: { 'edit-closed': handleEditClosed },
      showFooter: true,
      footerMethod,
      printConfig: { sheetName: '员工KPI绩效考核表' },
      _merge: queryForm.enableMerge, // 注入 reactive 依赖：enableMerge 变化时 computed 重算
      vxeConfig: {
        // 静态表头合并：年度目标 + 年度完成 两列标题合并
        mergeHeaderItems: [{ row: 0, col: 9, rowspan: 1, colspan: 2 }],
        // 静态表尾合并：总计行合并事业部+团队两列
        mergeFooterItems: [{ row: 2, col: 0, rowspan: 1, colspan: 2 }]
      }
    }))

    // ─── 打印（原生 grid.print，thead 每页重复表头）─────────────
    // vxe print 不执行 spanMethod（与之互斥），用 patchHtmlRowSpans 修正 tbody rowspan/colspan。
    // getPrintHtml 保留完整三级 <thead>，PRINT_STYLE 的 thead{display:table-header-group} 实现每页重复表头。
    // ci 是 tbody <td> 的 DOM 顺序 = 叶子列全局顺序，用 leafFields[ci] 取 field（勿用组内相对 columnIndex）。
    const doPrint = async (data, opts) => {
      const grid = getGrid()
      if (!grid) return
      const em = queryForm.enableMerge
      const { html } = await grid.getPrintHtml({ ...opts, data })
      grid.print({ ...opts, html: patchHtmlRowSpans(html, (ri, ci) => computeSpan(data, ri, leafFields[ci], em)) })
    }
    const handlePrintAll = () => {
      doPrint(tableData.value, { sheetName: '员工KPI绩效考核表（全部）', style: PRINT_STYLE })
    }
    const handlePrintDept = (dept) => {
      doPrint(tableData.value.filter(r => r.dept === dept), { sheetName: `${dept} KPI绩效报表`, style: PRINT_STYLE })
    }

    return { tableRef, queryForm, formItems, columns, tableOptions, tableData, handlePrintAll, handlePrintDept }
  }
})
</script>

<style scoped>
/* 合并单元格垂直居中：vxe 默认靠顶，rowspan > 1 的 td 需手动拉伸 .vxe-cell 填满高度 */
::v-deep .vxe-body--column[rowspan] {
  vertical-align: middle;
}
::v-deep .vxe-body--column[rowspan] .vxe-cell {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
