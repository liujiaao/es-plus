<template>
  <div class="playground-page">
    <div class="playground-header">
      <h1 class="playground-title">{{ t('playground.title') }}</h1>
      <p class="playground-desc">{{ t('playground.description') }}</p>
    </div>
    
    <div class="playground-container">
      <div class="playground-toolbar">
        <el-radio-group v-model="activeComponent" size="large">
          <el-radio-button label="es-form">EsForm</el-radio-button>
          <el-radio-button label="es-table">EsTable</el-radio-button>
          <el-radio-button label="use-dialog">useDialog</el-radio-button>
        </el-radio-group>
      </div>
      
      <div class="playground-content">
        <!-- EsForm Playground -->
        <div v-if="activeComponent === 'es-form'" class="playground-panel">
          <div class="panel-section">
            <h3 class="panel-title">{{ t('playground.configPanel') }}</h3>
            <div class="config-area">
              <el-form label-position="top">
                <el-form-item :label="t('playground.formItems')">
                  <div class="monaco-wrapper">
                    <VueMonacoEditor
                      v-model:value="formConfigCode"
                      language="json"
                      :options="monacoOptions"
                      :theme="monacoTheme"
                      path="form-items.json"
                      height="360px"
                    />
                  </div>
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" @click="applyFormConfig">{{ t('playground.applyConfig') }}</el-button>
                  <el-button @click="resetFormConfig">{{ t('playground.reset') }}</el-button>
                </el-form-item>
              </el-form>
            </div>
          </div>
          <div class="panel-section">
            <h3 class="panel-title">{{ t('playground.previewPanel') }}</h3>
            <div class="preview-area">
              <es-form
                :model="formModel"
                :form-item-list="formItems"
                :layout-form-props="formLayout"
                @confirm="handleFormSubmit"
                @reset="handleFormReset"
              />
              <div v-if="formResult" class="result-box">
                <h4>{{ t('playground.submitResult') }}</h4>
                <pre>{{ JSON.stringify(formResult, null, 2) }}</pre>
              </div>
            </div>
          </div>
        </div>
        
        <!-- EsTable Playground -->
        <div v-if="activeComponent === 'es-table'" class="playground-panel">
          <div class="panel-section">
            <h3 class="panel-title">{{ t('playground.configPanel') }}</h3>
            <div class="config-area">
              <el-form label-position="top">
                <el-form-item :label="t('playground.tableColumns')">
                  <div class="monaco-wrapper">
                    <VueMonacoEditor
                      v-model:value="tableConfigCode"
                      language="json"
                      :options="monacoOptions"
                      :theme="monacoTheme"
                      path="table-columns.json"
                      height="280px"
                    />
                  </div>
                </el-form-item>
                <el-form-item :label="t('playground.tableData')">
                  <div class="monaco-wrapper">
                    <VueMonacoEditor
                      v-model:value="tableDataCode"
                      language="json"
                      :options="monacoOptions"
                      :theme="monacoTheme"
                      path="table-data.json"
                      height="200px"
                    />
                  </div>
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" @click="applyTableConfig">{{ t('playground.applyConfig') }}</el-button>
                  <el-button @click="resetTableConfig">{{ t('playground.reset') }}</el-button>
                </el-form-item>
              </el-form>
            </div>
          </div>
          <div class="panel-section">
            <h3 class="panel-title">{{ t('playground.previewPanel') }}</h3>
            <div class="preview-area">
              <es-table
                :data-source="tableData"
                :columns="tableColumns"
                :options="{ border: true }"
              />
            </div>
          </div>
        </div>
        
        <!-- useDialog Playground -->
        <div v-if="activeComponent === 'use-dialog'" class="playground-panel">
          <div class="panel-section">
            <h3 class="panel-title">{{ t('playground.configPanel') }}</h3>
            <div class="config-area">
              <el-form label-position="top">
                <el-form-item :label="t('playground.dialogConfig')">
                  <div class="js-mode-hint">
                    <el-icon><InfoFilled /></el-icon>
                    <span>{{ t('playground.dialogHint') }}</span>
                  </div>
                  <div class="monaco-wrapper">
                    <VueMonacoEditor
                      v-model:value="dialogConfigCode"
                      language="javascript"
                      :options="monacoOptions"
                      :theme="monacoTheme"
                      path="dialog-config.js"
                      height="280px"
                    />
                  </div>
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" @click="openPlaygroundDialog">{{ t('playground.openDialog') }}</el-button>
                  <el-button @click="resetDialogConfig">{{ t('playground.reset') }}</el-button>
                </el-form-item>
              </el-form>
            </div>
          </div>
          <div class="panel-section">
            <h3 class="panel-title">{{ t('playground.codePreview') }}</h3>
            <div class="preview-area code-preview">
              <div v-if="!dialogConfigValid" class="invalid-hint">{{ t('playground.syntaxError') }}：{{ dialogParseError }}</div>
              <pre class="hljs"><code class="language-javascript">{{ dialogPreviewCode }}</code></pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, h, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { InfoFilled } from '@element-plus/icons-vue'
import { EsForm, EsTable, useDialog } from 'es-plus'

const { t } = useI18n()
import { VueMonacoEditor, loader } from '@guolao/vue-monaco-editor'
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import { useThemeStore } from '@/stores/theme'
import esFormSchema from '@/schemas/es-form.schema.json'
import esTableColumnsSchema from '@/schemas/es-table-columns.schema.json'
import esTableDataSchema from '@/schemas/es-table-data.schema.json'

// Wire monaco-editor to a Vite-bundled worker and feed the local instance
// to @guolao/vue-monaco-editor's loader. Without this, the loader pulls
// monaco from a CDN at runtime — which silently fails behind GFW and
// leaves the editor blank.
self.MonacoEnvironment = {
  getWorker(_workerId, label) {
    if (label === 'json') return new JsonWorker()
    // 'javascript' / 'typescript' both route through the TS worker — without
    // it Monaco fires `getSyntacticDiagnostics` / `provideInlayHints` etc and
    // gets back "Missing requestHandler" errors that flood the console.
    if (label === 'javascript' || label === 'typescript') return new TsWorker()
    return new EditorWorker()
  },
}
loader.config({ monaco })

const themeStore = useThemeStore()
const monacoTheme = computed(() => (themeStore.isDark ? 'vs-dark' : 'vs'))
const monacoOptions = {
  minimap: { enabled: false },
  fontSize: 13,
  tabSize: 2,
  scrollBeyondLastLine: false,
  formatOnPaste: true,
  automaticLayout: true,
}

onMounted(() => {
  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    allowComments: false,
    schemas: [
      {
        uri: 'https://es-plus.dev/schemas/es-form.schema.json',
        fileMatch: ['form-items.json'],
        schema: esFormSchema,
      },
      {
        uri: 'https://es-plus.dev/schemas/es-table-columns.schema.json',
        fileMatch: ['table-columns.json'],
        schema: esTableColumnsSchema,
      },
      {
        uri: 'https://es-plus.dev/schemas/es-table-data.schema.json',
        fileMatch: ['table-data.json'],
        schema: esTableDataSchema,
      },
    ],
  })
})

const activeComponent = ref('es-form')

// EsForm Playground
const defaultFormItems = [
  { prop: 'name', label: '姓名', formtype: 'Input', span: 12 },
  { prop: 'age', label: '年龄', formtype: 'Input', span: 12, attrs: { type: 'number' } },
  { prop: 'email', label: '邮箱', formtype: 'Input', span: 24 }
]

const formModel = ref({ name: '', age: '', email: '' })
const formItems = ref([...defaultFormItems])
const formLayout = ref({ fromLayProps: { labelWidth: '80px' } })
const formResult = ref(null)
const formConfigCode = ref(JSON.stringify(defaultFormItems, null, 2))

const applyFormConfig = () => {
  try {
    formItems.value = JSON.parse(formConfigCode.value)
    ElMessage.success(t('playground.configApplied'))
  } catch (e) {
    ElMessage.error(t('playground.jsonError'))
  }
}

const resetFormConfig = () => {
  formConfigCode.value = JSON.stringify(defaultFormItems, null, 2)
  formItems.value = [...defaultFormItems]
  formModel.value = { name: '', age: '', email: '' }
  formResult.value = null
}

const handleFormSubmit = (ref, model) => {
  formResult.value = model
}

const handleFormReset = () => {
  formResult.value = null
}

// EsTable Playground
const defaultTableColumns = [
  { prop: 'name', label: '姓名', width: 120 },
  { prop: 'age', label: '年龄', width: 100 },
  { prop: 'address', label: '地址' }
]

const defaultTableData = [
  { name: '张三', age: 28, address: '北京市' },
  { name: '李四', age: 32, address: '上海市' },
  { name: '王五', age: 24, address: '广州市' }
]

const tableColumns = ref([...defaultTableColumns])
const tableData = ref([...defaultTableData])
const tableConfigCode = ref(JSON.stringify(defaultTableColumns, null, 2))
const tableDataCode = ref(JSON.stringify(defaultTableData, null, 2))

const applyTableConfig = () => {
  try {
    tableColumns.value = JSON.parse(tableConfigCode.value)
    tableData.value = JSON.parse(tableDataCode.value)
    ElMessage.success(t('playground.configApplied'))
  } catch (e) {
    ElMessage.error(t('playground.jsonError'))
  }
}

const resetTableConfig = () => {
  tableConfigCode.value = JSON.stringify(defaultTableColumns, null, 2)
  tableDataCode.value = JSON.stringify(defaultTableData, null, 2)
  tableColumns.value = [...defaultTableColumns]
  tableData.value = [...defaultTableData]
}

// useDialog Playground — JS 模式
// 用户直接写一个对象字面量（不带外层括号），Playground 用 new Function 求值
const defaultDialogCode = `{
  title: '提示',
  width: '400px',
  render: (h) => h('div', { style: 'padding: 20px' }, '这是一个弹窗内容'),
  configBtn: [
    { name: '取消', click: (_, { close }) => close() },
    { name: '确定', type: 'primary', click: (_, { close }) => {
      ElMessage.success('点击了确认')
      close()
    } }
  ]
}`

const dialogConfigCode = ref(defaultDialogCode)
const dialogParseError = ref('')

// 把字符串求值成对象。注入 ElMessage 让 onSubmit 之类能直接用提示。
const evalDialogConfig = (code) => {
  try {
    const fn = new Function('ElMessage', 'return (' + code + ')')
    const obj = fn(ElMessage)
    if (!obj || typeof obj !== 'object') {
      throw new Error('表达式必须求值为对象')
    }
    dialogParseError.value = ''
    return obj
  } catch (e) {
    dialogParseError.value = (e && e.message) || String(e)
    return null
  }
}

const parsedDialogConfig = computed(() => evalDialogConfig(dialogConfigCode.value))
const dialogConfigValid = computed(() => parsedDialogConfig.value !== null)

const resetDialogConfig = () => {
  dialogConfigCode.value = defaultDialogCode
}

const openPlaygroundDialog = () => {
  const config = parsedDialogConfig.value
  if (!config) {
    ElMessage.error(t('playground.syntaxError') + '：' + dialogParseError.value)
    return
  }
  const dialog = useDialog()
  dialog(config)
}

// 代码预览：把用户写的对象字面量直接拼到 dialog(...) 里
const dialogPreviewCode = computed(() => {
  return `import { useDialog } from '@es-plus/vue3'

const dialog = useDialog()

dialog(${dialogConfigCode.value})`
})
</script>

<style lang="scss" scoped>
.playground-page {
  padding: 24px;
  max-width: 1600px;
  margin: 80px auto;
}

.playground-header {
  text-align: center;
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border-color-lighter);
}

.playground-title {
  font-size: 36px;
  font-weight: 700;
  color: var(--text-color-primary);
  margin-bottom: 12px;
}

.playground-desc {
  font-size: 16px;
  color: var(--text-color-secondary);
}

.playground-toolbar {
  display: flex;
  justify-content: center;
  margin-bottom: 24px;
}

.playground-content {
  background-color: var(--bg-color);
  border-radius: 8px;
  border: 1px solid var(--border-color-lighter);
  overflow: hidden;
}

.playground-panel {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 600px;
}

.panel-section {
  padding: 24px;
  
  &:first-child {
    border-right: 1px solid var(--border-color-lighter);
    background-color: var(--fill-color-light);
  }
}

.panel-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 20px;
  color: var(--text-color-primary);
}

.config-area {
  .monaco-wrapper {
    width: 100%;
    border: 1px solid var(--el-border-color, var(--border-color-lighter));
    border-radius: 4px;
    overflow: hidden;
  }

  :deep(.el-form-item__content) {
    width: 100%;
    display: block;
  }

  :deep(.monaco-editor) {
    .overflow-guard {
      border-radius: 4px;
    }
  }
}

.preview-area {
  min-height: 400px;

  &.code-preview {
    background-color: #f6f8fa;
    border-radius: 4px;
    padding: 16px;
  }
}

.invalid-hint {
  margin-bottom: 12px;
  padding: 8px 12px;
  font-size: 13px;
  color: #b54708;
  background-color: #fef0c7;
  border: 1px solid #fec84b;
  border-radius: 4px;
  word-break: break-all;
}

.js-mode-hint {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-bottom: 8px;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-color-regular);
  background-color: var(--fill-color-light);
  border-left: 3px solid var(--primary-color);
  border-radius: 4px;

  .el-icon {
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--primary-color);
  }

  code {
    padding: 1px 4px;
    font-size: 11px;
    background-color: var(--fill-color);
    border-radius: 3px;
    font-family: 'SFMono-Regular', Consolas, monospace;
  }
}

.result-box {
  margin-top: 24px;
  padding: 16px;
  background-color: #f5f7fa;
  border-radius: 4px;
  
  h4 {
    margin-bottom: 12px;
    color: #606266;
  }
  
  pre {
    margin: 0;
    font-size: 13px;
    color: #409eff;
  }
}

@media (max-width: 1200px) {
  .playground-panel {
    grid-template-columns: 1fr;
  }
  
  .panel-section:first-child {
    border-right: none;
    border-bottom: 1px solid var(--border-color-lighter);
  }
}
</style>
