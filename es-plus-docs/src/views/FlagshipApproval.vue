<template>
  <div class="flagship-approval">
    <header class="flagship-hero">
      <span class="flagship-badge">旗舰案例</span>
      <h1>合同审批工作台</h1>
      <p class="flagship-intro">
        {{ story.background }}
      </p>
      <p class="flagship-intro">
        查询联动、跨页勾选、批量审批、行内权限、审批详情 —— 整页由一份
        <strong>纯 JSON</strong>（{{ schemaKb }} KB、0 个函数）定义。三个站点加载的是
        <strong>同一个文件</strong>，由 <code>scripts/sync-cases.mjs</code> 分发。
      </p>
      <div class="flagship-bar">
        <span class="flagship-role-label">当前角色</span>
        <el-radio-group v-model="role" size="small">
          <el-radio-button value="admin">管理员</el-radio-button>
          <el-radio-button value="editor">审批员</el-radio-button>
          <el-radio-button value="viewer">访客</el-radio-button>
        </el-radio-group>
        <span class="flagship-codes">{{ permissionCodes.join(' · ') }}</span>
        <el-button size="small" @click="schemaVisible = !schemaVisible">
          {{ schemaVisible ? '收起 Schema' : '查看驱动本页的 Schema' }}
        </el-button>
      </div>
      <p class="flagship-tip">
        可试的三条主线：① 第 1 页勾几份 → 翻到第 2 页继续勾 → 「批量通过」（勾选跨页保留）；
        ② 点金额 ≥ 100 万的行，直接打开审批详情；③ 切到「访客」，通过/驳回按钮与金额列同时消失。
      </p>
    </header>

    <es-crud-page
      :key="role"
      ref="crudRef"
      :schema="schema"
      :http-request="mockHttp"
      @btn-click="handleBtnClick"
      @dialog-open="handleDialogOpen"
      @dialog-confirm="handleDialogConfirm"
      @row-click="handleRowClick"
    />

    <details v-if="schemaVisible" open class="flagship-schema">
      <summary>驱动上面整页的 CrudPageSchema（纯 JSON：可存库、可下发、可由 AI 生成）</summary>
      <pre>{{ schemaText }}</pre>
    </details>

    <!-- T4 案例模板：背景（hero）→ 实时 demo（上面）→ 问题 → 配置 → 结果 → 成本 → 边界。
         文案单源 docs/cases/flagship-approval.story.json，三站同一份字节；
         里面的数字（字节 / 行数 / 计数）由 check:flagship-case 逐项重算比对，不是手写。 -->
    <section class="flagship-story">
      <h2>问题</h2>
      <p class="story-lead">{{ story.problem.lead }}</p>
      <ol class="story-points">
        <li v-for="point in story.problem.points" :key="point.config">
          <p class="story-pain">{{ point.pain }}</p>
          <code class="story-config">{{ point.config }}</code>
          <p class="story-note">{{ point.note }}</p>
        </li>
      </ol>

      <h2>配置</h2>
      <div class="story-actions">
        <el-button size="small" type="primary" plain @click="copySchema">
          {{ copied ? '已复制' : '复制 JSON' }}
        </el-button>
        <el-button size="small" @click="downloadSchema">下载 JSON</el-button>
        <span class="story-hint">
          {{ primaryMetric.lines }} 行 · {{ schemaKb }} KB · {{ primaryMetric.functions }} 个函数 ·
          三端同一份字节
        </span>
      </div>
      <p class="story-basis">下载的就是驱动上面那个表格的文件本身，没有裁剪、没有隐藏字段。</p>

      <h2>结果</h2>
      <div class="story-metrics">
        <div v-for="metric in story.result.metrics" :key="metric.label" class="story-metric">
          <div class="story-metric-value">{{ metricValue(metric) }}</div>
          <div class="story-metric-label">{{ metric.label }}</div>
          <p class="story-metric-basis">{{ metric.file ? metric.note : metric.basis }}</p>
          <p v-if="metric.counts" class="story-metric-counts">
            <span v-for="(count, key) in metric.counts" :key="key">{{ count }} {{ countLabel[key] }}</span>
          </p>
        </div>
      </div>

      <h2>成本</h2>
      <p class="story-basis">{{ story.cost.basis }}</p>
      <!-- 用原生 table 而不是各站自己的表格组件：这一块三站要逐字一致，
           而 el-table / a-table / el-table(Vue2) 的列 API 三套不同 —— 用框架组件
           会把「同一份文档」变成三份需要各自维护的模板 -->
      <table class="story-cost">
        <thead>
          <tr><th>要写的东西</th><th>文件</th><th class="num">非空行</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in story.cost.rows" :key="row.file">
            <td>{{ row.label }}</td>
            <td><code>{{ row.file }}</code></td>
            <td class="num">{{ row.lines }}</td>
          </tr>
        </tbody>
      </table>

      <h2>边界</h2>
      <ul class="story-boundaries">
        <li v-for="item in story.boundaries" :key="item.title">
          <strong>{{ item.title }}</strong>{{ item.text }}
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { EsCrudPage, configureEsPlus } from '@es-plus/vue3'
// 单源：由 scripts/sync-cases.mjs 从 docs/cases/ 分发，禁止手改
import schema from '@/cases/flagship-approval.json'
// 叙事数据（背景/问题/结果/成本/边界）：同样是单源分发，三站渲染同一份字节
import story from '@/cases/flagship-approval.story.json'
import {
  DETAIL_THRESHOLD,
  ROLE_PERMISSIONS,
  approveContracts,
  createHttpRequest,
  createPermission,
  listContracts,
  rejectContract,
  toCsv,
} from '@/cases/flagship-approval.mock.js'

const role = ref('admin')
const crudRef = ref(null)
const schemaVisible = ref(false)
const pendingRejectRow = ref(null)

const schemaText = JSON.stringify(schema, null, 2)
// 体积不现算：story 里的 bytes/lines/functions 由 check:flagship-case 对着文件重算比对，
// 页面上印的是同一组数字 —— 现算 stringify 后的长度会得到 11.0 KB，和「文件 7.6 KB」打架
const primaryMetric = story.result.metrics.find((metric) => metric.file)
const schemaKb = (primaryMetric.bytes / 1024).toFixed(1)
const countLabel = { formItems: '个查询项', columns: '列', dialogs: '个弹窗', buttons: '个按钮', reactions: '条联动' }
const copied = ref(false)

const metricValue = (metric) => (metric.file ? `${metric.lines} 行` : metric.value)

async function copySchema() {
  try {
    await navigator.clipboard.writeText(schemaText)
  } catch {
    // 非安全上下文（http 直连 IP / 老浏览器）没有 clipboard：退回到选中文本，让用户自己复制
    const area = document.createElement('textarea')
    area.value = schemaText
    document.body.appendChild(area)
    area.select()
    document.execCommand('copy')
    area.remove()
  }
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

function downloadSchema() {
  const blob = new Blob([schemaText], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'flagship-approval.json'
  link.click()
  URL.revokeObjectURL(url)
}

const permissionCodes = computed(() => ROLE_PERMISSIONS[role.value] || [])

// 函数不进 schema：请求能力走组件 prop（真实项目可改配 configureEsPlus({ httpRequest })），
// 权限判定写进全局配置，schema 里只留 apiParams.url 与 permissionValue
const mockHttp = createHttpRequest()
configureEsPlus({ permission: createPermission(role.value) })

/**
 * 角色切换 = 改全局权限 → 重挂载 CRUD 子树（:key="role"）。
 *
 * 顺序不能反：列/按钮的 permissionValue 过滤发生在组件创建期（filteredColumns 是
 * 依赖 props 的 computed，permission 本身不是响应式的），所以必须「先换权限、后建实例」。
 * 这里刻意不用 el-radio-group 的 @change —— Element Plus 在 nextTick 才 emit，
 * 那一刻 :key 已经用旧权限重建过一遍了（表现为「慢一个角色」）。flush:'sync'
 * 的 watcher 在 role 赋值的同一 tick 内改写全局配置，重挂载必定读到新权限。
 */
watch(role, (next) => configureEsPlus({ permission: createPermission(next) }), { flush: 'sync' })

function refresh(message) {
  crudRef.value?.refresh?.()
  ElMessage.success(message)
}

function handleBtnClick(key, payload) {
  if (key === 'approve') {
    const { approved } = approveContracts([payload.id])
    refresh(approved ? `已通过：${payload.contractNo}` : `跳过（${payload.status}）：${payload.contractNo}`)
    return
  }
  if (key === 'batchApprove') {
    const rows = crudRef.value?.getSelectedRows?.() || []
    if (!rows.length) {
      ElMessage.warning('先勾选合同（支持跨页）再批量通过')
      return
    }
    const { approved, skipped } = approveContracts(rows.map((row) => row.id))
    crudRef.value?.tableRef?.clearAllSelection?.()
    refresh(`批量通过 ${approved} 份${skipped ? `，跳过已审批 ${skipped} 份` : ''}`)
    return
  }
  if (key === 'export') {
    const selected = crudRef.value?.getSelectedRows?.() || []
    const rows = selected.length ? selected : listContracts()
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = '合同审批清单.csv'
    link.click()
    URL.revokeObjectURL(url)
    ElMessage.success(`已导出 ${rows.length} 份合同`)
  }
}

function handleDialogOpen(key, row) {
  if (key === 'reject') pendingRejectRow.value = row || null
}

function handleDialogConfirm(key, data) {
  if (key !== 'reject' || !pendingRejectRow.value) return
  const row = pendingRejectRow.value
  const ok = rejectContract(row.id, data.rejectReason)
  pendingRejectRow.value = null
  refresh(ok ? `已驳回：${row.contractNo}` : `跳过（${row.status}）：${row.contractNo}`)
}

function handleRowClick(row) {
  if (Number(row.amount) >= DETAIL_THRESHOLD) crudRef.value?.openDialog?.('detail', row)
}

// 离开页面恢复「全部放行」，避免全局权限状态泄漏给其它示例
onUnmounted(() => configureEsPlus({ permission: () => true }))
// 逐页 title / description：单一来源在 utils/page-meta.ts（check:page-meta 静态核对）。
// 放在脚本末尾不影响求值 —— ESM 的 import 声明会被提升，这样文件级注释与 import 分组都不被打断。
import { usePageMeta } from '@/utils/page-meta'

usePageMeta('flagship-approval')
</script>

<style lang="scss" scoped>
.flagship-approval {
  max-width: 1400px;
  margin: 0 auto;
  padding: 8px clamp(12px, 3vw, 32px) 48px;
}

.flagship-hero {
  padding: 24px 0 16px;
  border-bottom: 1px solid var(--border-color-lighter);
  margin-bottom: 16px;

  h1 {
    font-size: 26px;
    margin: 8px 0 10px;
    color: var(--text-color-primary);
  }
}

.flagship-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
  color: #fff;
  background: linear-gradient(135deg, var(--es-brand-primary), #6f9cff);
}

.flagship-intro {
  color: var(--text-color-regular);
  line-height: 1.8;
  max-width: 900px;
}

.flagship-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin: 14px 0 10px;
}

.flagship-role-label {
  font-size: 13px;
  color: var(--text-color-secondary);
}

.flagship-codes {
  font-size: 12px;
  color: var(--text-color-secondary);
  font-family: var(--code-font-family, monospace);
}

.flagship-tip {
  font-size: 13px;
  color: var(--text-color-secondary);
  line-height: 1.8;
  margin: 0;
}

.flagship-schema {
  margin-top: 20px;
  border: 1px solid var(--border-color-lighter);
  border-radius: 6px;
  padding: 12px 16px;

  summary {
    cursor: pointer;
    font-size: 14px;
    color: var(--text-color-primary);
  }

  pre {
    margin: 12px 0 0;
    max-height: 480px;
    overflow: auto;
    font-size: 12px;
    line-height: 1.6;
  }
}

/* T4 叙事段：背景在 hero，实时 demo 在表格，以下从「问题」开始。
   版式按 6.5 的排版阶梯 —— h2 20px/600，正文 14px/1.8，证据行 13px。 */
.flagship-story {
  margin-top: 40px;
  padding-top: 8px;
  border-top: 1px solid var(--border-color-lighter);

  h2 {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-color-primary);
    margin: 36px 0 12px;
  }

  h2:first-child { margin-top: 24px; }
}

.story-lead {
  max-width: 78ch;
  font-size: 14px;
  line-height: 1.8;
  color: var(--text-color-regular);
}

.story-points {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
}

.story-points li {
  border: 1px solid var(--border-color-lighter);
  border-radius: 6px;
  padding: 14px 16px;
  background: var(--bg-color);
}

.story-pain {
  margin: 0 0 8px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-color-primary);
}

.story-config {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--fill-color);
  color: var(--text-color-regular);
  font-family: var(--code-font-family, monospace);
  font-size: 12px;
  word-break: break-all;
}

.story-note {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-color-secondary);
}

.story-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.story-hint,
.story-basis {
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-color-secondary);
}

.story-basis {
  max-width: 78ch;
  margin: 8px 0 12px;
}

.story-cost {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 8px;
  font-size: 13px;

  th,
  td {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-color-lighter);
    text-align: left;
    color: var(--text-color-regular);
  }

  th {
    font-weight: 600;
    color: var(--text-color-primary);
    background: var(--fill-color-light);
  }

  code {
    font-family: var(--code-font-family, monospace);
    font-size: 12px;
  }

  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
}

.story-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
}

.story-metric {
  border: 1px solid var(--border-color-lighter);
  border-radius: 6px;
  padding: 14px 16px;
  background: var(--bg-color);
}

.story-metric-value {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-color-primary);
  font-variant-numeric: tabular-nums;
}

.story-metric-label {
  margin-top: 2px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-color-regular);
}

.story-metric-basis,
.story-metric-counts {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-color-secondary);
}

.story-metric-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;

  span {
    padding: 1px 6px;
    border-radius: 3px;
    background: var(--fill-color);
    font-variant-numeric: tabular-nums;
  }
}

.story-boundaries {
  margin: 0;
  padding-left: 20px;
  max-width: 88ch;

  li {
    font-size: 14px;
    line-height: 1.8;
    color: var(--text-color-regular);
    margin-bottom: 8px;
  }

  strong {
    display: inline-block;
    margin-right: 6px;
    color: var(--text-color-primary);

    &::after { content: '：'; }
  }
}
</style>
