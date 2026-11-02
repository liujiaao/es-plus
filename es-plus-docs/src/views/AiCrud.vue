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
        <!-- 引擎标签跟随**实际**走通的路径，而不是「有没有填 key」：
             填了 key 但 OpenAI 报错时会回退到规则引擎，此时标「AI 引擎」就是假话。 -->
        <el-tooltip :disabled="!fallbackReason" :content="fallbackReason || ''" placement="bottom">
          <el-tag :type="engineTag.type" class="engine-tag">{{ engineTag.label }}</el-tag>
        </el-tooltip>
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
          :presets="visiblePresets"
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
            <div class="preview-area" v-if="fragmentResult || previewSchema">
              <!-- 离线兜底的边界：规则引擎与 CLI `es-plus create` 同源，只产 CRUD 整页。
                   不说这句话，用户会以为「只做一个表单」被生成错了。 -->
              <el-alert
                v-if="showOfflineScope"
                type="info"
                :closable="false"
                show-icon
                class="feature-hints"
                :title="t('aiCrud.offlineScopeNote')"
              />
              <!-- 已知边界（配置里有、预览画不出来）：来自 shared 的
                   describeUnrenderedFeatures，与 MCP 工具摘要同一份判据。
                   与「生成器丢了需求」严格区分 —— 后者是 bug，前者是事实。 -->
              <el-alert
                v-if="previewHints.length > 0"
                type="warning"
                :closable="false"
                show-icon
                class="feature-hints"
              >
                <template #title>
                  <strong>{{ t('aiCrud.hintsTitle') }}</strong>
                </template>
                <ul class="feature-hints-list">
                  <li v-for="(h, idx) in previewHints" :key="idx">{{ h }}</li>
                </ul>
              </el-alert>
              <!-- 生成路径**表达不了**的诉求（如 schema 无法内联的 render）：
                   产物里已经不存在，必须与上面的「预览边界」分开说。 -->
              <el-alert
                v-if="previewWarnings.length > 0"
                type="info"
                :closable="false"
                show-icon
                class="feature-hints"
              >
                <template #title>
                  <strong>{{ t('aiCrud.warningsTitle') }}</strong>
                </template>
                <ul class="feature-hints-list">
                  <li v-for="(w, idx) in previewWarnings" :key="idx">{{ w }}</li>
                </ul>
              </el-alert>
              <!-- 预览渲染的是**生成物本身**：整页交给真正的 es-crud-page；单场景
                   片段交给片段预览（同一份 fields 经 buildFormItem/buildTableColumn）。 -->
              <FragmentPreview
                v-if="fragmentResult"
                :key="`frag-${previewKey}`"
                :kind="fragmentResult.kind"
                :config="fragmentResult.config"
              />
              <es-crud-page
                v-else
                :key="`crud-${previewKey}`"
                :schema="previewSchema"
                :http-request="mockHttpRequest"
                auto-load
              />
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
import { EsCrudPage } from 'es-plus'
import { mcpFlow, type ChatMessage, type TraceEntry } from '@/utils/mcp-flow'
// 渲染端选项与称呼来自三站清单（与顶栏切换器、案例卡互链同一份）
import { SITES } from '@/utils/sites'
import type { StructuredCrudConfig, TargetFramework } from '@es-plus/shared'
import { PRESETS, type Preset } from '@/utils/preset-examples'
import ChatComposer from '@/components/ai-crud/ChatComposer.vue'
import FragmentPreview from '@/components/ai-crud/FragmentPreview.vue'
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
const generatedCode = ref('')
const generatedConfig = ref<unknown>(null)
/**
 * 实时预览的数据源：**生成物本身的 CrudPageSchema**，交给 `<es-crud-page>` 渲染。
 * 不在浏览器里另做字段映射 —— 预览与「生成代码」必须是同一份 schema 的两种视图。
 */
const previewSchema = ref<any>(null)
/**
 * 单场景片段的产物（表格 / 表单 / 弹窗）。与 previewSchema 互斥：整页走
 * `<es-crud-page>`，片段走 `<FragmentPreview>`。此前所有诉求都被塞进整页预览，
 * 「只做一个筛选表单」的用户会看到一整套 CRUD 外壳并以为生成错了。
 */
const fragmentResult = ref<{
  kind: 'table' | 'form' | 'dialog'
  config: Record<string, any>
  code: string
  summary: string
} | null>(null)
/** 强制重挂载：同一份 schema 再次生成时也要重建组件内部状态（分页/弹窗） */
const previewKey = ref(0)
const mockData = ref<any[]>([])
/**
 * 配置里有、但实时预览画不出来 / 需宿主补一步的事实（shared 的
 * describeUnrenderedFeatures 是唯一判据）。与「生成器丢了需求」严格区分。
 */
const previewHints = ref<string[]>([])
/** 本次生成被降级/剥离的诉求（如 schema 无法内联的 render） */
const previewWarnings = ref<string[]>([])
/**
 * 本次**实际**走通的引擎。标签不能只看「有没有填 key」：
 * 填了 key 但 OpenAI 报错时走的是规则引擎，标成「AI 引擎」就是假话。
 */
const engine = ref<'ai' | 'rule' | 'rule-fallback' | null>(null)
const fallbackReason = ref<string | undefined>(undefined)

/**
 * 是否展示「离线只产 CRUD 整页」的边界说明。
 * 已生成时只信事实（engine），未生成时按是否填了 key 预告 —— 与引擎标签同一条口径。
 */
const showOfflineScope = computed(() =>
  engine.value ? engine.value !== 'ai' : !useAI.value,
)

/**
 * 引擎标签：`null`（还没生成）时按「是否填了 key」预告，一旦有结果就**只信事实**。
 */
const engineTag = computed<{ label: string; type: 'success' | 'info' | 'warning' }>(() => {
  if (engine.value === 'ai') return { label: t('aiCrud.engineAi'), type: 'success' }
  if (engine.value === 'rule') return { label: t('aiCrud.engineRule'), type: 'info' }
  if (engine.value === 'rule-fallback') {
    return { label: t('aiCrud.engineRuleFallback'), type: 'warning' }
  }
  return useAI.value
    ? { label: t('aiCrud.engineAi'), type: 'success' }
    : { label: t('aiCrud.engineRule'), type: 'info' }
})

/**
 * 预览用的假接口。
 *
 * 响应形状必须匹配 es-table 的**默认**字段映射（core 的
 * `DEFAULT_CONFIG_FORM_FIELD_OUT`：列表 `rows`、总数 `records`），
 * 不是 `{data,total}` —— 后者会被 formatConfigOut 判成空列表，
 * 于是「预览有表头没数据」。真实项目里在 apiParams.configFormOut 里覆盖。
 */
const mockHttpRequest = () =>
  Promise.resolve({ rows: mockData.value, records: mockData.value.length })

// ─── AI config ──────────────────────────────────────────────────────────
/**
 * Base URL 的默认值必须区分「本地」与「线上」：
 *
 *  - 本地 `npm run dev` 有 vite 同源代理（/openai → api.openai.com），可以直接用；
 *  - 线上是纯静态托管（GitHub Pages），**没有代理** —— 默认给 `/openai/v1`
 *    等于给每个访客一个必然 404 的默认值。
 *
 * 所以线上默认留空（强制用户填自己的 CORS 网关），并允许用 `VITE_AI_BASE_URL`
 * 预置。Key 永不落盘（只在内存），base/model 落 localStorage 以免每次重填。
 */
const DEFAULT_AI_BASE =
  (import.meta.env.VITE_AI_BASE_URL as string | undefined) ??
  (import.meta.env.DEV ? '/openai/v1' : '')
const DEFAULT_AI_MODEL =
  (import.meta.env.VITE_AI_MODEL as string | undefined) ?? 'gpt-4o-mini'
const AI_CONFIG_STORAGE_KEY = 'es-plus:ai-endpoint'

function loadSavedEndpoint(): { baseUrl?: string; model?: string } {
  try {
    const raw = localStorage.getItem(AI_CONFIG_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as { baseUrl?: string; model?: string }) : {}
  } catch {
    return {}
  }
}
const savedEndpoint = loadSavedEndpoint()

const aiConfig = reactive({
  apiKey: '',
  baseUrl: savedEndpoint.baseUrl ?? DEFAULT_AI_BASE,
  model: savedEndpoint.model ?? DEFAULT_AI_MODEL,
})
const useAI = computed(() => !!aiConfig.apiKey)

/**
 * 可见的预设。`requiresAi` 的预设（单场景片段）只在配置了模型时出现：
 * 片段路由由模型按信封协议选择，离线规则引擎**只产 CRUD 整页**，给出这些
 * 预设只会得到和标题不符的产物。
 */
const visiblePresets = computed(() =>
  useAI.value ? PRESETS : PRESETS.filter((p) => !p.requiresAi),
)

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
  // 填了 key 却没填 Base URL：给一个可执行的错误，而不是让 fetch 打到
  // 相对路径（线上会 404，本地会命中静态服务器）后只在 trace 里留一行。
  if (aiConfig.apiKey && !aiConfig.baseUrl.trim()) {
    ElMessage.error(t('aiCrud.baseUrlRequired'))
    showSettings.value = true
    return
  }

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
    // 片段与整页配置是两种上下文：片段轮次没有 StructuredCrudConfig 快照，
    // 留着上一轮的配置会让「再加一列」被误当成整页 refin（模型看到的是旧 CRUD 配置）。
    if (result.fragment) currentStructuredConfig.value = null
    else if (result.structuredConfig) currentStructuredConfig.value = result.structuredConfig
    generatedTarget.value = result.target
    generatedCode.value = result.code
    generatedConfig.value = result.jsonView
    // 预览 = 生成物本身（同一份 CrudPageSchema），不再二次映射。
    // 单场景片段不是 CrudPageSchema —— 交给 FragmentPreview，二者互斥。
    fragmentResult.value = result.fragment
      ? {
          kind: result.fragment.kind,
          config: result.fragment.config,
          code: result.fragment.code,
          summary: result.fragment.summary,
        }
      : null
    previewSchema.value = result.fragment
      ? null
      : ((result.previewSchema ?? null) as Record<string, any> | null)
    previewKey.value += 1
    previewHints.value = result.featureHints ?? []
    previewWarnings.value = result.warnings ?? []
    engine.value = result.engine
    fallbackReason.value = result.fallbackReason
    mockData.value = result.fragment
      ? []
      : generateMockData(
          ((result.previewSchema?.columns as any[]) ?? result.columns ?? []) as any[]
        )
    if (result.engine === 'rule-fallback') {
      // 静默回退是最坏的情况：用户填了 key，以为看到的是 AI 产物。
      ElMessage.warning(fallbackReason.value ?? t('aiCrud.fallbackNotice'))
    }
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
  previewSchema.value = null
  fragmentResult.value = null
  previewHints.value = []
  previewWarnings.value = []
  engine.value = null
  fallbackReason.value = undefined
  mockData.value = []
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
  if (aiConfig.apiKey && !aiConfig.baseUrl.trim()) {
    ElMessage.error(t('aiCrud.baseUrlRequired'))
    return
  }
  showSettings.value = false
  // 只持久化 endpoint，不持久化 key —— 页面加载时 key 必须重新输入。
  try {
    localStorage.setItem(
      AI_CONFIG_STORAGE_KEY,
      JSON.stringify({ baseUrl: aiConfig.baseUrl, model: aiConfig.model })
    )
  } catch {
    // 隐私模式 / 配额满：持久化失败不影响本次使用
  }
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

// 逐页 title / description：单一来源在 utils/page-meta.ts（check:page-meta 静态核对）。
// 放在脚本末尾不影响求值 —— ESM 的 import 声明会被提升，这样文件级注释与 import 分组都不被打断。
import { usePageMeta } from '@/utils/page-meta'

usePageMeta('ai-crud')
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
    /* 同 FragmentDashboard：1fr 的 min-content 下限会把整页顶宽 */
    grid-template-columns: minmax(0, 1fr);
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
