<template>
  <div class="flagship-approval">
    <header class="flagship-hero">
      <span class="flagship-badge">旗舰案例</span>
      <h1>合同审批工作台</h1>
      <p class="flagship-intro">
        查询联动、跨页勾选、批量审批、行内权限、审批详情 —— 整页由一份
        <strong>纯 JSON</strong>（{{ schemaSize }} KB、0 个函数）定义。三个站点加载的是
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
  </div>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { EsCrudPage, configureEsPlus } from '@es-plus/vue3'
// 单源：由 scripts/sync-cases.mjs 从 docs/cases/ 分发，禁止手改
import schema from '@/cases/flagship-approval.json'
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
const schemaSize = (new Blob([schemaText]).size / 1024).toFixed(1)
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
</style>
