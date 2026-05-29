<template>
  <div class="ai-crud-page">
    <div class="ai-crud-header">
      <h1 class="ai-crud-title">{{ t('aiCrud.title') }}</h1>
      <p class="ai-crud-banner">{{ t('aiCrud.banner') }}</p>
      <div class="ai-crud-toolbar">
        <el-tag :type="useAI ? 'success' : 'info'" class="engine-tag">
          {{ useAI ? t('aiCrud.engineAi') : t('aiCrud.engineRule') }}
        </el-tag>
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
          <el-input v-model="aiConfig.baseUrl" placeholder="https://api.openai.com/v1" />
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
import type { StructuredCrudConfig } from '@es-plus/shared'
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

const previewOptions = computed(() => ({
  border: true,
  size: 'small' as const,
  headerCellStyle: { background: '#f5f7fa' },
}))

// ─── AI config ──────────────────────────────────────────────────────────
const aiConfig = reactive({
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
})
const useAI = computed(() => !!aiConfig.apiKey)
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
    })

    // Commit assistant message + uniform preview state from FlowResult.
    messages.value.push(result.message)
    if (result.structuredConfig) currentStructuredConfig.value = result.structuredConfig
    generatedCode.value = result.code
    generatedConfig.value = result.jsonView
    formItems.value = result.formItems as any[]
    previewColumns.value = result.columns as any[]
    previewBtns.value = (result.toolbarBtns as any[]).map((b) => ({ ...b, triggerEvent: false }))
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
  gap: 12px;
}

.engine-tag {
  font-size: 12px;
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
