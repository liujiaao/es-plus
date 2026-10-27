<template>
  <div class="code-playground">
    <!-- 演示区域 -->
    <div class="playground-preview">
      <div class="preview-header">
        <span class="preview-title">{{ title }}</span>
        <el-tag v-if="level" size="small" :type="LEVEL_TYPES[level]" class="level-tag" effect="plain">
          {{ LEVEL_LABELS[level] }}
        </el-tag>
        <div class="preview-actions">
          <el-button
            link
            :icon="isExpanded ? ArrowUp : ArrowDown"
            @click="toggleExpand"
          >
            {{ isExpanded ? t('codePlayground.collapse') : t('codePlayground.expand') }}
          </el-button>
          <el-button link :icon="CopyDocument" @click="copyCode">
            {{ t('codePlayground.copy') }}
          </el-button>
          <el-button link :icon="Promotion" @click="openInSandbox">
            {{ t('codePlayground.tryOnline') }}
          </el-button>
          <el-button link :icon="Refresh" @click="refreshPreview">
            {{ t('codePlayground.refresh') }}
          </el-button>
        </div>
      </div>
      <div class="preview-content" :class="{ 'is-expanded': isExpanded }">
        <div :key="refreshKey" class="preview-mount">
          <slot name="preview" />
        </div>
      </div>
    </div>

    <!-- 代码区域：结构与 es-pc / es-eui 的示例卡片一致，由 utils/code-block.js 产出 -->
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
        <div ref="codeHost" class="code-content" v-html="activeCodeHtml"></div>
      </div>
    </el-collapse-transition>
    
    <!-- 描述区域 -->
    <div v-if="description" class="playground-description">
      <el-alert :title="description" type="info" :closable="false" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { ArrowUp, ArrowDown, CopyDocument, Refresh, Promotion } from '@element-plus/icons-vue'
import { openInCodeSandbox, prefetchSandboxVendor } from '@/utils/sandbox'
import { enhanceCodeBlocks, renderCodeBlockHtml } from '@/utils/code-block.js'
import hljs from 'highlight.js'

const { t } = useI18n()

const codeHost = ref<HTMLElement | null>(null)

// 代码块的复制 / 折叠行为来自三站共用的 utils/code-block.js：v-html 每次换内容都要重标一遍
const enhanceCode = () => nextTick(() => enhanceCodeBlocks(codeHost.value))

// Warm the unpkg cache for `@es-plus/vue3` dist on mount so the user's click
// on "在线试" does not need to await a fetch (which would risk popup blocking).
onMounted(() => {
  prefetchSandboxVendor()
  enhanceCode()
})

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
  level?: number
}>()

// 案例难度梯度（L1 入门 → L5 复杂）
const LEVEL_LABELS = ['', '入门', '基础', '进阶', '高级', '复杂'] as const
const LEVEL_TYPES = ['', 'success', 'success', 'warning', 'danger', 'danger'] as const

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

/** 三个 tab 的语言标签：模板片段就是 HTML，脚本是 JS，样式是 CSS。 */
const TAB_LANG: Record<string, string> = { template: 'html', script: 'js', style: 'css' }

/** 高亮只负责 `<code>` 内部的内容（外层结构由 code-block.js 产出）。 */
const highlight = (code: string, lang: string): string => {
  if (!code) return ''
  try {
    return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
  } catch {
    return ''
  }
}

/** 当前 tab 的代码块：与 es-pc / es-eui 的示例卡片同一套结构（语言 / 复制 / 行号）。 */
const activeCodeHtml = computed(() => {
  const tab = activeTab.value
  const lang = TAB_LANG[tab] ?? 'text'
  const raw = (displayCode.value as unknown as Record<string, string>)[tab] || ''
  return renderCodeBlockHtml({
    raw,
    highlighted: highlight(raw, lang),
    lang,
    // 外层「展开代码」是这一层的折叠入口，代码块不再叠第二层
    collapsible: false,
  })
})

// `navigator.clipboard` is only available in secure contexts (https / localhost).
// On http://lan-ip dev servers it's undefined, so fall back to legacy execCommand.
const copyToClipboard = async (text: string): Promise<boolean> => {
  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // fall through to fallback
    }
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    ta.style.pointerEvents = 'none'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

const copyCode = async () => {
  let codeToCopy = ''
  if (typeof props.code === 'string') {
    codeToCopy = props.code
  } else {
    codeToCopy = `${props.code.template}\n\n${props.code.script}\n\n${props.code.style}`
  }
  const ok = await copyToClipboard(codeToCopy)
  if (ok) ElMessage.success(t('codePlayground.copied'))
  else ElMessage.error(t('codePlayground.copyFailed'))
}

const refreshPreview = () => {
  refreshKey.value++
}

const openInSandbox = async () => {
  const code = displayCode.value
  if (!code.template && !code.script) {
    ElMessage.warning(t('codePlayground.noSource'))
    return
  }
  try {
    await openInCodeSandbox({
      template: code.template,
      script: code.script,
      style: code.style,
      title: props.title,
    })
  } catch (err) {
    console.error(err)
    ElMessage.error(t('codePlayground.sandboxFailed'))
  }
}

// 高亮在 computed（activeCodeHtml）里随 tab 一次完成；
// 这里不再对 DOM 跑 hljs.highlightElement —— 那会把已渲染的代码块结构当文本转义。
watch(activeCodeHtml, enhanceCode)
</script>

<style lang="scss" scoped>
.code-playground {
  border: 1px solid var(--border-color-lighter);
  border-radius: 8px;
  margin: 16px 0;
  overflow: hidden;
  /* 锚点落点（#demo-xxx）要留出顶部固定栏的高度，否则标题被盖住 */
  scroll-margin-top: 88px;
}

.playground-preview {
  background-color: var(--fill-color-light);
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 8px;
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
  margin-left: auto;
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

/* 代码块的外观来自 docs-content.css（三站共用）；卡片已有圆角与边框，
   代码块再画一圈就成双线 —— 这里只把重复的那一层去掉。 */
.code-content :deep(.code-block-wrapper) {
  margin: 0;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.playground-description {
  padding: 12px 16px;
  background-color: var(--fill-color-light);
  border-top: 1px solid var(--border-color-lighter);
}
</style>
