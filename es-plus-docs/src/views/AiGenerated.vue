<template>
  <div class="ai-generated">
    <header class="ai-hero">
      <span class="ai-badge">AI 生成 · 未经手工修改</span>
      <h1>一句话 → 采购申请审批页</h1>
      <p class="ai-intro">
        下面整页来自一句中文需求，由 <code>es-plus create --ai</code> 生成一份
        <strong>纯 JSON</strong> 的 CrudPageSchema（{{ schemaSize }} KB、0 个函数）。
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
  </div>
</template>

<script setup>
import { onUnmounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { EsCrudPage, configureEsPlus } from '@es-plus/vue3'
// 单源：由 scripts/sync-cases.mjs 从 docs/cases/generated/ 分发，禁止手改
import schema from '@/cases/generated/purchase-approval.json'
import meta from '@/cases/generated/purchase-approval.meta.json'
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
const schemaSize = (new Blob([schemaText]).size / 1024).toFixed(1)

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
  background: var(--bg-color-page, #f5f7fa);
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
</style>
