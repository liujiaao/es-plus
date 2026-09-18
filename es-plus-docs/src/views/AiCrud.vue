<template>
  <div class="ai-crud-page">
    <div class="ai-crud-header">
      <h1 class="ai-crud-title">{{ t('aiCrud.title') }}</h1>
      <p class="ai-crud-banner">{{ t('aiCrud.banner') }}</p>
      <!--
        这条提示只在**真的会用 AI 路径**时才出现（已填 Key 且 base 仍指向 dev 代理）。
        此前是「只要 base 是 /openai 就显示」，而那是默认值 —— 于是每个访客首屏第一眼
        看到的都是「生产环境需自备 CORS 网关」。没填 Key 的人走的是本地规则引擎，
        与这条提示毫不相干，不该被它挡住；设置弹窗里的说明已经覆盖了他们。
      -->
      <el-alert
        v-if="isDevProxyBase && useAI"
        class="ai-crud-proxy-notice"
        type="warning"
        :closable="false"
        show-icon
      >
        <template #title>{{ t('aiCrud.proxyNotice') }}</template>
      </el-alert>
      <div class="ai-crud-toolbar">
        <el-tag :type="useAI ? 'success' : 'info'" class="engine-tag">
          {{ useAI ? t('aiCrud.engineAi') : t('aiCrud.engineRule') }}
        </el-tag>
        <!-- 渲染端选择：es-plus 的头号卖点是「同一份配置 → 三端」，不带这个开关的
             生成器演示只能说明「自然语言 → 一个 Vue 3 页面」。选择会同时作用于
             离线（generateCrudSchema 的 target 参数）与 AI（覆盖 config.target）两条路径。 -->
        <div class="target-picker">
          <span class="target-label">{{ t('aiCrud.targetLabel') }}</span>
          <el-radio-group v-model="target" size="small">
            <el-radio-button
              v-for="opt in TARGETS"
              :key="opt.value"
              :value="opt.value"
            >{{ opt.label }}</el-radio-button>
          </el-radio-group>
        </div>
        <el-button @click="showSettings = true" :icon="Setting">{{ t('aiCrud.settings') }}</el-button>
      </div>
    </div>

    <div class="ai-crud-content">
      <!-- Left: chat + preset picker -->
      <div class="ai-crud-chat-pane">
        <ChatComposer
          :messages="messages"
          :loading="loading"
          :presets="PRESETS"
          @send="handleSend"
          @select-preset="handlePreset"
          @reset="handleReset"
          @abort="handleAbort"
          @highlight-traces="handleHighlight"
        />
      </div>

      <!-- Right: tabs (trace default) -->
      <div class="ai-crud-output-pane">
        <el-tabs v-model="activeTab" class="output-tabs">
          <el-tab-pane :label="t('aiCrud.tabTrace')" name="trace">
            <TraceTab :traces="traces" :highlighted-ids="highlightedIds" />
          </el-tab-pane>

          <el-tab-pane :label="t('aiCrud.tabPreview')" name="preview">
            <div class="preview-area" v-if="formItems.length > 0">
              <!-- Surface features the prompt asked for that preview can't render
                   (multi-tab dialog, multi-step form, etc.). Without this the
                   user sees a plain table and thinks the generator dropped
                   the feature on the floor. -->
              <el-alert
                v-if="featureHints.length > 0"
                type="warning"
                :closable="false"
                show-icon
                class="feature-hints"
              >
                <template #title>
                  <strong>已识别的高级特性（preview 仅渲染基础表单/表格部分，完整代码在「生成代码」tab）</strong>
                </template>
                <ul class="feature-hints-list">
                  <li v-for="(h, idx) in featureHints" :key="idx">{{ h }}</li>
                </ul>
              </el-alert>
              <es-table
                :columns="previewColumns"
                :options="previewOptions"
                :data-source="mockData"
              >
                <es-form
                  :model="previewModel"
                  :form-item-list="formItems"
                  :config-btn="previewBtns"
                />
              </es-table>
            </div>
            <div v-else class="empty-state">
              <el-empty :description="t('aiCrud.emptyPreview')" />
            </div>
          </el-tab-pane>

          <el-tab-pane :label="t('aiCrud.tabCode')" name="code">
            <div class="code-area" v-if="generatedCode">
              <!-- 把本次实际使用的渲染端与对应包名摆在代码上方：这是「同一份配置 → 三端」
                   最直接的证据 —— 切一次渲染端，这里的 import 包名就会变。 -->
              <div class="code-meta">
                <span class="code-target">
                  {{ t('aiCrud.codeTarget') }}
                  <el-tag size="small" type="primary">{{ generatedTarget }}</el-tag>
                </span>
                <code class="code-pkg">{{ generatedPkg }}</code>
              </div>
              <pre class="code-block"><code>{{ generatedCode }}</code></pre>
            </div>
            <div v-else class="empty-state">
              <el-empty :description="t('aiCrud.emptyCode')" />
            </div>
          </el-tab-pane>

          <el-tab-pane :label="t('aiCrud.tabJson')" name="json">
            <div class="code-area" v-if="generatedConfig">
              <pre class="code-block"><code>{{ JSON.stringify(generatedConfig, null, 2) }}</code></pre>
            </div>
            <div v-else class="empty-state">
              <el-empty :description="t('aiCrud.emptyJson')" />
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>

    <!-- AI Settings Dialog (unchanged) -->
    <el-dialog v-model="showSettings" :title="t('aiCrud.settings')" width="500px">
      <el-form label-position="top">
        <el-alert
          type="info"
          :closable="false"
          show-icon
          style="margin-bottom: 16px"
        >
          {{ t('aiCrud.settingsAlert') }}
        </el-alert>
        <el-form-item label="API Key">
          <el-input v-model="aiConfig.apiKey" placeholder="sk-..." show-password />
        </el-form-item>
        <el-form-item label="Base URL">
          <el-input v-model="aiConfig.baseUrl" placeholder="/openai/v1 或 https://your-gateway.example.com/v1" />
        </el-form-item>
        <el-form-item label="Model">
          <el-input v-model="aiConfig.model" placeholder="gpt-4o-mini" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSettings = false">{{ t('aiCrud.cancel') }}</el-button>
        <el-button type="primary" @click="saveSettings">{{ t('aiCrud.save') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="tsx">
import { ref, reactive, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Setting } from '@element-plus/icons-vue'
import { EsForm, EsTable } from 'es-plus'
import { mcpFlow, type ChatMessage, type TraceEntry } from '@/utils/mcp-flow'
// 渲染端选项与称呼来自三站清单（与顶栏切换器、案例卡互链同一份）
import { SITES } from '@/utils/sites'
import type { StructuredCrudConfig, TargetFramework } from '@es-plus/shared'
import { PRESETS, type Preset } from '@/utils/preset-examples'
import ChatComposer from '@/components/ai-crud/ChatComposer.vue'
import TraceTab from '@/components/ai-crud/TraceTab.vue'

const { t, locale } = useI18n()

// ─── chat / trace state ──────────────────────────────────────────────────
const messages = ref<ChatMessage[]>([])
const traces = ref<TraceEntry[]>([])
const highlightedIds = ref<string[]>([])
const loading = ref(false)
const activeTab = ref<'trace' | 'preview' | 'code' | 'json'>('trace')

// Last AI-mode StructuredCrudConfig — only set when AI path succeeded; used to
// seed next-turn AI context. Offline path leaves this null (offline runs are
// stateless because there's no model to leverage prior context anyway).
const currentStructuredConfig = ref<StructuredCrudConfig | null>(null)

let abortController: AbortController | null = null

// ─── derived display state (drives the 3 right-side tabs) ─────────────────
const formItems = ref<any[]>([])
const previewColumns = ref<any[]>([])
const previewBtns = ref<any[]>([])
const generatedCode = ref('')
const generatedConfig = ref<unknown>(null)
const previewModel = reactive<Record<string, any>>({})
const mockData = ref<any[]>([])
// Features the prompt requested but preview can't fully render — shown as
// an inline alert above the table so users know they exist.
const featureHints = ref<string[]>([])

const previewOptions = computed(() => ({
  border: true,
  size: 'small' as const,
  headerCellStyle: { background: '#f5f7fa' },
}))

// ─── AI config ──────────────────────────────────────────────────────────
const aiConfig = reactive({
  apiKey: '',
  // 默认走 vite dev server 的同源代理（见 vite.config.ts server.proxy）：
  // /openai/v1 → https://api.openai.com/v1。浏览器直连 OpenAI 会被 CORS 拦截。
  // 用户可在设置里改成任意自建 endpoint（如自建网关 / 兼容 OpenAI 的国内服务）。
  baseUrl: '/openai/v1',
  model: 'gpt-4o-mini',
})
const useAI = computed(() => !!aiConfig.apiKey)

/**
 * 目标渲染端。三端是 es-plus 的头号卖点，所以它是**用户可选**的，而不是让模型猜。
 * 三条链路都会用到它：
 *  - 离线：generateCrudSchema(description, target) —— 与 MCP/CLI 同一个函数；
 *  - AI：校验通过后覆盖 config.target（generateFromConfig 从 config 读它）；
 *  - 提示词：把选择写进 system prompt 的上下文，减少模型自作主张。
 *
 * 选项直接来自三站清单（`SITES.short`），不在这里再写一遍渲染端名字 ——
 * 顶栏切换器、案例卡互链、本页选择器用的应当是同一组称呼。
 */
const TARGETS = SITES.map((s) => ({ value: s.key, label: s.short }))
const target = ref<'vue3' | 'vue2' | 'antdv'>('vue3')

/** 本次生成实际使用的渲染端（来自 FlowResult.target，不由界面假设 —— 便于发现不一致） */
const generatedTarget = ref<TargetFramework>('vue3')
/** 该渲染端对应的包名，摆在生成代码上方作为「三端」的直接证据 */
const PACKAGE_OF: Record<TargetFramework, string> = {
  vue3: '@es-plus/vue3 + element-plus',
  vue2: '@es-plus/vue2 + element-ui',
  antdv: '@es-plus/adapter-antdv + ant-design-vue',
}
const generatedPkg = computed(() => PACKAGE_OF[generatedTarget.value])
// 当前是否在使用开发态同源代理路径（生产无此代理，需用户自备网关）。
const isDevProxyBase = computed(() => aiConfig.baseUrl.startsWith('/openai'))
const showSettings = ref(false)

// ─── handlers ──────────────────────────────────────────────────────────
const handleSend = async (text: string) => {
  if (loading.value) return

  // push user message + clear stale highlights
  const userMsg: ChatMessage = {
    id: `u-${Date.now()}`,
    ts: Date.now(),
    role: 'user',
    content: text,
  }
  messages.value.push(userMsg)
  highlightedIds.value = []
  loading.value = true
  abortController = new AbortController()

  try {
    const result = await mcpFlow(text, messages.value.slice(0, -1), {
      ai: aiConfig.apiKey ? { ...aiConfig } : undefined,
      onTrace: (entry) => traces.value.push(entry),
      signal: abortController.signal,
      currentConfig: currentStructuredConfig.value ?? undefined,
      target: target.value,
    })

    // Commit assistant message + uniform preview state from FlowResult.
    messages.value.push(result.message)
    if (result.structuredConfig) currentStructuredConfig.value = result.structuredConfig
    generatedTarget.value = result.target
    generatedCode.value = result.code
    generatedConfig.value = result.jsonView
    formItems.value = result.formItems as any[]
    previewColumns.value = result.columns as any[]
    previewBtns.value = (result.toolbarBtns as any[]).map((b) => ({ ...b, triggerEvent: false }))
    featureHints.value = result.featureHints ?? []
    // Reset preview model + regenerate mock data on every turn.
    for (const k of Object.keys(previewModel)) delete previewModel[k]
    formItems.value.forEach((it: any) => {
      previewModel[it.prop] = ''
    })
    mockData.value = generateMockData(previewColumns.value)
  } catch (err) {
    const isAbort = err instanceof Error && (err.name === 'AbortError' || err.message === 'aborted')
    if (!isAbort) {
      ElMessage.error(err instanceof Error ? err.message : String(err))
    }
  } finally {
    loading.value = false
    abortController = null
  }
}

const handlePreset = (preset: Preset) => {
  const text = locale.value === 'en-US' ? preset.prompt.en : preset.prompt.zh
  handleSend(text)
}

const handleReset = () => {
  messages.value = []
  traces.value = []
  highlightedIds.value = []
  currentStructuredConfig.value = null
  generatedCode.value = ''
  generatedConfig.value = null
  formItems.value = []
  previewColumns.value = []
  previewBtns.value = []
  mockData.value = []
  featureHints.value = []
  for (const k of Object.keys(previewModel)) delete previewModel[k]
}

const handleAbort = () => {
  abortController?.abort()
}

const handleHighlight = (ids: string[]) => {
  highlightedIds.value = ids
  // Switch to trace tab so highlight is visible
  activeTab.value = 'trace'
}

const saveSettings = () => {
  showSettings.value = false
  ElMessage.success(useAI.value ? t('aiCrud.settingsSavedAi') : t('aiCrud.settingsSavedRule'))
}

// Mock data for the live preview — adapts column types from prop/label hints.
const generateMockData = (cols: any[]): any[] => {
  const rows: any[] = []
  for (let i = 1; i <= 5; i++) {
    const row: Record<string, any> = { id: i }
    cols.forEach((col) => {
      if (/status|状态/.test(col.prop || '')) row[col.prop] = i % 2 === 0 ? 1 : 0
      else if (/time|Time|date|Date|时间|日期/.test(col.prop || col.label || ''))
        row[col.prop] = `2024-0${i}-1${i}`
      else if (/amount|price|金额|价格/.test(col.prop || col.label || ''))
        row[col.prop] = (Math.random() * 1000).toFixed(2)
      else if (/age|年龄/.test(col.prop || col.label || ''))
        row[col.prop] = 20 + i * 3
      else row[col.prop] = `${col.label || col.prop}_${i}`
    })
    rows.push(row)
  }
  return rows
}

// Whenever a new assistant message arrives, jump the tab focus to Preview the
// FIRST time we have content; afterwards leave the user on whichever tab they
// chose.
let firstResultShown = false
watch(
  () => messages.value.length,
  () => {
    if (!firstResultShown && generatedCode.value) {
      firstResultShown = true
      activeTab.value = 'trace'
    }
  },
)

</script>

<style lang="scss" scoped>
.ai-crud-page {
  padding: 24px;
  max-width: 1600px;
  margin: 80px auto;
}

.ai-crud-header {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color-lighter);
}

.ai-crud-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-color-primary);
  margin-bottom: 8px;
  /* 品牌主色 → 强调色。此前这里是并入前旧产品的紫色渐变（#667eea → #764ba2），
     是全站品牌色改造的最后一处漏网 —— 与首页 hero、顶栏标记都不是一套。 */
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--brand-accent) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.ai-crud-banner {
  font-size: 13px;
  color: var(--text-color-secondary);
  line-height: 1.6;
  margin-bottom: 12px;
  max-width: 900px;
}

.ai-crud-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.engine-tag {
  font-size: 12px;
}

/* 渲染端选择器：紧挨着引擎标签，让「三端」和「引擎」一样是首屏可见的控制项 */
.target-picker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.target-label {
  font-size: 13px;
  color: var(--text-color-secondary);
}

/* 生成代码上方的元信息：本次目标 + 对应包名（切渲染端时这里会变） */
.code-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color-lighter);
  background: var(--fill-color-light);
}

.code-target {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-color-regular);
}

.code-pkg {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
  color: var(--text-color-secondary);
}

.ai-crud-content {
  display: grid;
  grid-template-columns: minmax(360px, 40%) 1fr;
  gap: 16px;
  height: calc(100vh - 280px);
  min-height: 600px;
}

.ai-crud-chat-pane {
  min-width: 0;
  display: flex;
}

.ai-crud-output-pane {
  background: var(--bg-color);
  border: 1px solid var(--border-color-lighter);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  .output-tabs {
    height: 100%;
    display: flex;
    flex-direction: column;

    :deep(.el-tabs__header) {
      padding: 0 16px;
      margin: 0;
      background: var(--fill-color-light);
    }

    :deep(.el-tabs__content) {
      flex: 1;
      overflow: auto;
      padding: 12px 16px;
    }

    :deep(.el-tab-pane) {
      height: 100%;
    }
  }
}

.code-area {
  height: 100%;
  overflow: auto;
}

.code-block {
  margin: 0;
  padding: 16px;
  background: #1e1e2e;
  color: #cdd6f4;
  border-radius: 6px;
  font-family: 'SFMono-Regular', 'Fira Code', Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  overflow-x: auto;
  white-space: pre;

  code {
    font-family: inherit;
  }
}

.preview-area {
  padding: 8px;
}

.feature-hints {
  margin-bottom: 12px;
}

.feature-hints-list {
  margin: 6px 0 0;
  padding-left: 20px;
  font-size: 13px;
  line-height: 1.7;

  li {
    margin: 2px 0;
  }
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 320px;
}

@media (max-width: 1024px) {
  .ai-crud-content {
    grid-template-columns: 1fr;
    height: auto;
  }
  .ai-crud-chat-pane {
    height: 480px;
  }
  .ai-crud-output-pane {
    height: 600px;
  }
}
</style>
