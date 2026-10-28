<template>
  <div class="ai-case-host">
    <header class="ai-case-hero">
      <span class="ai-case-badge">{{ claimLabel }}</span>
      <h1>{{ entry.title }}</h1>
      <p v-if="meta.nl" class="ai-case-nl">「{{ meta.nl }}」</p>
      <div class="ai-case-bar">
        <a-tag v-for="t in entry.tokens" :key="t">{{ t }}</a-tag>
        <span class="ai-case-provenance">
          <template v-if="meta.model">model {{ meta.model }} · </template>
          {{ meta.generatedAt }}<template v-if="meta.attempts"> · {{ meta.attempts }} 次尝试</template> ·
          {{ meta.mode }} 模式
        </span>
        <a-button size="small" @click="schemaVisible = !schemaVisible">
          {{ schemaVisible ? '收起 Schema' : '查看生成的 Schema' }}
        </a-button>
      </div>
      <div v-if="controls.length" class="ai-case-controls">
        <a-switch
          v-for="c in controls"
          :key="c.key"
          v-model:checked="controlsState[c.key]"
          :checked-children="c.label"
          :un-checked-children="c.label"
        />
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

<script setup>
/**
 * 通用宿主 —— 由 manifest 驱动的案例页（Vue3 + Ant Design Vue）。
 *
 * 与主文档站的 `AiCaseHost.vue` **同一份逻辑**，差别只有框架投影（a-* 组件、Modal/message）。
 * 案例的业务规则一律不在这里：请求 / 权限 / 副作用都由 `docs/cases/generated/<id>.mock.js`
 * 按统一契约提供（见该文件头注），所以新增案例不必再写宿主页。
 */
import { computed, onUnmounted, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { EsCrudPage, configureEsPlus } from '@es-plus/adapter-antdv'
import { getGlobalConfig } from '@es-plus/core'
import { AI_CASES } from '@/cases/generated/registry.js'

const props = defineProps({
  caseId: { type: String, required: true },
})

const entry = computed(() => AI_CASES[props.caseId] ?? { schema: {}, meta: {}, mock: {}, tokens: [] })
const meta = computed(() => entry.value.meta ?? {})
const mock = computed(() => entry.value.mock ?? {})

/** mock 可选导出的开关声明：`[{ key, label, default }]`（如「具备审批权限」）。 */
const controls = computed(() => (Array.isArray(mock.value.controls) ? mock.value.controls : []))
const controlsState = reactive({})
for (const c of controls.value) controlsState[c.key] = c.default ?? true
const remountKey = computed(() => JSON.stringify(controlsState))

const permission = () => mock.value.createPermission?.(controlsState) ?? (() => true)

const crudRef = ref(null)
const schemaVisible = ref(false)
const schemaText = computed(() => JSON.stringify(entry.value.schema ?? {}, null, 2))
const mockHttp = computed(() => mock.value.createHttpRequest?.({ delay: 120 }))

/**
 * 权限与请求都是**全局**配置：进页写一次、开关变化同步写、离开必须恢复（否则会泄漏到别的页）。
 *
 * 全局请求这一处不能省：字段级 `apiParams`（远端下拉）由 EsForm 自己去取数，读的是
 * 全局 httpRequest，而不是本页传给 `<es-crud-page>` 的 prop —— 只配组件 prop，
 * legacy-erp-api 的供应商下拉会静默落到站点自带的 demo 请求上。
 */
const prevHttpRequest = getGlobalConfig().httpRequest
function applyGlobalConfig() {
  configureEsPlus({
    permission: permission(),
    ...(mock.value.createHttpRequest ? { httpRequest: (params) => mockHttp.value(params) } : {}),
  })
}
applyGlobalConfig()
watch(controlsState, applyGlobalConfig, { deep: true, flush: 'sync' })
onUnmounted(() => configureEsPlus({ permission: () => true, httpRequest: prevHttpRequest }))

/** 打开弹窗时记下那一行：编辑弹窗的 formItems 里没有 id，副作用要靠它定位。 */
let openedRow
function onDialogOpen(key, row) {
  openedRow = row
}

function notify(text) {
  if (!text) return
  message.success(text)
  crudRef.value?.refresh?.()
}

function onDialogConfirm(key, data) {
  notify(mock.value.handleDialogConfirm?.(key, data, openedRow))
}

function onBtnClick(key, row) {
  // 第三个参数带上当前勾选：批量按钮要作用在选中的行上，而勾选只有表格实例知道。
  const selection = crudRef.value?.getSelectedRows?.() ?? []
  notify(mock.value.handleRowAction?.(key, row ?? openedRow, { selection }))
}

/**
 * 行内编辑（仅 vxe 引擎）：引擎把原生 edit-actived / edit-closed 归一成 `cell-edit`，
 * 载荷带旧值。刻意**不走** notify() —— 它顺手 refresh()，会把当前页重新取回来
 * （mock 没落库），刚编辑的那格当场被打回原值。真实项目在这里接保存接口。
 */
function onCellEdit(payload) {
  const text = mock.value.handleCellEdit?.(payload)
  if (text) message.success(text)
}

const CLAIM_LABEL = { execute: '三端可交互', compile: '产物可编译', measure: '仅被度量' }
const claimLabel = computed(() => CLAIM_LABEL[entry.value.claim] ?? entry.value.claim)
</script>

<style lang="scss" scoped>
.ai-case-hero {
  padding: 16px 0 12px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 16px;

  h1 {
    font-size: 22px;
    margin: 6px 0 8px;
    color: #1f1f1f;
  }
}

.ai-case-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
  color: #fff;
  background: linear-gradient(135deg, var(--es-brand-primary), var(--es-brand-accent));
}

.ai-case-nl {
  margin: 8px 0;
  padding: 8px 12px;
  border-left: 3px solid #1677ff;
  background: #fafafa;
  font-size: 13px;
  line-height: 1.8;
  color: #595959;
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
  color: #8c8c8c;
}

.ai-case-controls {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
  margin: 8px 0;
}

.ai-case-tip {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.8;
  color: #8c8c8c;
}

.ai-case-schema {
  margin-top: 18px;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  padding: 12px 16px;

  summary {
    cursor: pointer;
    font-size: 14px;
    color: #1f1f1f;
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
