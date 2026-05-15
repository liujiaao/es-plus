<template>
  <div class="playground-page">
    <div class="playground-header">
      <h1 class="playground-title">Playground</h1>
      <p class="playground-desc">在线体验 ES-Plus 组件，实时预览代码效果</p>
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
            <h3 class="panel-title">配置面板</h3>
            <div class="config-area">
              <el-form label-position="top">
                <el-form-item label="表单字段 (JSON)">
                  <el-input
                    v-model="formConfigCode"
                    type="textarea"
                    :rows="15"
                    class="code-input"
                  />
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" @click="applyFormConfig">应用配置</el-button>
                  <el-button @click="resetFormConfig">重置</el-button>
                </el-form-item>
              </el-form>
            </div>
          </div>
          <div class="panel-section">
            <h3 class="panel-title">预览面板</h3>
            <div class="preview-area">
              <es-form
                :model="formModel"
                :form-item-list="formItems"
                :layout-form-props="formLayout"
                @confirm="handleFormSubmit"
                @reset="handleFormReset"
              />
              <div v-if="formResult" class="result-box">
                <h4>提交结果:</h4>
                <pre>{{ JSON.stringify(formResult, null, 2) }}</pre>
              </div>
            </div>
          </div>
        </div>
        
        <!-- EsTable Playground -->
        <div v-if="activeComponent === 'es-table'" class="playground-panel">
          <div class="panel-section">
            <h3 class="panel-title">配置面板</h3>
            <div class="config-area">
              <el-form label-position="top">
                <el-form-item label="列配置 (JSON)">
                  <el-input
                    v-model="tableConfigCode"
                    type="textarea"
                    :rows="12"
                    class="code-input"
                  />
                </el-form-item>
                <el-form-item label="数据 (JSON)">
                  <el-input
                    v-model="tableDataCode"
                    type="textarea"
                    :rows="8"
                    class="code-input"
                  />
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" @click="applyTableConfig">应用配置</el-button>
                  <el-button @click="resetTableConfig">重置</el-button>
                </el-form-item>
              </el-form>
            </div>
          </div>
          <div class="panel-section">
            <h3 class="panel-title">预览面板</h3>
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
            <h3 class="panel-title">配置面板</h3>
            <div class="config-area">
              <el-form label-position="top">
                <el-form-item label="弹窗配置">
                  <el-input
                    v-model="dialogConfigCode"
                    type="textarea"
                    :rows="10"
                    class="code-input"
                  />
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" @click="openPlaygroundDialog">打开弹窗</el-button>
                </el-form-item>
              </el-form>
            </div>
          </div>
          <div class="panel-section">
            <h3 class="panel-title">代码预览</h3>
            <div class="preview-area code-preview">
              <pre class="hljs"><code class="language-javascript">const dialog = useDialog()

dialog({
  title: '{{ dialogConfig.title }}',
  width: '{{ dialogConfig.width }}',
  render: () => h('div', '{{ dialogConfig.content }}'),
  onSubmit: (close) => {
    close()
  }
})</code></pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, h } from 'vue'
import { ElMessage } from 'element-plus'
import EsForm from 'es-plus/components/es-form'
import EsTable from 'es-plus/components/es-table'
import { useDialog } from 'es-plus'

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
    ElMessage.success('配置已应用')
  } catch (e) {
    ElMessage.error('JSON 格式错误')
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
    ElMessage.success('配置已应用')
  } catch (e) {
    ElMessage.error('JSON 格式错误')
  }
}

const resetTableConfig = () => {
  tableConfigCode.value = JSON.stringify(defaultTableColumns, null, 2)
  tableDataCode.value = JSON.stringify(defaultTableData, null, 2)
  tableColumns.value = [...defaultTableColumns]
  tableData.value = [...defaultTableData]
}

// useDialog Playground
const dialogConfig = ref({
  title: '提示',
  width: '400px',
  content: '这是一个弹窗内容'
})

const dialogConfigCode = ref(JSON.stringify(dialogConfig.value, null, 2))

const openPlaygroundDialog = () => {
  try {
    const config = JSON.parse(dialogConfigCode.value)
    const dialog = useDialog()
    dialog({
      title: config.title,
      width: config.width,
      render: () => h('div', { style: 'padding: 20px' }, config.content),
      onSubmit: (close) => {
        ElMessage.success('点击了确认')
        close()
      }
    })
  } catch (e) {
    ElMessage.error('JSON 格式错误')
  }
}
</script>

<style lang="scss" scoped>
.playground-page {
  padding: 24px;
  max-width: 1600px;
  margin: 0 auto;
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
  .code-input {
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 13px;
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
