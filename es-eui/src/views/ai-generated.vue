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
      schemaVisible: false,
      schemaText,
      schemaSize: (new Blob([schemaText]).size / 1024).toFixed(1),
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
</style>
