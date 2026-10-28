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
        <!-- 标签页是键盘可达的：<button> + role="tab" + 左右方向键切换（路线图 1.7）。
             此前是三个带 @click 的 <div> —— 鼠标能点，键盘永远切不到 Script / Style。 -->
        <div ref="tabList" class="code-tabs" role="tablist" aria-label="代码视图" @keydown="onTabKeydown">
          <button
            v-for="tab in codeTabs"
            :id="`code-tab-${tab.name}`"
            :key="tab.name"
            type="button"
            role="tab"
            class="code-tab"
            :class="{ active: activeTab === tab.name }"
            :aria-selected="String(activeTab === tab.name)"
            :tabindex="activeTab === tab.name ? 0 : -1"
            @click="activeTab = tab.name"
          >
            {{ tab.label }}
          </button>
        </div>
        <div
          ref="codeHost"
          class="code-content"
          role="tabpanel"
          :aria-labelledby="`code-tab-${activeTab}`"
          v-html="activeCodeHtml"
        ></div>
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
// 与文档正文同一个高亮器（只注册用到的语言）—— 不要在这里 import 'highlight.js' 全集
import hljs from '@/utils/highlight.mjs'

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
const tabList = ref<HTMLElement | null>(null)

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

/**
 * 标签页的方向键导航（WAI-ARIA tabs 的标准键盘约定）：
 * 左右切换、Home/End 到首尾，焦点跟着走。Tab 键只在当前标签上停一次。
 */
const onTabKeydown = (event: KeyboardEvent) => {
  const names = codeTabs.value.map((t) => t.name)
  const index = names.indexOf(activeTab.value)
  let next: number | null = null
  if (event.key === 'ArrowRight') next = (index + 1) % names.length
  else if (event.key === 'ArrowLeft') next = (index - 1 + names.length) % names.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = names.length - 1
  if (next === null) return
  event.preventDefault()
  activeTab.value = names[next]
  nextTick(() => {
    tabList.value?.querySelectorAll<HTMLButtonElement>('.code-tab')[next as number]?.focus()
  })
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
  /* 元素从 <div> 换成 <button> 后要清掉浏览器的默认外观，视觉保持原样 */
  border: 0;
  background: transparent;
  font-family: inherit;
  padding: 10px 20px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-color-regular);
  transition: color var(--es-duration-slow) var(--es-ease), background-color var(--es-duration-slow) var(--es-ease), border-color var(--es-duration-slow) var(--es-ease), box-shadow var(--es-duration-slow) var(--es-ease), transform var(--es-duration-slow) var(--es-ease), opacity var(--es-duration-slow) var(--es-ease);
  
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
