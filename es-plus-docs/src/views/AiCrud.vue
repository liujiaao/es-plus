<template>
  <div class="ai-crud-page">
    <div class="ai-crud-header">
      <h1 class="ai-crud-title">AI CRUD Generator</h1>
      <p class="ai-crud-desc">自然语言描述 → 完整 CRUD 页面配置，体验配置化组件库在 AI 时代的生产力</p>
    </div>

    <div class="ai-crud-container">
      <!-- Toolbar -->
      <div class="ai-crud-toolbar">
        <div class="toolbar-left">
          <el-dropdown @command="handlePreset">
            <el-button>
              预设示例 <el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="example in PRESET_EXAMPLES"
                  :key="example.label"
                  :command="example.prompt"
                >
                  {{ example.label }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-tag :type="useAI ? 'success' : 'info'" class="engine-tag">
            {{ useAI ? 'AI 引擎' : '规则引擎' }}
          </el-tag>
        </div>
        <div class="toolbar-right">
          <el-button @click="showSettings = true" :icon="Setting">AI 设置</el-button>
        </div>
      </div>

      <!-- Main content -->
      <div class="ai-crud-content">
        <!-- Left: Input panel -->
        <div class="input-panel">
          <div class="panel-title">需求描述</div>
          <el-input
            v-model="promptInput"
            type="textarea"
            :rows="6"
            placeholder="请描述你要生成的 CRUD 页面，例如：&#10;&#10;用户管理页面，查询条件有姓名、手机号、状态，表格显示姓名、手机号、邮箱、状态、创建时间，支持新增编辑删除"
            class="prompt-input"
          />
          <div class="action-bar">
            <el-button type="primary" :loading="generating" @click="handleGenerate" size="large">
              {{ generating ? '生成中...' : '生成配置' }}
            </el-button>
            <el-button @click="handleCopy" :disabled="!generatedCode" size="large">
              复制代码
            </el-button>
            <el-button @click="handleClear" size="large">清空</el-button>
          </div>

          <!-- Stats -->
          <div v-if="generatedCode" class="stats-bar">
            <el-tag size="small" type="info">{{ formItems.length }} 个查询字段</el-tag>
            <el-tag size="small" type="info">{{ columns.length }} 列</el-tag>
            <el-tag size="small" type="info">{{ actions.length }} 个操作</el-tag>
            <el-tag size="small" type="success">~{{ generatedCode.split('\n').length }} 行代码</el-tag>
          </div>
        </div>

        <!-- Right: Output panel -->
        <div class="output-panel">
          <el-tabs v-model="activeTab" class="output-tabs">
            <el-tab-pane label="生成代码" name="code">
              <div class="code-area" v-if="generatedCode">
                <pre class="code-block"><code>{{ generatedCode }}</code></pre>
              </div>
              <div v-else class="empty-state">
                <el-empty description="输入需求描述后点击「生成配置」" />
              </div>
            </el-tab-pane>
            <el-tab-pane label="实时预览" name="preview">
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
                <el-empty description="生成配置后可在此预览效果" />
              </div>
            </el-tab-pane>
            <el-tab-pane label="JSON 配置" name="json">
              <div class="code-area" v-if="generatedConfig">
                <pre class="code-block"><code>{{ JSON.stringify(generatedConfig, null, 2) }}</code></pre>
              </div>
              <div v-else class="empty-state">
                <el-empty description="生成配置后可查看 JSON 数据结构" />
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
      </div>
    </div>

    <!-- AI Settings Dialog -->
    <el-dialog v-model="showSettings" title="AI 设置" width="500px">
      <el-form label-position="top">
        <el-alert
          type="info"
          :closable="false"
          show-icon
          style="margin-bottom: 16px"
        >
          填写 API Key 后将使用真实 AI 生成，支持 OpenAI 兼容格式（如 DeepSeek、通义千问、月之暗面等）。不填则使用本地规则引擎。
        </el-alert>
        <el-form-item label="API Key">
          <el-input
            v-model="aiConfig.apiKey"
            placeholder="sk-..."
            show-password
          />
        </el-form-item>
        <el-form-item label="Base URL">
          <el-input
            v-model="aiConfig.baseUrl"
            placeholder="https://api.openai.com/v1"
          />
        </el-form-item>
        <el-form-item label="Model">
          <el-input
            v-model="aiConfig.model"
            placeholder="gpt-4o-mini"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSettings = false">取消</el-button>
        <el-button type="primary" @click="saveSettings">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="tsx">
import { ref, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowDown, Setting } from '@element-plus/icons-vue'
import { EsForm, EsTable } from 'es-plus'
import {
  generateCrudConfig,
  generateCode,
  PRESET_EXAMPLES,
  type GeneratedConfig
} from '@/utils/ai-crud-engine'
import { generateWithAI, DEFAULT_AI_CONFIG, type AiConfig } from '@/utils/ai-crud-api'

const promptInput = ref('')
const generating = ref(false)
const generatedCode = ref('')
const generatedConfig = ref<GeneratedConfig | null>(null)
const activeTab = ref('code')
const showSettings = ref(false)

const formItems = ref<any[]>([])
const columns = ref<any[]>([])
const actions = ref<string[]>([])
const previewBtns = ref<any[]>([])

const aiConfig = reactive<AiConfig>({ ...DEFAULT_AI_CONFIG })

const useAI = computed(() => !!aiConfig.apiKey)

const previewModel = reactive<Record<string, any>>({})
const mockData = ref<any[]>([])

const previewColumns = computed(() => {
  return columns.value.map(col => {
    const { render, ...rest } = col
    return rest
  })
})

const previewOptions = computed(() => ({
  border: true,
  size: 'small' as const,
  headerCellStyle: { background: '#f5f7fa' }
}))

function handlePreset(prompt: string) {
  promptInput.value = prompt
}

async function handleGenerate() {
  if (!promptInput.value.trim()) {
    ElMessage.warning('请输入需求描述')
    return
  }

  generating.value = true

  try {
    let config: GeneratedConfig

    if (useAI.value) {
      const aiResult = await generateWithAI(promptInput.value, aiConfig)
      config = aiResult
    } else {
      config = generateCrudConfig(promptInput.value)
    }

    generatedConfig.value = config
    formItems.value = config.formItems || []
    columns.value = config.columns || []
    actions.value = config.actions || []
    previewBtns.value = (config.queryBtns || []).map((btn: any) => ({
      ...btn,
      triggerEvent: false,
      click: btn.key === 'add' ? () => ElMessage.success('新增按钮被点击') : undefined
    }))

    // Build preview model
    Object.keys(previewModel).forEach(k => delete previewModel[k])
    formItems.value.forEach(item => {
      previewModel[item.prop] = ''
    })

    // Generate mock data for preview
    mockData.value = generateMockData(config.columns)

    // Generate code
    generatedCode.value = generateCode(config)
    activeTab.value = 'code'

    ElMessage.success(useAI.value ? 'AI 生成完成' : '规则引擎生成完成')
  } catch (error: any) {
    ElMessage.error(error.message || '生成失败')
  } finally {
    generating.value = false
  }
}

function generateMockData(cols: any[]): any[] {
  const rows: any[] = []
  for (let i = 1; i <= 5; i++) {
    const row: Record<string, any> = { id: i }
    cols.forEach(col => {
      if (col.prop === 'action') return
      if (/status|状态/.test(col.prop || '')) row[col.prop] = i % 2 === 0 ? 1 : 0
      else if (/time|Time|日期|时间/.test(col.prop || col.label || '')) row[col.prop] = `2024-0${i}-1${i}`
      else if (/amount|price|金额|价格/.test(col.prop || col.label || '')) row[col.prop] = (Math.random() * 1000).toFixed(2)
      else if (/age|年龄/.test(col.prop || col.label || '')) row[col.prop] = 20 + i * 3
      else row[col.prop] = `${col.label || col.prop}_${i}`
    })
    rows.push(row)
  }
  return rows
}

async function handleCopy() {
  if (!generatedCode.value) return
  try {
    await navigator.clipboard.writeText(generatedCode.value)
    ElMessage.success('代码已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败，请手动选择复制')
  }
}

function handleClear() {
  promptInput.value = ''
  generatedCode.value = ''
  generatedConfig.value = null
  formItems.value = []
  columns.value = []
  actions.value = []
  mockData.value = []
}

function saveSettings() {
  showSettings.value = false
  if (aiConfig.apiKey) {
    ElMessage.success('AI 设置已保存，将使用 AI 引擎生成')
  } else {
    ElMessage.info('未填写 API Key，将使用本地规则引擎')
  }
}
</script>

<style lang="scss" scoped>
.ai-crud-page {
  padding: 24px;
  max-width: 1600px;
  margin: 0 auto;
}

.ai-crud-header {
  text-align: center;
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border-color-lighter);
}

.ai-crud-title {
  font-size: 32px;
  font-weight: 700;
  color: var(--text-color-primary);
  margin-bottom: 8px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.ai-crud-desc {
  font-size: 15px;
  color: var(--text-color-secondary);
}

.ai-crud-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.engine-tag {
  font-size: 12px;
}

.ai-crud-content {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 20px;
  min-height: 600px;
}

.input-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  background-color: var(--fill-color-light);
  border-radius: 8px;
  padding: 20px;
  border: 1px solid var(--border-color-lighter);
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color-primary);
}

.prompt-input {
  :deep(.el-textarea__inner) {
    font-size: 14px;
    line-height: 1.6;
  }
}

.action-bar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.stats-bar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.output-panel {
  background-color: var(--bg-color);
  border-radius: 8px;
  border: 1px solid var(--border-color-lighter);
  overflow: hidden;

  .output-tabs {
    height: 100%;

    :deep(.el-tabs__header) {
      padding: 0 16px;
      margin: 0;
      background-color: var(--fill-color-light);
    }

    :deep(.el-tabs__content) {
      padding: 16px;
      height: calc(100% - 40px);
      overflow: auto;
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
  background-color: #1e1e2e;
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
  min-height: 400px;
}

@media (max-width: 1024px) {
  .ai-crud-content {
    grid-template-columns: 1fr;
  }
}
</style>
