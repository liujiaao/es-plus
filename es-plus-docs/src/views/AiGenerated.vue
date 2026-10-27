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
        <el-switch v-model="withAudit" active-text="具备审批权限 approval:audit" />
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
          <template v-for="item in story.terms" :key="item.term">
            <dt>{{ item.term }}</dt>
            <dd>{{ item.meaning }}</dd>
          </template>
        </dl>
      </details>
    </section>
  </div>
</template>

<script setup>
import { onUnmounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { EsCrudPage, configureEsPlus } from '@es-plus/vue3'
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

const withAudit = ref(true)
const crudRef = ref(null)
const schemaVisible = ref(false)

const schemaText = JSON.stringify(schema, null, 2)
// 产物体积印 story 里的数字（对着文件重算过），不现算 stringify 后的长度 ——
// 两者会打架：文件 7.8 KB，重新排版后 11 KB（旗舰页同样的坑）
const productKb = (story.product.bytes / 1024).toFixed(1)
const countLabel = { formItems: '个查询项', columns: '列', dialogs: '个弹窗', buttons: '个按钮', reactions: '条联动' }
const commandCopied = ref(false)

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // 非安全上下文（http 直连 IP / 老浏览器）没有 clipboard：退回到选中文本，让用户自己复制
    const area = document.createElement('textarea')
    area.value = text
    document.body.appendChild(area)
    area.select()
    document.execCommand('copy')
    area.remove()
  }
}

async function copyCommand() {
  await copyText(story.repro.command)
  commandCopied.value = true
  setTimeout(() => { commandCopied.value = false }, 2000)
}

function downloadSchema() {
  const blob = new Blob([schemaText], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'purchase-approval.json'
  link.click()
  URL.revokeObjectURL(url)
}

const mockHttp = createHttpRequest()

/**
 * 权限是宿主注入的（schema 里只有权限码）：开关切换 → 改全局权限 → 重挂载 CRUD 子树。
 * 与旗舰页同一套顺序约束：列/按钮的 permissionValue 在组件创建期过滤，所以必须
 * 「先换权限、后建实例」（flush:'sync' 的 watcher 保证 :key 重建时读到新权限）。
 */
configureEsPlus({ permission: createPermission(withAudit.value) })
watch(withAudit, (next) => configureEsPlus({ permission: createPermission(next) }), { flush: 'sync' })

/**
 * 权限是**全局**配置：离开本页必须恢复成「全放行」，否则关着审批开关离开时，
 * `approval:audit` 的拒绝会泄漏到之后访问的每个页面（旗舰页有同样的 onUnmounted）。
 */
onUnmounted(() => configureEsPlus({ permission: () => true }))

function refresh(message) {
  crudRef.value?.refresh?.()
  ElMessage.success(message)
}

async function handleBtnClick(key, row) {
  // 生成的按钮没有 key —— 运行时以按钮名作为事件标识（见 crud-page 的 key 兜底）
  if (key === '通过') {
    refresh(approveRequest(row.id) ? `已通过：${row.applyNo}` : `跳过（${row.status}）：${row.applyNo}`)
    return
  }
  if (key === '驳回') {
    try {
      await ElMessageBox.confirm(`确定驳回 ${row.applyNo}？`, '驳回采购申请', {
        type: 'warning',
        confirmButtonText: '驳回',
        cancelButtonText: '取消',
      })
    } catch {
      return
    }
    refresh(rejectRequest(row.id, '审批人驳回') ? `已驳回：${row.applyNo}` : `跳过（${row.status}）：${row.applyNo}`)
  }
}

function handleDialogConfirm(key, data) {
  if (key !== 'add') return
  const row = createRequest(data)
  refresh(`已新增：${row.applyNo}`)
}
// 逐页 title / description：单一来源在 utils/page-meta.ts（check:page-meta 静态核对）。
// 放在脚本末尾不影响求值 —— ESM 的 import 声明会被提升，这样文件级注释与 import 分组都不被打断。
import { usePageMeta } from '@/utils/page-meta'

usePageMeta('ai-generated')
</script>

<style lang="scss" scoped>
.ai-generated {
  max-width: 1400px;
  margin: 0 auto;
  padding: 8px clamp(12px, 3vw, 32px) 48px;
}

.ai-hero {
  padding: 24px 0 16px;
  border-bottom: 1px solid var(--border-color-lighter);
  margin-bottom: 16px;

  h1 {
    font-size: 26px;
    margin: 8px 0 10px;
    color: var(--text-color-primary);
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
  color: var(--text-color-regular);
  line-height: 1.8;
  max-width: 960px;
}

.ai-nl {
  margin: 12px 0;
  padding: 10px 14px;
  border-left: 3px solid var(--primary-color);
  background: var(--bg-color-page, var(--es-fill));
  color: var(--text-color-primary);
  line-height: 1.8;
  font-size: 13px;
}

.ai-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin: 12px 0 8px;
}

.ai-provenance {
  font-size: 12px;
  font-family: var(--code-font-family, monospace);
  color: var(--text-color-secondary);
}

.ai-tip {
  font-size: 13px;
  color: var(--text-color-secondary);
  line-height: 1.9;
  margin: 0;
}

.ai-schema {
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

/* T5 证据段：方法 → 产物 → 实测数据 → 边界 → 术语（折叠）。
   与旗舰案例（T4）同名同构，只换前缀，保证两页读起来是一套模板。 */
.ai-section-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-color-primary);
  margin: 8px 0 12px;
}

.ai-evidence {
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

.evidence-steps {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 12px;

  li {
    display: flex;
    gap: 12px;
    border: 1px solid var(--border-color-lighter);
    border-radius: 6px;
    padding: 14px 16px;
    background: var(--bg-color);
  }

  strong {
    display: block;
    font-size: 14px;
    color: var(--text-color-primary);
    margin-bottom: 4px;
  }

  p {
    margin: 0;
    font-size: 13px;
    line-height: 1.8;
    color: var(--text-color-regular);
  }
}

.step-index {
  flex: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--es-brand-primary);
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
  color: var(--text-color-secondary);
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
    background: var(--fill-color);
    color: var(--text-color-secondary);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
}

.evidence-command {
  margin: 0 0 4px;
  padding: 12px 14px;
  border-radius: 6px;
  background: var(--code-bg-color);
  color: var(--text-color-regular);
  font-size: 12px;
  line-height: 1.7;
  overflow-x: auto;

  code {
    font-family: var(--code-font-family, monospace);
    white-space: pre;
  }
}

.evidence-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
}

.evidence-metric {
  border: 1px solid var(--border-color-lighter);
  border-radius: 6px;
  padding: 14px 16px;
  background: var(--bg-color);
}

.evidence-metric-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-color-primary);
  font-variant-numeric: tabular-nums;
}

.evidence-metric-label {
  margin-top: 2px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-color-regular);
}

.evidence-metric-basis {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-color-secondary);
}

.evidence-boundaries {
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

.evidence-terms {
  margin-top: 24px;
  border: 1px solid var(--border-color-lighter);
  border-radius: 6px;
  padding: 12px 16px;

  summary {
    cursor: pointer;
    font-size: 14px;
    color: var(--text-color-primary);
  }

  dl { margin: 12px 0 0; }

  dt {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-color-primary);
    font-family: var(--code-font-family, monospace);
  }

  dd {
    margin: 2px 0 10px;
    font-size: 13px;
    line-height: 1.8;
    color: var(--text-color-regular);
  }
}
</style>
