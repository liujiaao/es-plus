<template>
  <div ref="hostEl" class="engine-workbench">
    <div class="wb-bar">
      <div class="wb-group">
        <span class="wb-label">工单量</span>
        <el-radio-group :model-value="size" size="small" :disabled="busy" @change="switchSize">
          <el-radio-button v-for="opt in SIZE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</el-radio-button>
        </el-radio-group>
      </div>
      <div class="wb-group">
        <span class="wb-label">渲染引擎</span>
        <el-radio-group :model-value="engine" size="small" :disabled="busy" @change="switchEngine">
          <el-radio-button value="default" :disabled="size === 50000">el-table</el-radio-button>
          <el-radio-button value="vxe">vxe-table</el-radio-button>
        </el-radio-group>
        <el-tag v-if="size === 50000" size="small" type="warning">5 万行只给 vxe：el-table 没有虚拟滚动</el-tag>
      </div>
      <div class="wb-metrics">
        <span class="wb-metric"><em>上次操作</em><b>{{ lastOp }} · {{ lastCost === null ? '—' : `${lastCost} ms` }}</b></span>
        <span class="wb-metric"><em>表体 DOM 行</em><b data-testid="dom-rows">{{ domRows }}</b></span>
        <span class="wb-metric"><em>已选</em><b data-testid="sel-count">{{ selectedIds.length }} 行</b></span>
        <span class="wb-metric"><em>JS 堆</em><b>{{ heapText }}</b></span>
      </div>
    </div>

    <es-table
      ref="tableRef"
      :columns="columns"
      :options="tableOptions"
      :data-source="sortedRows"
      @change-table-sort="onSortChange"
      @selection-change="onSelectionChange"
      @header-dragend="onHeaderDragend"
    />

    <div class="wb-foot">
      <span class="wb-label">列宽预设</span>
      <el-radio-group :model-value="preset" size="small" @change="applyPreset">
        <el-radio-button value="default">默认</el-radio-button>
        <el-radio-button value="compact">紧凑</el-radio-button>
        <el-radio-button value="loose">宽松</el-radio-button>
      </el-radio-group>
      <span v-for="chip in widthChips" :key="chip.prop" class="wb-chip" data-testid="width-chip">{{ chip.label }} {{ chip.width }}px</span>
      <span class="wb-hint">列宽只是列配置：预设或拖表头都会写回配置，换引擎后原样生效</span>
    </div>

    <p class="wb-note">
      同一份 <code>columns</code> / <code>data-source</code> / 事件（<code>change-table-sort</code> /
      <code>selection-change</code>）在两个引擎间通用，<strong>引擎只换渲染层</strong>。从 5,000 行起，
      el-table 会把每一行都插进 DOM，vxe 只渲染视口内的十几行——看「表体 DOM 行」这一栏
      （vxe 4.6+ 的虚拟滚动经 <code>vxeConfig.scrollY</code> 逃生舱显式打开，es-plus 原样透传）。
      勾选、排序、列宽都写在业务状态/列配置里，切引擎后自动生效；滚动位置依赖底层引擎自己的滚动容器
      （下面那行选择器），这是 es-plus 没有收口的一处，本案例如实保留。
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { ElTag } from 'element-plus'
import { EsTable } from '@es-plus/vue3'

const SIZE_OPTIONS = [
  { value: 500, label: '500 行' },
  { value: 5000, label: '5,000 行' },
  { value: 50000, label: '50,000 行' },
]

const OWNERS = ['李雷', '韩梅梅', '张伟', '王芳', '赵磊', '陈晨']
const TITLES = ['登录页偶发 502', '导出报表超时', '权限配置不生效', '消息推送延迟', '支付回调丢失', '列表分页跳页']

// 造数按数量缓存：切数据量时只量「表格重渲染」的耗时，不含造数
const rowCache = new Map<number, Record<string, unknown>[]>()
const buildRows = (count: number) => {
  const cached = rowCache.get(count)
  if (cached) return cached
  const list = Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    orderNo: `WO-2024-${String(i + 1).padStart(6, '0')}`,
    title: `${TITLES[i % TITLES.length]} #${i + 1}`,
    priority: `P${i % 4}`,
    status: ['pending', 'doing', 'done', 'closed'][i % 4],
    owner: OWNERS[i % OWNERS.length],
    amount: 200 + ((i * 137) % 9800),
    createdAt: `2024-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')} ${String(i % 24).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}`,
  }))
  rowCache.set(count, list)
  return list
}

const PRIORITY_META: Record<string, [string, string]> = {
  P0: ['紧急', 'danger'],
  P1: ['高', 'warning'],
  P2: ['中', 'primary'],
  P3: ['低', 'info'],
}
const STATUS_META: Record<string, [string, string]> = {
  pending: ['待处理', 'warning'],
  doing: ['处理中', 'primary'],
  done: ['已完成', 'success'],
  closed: ['已关闭', 'info'],
}

// render 函数列在两个引擎走同一条路径：el-table 原生 / vxe 经 RenderDomTb 桥接
const tagRender = (prop: string, meta: Record<string, [string, string]>) => (h: any, { row }: any) => {
  const [text, type] = meta[row[prop]] ?? [row[prop], 'info']
  return h(ElTag, { size: 'small', type }, () => text)
}

const BASE_COLUMNS: Record<string, any>[] = [
  { type: 'selection', width: 46 },
  { prop: 'orderNo', label: '工单号', width: 150 },
  { prop: 'title', label: '标题', minWidth: 220, showOverflowTooltip: true },
  { prop: 'priority', label: '优先级', width: 96, render: tagRender('priority', PRIORITY_META) },
  { prop: 'status', label: '状态', width: 104, render: tagRender('status', STATUS_META) },
  { prop: 'owner', label: '负责人', width: 96 },
  {
    prop: 'amount',
    label: '金额',
    width: 120,
    align: 'right',
    sortable: true,
    formatter: (row: any) => `¥${Number(row.amount).toLocaleString()}`,
    // vxe 的默认排序按 formatter 的显示文本比较（"¥1,004" < "¥400"），和 el-table 的原值排序不一致；
    // 用列级 vxeColumn.sortBy 把排序键指回原始数值字段，三端排序才真正等价。
    vxeColumn: { sortBy: 'amount' },
  },
  { prop: 'createdAt', label: '创建时间', width: 168, sortable: true },
]

const engine = ref<'default' | 'vxe'>('default')
const size = ref(500)
const rows = ref<Record<string, unknown>[]>(buildRows(500))
const widths = ref<Record<string, number>>({})
const preset = ref('default')
const sortState = ref<{ prop: string; order: 'ascending' | 'descending' } | null>(null)
const selectedIds = ref<number[]>([])
const lastOp = ref('初始渲染')
const lastCost = ref<number | null>(null)
const domRows = ref(0)
const heapText = ref('—')
const busy = ref(false)
const tableRef = ref<any>(null)
const hostEl = ref<HTMLElement | null>(null)

const columns = computed(() =>
  BASE_COLUMNS.map((col) => (col.prop && widths.value[col.prop] ? { ...col, width: widths.value[col.prop] } : col))
)

// 排序放在业务侧：三端 a-table / el-table / vxe 收到的始终是同一份有序数据。
// （antdv 的 sortable 是 sorter:true = 只发事件不本地排，业务侧排序才能让三端表现一致）
const sortedRows = computed(() => {
  const sort = sortState.value
  if (!sort) return rows.value
  const dir = sort.order === 'descending' ? -1 : 1
  return [...rows.value].sort((a, b) => {
    const av = a[sort.prop] as any
    const bv = b[sort.prop] as any
    if (av === bv) return 0
    return (av > bv ? 1 : -1) * dir
  })
})

/** 拖拽列宽写回列配置 —— 配置驱动，所以换引擎后宽度天然保持 */
const onHeaderDragend = (newWidth: number, _oldWidth: number, column: any) => {
  if (column?.property) widths.value = { ...widths.value, [column.property]: Math.round(newWidth) }
}
const onVxeResize = ({ resizeColumn, resizeWidth }: any) => {
  const prop = resizeColumn?.field || resizeColumn?.property
  if (prop) widths.value = { ...widths.value, [prop]: Math.round(resizeWidth) }
}

// 列宽预设同样只是改列配置，与拖拽写回共用同一份 widths
const WIDTH_PRESETS: Record<string, Record<string, number>> = {
  default: {},
  compact: { orderNo: 132, title: 180, priority: 84, status: 92, owner: 82, amount: 104, createdAt: 150 },
  loose: { orderNo: 190, title: 360, priority: 112, status: 124, owner: 116, amount: 148, createdAt: 200 },
}
const applyPreset = (next: string) => {
  preset.value = next
  widths.value = { ...WIDTH_PRESETS[next] }
}

const tableOptions = computed(() => ({
  engine: engine.value,
  border: true,
  stripe: true,
  rowkey: 'id',
  height: 420,
  heightType: 'height' as const,
  defaultSort: sortState.value ?? undefined,
  // vxe 4.6+ 的虚拟滚动要显式开启（gt: 0 = 永远虚拟）：这是 5 万行只留十几行 DOM 的关键。
  // 也是 vxeConfig 逃生舱的示例——es-plus 不理解的 vxe 原生配置原样透传。
  vxeConfig: { scrollY: { enabled: true, gt: 0 }, scrollX: { enabled: true, gt: 0 } },
  vxeOn: { 'column-resizable-change': onVxeResize },
}))

const widthChips = computed(() =>
  BASE_COLUMNS.filter((col) => col.prop && widths.value[col.prop]).map((col) => ({
    prop: col.prop,
    label: col.label,
    width: widths.value[col.prop],
  }))
)

const onSelectionChange = (selected: Record<string, unknown>[]) => {
  selectedIds.value = selected.map((row) => row.id as number)
}
// 两个引擎都归一化成 { prop, order }（el-table 原生 / vxe 引擎已转换 ascending|descending|null）
// 相同值不重复写入：vxe 在应用 defaultSort 时也会发 sort-change，不判重会形成 prop 更新回路
const onSortChange = (payload: any) => {
  const next = payload?.order ? { prop: payload.prop, order: payload.order as 'ascending' | 'descending' } : null
  const cur = sortState.value
  if (next === null ? cur === null : cur && cur.prop === next.prop && cur.order === next.order) return
  sortState.value = next
}

// 滚动容器归底层引擎所有，这里只用一行选择器把它捞出来：
// el-table 是 .el-scrollbar__wrap，vxe 虚拟滚动是 .vxe-table--body-inner-wrapper（外层 wrapper 是 overflow:hidden）
const scrollBody = () =>
  hostEl.value?.querySelector('.vxe-table--body-inner-wrapper, .el-scrollbar__wrap') as HTMLElement | null
// 取行高时要跳过测量行（a-table 的 .ant-table-measure-row 高度为 0），否则换算出的行号会漂
const rowHeightOf = (body: HTMLElement | null): number => {
  const row = body ? [...body.querySelectorAll('tr')].find((tr) => tr.getBoundingClientRect().height > 0) : null
  return row ? row.getBoundingClientRect().height : 40
}
const captureView = () => {
  const body = scrollBody()
  if (!body) return null
  return { rowIndex: Math.round(body.scrollTop / rowHeightOf(body)) }
}

const raf2 = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

const measure = async (label: string, mutate: () => void) => {
  const t0 = performance.now()
  mutate()
  await nextTick()
  await raf2()
  lastCost.value = Math.round(performance.now() - t0)
  lastOp.value = label
  domRows.value = hostEl.value
    ? hostEl.value.querySelectorAll('tr.el-table__row, tr.vxe-body--row').length
    : 0
  const mem = (performance as any).memory
  heapText.value = mem ? `${(mem.usedJSHeapSize / 1048576).toFixed(0)} MB` : '—'
}

const restore = async (view: { rowIndex: number } | null, selected: number[]) => {
  await nextTick()
  await raf2()
  const table = tableRef.value
  if (selected.length) {
    const wanted = new Set(selected)
    rows.value.forEach((row) => {
      if (wanted.has(row.id as number)) table?.toggleRowSelection?.(row, true)
    })
  }
  if (view && view.rowIndex > 0) {
    // 两个引擎都是「滚容器」：换算行高后直接写 scrollTop（虚拟滚动的 vxe 也认这个入口）
    const body = scrollBody()
    if (body) body.scrollTop = view.rowIndex * rowHeightOf(body)
  }
}

const switchEngine = async (next: 'default' | 'vxe') => {
  if (busy.value || next === engine.value) return
  if (next === 'default' && size.value === 50000) return
  busy.value = true
  const view = captureView()
  const selected = [...selectedIds.value]
  try {
    await measure(`切换引擎 → ${next === 'vxe' ? 'vxe-table' : 'el-table'}`, () => {
      engine.value = next
    })
    // 换引擎后按 id 重新勾选、把视口锚点行滚回来
    await restore(view, selected)
  } finally {
    busy.value = false
  }
}

const switchSize = async (next: number) => {
  if (busy.value || next === size.value) return
  const data = buildRows(next) // 造数不计入渲染耗时
  busy.value = true
  const forceVxe = next === 50000 && engine.value !== 'vxe'
  try {
    await measure(`切换数据量 → ${next.toLocaleString()} 行${forceVxe ? '（自动切 vxe）' : ''}`, () => {
      if (forceVxe) engine.value = 'vxe'
      size.value = next
      rows.value = data
      // 换数据集：勾选/排序属于上一批数据，清空
      selectedIds.value = []
      sortState.value = null
    })
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
  await nextTick()
  await raf2()
  domRows.value = hostEl.value
    ? hostEl.value.querySelectorAll('tr.el-table__row, tr.vxe-body--row').length
    : 0
  const mem = (performance as any).memory
  heapText.value = mem ? `${(mem.usedJSHeapSize / 1048576).toFixed(0)} MB` : '—'
})
</script>

<style scoped>
.engine-workbench {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 12px;
}
.wb-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px 24px;
  margin-bottom: 12px;
}
.wb-group {
  display: flex;
  align-items: center;
  gap: 8px;
}
.wb-label {
  font-size: 13px;
  color: #606266;
}
.wb-metrics {
  display: flex;
  gap: 16px;
  margin-left: auto;
  flex-wrap: wrap;
}
.wb-metric {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}
.wb-metric em {
  font-style: normal;
  font-size: 11px;
  color: #909399;
}
.wb-metric b {
  font-size: 13px;
  color: #303133;
  font-variant-numeric: tabular-nums;
}
.wb-foot {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
  font-size: 12px;
}
.wb-hint {
  color: #909399;
}
.wb-chip {
  padding: 1px 8px;
  border-radius: 10px;
  background: #ecf5ff;
  color: #409eff;
  font-family: 'Fira Code', monospace;
  font-size: 11px;
}
.wb-note {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.8;
  color: #909399;
}
.wb-note code {
  background: #f5f5f5;
  padding: 1px 5px;
  border-radius: 3px;
  font-family: 'Fira Code', monospace;
  color: #d63384;
}
</style>
