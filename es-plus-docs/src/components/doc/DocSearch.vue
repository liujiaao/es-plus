<template>
  <el-dialog
    v-model="dialogVisible"
    :show-close="false"
    width="600px"
    class="doc-search-dialog"
    @open="handleOpen"
  >
    <div class="search-container">
      <div class="search-input-wrapper">
        <el-icon class="search-icon"><Search /></el-icon>
        <input
          ref="searchInputRef"
          v-model="searchQuery"
          type="text"
          class="search-input"
          :placeholder="t('search.placeholder')"
          @keydown.up.prevent="moveSelection(-1)"
          @keydown.down.prevent="moveSelection(1)"
          @keydown.enter.prevent="confirmSelection"
        />
        <div class="search-shortcut">ESC</div>
      </div>

      <div class="search-results" v-if="searchQuery">
        <div v-if="results.length === 0" class="no-results">
          <p>{{ t('search.noResults') }}</p>
          <!-- 空结果也给出下一步：空态的建议词在这里同样可点，不让用户对着「没找到」发呆 -->
          <div class="quick-links suggest-links">
            <button
              v-for="s in suggestions"
              :key="s"
              type="button"
              class="suggestion-chip"
              @click="searchQuery = s"
            >
              {{ s }}
            </button>
          </div>
        </div>
        <div v-else class="results-list" ref="resultsListRef">
          <div
            v-for="(result, index) in results"
            :key="index"
            class="result-item"
            :class="{ 'is-selected': index === selectedIndex }"
            @click="handleSelect(result)"
            @mouseenter="selectedIndex = index"
          >
            <div class="result-row">
              <span class="result-category" :class="`cat-${result.category}`">{{ categoryLabel(result.category) }}</span>
              <span class="result-title" v-html="highlight(result.title)" />
            </div>
            <div v-if="result.content" class="result-snippet" v-html="highlight(result.content)" />
            <div class="result-path">{{ result.path }}</div>
          </div>
        </div>
      </div>

      <div class="search-tips" v-else>
        <template v-if="recentQueries.length">
          <div class="tips-title">
            <span>{{ t('search.recent') }}</span>
            <button class="clear-recent-btn" @click="clearRecent">{{ t('search.clear') }}</button>
          </div>
          <div class="recent-list">
            <div
              v-for="(q, i) in recentQueries"
              :key="i"
              class="recent-item"
              @click="searchQuery = q"
            >
              <el-icon><Search /></el-icon>
              <span>{{ q }}</span>
            </div>
          </div>
        </template>
        <div class="tips-title">{{ t('search.quickLinks') }}</div>
        <div class="quick-links">
          <div class="quick-link" @click="navigateTo('/guide/getting-started')">
            <el-icon><Document /></el-icon>
            <span>{{ t('search.quickGettingStarted') }}</span>
          </div>
          <div class="quick-link" @click="navigateTo('/components/es-form')">
            <el-icon><Edit /></el-icon>
            <span>{{ t('search.quickEsForm') }}</span>
          </div>
          <div class="quick-link" @click="navigateTo('/components/es-table')">
            <el-icon><Grid /></el-icon>
            <span>{{ t('search.quickEsTable') }}</span>
          </div>
          <div class="quick-link" @click="navigateTo('/advanced/use-dialog')">
            <el-icon><ChatDotRound /></el-icon>
            <span>{{ t('search.quickUseDialog') }}</span>
          </div>
          <div class="quick-link" @click="navigateTo('/cases')">
            <el-icon><Files /></el-icon>
            <span>{{ t('search.quickCases') }}</span>
          </div>
          <div class="quick-link" @click="navigateTo('/ai-crud')">
            <el-icon><MagicStick /></el-icon>
            <span>{{ t('search.quickAiCrud') }}</span>
          </div>
          <div class="quick-link" @click="navigateTo('/playground')">
            <el-icon><Cpu /></el-icon>
            <span>{{ t('search.quickPlayground') }}</span>
          </div>
        </div>
        <div class="tips-title">{{ t('search.trySearch') }}</div>
        <div class="quick-links suggest-links">
          <button
            v-for="s in suggestions"
            :key="s"
            type="button"
            class="suggestion-chip"
            @click="searchQuery = s"
          >
            {{ s }}
          </button>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Fuse from 'fuse.js'
import {
  buildCaseEntries,
  buildExampleEntries,
  buildFixedEntries,
  buildGuideEntries,
  type SearchCategory,
  type SearchEntry,
} from '@/utils/search-index'

const { t, tm, locale } = useI18n()

const RECENT_KEY = 'es-plus-doc-recent-search'
const RECENT_MAX = 5

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const router = useRouter()

const searchQuery = ref('')
const searchInputRef = ref<HTMLInputElement>()
const resultsListRef = ref<HTMLElement>()
const selectedIndex = ref(0)

const loadRecent = (): string[] => {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    return raw ? (JSON.parse(raw) as string[]).slice(0, RECENT_MAX) : []
  } catch {
    return []
  }
}
const recentQueries = ref<string[]>(loadRecent())

const persistRecent = (q: string) => {
  const trimmed = q.trim()
  if (!trimmed) return
  const next = [trimmed, ...recentQueries.value.filter((r) => r !== trimmed)].slice(0, RECENT_MAX)
  recentQueries.value = next
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {}
}

const clearRecent = () => {
  recentQueries.value = []
  try {
    localStorage.removeItem(RECENT_KEY)
  } catch {}
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const highlight = (text: string) => {
  const q = searchQuery.value.trim()
  if (!q) return escapeHtml(text)
  const parts = q.split(/\s+/).filter(Boolean).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (parts.length === 0) return escapeHtml(text)
  const pattern = new RegExp(`(${parts.join('|')})`, 'gi')
  return escapeHtml(text).replace(pattern, '<mark>$1</mark>')
}

// 索引口径见 utils/search-index.ts。这里只做三件事：装载、按需补组件/高级页、交互。
// 组件 / 高级页的 `.data.ts` 把 103 个示例 SFC 原文（约 680KB）eager 打进模块，
// 不能进首屏包 —— 用户第一次打开搜索时再 import，之后走浏览器缓存。
const baseEntries = ref<SearchEntry[]>([])
const exampleEntries = ref<SearchEntry[]>([])
let exampleLoading: Promise<void> | null = null

const rebuildBase = () => {
  const isEn = locale.value === 'en-US'
  baseEntries.value = [
    ...buildGuideEntries(isEn),
    ...buildFixedEntries(),
    // 案例目录只有中文正文：英文站不索引，免得搜出「摘要与查询语言无关」的噪音
    ...(isEn ? [] : buildCaseEntries()),
  ]
}
rebuildBase()
// 语言切换后重建索引，否则英文站搜到的仍是中文正文
watch(locale, rebuildBase)

const ensureExampleIndex = () => {
  if (exampleEntries.value.length || exampleLoading) return
  exampleLoading = (async () => {
    try {
      const [{ docsData: componentDocs }, { docsData: advancedDocs }] = await Promise.all([
        import('@/views/component-doc.data'),
        import('@/views/advanced-doc.data'),
      ])
      exampleEntries.value = [
        ...buildExampleEntries(componentDocs, '/components', 'component'),
        ...buildExampleEntries(advancedDocs, '/advanced', 'advanced'),
      ]
    } catch (e) {
      // 索引加载失败不该让搜索不可用：指南/案例/固定页仍在
      console.warn('[DocSearch] 组件索引加载失败', e)
    }
  })()
}

const searchData = computed(() => [...baseEntries.value, ...exampleEntries.value])

/** 空态建议词：中英各一份，写在 locale 里，改文案不用改组件 */
const suggestions = computed<string[]>(() => {
  const list = tm('search.suggestions')
  return Array.isArray(list) ? (list as string[]) : []
})

const categoryLabel = (category: SearchCategory) => t(`search.cat.${category}`)

const fuse = computed(() => new Fuse(searchData.value, {
  keys: [
    { name: 'title', weight: 0.6 },
    { name: 'content', weight: 0.3 },
    // 路径参与检索：「mcp」「es-form」这类词直接落在 URL 里；
    // 分类用本地化文案而不是内部 key（搜「组件」要命中，搜 component 也要命中）
    { name: 'path', weight: 0.05 },
    { name: 'category', weight: 0.05, getFn: (item: SearchEntry) => categoryLabel(item.category) },
  ],
  threshold: 0.4,
  ignoreLocation: true,
  minMatchCharLength: 2,
}))

const results = computed(() => {
  if (!searchQuery.value) return []
  return fuse.value.search(searchQuery.value).slice(0, 30).map(r => r.item)
})

// 一边打字一边把组件索引补上：首次打开时 lazy chunk 还没回来，
// 用户往往直接输入关键词，不能等他关掉重开才搜得到组件。
watch(searchQuery, (q) => {
  if (q) ensureExampleIndex()
})

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
})

const handleOpen = () => {
  searchQuery.value = ''
  selectedIndex.value = 0
  recentQueries.value = loadRecent()
  // 打开即预取组件/高级索引（用户此时还没打字，数据在路上，输入时基本已就绪）
  ensureExampleIndex()
  setTimeout(() => {
    searchInputRef.value?.focus()
  }, 100)
}

const moveSelection = (delta: number) => {
  if (results.value.length === 0) return
  const len = results.value.length
  selectedIndex.value = (selectedIndex.value + delta + len) % len
  nextTick(() => {
    const el = resultsListRef.value?.children[selectedIndex.value] as HTMLElement | undefined
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' })
    }
  })
}

const confirmSelection = () => {
  const result = results.value[selectedIndex.value]
  if (!result) return
  handleSelect(result)
}

const handleSelect = (result: SearchEntry) => {
  persistRecent(searchQuery.value)
  router.push(result.path)
  dialogVisible.value = false
}

const navigateTo = (path: string) => {
  router.push(path)
  dialogVisible.value = false
}

watch(searchQuery, () => {
  selectedIndex.value = 0
})
</script>

<style lang="scss" scoped>
.search-container {
  padding: 8px 0;
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background-color: var(--fill-color);
  border-radius: 8px;
  gap: 12px;

  .search-icon {
    font-size: 20px;
    color: var(--text-color-secondary);
  }

  .search-input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-size: 16px;
    color: var(--text-color-primary);

    &::placeholder {
      color: var(--text-color-secondary);
    }
  }

  .search-shortcut {
    padding: 4px 8px;
    font-size: 12px;
    color: var(--text-color-secondary);
    background-color: var(--bg-color);
    border-radius: 4px;
    border: 1px solid var(--border-color-lighter);
  }
}

.search-results {
  margin-top: 16px;
  max-height: 400px;
  overflow-y: auto;
}

.no-results {
  padding: 24px;
  text-align: center;
  color: var(--text-color-secondary);
}

.results-list {
  display: flex;
  flex-direction: column;
}

.result-item {
  padding: 12px 16px;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--fill-color-light);
  }

  &.is-selected {
    background-color: var(--primary-color-light, rgba(64, 158, 255, 0.12));
    box-shadow: inset 2px 0 0 var(--primary-color);
  }

  :deep(mark) {
    background: rgba(255, 215, 0, 0.4);
    color: inherit;
    padding: 0 2px;
    border-radius: 2px;
  }

  .result-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .result-category {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    background-color: var(--primary-color-light);
    color: var(--primary-color);
    flex-shrink: 0;

    // 分类色按「内容层级」分组：文档类用中性色，组件/高级用品牌绿，案例/AI 用紫色系
    &.cat-component,
    &.cat-advanced {
      background-color: rgba(103, 194, 58, 0.12);
      color: var(--success-color, var(--es-success));
    }

    &.cat-case {
      background-color: rgba(230, 162, 60, 0.14);
      color: #b88230;
    }

    &.cat-ai {
      background-color: rgba(111, 66, 193, 0.12);
      color: #6f42c1;
    }

    &.cat-tool {
      background-color: rgba(144, 147, 153, 0.16);
      color: var(--text-color-secondary);
    }
  }

  .result-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-color-primary);
  }

  .result-snippet {
    font-size: 12px;
    color: var(--text-color-regular);
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    line-height: 1.5;
  }

  .result-path {
    font-size: 11px;
    color: var(--text-color-secondary);
    font-family: 'SFMono-Regular', Consolas, monospace;
  }
}

.search-tips {
  margin-top: 16px;

  .tips-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    font-size: 12px;
    color: var(--text-color-secondary);
  }
}

.clear-recent-btn {
  background: none;
  border: none;
  font-size: 12px;
  color: var(--primary-color);
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background-color 0.15s;

  &:hover {
    background-color: var(--fill-color-light);
  }
}

.recent-list {
  display: flex;
  flex-direction: column;
  padding: 0 8px 8px;
}

.recent-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text-color-regular);
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s;

  &:hover {
    background-color: var(--fill-color-light);
    color: var(--primary-color);
  }

  .el-icon {
    font-size: 14px;
    color: var(--text-color-secondary);
  }
}

.quick-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 16px;
}

.quick-link {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background-color: var(--fill-color);
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-color-regular);
  transition: all 0.2s;

  &:hover {
    background-color: var(--fill-color-light);
    color: var(--primary-color);
  }
}

/* 建议词：点一下就把词填进输入框，比「自己再想一个关键词」省一步 */
.suggest-links {
  margin-top: 8px;
}

.suggestion-chip {
  padding: 6px 12px;
  border: 1px dashed var(--border-color-lighter);
  border-radius: 14px;
  background: transparent;
  color: var(--primary-color);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-style: solid;
    border-color: var(--primary-color);
    background-color: var(--fill-color-light);
  }
}

:deep(.el-dialog__header) {
  display: none;
}

:deep(.el-dialog__body) {
  padding: 0;
}
</style>

<!-- 全局：el-dialog teleport 到 body，scoped 选择器够不到。600px 固定宽在 390px
     视口下左侧被裁掉（搜索框图标与首字看不见），按视口收窄。 -->
<style>
.doc-search-dialog {
  max-width: calc(100vw - 24px);
}
</style>
