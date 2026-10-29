<template>
  <div class="flagship-approval">
    <header class="flagship-hero">
      <span class="flagship-badge">旗舰案例</span>
      <h1>合同审批工作台</h1>
      <p class="flagship-intro">{{ story.background }}</p>
      <p class="flagship-intro">
        查询联动、跨页勾选、批量审批、行内权限、审批详情 —— 整页由一份
        <strong>纯 JSON</strong>（{{ schemaKb }} KB、0 个函数）定义。三个站点加载的是
        <strong>同一个文件</strong>，由 <code>scripts/sync-cases.mjs</code> 分发。
      </p>
      <div class="flagship-bar">
        <span class="flagship-role-label">当前角色</span>
        <el-radio-group v-model="role" size="small">
          <el-radio-button label="admin">管理员</el-radio-button>
          <el-radio-button label="editor">审批员</el-radio-button>
          <el-radio-button label="viewer">访客</el-radio-button>
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

<script>
/**
 * 旗舰案例「合同审批工作台」—— Vue 2 / Element UI 宿主页。
 *
 * 与另两站的宿主页逐行同构，只有三处框架差异：
 *   1. 本文件是 Options API（Vue 2.6，无 <script setup>）；
 *   2. 选值用 el-radio-button 的 `label`（Element UI 2.x 契约，Element Plus 才用 `value`）；
 *   3. 消息用 element-ui 的 Message。
 *
 * schema 与 mock 后端来自 `@/cases/`（由 scripts/sync-cases.mjs 从 docs/cases/ 分发，
 * 与另两端逐字节相同），本文件不含任何业务规则。
 */
import { EsCrudPage, configureEsPlus } from '@es-plus/vue2'
import Message from 'element-ui/lib/message'
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

export default {
  name: 'FlagshipApproval',
  components: { EsCrudPage },
  data() {
    const schemaText = JSON.stringify(schema, null, 2)
    // 体积不现算：story 里的 bytes/lines/functions 由 check:flagship-case 对着文件重算比对，
    // 页面上印的是同一组数字 —— 现算 stringify 后的长度会得到 11.0 KB，和「文件 7.6 KB」打架
    const primaryMetric = story.result.metrics.find((metric) => metric.file)
    return {
      role: 'admin',
      schema,
      story,
      primaryMetric,
      schemaKb: (primaryMetric.bytes / 1024).toFixed(1),
      countLabel: { formItems: '个查询项', columns: '列', dialogs: '个弹窗', buttons: '个按钮', reactions: '条联动' },
      copied: false,
      schemaVisible: false,
      schemaText,
      // 函数不进 schema：请求能力走组件 prop（真实项目可改为全局 httpRequest 配置）
      mockHttp: createHttpRequest(),
    }
  },
  computed: {
    permissionCodes() {
      return ROLE_PERMISSIONS[this.role] || []
    },
  },
  watch: {
    // 角色切换 = 先改全局权限，再由 :key="role" 重挂载 CRUD 子树。Vue 2 的用户
    // watcher 在渲染 watcher 之前执行，所以新实例一定读到新权限。刻意不用
    // el-radio-group 的 @change：事件时机依赖 UI 库实现，容易变成「慢一个角色」。
    role(next) {
      configureEsPlus({ permission: createPermission(next) })
    },
  },
  created() {
    // 非响应式的「待驳回行」：只是事件之间的上下文，不需要驱动渲染
    this.pendingRejectRow = null
    configureEsPlus({ permission: createPermission(this.role) })
  },
  beforeDestroy() {
    // 离开页面恢复「全部放行」，避免全局权限状态泄漏给其它示例
    configureEsPlus({ permission: () => true })
  },
  methods: {
    refresh(text) {
      this.$refs.crudRef?.refresh?.()
      Message.success(text)
    },
    metricValue(metric) {
      return metric.file ? `${metric.lines} 行` : metric.value
    },
    async copySchema() {
      try {
        await navigator.clipboard.writeText(this.schemaText)
      } catch (error) {
        // 非安全上下文（http 直连 IP / 老浏览器）没有 clipboard：退回到选中文本，让用户自己复制
        const area = document.createElement('textarea')
        area.value = this.schemaText
        document.body.appendChild(area)
        area.select()
        document.execCommand('copy')
        area.remove()
      }
      this.copied = true
      setTimeout(() => { this.copied = false }, 2000)
    },
    downloadSchema() {
      const blob = new Blob([this.schemaText], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'flagship-approval.json'
      link.click()
      URL.revokeObjectURL(url)
    },
    handleBtnClick(key, payload) {
      if (key === 'approve') {
        const { approved } = approveContracts([payload.id])
        this.refresh(approved ? `已通过：${payload.contractNo}` : `跳过（${payload.status}）：${payload.contractNo}`)
        return
      }
      if (key === 'batchApprove') {
        const rows = this.$refs.crudRef?.getSelectedRows?.() || []
        if (!rows.length) {
          Message.warning('先勾选合同（支持跨页）再批量通过')
          return
        }
        const { approved, skipped } = approveContracts(rows.map((row) => row.id))
        this.$refs.crudRef?.tableRef?.clearAllSelection?.()
        this.refresh(`批量通过 ${approved} 份${skipped ? `，跳过已审批 ${skipped} 份` : ''}`)
        return
      }
      if (key === 'export') {
        const selected = this.$refs.crudRef?.getSelectedRows?.() || []
        const rows = selected.length ? selected : listContracts()
        const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = '合同审批清单.csv'
        link.click()
        URL.revokeObjectURL(url)
        Message.success(`已导出 ${rows.length} 份合同`)
      }
    },
    handleDialogOpen(key, row) {
      if (key === 'reject') this.pendingRejectRow = row || null
    },
    handleDialogConfirm(key, data) {
      if (key !== 'reject' || !this.pendingRejectRow) return
      const row = this.pendingRejectRow
      const ok = rejectContract(row.id, data.rejectReason)
      this.pendingRejectRow = null
      this.refresh(ok ? `已驳回：${row.contractNo}` : `跳过（${row.status}）：${row.contractNo}`)
    },
    handleRowClick(row) {
      if (Number(row.amount) >= DETAIL_THRESHOLD) this.$refs.crudRef?.openDialog?.('detail', row)
    },
  },
}
</script>

<style lang="scss" scoped>
.flagship-approval {
  max-width: 1400px;
  margin: 0 auto;
  padding: 8px clamp(12px, 3vw, 32px) 48px;
}

.flagship-hero {
  padding: 24px 0 16px;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 16px;

  h1 {
    font-size: 26px;
    margin: 8px 0 10px;
    color: #1a1a2e;
  }
}

.flagship-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
  color: #fff;
  background: linear-gradient(135deg, var(--es-brand-primary), var(--es-brand-accent));
}

.flagship-intro {
  color: #606266;
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
  color: #909399;
}

.flagship-codes {
  font-size: 12px;
  color: #909399;
  font-family: monospace;
}

.flagship-tip {
  font-size: 13px;
  color: #909399;
  line-height: 1.8;
  margin: 0;
}

.flagship-schema {
  margin-top: 20px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 12px 16px;

  summary {
    cursor: pointer;
    font-size: 14px;
    color: #1a1a2e;
  }

  pre {
    margin: 12px 0 0;
    max-height: 480px;
    overflow: auto;
    font-size: 12px;
    line-height: 1.6;
  }
}

/* T4 叙事段：与 docs / es-pc 同名同结构，只换这套站的色板 */
.flagship-story {
  margin-top: 40px;
  padding-top: 8px;
  border-top: 1px solid var(--es-border-lighter, #ebeef5);

  h2 {
    font-size: 20px;
    font-weight: 600;
    color: #1a1a2e;
    margin: 36px 0 12px;
  }

  h2:first-child { margin-top: 24px; }
}

.story-lead {
  max-width: 78ch;
  font-size: 14px;
  line-height: 1.8;
  color: #333;
}

.story-points {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;

  li {
    border: 1px solid var(--es-border-lighter, #ebeef5);
    border-radius: 6px;
    padding: 14px 16px;
    background: #fff;
  }
}

.story-pain {
  margin: 0 0 8px;
  font-size: 14px;
  line-height: 1.7;
  color: #1a1a2e;
}

.story-config {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  background: #f5f5f5;
  color: #333;
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
}

.story-note {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.7;
  color: #666;
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
  color: #666;
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
    border-bottom: 1px solid var(--es-border-lighter, #ebeef5);
    text-align: left;
    color: #333;
  }

  th {
    font-weight: 600;
    color: #1a1a2e;
    background: #fafafa;
  }

  code {
    font-family: monospace;
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
  border: 1px solid var(--es-border-lighter, #ebeef5);
  border-radius: 6px;
  padding: 14px 16px;
  background: #fff;
}

.story-metric-value {
  font-size: 22px;
  font-weight: 600;
  color: #1a1a2e;
  font-variant-numeric: tabular-nums;
}

.story-metric-label {
  margin-top: 2px;
  font-size: 13px;
  font-weight: 500;
  color: #333;
}

.story-metric-basis,
.story-metric-counts {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: #666;
}

.story-metric-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;

  span {
    padding: 1px 6px;
    border-radius: 3px;
    background: #f5f5f5;
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
    color: #333;
    margin-bottom: 8px;
  }

  strong {
    display: inline-block;
    margin-right: 6px;
    color: #1a1a2e;

    &::after { content: '：'; }
  }
}
</style>
