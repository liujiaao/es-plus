<template>
  <div>
    <el-alert type="info" :closable="false" style="margin-bottom:10px"
      description="企业级复杂合并：三级表头 + spanMethod 行列混合合并 + vxeConfig.mergeCells 静态合并 + mergeHeaderItems 表头合并 + mergeFooterItems 多行表尾合并；表单控合并/筛选" />

    <es-form
      :model="queryForm"
      :form-item-list="formItems"
      style="margin-bottom: 8px"
    />

    <!-- 打印工具栏 -->
    <div style="margin-bottom: 8px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
      <el-button size="small" type="primary" :icon="Printer" @click="handlePrintPreview">打印预览</el-button>
      <el-button size="small" @click="handlePrintAll">打印全部</el-button>
      <el-button size="small" @click="handlePrintDept('技术事业部')">打印技术事业部</el-button>
      <el-button size="small" @click="handlePrintDept('产品事业部')">打印产品事业部</el-button>
      <span style="font-size:12px; color:#909399">分页打印时三级表头在每页自动重复（CSS: thead display:table-header-group）</span>
    </div>

    <es-table
      ref="tableRef"
      :columns="columns"
      :options="tableOptions"
      :data-source="tableData"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, h, watch, computed } from 'vue'
import { ElTag } from 'element-plus'
import { Printer } from '@element-plus/icons-vue'
import { EsTable, EsForm } from 'es-plus'


// ─── 表格实例 ──────────────────────────────────────────────────
const tableRef = ref<any>(null)
const getGrid = () => tableRef.value?.vxeInstance?.()

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

// vxe print 引擎只读静态 merge 注册表，不执行 spanMethod（两者互斥，setMergeCells 与 spanMethod 冲突）。
// 解决：getPrintHtml 生成基础 HTML → DOMParser 修正 rowspan/colspan → print({ html }) 传回 vxe 打印窗口。

function computeSpan(data: any[], rowIndex: number, colIndex: number, enableMerge: boolean | 'row') {
  if (!enableMerge) return { rowspan: 1, colspan: 1 }
  const field = leafFields[colIndex]
  if (MERGE_ALWAYS.includes(field)) return mergeRows(data, rowIndex, field)
  if (enableMerge === true && MERGE_FULL.includes(field)) return mergeRows(data, rowIndex, field)
  return { rowspan: 1, colspan: 1 }
}

async function doPrint(data: any[], opts: Record<string, any>) {
  const grid = getGrid()
  if (!grid) return
  const { html } = await grid.getPrintHtml({ ...opts, data })
  grid.print({ ...opts, html: fixMerges(html, data) })
}

function fixMerges(html: string, data: any[]): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const em = queryForm.enableMerge
  Array.from(doc.querySelectorAll('tbody tr')).forEach((tr, ri) => {
    Array.from(tr.querySelectorAll('td')).forEach((td, ci) => {
      const { rowspan, colspan } = computeSpan(data, ri, ci, em)
      if (rowspan === 0) { td.remove(); return }
      if (rowspan > 1) td.setAttribute('rowspan', String(rowspan))
      if (colspan > 1) td.setAttribute('colspan', String(colspan))
    })
  })
  return doc.body.innerHTML
}

// 打印预览 = 浏览器原生打印对话框（本身就是预览窗口）。
// doPrint 流程：getPrintHtml 拿到含 <thead> 多级表头的 HTML
//   → fixMerges 修正 tbody rowspan/colspan（<thead> 保持不变）
//   → print({ html, style: PRINT_STYLE })
//   → VxeUI.print 将 PRINT_STYLE 注入 <style>
//   → 浏览器打印引擎识别 thead { display:table-header-group } 实现每页重复表头
function handlePrintPreview() {
  doPrint(tableData.value, { sheetName: '员工KPI绩效考核表', style: PRINT_STYLE })
}

function handlePrintAll() {
  doPrint(tableData.value, { sheetName: '员工KPI绩效考核表（全部）', style: PRINT_STYLE })
}

function handlePrintDept(dept: string) {
  const deptData = tableData.value.filter((r: any) => r.dept === dept)
  doPrint(deptData, { sheetName: `${dept} KPI绩效报表`, style: PRINT_STYLE })
}

// ─── 表单联动 ─────────────────────────────────────────────────
const queryForm = reactive({ enableMerge: true, dept: '' as string })

const formItems = [
  {
    prop: 'enableMerge', label: '合并模式', formtype: 'Select' as const, span: 6,
    dataOptions: [{ label: '全部合并', value: true }, { label: '仅行合并', value: 'row' as any }, { label: '原始样式', value: false }],
  },
  {
    prop: 'dept', label: '事业部', formtype: 'Select' as const, span: 6,
    dataOptions: [{ label: '全部', value: '' }, { label: '技术事业部', value: '技术事业部' }, { label: '产品事业部', value: '产品事业部' }],
  },
]

// ─── 数据：员工 KPI 绩效考核表 ─────────────────────────────────
const rawData = [
  { id: 1,  dept: '技术事业部', team: '前端组', name: '张三', h1Target: 100, h1Actual: 120, h2Target: 110, h2Actual: 130 },
  { id: 2,  dept: '技术事业部', team: '前端组', name: '李四', h1Target: 90,  h1Actual: 85,  h2Target: 100, h2Actual: 110 },
  { id: 3,  dept: '技术事业部', team: '前端组', name: '王五', h1Target: 110, h1Actual: 115, h2Target: 120, h2Actual: 125 },
  { id: 4,  dept: '技术事业部', team: '后端组', name: '赵六', h1Target: 80,  h1Actual: 90,  h2Target: 85,  h2Actual: 95  },
  { id: 5,  dept: '技术事业部', team: '后端组', name: '孙七', h1Target: 95,  h1Actual: 105, h2Target: 100, h2Actual: 115 },
  { id: 6,  dept: '产品事业部', team: '平台组', name: '周八', h1Target: 105, h1Actual: 110, h2Target: 110, h2Actual: 115 },
  { id: 7,  dept: '产品事业部', team: '平台组', name: '吴九', h1Target: 85,  h1Actual: 80,  h2Target: 90,  h2Actual: 95  },
  { id: 8,  dept: '产品事业部', team: '增长组', name: '郑十', h1Target: 75,  h1Actual: 90,  h2Target: 85,  h2Actual: 100 },
  { id: 9,  dept: '产品事业部', team: '增长组', name: '钱A', h1Target: 100, h1Actual: 95,  h2Target: 105, h2Actual: 108 },
  { id: 10, dept: '产品事业部', team: '增长组', name: '孙B', h1Target: 88,  h1Actual: 92,  h2Target: 95,  h2Actual: 98  },
   { id: 11,  dept: '技术事业部', team: '前端组', name: '张三1', h1Target: 100, h1Actual: 120, h2Target: 110, h2Actual: 130 },
  { id: 12,  dept: '技术事业部', team: '前端组', name: '李四2', h1Target: 90,  h1Actual: 85,  h2Target: 100, h2Actual: 110 },
  { id: 13,  dept: '技术事业部', team: '前端组', name: '王五3', h1Target: 110, h1Actual: 115, h2Target: 120, h2Actual: 125 },
  { id: 14,  dept: '技术事业部', team: '后端组', name: '赵六4', h1Target: 80,  h1Actual: 90,  h2Target: 85,  h2Actual: 95  },
  { id: 15,  dept: '技术事业部', team: '后端组', name: '孙七5', h1Target: 95,  h1Actual: 105, h2Target: 100, h2Actual: 115 },
  { id: 16,  dept: '产品事业部', team: '平台组', name: '周八6', h1Target: 105, h1Actual: 110, h2Target: 110, h2Actual: 115 },
  { id: 17,  dept: '产品事业部', team: '平台组', name: '吴九7', h1Target: 85,  h1Actual: 80,  h2Target: 90,  h2Actual: 95  },
  { id: 18,  dept: '产品事业部', team: '增长组', name: '郑十8', h1Target: 75,  h1Actual: 90,  h2Target: 85,  h2Actual: 100 },
  { id: 19,  dept: '产品事业部', team: '增长组', name: '钱A9', h1Target: 100, h1Actual: 95,  h2Target: 105, h2Actual: 108 },
  { id: 20, dept: '产品事业部', team: '增长组', name: '孙B10', h1Target: 88,  h1Actual: 92,  h2Target: 95,  h2Actual: 98  },
]

function buildTableData() {
  let list = [...rawData]
  if (queryForm.dept) list = list.filter(r => r.dept === queryForm.dept)
  return list.map(r => ({
    ...r,
    h1Rate: Math.round((r.h1Actual / r.h1Target) * 100),
    h2Rate: Math.round((r.h2Actual / r.h2Target) * 100),
    totalTarget: r.h1Target + r.h2Target,
    totalActual: r.h1Actual + r.h2Actual,
  }))
}

const tableData = ref(buildTableData())
// enableMerge 变了也要重建 data：触发 vxe-grid 重新渲染，才能重新执行 spanMethod 读到新的合并模式
watch([() => queryForm.dept, () => queryForm.enableMerge], () => { tableData.value = buildTableData() })

// ─── 列配置：三级表头结构 ──────────────────────────────────────
const columns: any[] = [
  // 第一组：组织架构（3 列）
  {
    label: '组织架构', groups: [
      { prop: 'dept', label: '事业部', width: 110, align: 'center' as const,
        render: (_h: any, { value }: any) =>
          h(ElTag, { type: (value === '技术事业部' ? '' : 'success') as any, size: 'small' }, () => value) },
      { prop: 'team', label: '团队', width: 80, align: 'center' as const },
      { prop: 'name', label: '成员', width: 70, align: 'center' as const },
    ],
  },
  // 第二组：H1 上半年（目标 + 实际 + 达成率）
  {
    label: 'H1 上半年', groups: [
      { prop: 'h1Target', label: '目标 KPI', width: 110, align: 'center' as const,
        editRender: { name: 'input', attrs: { type: 'number', min: 0 } } },
      { prop: 'h1Actual', label: '实际完成', width: 100, align: 'center' as const,
        editRender: { name: 'input', attrs: { type: 'number', min: 0 } } },
      { prop: 'h1Rate', label: '达成率', width: 80, align: 'center' as const,
        render: (_h: any, { value }: any) => {
          const c = value >= 100 ? '#67c23a' : value >= 90 ? '#e6a23c' : '#f56c6c'
          return h('span', { style: { color: c, fontWeight: 'bold' } }, value + '%')
        } },
    ],
  },
  // 第三组：H2 下半年（目标 + 实际 + 达成率）
  {
    label: 'H2 下半年', groups: [
      { prop: 'h2Target', label: '目标 KPI', width: 110, align: 'center' as const,
        editRender: { name: 'input', attrs: { type: 'number', min: 0 } } },
      { prop: 'h2Actual', label: '实际完成', width: 100, align: 'center' as const,
        editRender: { name: 'input', attrs: { type: 'number', min: 0 } } },
      { prop: 'h2Rate', label: '达成率', width: 80, align: 'center' as const,
        render: (_h: any, { value }: any) => {
          const c = value >= 100 ? '#67c23a' : value >= 90 ? '#e6a23c' : '#f56c6c'
          return h('span', { style: { color: c, fontWeight: 'bold' } }, value + '%')
        } },
    ],
  },
  // 年度汇总
  { prop: 'totalTarget', label: '年度目标', width: 100, align: 'center' as const },
  { prop: 'totalActual', label: '年度完成', width: 100, align: 'center' as const },
]

// 从 columns 配置动态展开叶子列 field 顺序，colIndex → field，不依赖手动数下标
const leafFields: string[] = (columns as any[]).flatMap(col =>
  col.groups ? col.groups.map((g: any) => g.prop) : [col.prop]
)
const MERGE_ALWAYS = ['dept', 'team']                    // enableMerge 为真时都合并
const MERGE_FULL   = ['totalTarget', 'totalActual']      // enableMerge === true 时才合并

// ─── spanMethod：行列混合动态合并 ──────────────────────────────
// 注意：vxe-grid v4 的 spanMethod 回调不传 data，必须从闭包中取 tableData.value
function spanMethod({ rowIndex, columnIndex }: any) {
  return computeSpan(tableData.value, rowIndex, columnIndex, queryForm.enableMerge)
}

function mergeRows(data: any[], rowIndex: number, field: string) {
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

// ─── 编辑完成后重算派生字段 ────────────────────────────────────
function handleEditClosed({ row }: any) {
  row.h1Target = Number(row.h1Target) || 0
  row.h1Actual = Number(row.h1Actual) || 0
  row.h2Target = Number(row.h2Target) || 0
  row.h2Actual = Number(row.h2Actual) || 0
  row.h1Rate = row.h1Target > 0 ? Math.round((row.h1Actual / row.h1Target) * 100) : 0
  row.h2Rate = row.h2Target > 0 ? Math.round((row.h2Actual / row.h2Target) * 100) : 0
  row.totalTarget = row.h1Target + row.h2Target
  row.totalActual = row.h1Actual + row.h2Actual
  // 浅拷贝数组触发 vxe-grid data prop 变化，驱动 footerMethod 重算表尾
  tableData.value = [...tableData.value]
}

// ─── 表尾合计：按事业部分组小计 + 合计 ───────────────────────
function footerMethod({ columns: cols, data }: any) {
  const isNum = (f: string) => ['h1Target','h1Actual','h2Target','h2Actual','totalTarget','totalActual'].includes(f)
  const sum = (list: any[], f: string) => list.reduce((s: number, r: any) => s + (Number(r[f]) || 0), 0)
  const row = (label: string, list: any[]) =>
    cols.map((col: any, i: number) => {
      if (i === 0) return label
      if (isNum(col.field)) return sum(list, col.field).toLocaleString()
      return ''
    })

  const dept1 = data.filter((r: any) => r.dept === '技术事业部')
  const dept2 = data.filter((r: any) => r.dept === '产品事业部')

  return [
    row('技术小计', dept1),
    row('产品小计', dept2),
    row('总计', data),
  ]
}

// 用 computed 包裹：当 enableMerge 变化时创建新 options 对象引用，
// vxe-engine 的 gridConfig computed 侦测到变化，传递给 vxe-grid 触发重渲染
const tableOptions = computed(() => ({
  engine: 'vxe' as const,
  border: true,
  rowkey: 'id',
  height: 600,
  heightType: 'height' as const,
  spanMethod,
  editConfig: { trigger: 'click', mode: 'cell', showStatus: true },
  vxeOn: { 'edit-closed': handleEditClosed },
  showFooter: true,
  footerMethod,
  printConfig: { sheetName: '员工KPI绩效考核表' },
  _merge: queryForm.enableMerge, // ← 注入 reactive 依赖：enableMerge 变化时 computed 重算
  vxeConfig: {
    // 静态表头合并：年度目标 + 年度完成 两列标题合并为"年度汇总"
    mergeHeaderItems: [
      { row: 0, col: 9, rowspan: 1, colspan: 2 },
    ],
    // 静态表尾合并：总计行合并事业部+团队两列
    mergeFooterItems: [
      { row: 2, col: 0, rowspan: 1, colspan: 2 },
    ],
    // 注意：body 单元格不使用 mergeCells（与 spanMethod 冲突），改由 spanMethod 统一处理
  },
} as any))
</script>

<style scoped>
/* 合并单元格垂直居中：vxe 默认靠顶，rowspan > 1 的 td 需要手动拉伸 .vxe-cell 填满高度 */
:deep(.vxe-body--column[rowspan]) {
  vertical-align: middle;
}
:deep(.vxe-body--column[rowspan]) .vxe-cell {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
