<template>
  <div class="fd" data-testid="fragment-dashboard">
    <header class="fd-hero">
      <span class="fd-badge">A8 片段拼装</span>
      <h1>三个片段拼成一个分析页：宿主只管取数与编排</h1>
      <p class="fd-nl">「{{ data.nl }}」</p>
      <p class="fd-lede">
        页面里<strong>没有任何 schema</strong>：筛选表单、结果表格、详情弹窗来自三个片段工具，产物一行未改；
        布局、取数、图表由宿主自己写 —— 图表是原生 <code>&lt;svg&gt;</code>，完全不经 es-plus。
        片段只贡献「字段与长相」，行为留在宿主，这正是片段能被任意页面复用的前提。
      </p>
      <p class="fd-claim">
        <span class="fd-chip-label">claim（与 manifest 逐站一致）</span>
        <span v-for="(claim, site) in data.sites" :key="site" class="fd-chip">{{ site }}: {{ claim }}</span>
        「片段 = 工具(冻结入参)」由 <code>npm run check:fragment-dashboard</code> 重算逐字节比对；
        三端 9 个片段各过一次语法解析，<strong>模板与依赖不在编译断言里</strong>（那是 e2e 的事）。
        es-pc 上本页<strong>同样在跑</strong>（同一份宿主页 + antdv 三片段），但那端没有 e2e project，
        主张按「跑过的才叫 execute」停在 <code>compile</code>。
      </p>
    </header>

    <!-- ① 片段即组件：属性名全部来自底层 es-form / es-table / es-dialog 的既有契约。 -->
    <section class="fd-layout">
      <aside class="fd-pane fd-pane--filter">
        <h2><span class="fd-step">①</span> 筛选 · <code>generate_form</code></h2>
        <FilterBar :model="filters" :config-btn="filterBtns" />
        <p class="fd-note">
          查询 / 重置由宿主接管（片段本身不 emit）—— 点击后宿主带条件重新取数。
          收到的条件：<code>{{ conditionText }}</code>
        </p>
      </aside>

      <div class="fd-pane fd-pane--table">
        <h2>
          <span class="fd-step">②</span> 结果 · <code>generate_table</code>
          <span class="fd-count" data-testid="fd-count">{{ rows.length }} 条命中</span>
        </h2>
        <ResultTable
          :data-source="pageRows"
          :pagination="pager"
          @row-click="openRow"
          @update:pagination="onPager"
        />
        <p class="fd-note">
          表格片段没有 apiUrl（不自取数）：行与分页由宿主注入，行点击冒泡到宿主开弹窗。
        </p>
      </div>

      <aside class="fd-pane fd-pane--chart">
        <h2><span class="fd-step">③</span> 原生图表</h2>
        <!-- 手写 SVG：不经 es-plus，也不会因为换组件库而变 -->
        <svg class="fd-chart" viewBox="0 0 240 170" role="img" aria-label="各状态金额合计">
          <g v-for="(bar, i) in chartBars" :key="bar.label">
            <rect
              :x="16 + i * 76"
              :y="140 - bar.height"
              width="52"
              :height="bar.height"
              rx="4"
              :fill="bar.color"
              :data-testid="`fd-bar-${i}`"
            />
            <text :x="42 + i * 76" y="156" text-anchor="middle" class="fd-chart-label">{{ bar.label }}</text>
            <text :x="42 + i * 76" :y="134 - bar.height" text-anchor="middle" class="fd-chart-value">
              {{ bar.display }}
            </text>
          </g>
          <line x1="8" y1="140" x2="232" y2="140" class="fd-chart-axis" />
        </svg>
        <p class="fd-note">
          数据来自同一批行：<strong data-testid="fd-total">合计 {{ totalText }}</strong>
          —— 页面里只有一个数据源，图表不是另拉一遍。
        </p>
      </aside>
    </section>

    <!-- 弹窗片段：宿主用 ref.open(title, row) 打开，集成契约见下方接线表。 -->
    <OrderDialog ref="dialogRef" />

    <section class="fd-section">
      <h2>片段 → 宿主：三个接线点</h2>
      <table class="fd-wiring" data-testid="fd-wiring">
        <thead>
          <tr><th>片段</th><th>接线点</th><th>为什么必须由宿主接</th></tr>
        </thead>
        <tbody>
          <tr v-for="w in data.host.wiring" :key="w.fragment">
            <td><code>{{ w.fragment }}</code></td>
            <td><code>{{ w.point }}</code></td>
            <td>{{ w.why }}</td>
          </tr>
        </tbody>
      </table>
      <p class="fd-note">{{ data.host.dataPath }}</p>
      <p class="fd-note">{{ data.host.chart }}</p>
    </section>

    <section class="fd-section">
      <h2>产物：三端同一份字段表，三份可独立编译的 SFC</h2>
      <p class="fd-note">
        下面是从工具出参里<strong>原样取出</strong>的片段源码（含 <code>vue3</code> / <code>vue2</code>
        / <code>antdv</code> 三个目标）。主站跑的是 vue3 那三份，es-pc 跑 antdv 那三份。
      </p>
      <div class="fd-tabs">
        <button
          v-for="target in targets"
          :key="target"
          type="button"
          :class="{ active: target === pickedTarget }"
          :data-testid="`fd-target-${target}`"
          @click="pickedTarget = target"
        >
          {{ target }}
          <em>{{ targetNote(target) }}</em>
        </button>
      </div>
      <div class="fd-sources">
        <article v-for="key in fragmentKeys" :key="key" :data-testid="`fd-source-${key}`">
          <h3>
            {{ data.fragments[key].label }}
            <code>{{ data.fragments[key].tool }}</code>
            <span class="fd-src-meta">
              {{ data.fragments[key].file }} · {{ data.fragments[key].lines }} 行 ·
              {{ data.targets[pickedTarget].bytes[key] }} 字节
            </span>
          </h3>
          <pre>{{ sources[pickedTarget][key] }}</pre>
        </article>
      </div>
    </section>

    <section class="fd-section">
      <h2>当前边界（片段拼装还缺什么）</h2>
      <ul class="fd-gaps" data-testid="fd-gaps">
        <li v-for="gap in data.knownGaps" :key="gap">{{ gap }}</li>
      </ul>
      <p class="fd-note">
        这些不是「以后再说」的注脚：页面上的接线方式就是它们的结果 —— 片段今天能拼回页面，
        但拼装契约是底层组件的属性名，而不是片段自己的 props / emits。
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
/**
 * A8 片段拼装仪表盘（主文档站与 es-pc 共用同一份文件，逐字节相同）。
 *
 * 三件事刻意写在这个文件里、不藏进片段：
 *   1. **取数**：一次 `httpRequest` 拿全量，筛选条件只存在于宿主；
 *   2. **编排**：`model` / `configBtn` / `dataSource` / `pagination` 四个接线点；
 *   3. **图表**：手写 SVG，证明片段能与原生实现共存。
 *
 * 片段本身一行未改（由 `scripts/gen-fragment-dashboard.mjs` 生成，`check:fragment-dashboard`
 * 重算比对）。为什么用「同名属性」接线而不是 props：片段目前不声明 props/emits，
 * 见页面末尾的「当前边界」。
 *
 * 请求函数从 `@es-plus/core` 取（而不是各端的 UI 包）：两站注入的是同一个全局配置，
 * 页面因此可以共用一份 —— 端差异只在片段（`@es-plus/vue3` vs `@es-plus/adapter-antdv`）。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { httpRequest } from '@es-plus/core'
import FilterBar from '@/cases/generated/fragments/FilterBar.vue'
import ResultTable from '@/cases/generated/fragments/ResultTable.vue'
import OrderDialog from '@/cases/generated/fragments/OrderDialog.vue'
import FACTS from '@/cases/generated/fragment-dashboard.json'
import { FRAGMENT_SOURCES } from '@/cases/generated/fragment-dashboard-sources.js'

interface OrderRow {
  id: number
  orderNo: string
  customer: string
  amount: number
  status: number
}

const data = FACTS as typeof FACTS
const sources = FRAGMENT_SOURCES as Record<string, Record<string, string>>
const targets = data.frozenArgs.targets as string[]
const fragmentKeys = ['filter', 'table', 'dialog'] as const

const pickedTarget = ref('vue3')
const targetNote = (target: string) => (data.targets as Record<string, { note: string }>)[target]?.note ?? ''

/** 筛选条件：片段的内部 model 被宿主这份替代（同名属性覆盖根组件绑定）。 */
const filters = reactive<{ keyword: string; status: string | number }>({ keyword: '', status: '' })
/** 宿主接管的按钮：key=query / rest 保留 es-form 的语义（rest 会先 resetFields）。 */
const filterBtns = [
  { name: '查询', type: 'primary', key: 'query', click: () => void load() },
  {
    name: '重置',
    key: 'rest',
    click: () => {
      filters.keyword = ''
      filters.status = ''
      void load()
    },
  },
]

const rows = ref<OrderRow[]>([])
const pager = reactive({ current: 1, pageSize: 8, total: 0 })
const dialogRef = ref<{ open: (title?: string, row?: Partial<OrderRow>) => void } | null>(null)

const conditionText = computed(() => {
  const parts: string[] = []
  if (filters.keyword) parts.push(`keyword=${filters.keyword}`)
  if (filters.status !== '' && filters.status !== undefined) parts.push(`status=${filters.status}`)
  return parts.length ? parts.join('&') : '（无）'
})

const pageRows = computed(() => rows.value.slice((pager.current - 1) * pager.pageSize, pager.current * pager.pageSize))

const STATUS_BARS = [
  { value: 0, label: '待发货', color: '#f59e0b' },
  { value: 1, label: '已发货', color: '#10b981' },
  { value: 2, label: '已签收', color: '#6366f1' },
]

const chartBars = computed(() => {
  const sums = STATUS_BARS.map((b) => ({
    ...b,
    sum: rows.value.filter((r) => Number(r.status) === b.value).reduce((acc, r) => acc + Number(r.amount || 0), 0),
  }))
  const max = Math.max(1, ...sums.map((s) => s.sum))
  return sums.map((s) => ({
    label: s.label,
    color: s.color,
    height: Math.round((s.sum / max) * 92),
    display: `${Math.round(s.sum / 1000)}k`,
  }))
})

const totalText = computed(() => `¥${rows.value.reduce((acc, r) => acc + Number(r.amount || 0), 0).toLocaleString('zh-CN')}`)

/** 一次取全量（演示后端 37 条）：筛选在服务端做，分页与图表在宿主做。 */
async function load() {
  const params: Record<string, unknown> = { pageIndex: 1, pageSize: 100 }
  if (filters.keyword) params.keyword = filters.keyword
  if (filters.status !== '' && filters.status !== undefined) params.status = filters.status
  const res = (await httpRequest({ url: '/api/demo/orders', method: 'GET', formParams: params })) as {
    data?: OrderRow[]
  }
  rows.value = res?.data ?? []
  pager.total = rows.value.length
  pager.current = 1
}

/** 弹窗片段用 title 区分只读/编辑：'查看' 时按钮只剩「关闭」。 */
function openRow(row: OrderRow) {
  dialogRef.value?.open('查看', row)
}

function onPager(next: { current?: number; pageSize?: number }) {
  if (next.current) pager.current = next.current
  if (next.pageSize) pager.pageSize = next.pageSize
}

onMounted(() => {
  void load()
})
// 逐页 title / description：单一来源在 utils/page-meta.ts（check:page-meta 静态核对）。
// 放在脚本末尾不影响求值 —— ESM 的 import 声明会被提升，这样文件级注释与 import 分组都不被打断。
import { usePageMeta } from '@/utils/page-meta'

usePageMeta('fragment-dashboard')
</script>

<style lang="scss" scoped>
.fd {
  max-width: 1240px;
  margin: 0 auto;
  padding: 8px clamp(12px, 3vw, 32px) 56px;
  color: var(--text-color-primary, #1f1f1f);
}

.fd-hero {
  padding: 16px 0;
  border-bottom: 1px solid var(--border-color-lighter, var(--es-border-lighter));

  h1 {
    font-size: 24px;
    margin: 8px 0 10px;
  }

  p {
    color: var(--text-color-regular, var(--es-text-regular));
    line-height: 1.9;
    margin: 6px 0;
  }
}

.fd-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
  color: #fff;
  background: linear-gradient(135deg, #6f42c1, #a855f7);
}

.fd-nl {
  font-style: italic;
  color: var(--text-color-secondary, var(--es-text-secondary));
}

.fd-claim {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.fd-chip {
  padding: 1px 8px;
  border-radius: 8px;
  font-size: 12px;
  color: var(--es-info-text);
  background: var(--es-info-tint);
}

.fd-chip-label {
  font-size: 12px;
  color: var(--text-color-secondary, var(--es-text-secondary));
}

.fd-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(220px, 300px);
  gap: 14px;
  margin-top: 20px;

  // 顶部筛选占满一行（与 NL 的「顶部筛选、中间表格、右侧图表」一致）：
  // 390px 的三栏会把 el-form 的 label + 控件压成一条缝，antdv 端尤其明显。
  .fd-pane--filter {
    grid-column: 1 / -1;
  }

  @media (max-width: 900px) {
    /* minmax(0, 1fr) 而不是 1fr：表单的最小内容宽度会把单列撑得比视口还宽。
       （antdv 端同样处理，两页布局保持同一份口径） */
    grid-template-columns: minmax(0, 1fr);
  }
}

.fd-pane {
  min-width: 0;
  border: 1px solid var(--border-color-lighter, var(--es-border-lighter));
  border-radius: 8px;
  padding: 12px 14px;
  background: var(--bg-color, #fff);

  h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    margin: 0 0 10px;
  }
}

.fd-step {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  font-size: 12px;
  color: #fff;
  background: #6f42c1;
}

.fd-count {
  margin-left: auto;
  font-size: 12px;
  font-weight: normal;
  color: var(--text-color-secondary, var(--es-text-secondary));
}

.fd-note {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.8;
  color: var(--text-color-secondary, var(--es-text-secondary));
}

.fd-chart {
  width: 100%;
  height: auto;
}

.fd-chart-label {
  font-size: 10px;
  fill: var(--es-text-secondary);
}

.fd-chart-value {
  font-size: 10px;
  fill: var(--es-text-regular);
}

.fd-chart-axis {
  stroke: var(--es-border-lighter);
}

.fd-section {
  margin-top: 28px;

  h2 {
    font-size: 16px;
    margin: 0 0 12px;
  }
}

.fd-wiring {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  /* 三列文字（片段/接线点/为什么）在 320px 下的 min-content 约 309px，
     比容器（296px）宽 —— 让表格自己横滑，页面宽度不变。 */
  @media (max-width: 768px) {
    display: block;
    max-width: 100%;
    overflow-x: auto;
  }

  th,
  td {
    border: 1px solid var(--border-color-lighter, var(--es-border-lighter));
    padding: 8px 10px;
    text-align: left;
    vertical-align: top;
    line-height: 1.7;
  }

  th {
    background: var(--bg-color-page, var(--es-bg-subtle));
    font-weight: 600;
  }
}

.fd-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;

  button {
    padding: 6px 12px;
    border: 1px solid var(--es-border);
    border-radius: 6px;
    background: var(--es-bg);
    cursor: pointer;
    font-size: 13px;

    em {
      margin-left: 6px;
      font-style: normal;
      font-size: 11px;
      color: var(--es-text-secondary);
    }

    &.active {
      border-color: #6f42c1;
      color: #6f42c1;
      background: var(--es-brand-tint);
    }
  }
}

.fd-sources {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr));
  gap: 14px;

  article {
    border: 1px solid var(--border-color-lighter, var(--es-border-lighter));
    border-radius: 8px;
    padding: 10px 12px;
    min-width: 0;
  }

  h3 {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    margin: 0 0 8px;
  }

  pre {
    margin: 0;
    max-height: 320px;
    overflow: auto;
    font-size: 12px;
    line-height: 1.6;
    background: var(--bg-color-page, var(--es-bg-subtle));
    padding: 10px;
    border-radius: 6px;
  }
}

.fd-src-meta {
  font-size: 11px;
  font-weight: normal;
  color: var(--es-text-secondary);
}

.fd-gaps {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  line-height: 1.9;
  color: var(--text-color-regular, var(--es-text-regular));
}

/* 表格片段自带的分页器（Vue3 端 el-pagination、antdv 端 a-pagination/.ant-pagination）
   在 320px 下会被 es-table 的 .table_component（overflow: hidden）裁掉，页码根本点不到。
   这里只让分页允许换行 —— 片段产物一行未改，宿主负责适配。
   两站共用同一份宿主页，故两个选择器都写上：各自站点只命中其中一条，另一条无害。 */
@media (max-width: 768px) {
  :deep(.el-pagination),
  :deep(.ant-pagination) {
    flex-wrap: wrap;
    justify-content: center;
    row-gap: 8px;
    white-space: normal;
  }
}
</style>
