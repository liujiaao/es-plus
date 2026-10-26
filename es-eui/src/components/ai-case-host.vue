<template>
  <div class="ai-case-host">
    <header class="ai-case-hero">
      <span class="ai-case-badge">{{ claimLabel }}</span>
      <h1>{{ entry.title }}</h1>
      <p v-if="meta.nl" class="ai-case-nl">「{{ meta.nl }}」</p>
      <div class="ai-case-bar">
        <el-tag v-for="t in entry.tokens" :key="t" size="small" type="info">{{ t }}</el-tag>
        <span class="ai-case-provenance">
          <span v-if="meta.model">model {{ meta.model }} · </span>
          {{ meta.generatedAt }}<span v-if="meta.attempts"> · {{ meta.attempts }} 次尝试</span> ·
          {{ meta.mode }} 模式
        </span>
        <el-button size="small" @click="schemaVisible = !schemaVisible">
          {{ schemaVisible ? '收起 Schema' : '查看生成的 Schema' }}
        </el-button>
      </div>
      <div v-if="controls.length" class="ai-case-controls">
        <span v-for="c in controls" :key="c.key" class="ai-case-control">
          <el-switch v-model="controlsState[c.key]" />
          <span class="ai-case-control-label">{{ c.label }}</span>
        </span>
      </div>
      <p v-if="meta.tip" class="ai-case-tip">{{ meta.tip }}</p>
    </header>

    <!-- :key 让开关变化时重建 CRUD 子树：列/按钮的 permissionValue 在创建期过滤，
         权限必须先换、实例后建（与另两站同一套时序约束）。 -->
    <es-crud-page
      :key="remountKey"
      ref="crudRef"
      :schema="entry.schema"
      :http-request="mockHttp"
      @btn-click="onBtnClick"
      @cell-edit="onCellEdit"
      @dialog-open="onDialogOpen"
      @dialog-confirm="onDialogConfirm"
    />

    <details v-if="schemaVisible" open class="ai-case-schema">
      <summary>本站点加载的 CrudPageSchema（纯 JSON，0 个函数）</summary>
      <pre>{{ schemaText }}</pre>
    </details>
  </div>
</template>

<script>
/**
 * 通用宿主 —— 由 manifest 驱动的案例页（Vue 2 + Element UI）。
 *
 * 与另两站的 `AiCaseHost.vue` **同一份逻辑**，两处框架差异 + 一处本站历史包袱：
 *   1. Options API（Vue 2.6 无 `<script setup>`）；
 *   2. 消息用 element-ui 的 Message；
 *   3. 本站 main.js 注册了全局响应映射（`configQueryfieldOutput` → data/total/pageIndex），
 *      对每张表都生效。故宿主把 mock 的标准响应（rows/records/pageNo）转成本站口径 ——
 *      这正是「schema 描述页面、宿主适配后端」的边界：产物不用改一个字。
 *
 * 案例的业务规则一律不在这里：请求 / 权限 / 副作用都由 `docs/cases/generated/<id>.mock.js`
 * 按统一契约提供（见该文件头注）。
 */
import { EsCrudPage, configureEsPlus } from '@es-plus/vue2'
import { getGlobalConfig } from '@es-plus/core'
import { Message } from 'element-ui'
import { AI_CASES } from '@/cases/generated/registry.js'

const EMPTY = { schema: {}, meta: {}, mock: {}, tokens: [], claim: '' }

/** 标准响应（rows/records/pageNo）→ 本站后端约定（data/total/pageIndex/pageSize）。 */
function toSiteResponse(res) {
  return { data: res.rows, total: res.records, pageIndex: res.pageNo, pageSize: res.pageSize }
}

export default {
  name: 'AiCaseHost',
  components: { EsCrudPage },
  props: {
    caseId: { type: String, required: true },
  },
  data() {
    const entry = AI_CASES[this.caseId] || EMPTY
    const mock = entry.mock || {}
    // 所有键在创建时就写进 data()（Vue2 对后加的键不响应 —— 见 memory「vue2 reactive post-hoc keys」）。
    const controlsState = {}
    for (const c of Array.isArray(mock.controls) ? mock.controls : []) controlsState[c.key] = c.default !== false
    const request = mock.createHttpRequest ? mock.createHttpRequest({ delay: 120 }) : undefined
    // 只有**案例自己没声明** configTableOut 时才套本站口径：案例一旦显式声明了响应映射
    // （如 legacy-erp-api 的 { tableData:'list', total:'totalCount' }），后端信封就是它说了算 ——
    // 宿主再改一遍会把 list/count 换成 rows/records，配置里的映射就永远读不到。
    const usesSiteEnvelope = !(entry.schema && entry.schema.tableOptions && entry.schema.tableOptions.configTableOut)
    return {
      entry,
      controlsState,
      mockHttp: request
        ? (params) => request(params).then(usesSiteEnvelope ? toSiteResponse : (res) => res)
        : undefined,
      schemaVisible: false,
      openedRow: undefined,
    }
  },
  computed: {
    meta() {
      return this.entry.meta || {}
    },
    controls() {
      return Array.isArray(this.entry.mock && this.entry.mock.controls) ? this.entry.mock.controls : []
    },
    remountKey() {
      return JSON.stringify(this.controlsState)
    },
    schemaText() {
      return JSON.stringify(this.entry.schema || {}, null, 2)
    },
    claimLabel() {
      return { execute: '三端可交互', compile: '产物可编译', measure: '仅被度量' }[this.entry.claim] || this.entry.claim
    },
  },
  watch: {
    // 权限是宿主注入的：开关切换 → 先换全局权限 → 由 :key 重挂载（Vue2 用户 watcher 早于
    // 渲染 watcher，新实例一定读到新权限）。
    controlsState: {
      deep: true,
      handler() {
        this.applyGlobalConfig()
      },
    },
  },
  created() {
    // 站点在 main.js 里配过全局 httpRequest —— 先记下它，离开时必须还回去
    this.prevHttpRequest = getGlobalConfig().httpRequest
    this.applyGlobalConfig()
  },
  beforeDestroy() {
    // 离开页面恢复全局权限与请求，避免泄漏给其它示例
    configureEsPlus({ permission: () => true, httpRequest: this.prevHttpRequest })
  },
  methods: {
    /**
     * 权限与请求都是**全局**配置。
     *
     * 全局请求这一处不能省：字段级 `apiParams`（远端下拉）由 EsForm 自己取数，
     * 读的是全局 httpRequest，而不是本页传给 `<es-crud-page>` 的 prop —— 只配组件
     * prop，案例里的远端下拉会落到站点自带的 demo 请求上（拿回无关数据）。
     */
    applyGlobalConfig() {
      const mock = this.entry.mock || {}
      configureEsPlus({
        permission: this.permission(),
        ...(mock.createHttpRequest && this.mockHttp ? { httpRequest: this.mockHttp } : {}),
      })
    },
    permission() {
      const create = this.entry.mock && this.entry.mock.createPermission
      return create ? create(this.controlsState) : () => true
    },
    onDialogOpen(key, row) {
      // 编辑弹窗的 formItems 里没有 id，副作用要靠「打开时那一行」定位
      this.openedRow = row
    },
    notify(text) {
      if (!text) return
      this.$refs.crudRef && this.$refs.crudRef.refresh && this.$refs.crudRef.refresh()
      Message.success(text)
    },
    onDialogConfirm(key, data) {
      const handle = this.entry.mock && this.entry.mock.handleDialogConfirm
      this.notify(handle ? handle(key, data, this.openedRow) : null)
    },
    onBtnClick(key, row) {
      const handle = this.entry.mock && this.entry.mock.handleRowAction
      // 第三个参数带上当前勾选（跨页保留）：批量按钮要作用在选中的行上。
      const api = this.$refs.crudRef
      const selection = (api && api.getSelectedRows && api.getSelectedRows()) || []
      this.notify(handle ? handle(key, row || this.openedRow, { selection }) : null)
    },
    // 行内编辑（仅 vxe 引擎）：引擎把原生 edit-actived / edit-closed 归一成
    // `cell-edit`（带旧值）。刻意**不走** notify() —— 它顺手 refresh()，会把当前页
    // 重新取回来（mock 没落库），刚编辑的那格当场被打回原值。真实项目在这里接保存接口。
    onCellEdit(payload) {
      const handle = this.entry.mock && this.entry.mock.handleCellEdit
      const text = handle ? handle(payload) : null
      if (text) Message.success(text)
    },
  },
}
</script>

<style lang="scss" scoped>
.ai-case-hero {
  padding: 16px 0 12px;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 16px;

  h1 {
    font-size: 22px;
    margin: 6px 0 8px;
    color: #1a1a2e;
  }
}

.ai-case-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
  color: #fff;
  background: linear-gradient(135deg, #6f42c1, #a855f7);
}

.ai-case-nl {
  margin: 8px 0;
  padding: 8px 12px;
  border-left: 3px solid var(--es-brand-primary, #409eff);
  background: #fafafa;
  font-size: 13px;
  line-height: 1.8;
  color: #606266;
}

.ai-case-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin: 10px 0 6px;
}

.ai-case-provenance {
  font-size: 12px;
  font-family: monospace;
  color: #909399;
}

.ai-case-controls {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
  margin: 8px 0;
}

.ai-case-control {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #606266;
}

.ai-case-tip {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.8;
  color: #909399;
}

.ai-case-schema {
  margin-top: 18px;
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
    max-height: 460px;
    overflow: auto;
    font-size: 12px;
    line-height: 1.6;
  }
}
</style>
