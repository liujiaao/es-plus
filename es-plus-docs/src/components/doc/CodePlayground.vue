<template>
  <div class="code-playground">
    <!-- 演示区域 -->
    <div class="playground-preview">
      <div class="preview-header">
        <span class="preview-title">{{ title }}</span>
        <div class="preview-actions">
          <el-button 
            link 
            :icon="isExpanded ? ArrowUp : ArrowDown" 
            @click="toggleExpand"
          >
            {{ isExpanded ? '收起代码' : '展开代码' }}
          </el-button>
          <el-button link :icon="CopyDocument" @click="copyCode">
            复制
          </el-button>
          <el-button link :icon="Refresh" @click="refreshPreview">
            刷新
          </el-button>
        </div>
      </div>
      <div class="preview-content" :class="{ 'is-expanded': isExpanded }">
        <slot name="preview" />
      </div>
    </div>
    
    <!-- 代码区域 -->
    <el-collapse-transition>
      <div v-show="isExpanded" class="playground-code">
        <div class="code-tabs">
          <div 
            v-for="tab in codeTabs" 
            :key="tab.name"
            class="code-tab"
            :class="{ active: activeTab === tab.name }"
            @click="activeTab = tab.name"
          >
            {{ tab.label }}
          </div>
        </div>
        <div class="code-content">
          <pre v-if="activeTab === 'template'" class="hljs"><code class="language-html">{{ displayCode.template }}</code></pre>
          <pre v-if="activeTab === 'script'" class="hljs"><code class="language-javascript">{{ displayCode.script }}</code></pre>
          <pre v-if="activeTab === 'style'" class="hljs"><code class="language-css">{{ displayCode.style }}</code></pre>
        </div>
      </div>
    </el-collapse-transition>
    
    <!-- 描述区域 -->
    <div v-if="description" class="playground-description">
      <el-alert :title="description" type="info" :closable="false" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowUp, ArrowDown, CopyDocument, Refresh } from '@element-plus/icons-vue'
import hljs from 'highlight.js'

interface CodeTabs {
  name: string
  label: string
}

interface CodeContent {
  template: string
  script: string
  style: string
}

const props = defineProps<{
  title: string
  description?: string
  code: CodeContent | string
}>()

const isExpanded = ref(false)
const activeTab = ref('template')
const refreshKey = ref(0)

const codeTabs = computed<CodeTabs[]>(() => {
  const tabs: CodeTabs[] = []
  if (typeof props.code === 'object') {
    if (props.code.template) tabs.push({ name: 'template', label: 'Template' })
    if (props.code.script) tabs.push({ name: 'script', label: 'Script' })
    if (props.code.style) tabs.push({ name: 'style', label: 'Style' })
  }
  return tabs
})

const displayCode = computed<CodeContent>(() => {
  if (typeof props.code === 'string') {
    return { template: props.code, script: '', style: '' }
  }
  return props.code
})

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value
}

const copyCode = async () => {
  let codeToCopy = ''
  if (typeof props.code === 'string') {
    codeToCopy = props.code
  } else {
    codeToCopy = `${props.code.template}\n\n${props.code.script}\n\n${props.code.style}`
  }
  
  try {
    await navigator.clipboard.writeText(codeToCopy)
    ElMessage.success('代码已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败')
  }
}

const refreshPreview = () => {
  refreshKey.value++
}

// 高亮代码
watch(() => props.code, () => {
  if (isExpanded.value) {
    setTimeout(() => {
      document.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block as HTMLElement)
      })
    }, 100)
  }
}, { immediate: true })

provide('refreshKey', refreshKey)
</script>

<script lang="ts">
import { provide } from 'vue'
</script>

<style lang="scss" scoped>
.code-playground {
  border: 1px solid var(--border-color-lighter);
  border-radius: 8px;
  margin: 16px 0;
  overflow: hidden;
}

.playground-preview {
  background-color: var(--fill-color-light);
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color-lighter);
  background-color: var(--bg-color);
}

.preview-title {
  font-weight: 600;
  color: var(--text-color-primary);
}

.preview-actions {
  display: flex;
  gap: 8px;
}

.preview-content {
  padding: 24px;
  background-color: var(--bg-color);
  min-height: 100px;
}

.playground-code {
  border-top: 1px solid var(--border-color-lighter);
}

.code-tabs {
  display: flex;
  background-color: var(--fill-color-light);
  border-bottom: 1px solid var(--border-color-lighter);
}

.code-tab {
  padding: 10px 20px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-color-regular);
  transition: all 0.3s;
  
  &:hover {
    color: var(--primary-color);
  }
  
  &.active {
    color: var(--primary-color);
    background-color: var(--bg-color);
    border-bottom: 2px solid var(--primary-color);
  }
}

.code-content {
  pre {
    margin: 0;
    padding: 16px;
    background-color: #f6f8fa;
    overflow-x: auto;
    font-size: 13px;
    line-height: 1.6;
  }
}

.playground-description {
  padding: 12px 16px;
  background-color: var(--fill-color-light);
  border-top: 1px solid var(--border-color-lighter);
}
</style>
