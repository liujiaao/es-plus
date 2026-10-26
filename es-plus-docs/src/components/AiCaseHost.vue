<template>
  <div class="ai-case-host">
    <header class="ai-case-hero">
      <span class="ai-case-badge">{{ claimLabel }}</span>
      <h1>{{ entry.title }}</h1>
      <p v-if="meta.nl" class="ai-case-nl">「{{ meta.nl }}」</p>
      <div class="ai-case-bar">
        <el-tag v-for="t in entry.tokens" :key="t" size="small" effect="plain">{{ t }}</el-tag>
        <span class="ai-case-provenance">
          <template v-if="meta.model">model {{ meta.model }} · </template>
          {{ meta.generatedAt }}<template v-if="meta.attempts"> · {{ meta.attempts }} 次尝试</template> ·
          {{ meta.mode }} 模式
        </span>
        <el-button size="small" @click="schemaVisible = !schemaVisible">
          {{ schemaVisible ? '收起 Schema' : '查看生成的 Schema' }}
        </el-button>
      </div>
      <div v-if="controls.length" class="ai-case-controls">
        <el-switch
          v-for="c in controls"
          :key="c.key"
          v-model="controlsState[c.key]"
          :active-text="c.label"
        />
      </div>
      <p v-if="meta.tip" class="ai-case-tip">{{ meta.tip }}</p>
    </header>

    <!-- :key 让开关变化时重建 CRUD 子树：列/按钮的 permissionValue 在创建期过滤，
         权限必须先换、实例后建（与旗舰页同一套时序约束）。 -->
    <es-crud-page
      :key="remountKey"
      ref="crudRef"
      :schema="entry.schema"
      :http-request="mockHttp"
      @btn-click="onBtnClick"
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
 * 通用宿主 —— 由 manifest 驱动的案例页（Vue3 + Element Plus）。
 *
 * 设计边界：**本文件不含任何案例的业务规则**。它只做三件事，三件事都由案例自己的 mock
 * 提供（`docs/cases/generated/<id>.mock.js` 的统一契约）：
 *   1. 请求：`createHttpRequest({delay})` → 组件 prop；
 *   2. 权限：`createPermission(controlsState)` → 全局配置；
 *   3. 副作用：`handleDialogConfirm(key, data, row)` / `handleRowAction(key, row)` → 提示文案。
 *
 * 于是新增一个案例只需要：manifest 加一条 + 产物落盘 + sync —— 不必再写宿主页。
 * 另两端（es-pc / es-eui）是同一份逻辑的框架投影，不是第二套逻辑。
 */
import { computed, onUnmounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { EsCrudPage, configureEsPlus } from '@es-plus/vue3'
import { getGlobalConfig } from '@es-plus/core'
import { AI_CASES } from '@/cases/generated/registry.js'

const props = defineProps({
  caseId: { type: String, required: true },
})

// 未知 id 兜底成空案例（画廊详情页会先判存在并给出「案例不存在」提示，不会走到这里）。
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
const schemaText = computed(() => JSON.stringify(entry.value?.schema ?? {}, null, 2))
const mockHttp = computed(() => mock.value.createHttpRequest?.({ delay: 120 }))

/**
 * 权限与请求都是**全局**配置：进页写一次、开关变化同步写、离开必须恢复
 * （否则会泄漏到别的页）。
 *
 * 全局请求这一处不能省：字段级 `apiParams`（远端下拉）由 EsForm 自己去取数，
 * 它读的是全局 httpRequest，而不是本页传给 `<es-crud-page>` 的 prop ——
 * 只配组件 prop，legacy-erp-api 这类案例的供应商下拉会静默落到站点自带的
 * demo 请求上（拿回无关数据）。离开时恢复站点原来那个函数。
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

function notify(message) {
  if (!message) return
  ElMessage.success(message)
  crudRef.value?.refresh?.()
}

function onDialogConfirm(key, data) {
  notify(mock.value.handleDialogConfirm?.(key, data, openedRow))
}

/**
 * 行/工具栏按钮。第三个参数带上**当前勾选**：批量按钮（如「批量通过」）要作用在选中的行上，
 * 而勾选状态只有表格实例知道 —— `<es-crud-page>` 暴露了 getSelectedRows()（跨页保留），
 * 宿主把它转交给 mock，mock 仍是纯数据操作。
 */
function onBtnClick(key, row) {
  const selection = crudRef.value?.getSelectedRows?.() ?? []
  notify(mock.value.handleRowAction?.(key, row ?? openedRow, { selection }))
}

const CLAIM_LABEL = { execute: '三端可交互', compile: '产物可编译', measure: '仅被度量' }
const claimLabel = computed(() => CLAIM_LABEL[entry.value.claim] ?? entry.value.claim)
</script>

<style lang="scss" scoped>
.ai-case-hero {
  padding: 16px 0 12px;
  border-bottom: 1px solid var(--border-color-lighter);
  margin-bottom: 16px;

  h1 {
    font-size: 22px;
    margin: 6px 0 8px;
    color: var(--text-color-primary);
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
  border-left: 3px solid var(--primary-color);
  background: var(--bg-color-page, #f5f7fa);
  font-size: 13px;
  line-height: 1.8;
  color: var(--text-color-regular);
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
  font-family: var(--code-font-family, monospace);
  color: var(--text-color-secondary);
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
  color: var(--text-color-secondary);
}

.ai-case-schema {
  margin-top: 18px;
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
    max-height: 460px;
    overflow: auto;
    font-size: 12px;
    line-height: 1.6;
  }
}
</style>
