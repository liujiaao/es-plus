<template>
  <div class="ai-generated">
    <header class="ai-hero">
      <span class="ai-badge">AI 生成 · 未经手工修改</span>
      <h1>一句话 → 采购申请审批页</h1>
      <p class="ai-intro">{{ story.conclusion }}</p>
      <p class="ai-intro">
        下面整页来自一句中文需求，由 <code>es-plus create --ai</code> 生成一份
        <strong>纯 JSON</strong> 的 CrudPageSchema（{{ productKb }} KB、{{ story.product.functions }} 个函数）。
        模型只负责把 NL 翻成配置，宿主只注入数据请求与权限 —— 配置本身可存库、可下发、
        也能在另两端渲染同一份字节。
      </p>
      <blockquote class="ai-nl">「{{ meta.nl }}」</blockquote>
      <div class="ai-bar">
        <el-switch v-model="withAudit" />
        <span class="ai-switch-label">具备审批权限 approval:audit</span>
        <span class="ai-provenance">
          model {{ meta.model }} · {{ meta.generatedAt }} · {{ meta.attempts }} 次尝试 · {{ meta.mode }} 模式
        </span>
        <el-button size="small" @click="schemaVisible = !schemaVisible">
          {{ schemaVisible ? '收起 Schema' : '查看生成的 Schema' }}
        </el-button>
      </div>
      <p class="ai-tip">
        可试的三条主线：① 新增 → 把状态选成「已驳回」，驳回原因才会出现且必填（模型用
        <code>reactions</code> 表达的条件必填）；② 关掉审批权限开关，「通过」「驳回」两个行按钮
        同时消失（<code>permissionValue</code>）；③ 状态列是中文彩色标签（<code>dataOptions</code>
        + <code>tagType</code>）。查询、分页、弹窗确认都由 schema 驱动。
      </p>
    </header>

    <h2 class="ai-section-title">30 秒演示</h2>
    <es-crud-page
      :key="String(withAudit)"
      ref="crudRef"
      :schema="schema"
      :http-request="mockHttp"
      @btn-click="handleBtnClick"
      @dialog-confirm="handleDialogConfirm"
    />

    <details v-if="schemaVisible" open class="ai-schema">
      <summary>AI 生成的 CrudPageSchema（纯 JSON；含 reactions / permissionValue / operationColumn / dataOptions）</summary>
      <pre>{{ schemaText }}</pre>
    </details>

    <!-- T5 AI 证据模板：用户任务标题（hero）→ 一句话结论 → 30 秒演示（上面）→ 方法 → 产物 →
         实测数据 → 边界与不承诺 → 术语折叠。文案单源
         docs/cases/generated/purchase-approval.story.json（cases:check 校验三站一致），
         里面的数字与复现命令都由 check:generated-case 对着产物重算比对。 -->
    <section class="ai-evidence">
      <h2>方法</h2>
      <ol class="evidence-steps">
        <li v-for="(step, index) in story.method" :key="step.title">
          <span class="step-index">{{ index + 1 }}</span>
          <div>
            <strong>{{ step.title }}</strong>
            <p>{{ step.text }}</p>
          </div>
        </li>
      </ol>

      <h2>产物</h2>
      <div class="evidence-actions">
        <el-button size="small" type="primary" plain @click="downloadSchema">下载 JSON</el-button>
        <el-button size="small" @click="copyCommand">{{ commandCopied ? '已复制命令' : '复制复现命令' }}</el-button>
        <span class="evidence-hint">
          {{ story.product.lines }} 行 · {{ productKb }} KB · {{ story.product.functions }} 个函数
        </span>
      </div>
      <p class="evidence-note">{{ story.product.note }}</p>
      <div class="evidence-counts">
        <span v-for="(count, key) in story.product.counts" :key="key">{{ count }} {{ countLabel[key] }}</span>
      </div>
      <pre class="evidence-command"><code>{{ story.repro.command }}</code></pre>
      <p class="evidence-note">{{ story.repro.note }}</p>

      <h2>实测数据</h2>
      <p class="evidence-note">
        核对日期 {{ story.evidence.measuredAt }}。下面每一条都写清了口径；能在产物里重算的数字，
        守卫每次跑都会重算一遍。
      </p>
      <div class="evidence-metrics">
        <div v-for="metric in story.evidence.metrics" :key="metric.label" class="evidence-metric">
          <div class="evidence-metric-value">{{ metric.value }}</div>
          <div class="evidence-metric-label">{{ metric.label }}</div>
          <p class="evidence-metric-basis">{{ metric.basis }}</p>
        </div>
      </div>

      <h2>边界与不承诺</h2>
      <ul class="evidence-boundaries">
        <li v-for="item in story.boundaries" :key="item.title">
          <strong>{{ item.title }}</strong>{{ item.text }}
        </li>
      </ul>

      <details class="evidence-terms">
        <summary>术语（内部代号不放进标题）</summary>
        <dl>
          <template v-for="item in story.terms">
            <dt :key="`${item.term}-t`">{{ item.term }}</dt>
            <dd :key="`${item.term}-d`">{{ item.meaning }}</dd>
          </template>
        </dl>
      </details>
    </section>
  </div>
</template>

<script>
/**
 * F7「一句话 → 页面」—— Vue 2 / Element UI 宿主页。
 *
 * 与另两站的宿主页逐行同构，只有三处框架差异：
 *   1. 本文件是 Options API（Vue 2.6，无 <script setup>）；
 *   2. 确认框用 element-ui 的 MessageBox.confirm（返回 Promise）；
 *   3. 消息用 element-ui 的 Message。
 *
 * schema / meta / mock 来自 `@/cases/generated/`（scripts/sync-cases.mjs 从
 * docs/cases/generated/ 分发，与另两端逐字节相同），本文件不含任何业务规则。
 */
import { EsCrudPage, configureEsPlus } from '@es-plus/vue2'
import { Message, MessageBox } from 'element-ui'
// 单源：由 scripts/sync-cases.mjs 从 docs/cases/generated/ 分发，禁止手改
import schema from '@/cases/generated/purchase-approval.json'
import meta from '@/cases/generated/purchase-approval.meta.json'
// 证据叙事（方法/产物/实测数据/边界/术语）：单源分发，三站同一份字节
import story from '@/cases/generated/purchase-approval.story.json'
import {
  approveRequest,
  createHttpRequest,
  createPermission,
  createRequest,
  rejectRequest,
} from '@/cases/generated/purchase-approval.mock.js'

/**
 * 本站 main.js 注册了历史项目沿用的全局映射
 * `EsTable.methods.configQueryfieldOutput`（data / total / pageIndex），它对本站每张表
 * 都生效、优先级高于默认契约。所以宿主在这里把 mock 的标准响应
 * （rows / records / pageNo）转成本站后端约定的形状 —— 这正是「schema 描述页面、
 * 宿主适配后端」的边界：生成产物不用改一个字。
 */
function createSiteHttp() {
  const request = createHttpRequest()
  return (params) =>
    request(params).then((res) => ({
      data: res.rows,
      total: res.records,
      pageIndex: res.pageNo,
      pageSize: res.pageSize,
    }))
}

export default {
  name: 'AiGenerated',
  components: { EsCrudPage },
  data() {
    const schemaText = JSON.stringify(schema, null, 2)
    return {
      withAudit: true,
      schema,
      meta,
      story,
      schemaVisible: false,
      schemaText,
      // 产物体积印 story 里的数字（对着文件重算过），不现算 stringify 后的长度 ——
      // 两者会打架：文件 7.8 KB，重新排版后 11 KB（旗舰页同样的坑）
      productKb: (story.product.bytes / 1024).toFixed(1),
      countLabel: { formItems: '个查询项', columns: '列', dialogs: '个弹窗', buttons: '个按钮', reactions: '条联动' },
      commandCopied: false,
      // 函数不进 schema：请求能力走组件 prop（真实项目可改为全局 httpRequest 配置）
      mockHttp: createSiteHttp(),
    }
  },
  watch: {
    // 权限是宿主注入的（schema 里只有权限码）：开关切换 → 改全局权限 → 由
    // :key 重挂载 CRUD 子树。Vue 2 的用户 watcher 在渲染 watcher 之前执行，
    // 新实例一定读到新权限（与旗舰页同一套时序约束）。
    withAudit(next) {
      configureEsPlus({ permission: createPermission(next) })
    },
  },
  created() {
    configureEsPlus({ permission: createPermission(this.withAudit) })
  },
  beforeDestroy() {
    // 离开页面恢复「全部放行」，避免全局权限状态泄漏给其它示例
    configureEsPlus({ permission: () => true })
  },
  methods: {
    async copyText(text) {
      try {
        await navigator.clipboard.writeText(text)
      } catch {
        // 非安全上下文（http 直连 IP / 老浏览器）没有 clipboard：退回 execCommand
        const area = document.createElement('textarea')
        area.value = text
        document.body.appendChild(area)
        area.select()
        document.execCommand('copy')
        area.remove()
      }
    },
    async copyCommand() {
      await this.copyText(this.story.repro.command)
      this.commandCopied = true
      setTimeout(() => { this.commandCopied = false }, 2000)
    },
    downloadSchema() {
      const blob = new Blob([this.schemaText], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'purchase-approval.json'
      link.click()
      URL.revokeObjectURL(url)
    },
    refresh(text) {
      this.$refs.crudRef?.refresh?.()
      Message.success(text)
    },
    handleBtnClick(key, row) {
      // 生成的按钮没有 key —— 运行时以按钮名作为事件标识（见 crud-page 的 key 兜底）
      if (key === '通过') {
        this.refresh(approveRequest(row.id) ? `已通过：${row.applyNo}` : `跳过（${row.status}）：${row.applyNo}`)
        return
      }
      if (key === '驳回') {
        MessageBox.confirm(`确定驳回 ${row.applyNo}？`, '驳回采购申请', {
          type: 'warning',
          confirmButtonText: '驳回',
          cancelButtonText: '取消',
        })
          .then(() => {
            this.refresh(rejectRequest(row.id, '审批人驳回') ? `已驳回：${row.applyNo}` : `跳过（${row.status}）：${row.applyNo}`)
          })
          .catch(() => {})
      }
    },
    handleDialogConfirm(key, data) {
      if (key !== 'add') return
      const row = createRequest(data)
      this.refresh(`已新增：${row.applyNo}`)
    },
  },
}
</script>

<style lang="scss" scoped>
.ai-generated {
  max-width: 1400px;
  margin: 0 auto;
  padding: 8px clamp(12px, 3vw, 32px) 48px;
}

.ai-hero {
  padding: 24px 0 16px;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 16px;

  h1 {
    font-size: 26px;
    margin: 8px 0 10px;
    color: #1a1a2e;
  }
}

.ai-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
  color: #fff;
  background: linear-gradient(135deg, #6f42c1, #a855f7);
}

.ai-intro {
  color: #606266;
  line-height: 1.8;
  max-width: 960px;
}

.ai-nl {
  margin: 12px 0;
  padding: 10px 14px;
  border-left: 3px solid var(--es-brand-primary, #409eff);
  background: #fafafa;
  color: #1a1a2e;
  line-height: 1.8;
  font-size: 13px;
}

.ai-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin: 14px 0 10px;
}

.ai-switch-label {
  font-size: 13px;
  color: #606266;
}

.ai-provenance {
  font-size: 12px;
  color: #909399;
  font-family: monospace;
}

.ai-tip {
  font-size: 13px;
  color: #909399;
  line-height: 1.9;
  margin: 0;
}

.ai-schema {
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

/* T5 证据段：方法 → 产物 → 实测数据 → 边界 → 术语（折叠）。
   与旗舰案例（T4）同名同构，只换这套站的色板。 */
.ai-section-title {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 8px 0 12px;
}

.ai-evidence {
  margin-top: 40px;
  padding-top: 8px;
  border-top: 1px solid #ebeef5;

  h2 {
    font-size: 20px;
    font-weight: 600;
    color: #1a1a2e;
    margin: 36px 0 12px;
  }

  h2:first-child { margin-top: 24px; }
}

.evidence-steps {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 12px;

  li {
    display: flex;
    gap: 12px;
    border: 1px solid #ebeef5;
    border-radius: 6px;
    padding: 14px 16px;
    background: #fff;
  }

  strong {
    display: block;
    font-size: 14px;
    color: #1a1a2e;
    margin-bottom: 4px;
  }

  p {
    margin: 0;
    font-size: 13px;
    line-height: 1.8;
    color: #606266;
  }
}

.step-index {
  flex: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--es-brand-primary, #409eff);
  color: #fff;
  font-size: 12px;
  line-height: 22px;
  text-align: center;
}

.evidence-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.evidence-hint,
.evidence-note {
  font-size: 13px;
  line-height: 1.7;
  color: #909399;
}

.evidence-note {
  max-width: 78ch;
  margin: 8px 0 12px;
}

.evidence-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
  margin-bottom: 12px;

  span {
    padding: 1px 6px;
    border-radius: 3px;
    background: #f5f7fa;
    color: #909399;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
}

.evidence-command {
  margin: 0 0 4px;
  padding: 12px 14px;
  border-radius: 6px;
  background: #f6f8fa;
  color: #606266;
  font-size: 12px;
  line-height: 1.7;
  overflow-x: auto;

  code {
    // 本站全局给 code 定了浅色前景（给深色代码块用的），这里必须显式压回来，
    // 否则复现命令在浅底上几乎看不见
    color: #606266;
    background: transparent;
    font-family: monospace;
    white-space: pre;
  }
}

.evidence-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
}

.evidence-metric {
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 14px 16px;
  background: #fff;
}

.evidence-metric-value {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a2e;
  font-variant-numeric: tabular-nums;
}

.evidence-metric-label {
  margin-top: 2px;
  font-size: 13px;
  font-weight: 500;
  color: #606266;
}

.evidence-metric-basis {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: #909399;
}

.evidence-boundaries {
  margin: 0;
  padding-left: 20px;
  max-width: 88ch;

  li {
    font-size: 14px;
    line-height: 1.8;
    color: #606266;
    margin-bottom: 8px;
  }

  strong {
    display: inline-block;
    margin-right: 6px;
    color: #1a1a2e;

    &::after { content: '：'; }
  }
}

.evidence-terms {
  margin-top: 24px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 12px 16px;

  summary {
    cursor: pointer;
    font-size: 14px;
    color: #1a1a2e;
  }

  dl { margin: 12px 0 0; }

  dt {
    font-size: 13px;
    font-weight: 600;
    color: #1a1a2e;
    font-family: monospace;
  }

  dd {
    margin: 2px 0 10px;
    font-size: 13px;
    line-height: 1.8;
    color: #606266;
  }
}
</style>
