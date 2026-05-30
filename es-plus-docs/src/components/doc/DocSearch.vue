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
          {{ t('search.noResults') }}
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
              <span class="result-category" :class="`cat-${result.category}`">{{ result.category }}</span>
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

const { t } = useI18n()

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

interface SearchEntry {
  title: string
  path: string
  category: string
  content: string
  level: number
}

// Build search index from all .md files at build time
const mdModules = import.meta.glob('@/docs/*.md', { as: 'raw', eager: true }) as Record<string, string>

// Match Doc.vue's heading-id slugify logic exactly
const slugify = (text: string) =>
  text.toLowerCase().replace(/[^\w一-龥]+/g, '-').replace(/^-|-$/g, '')

// File-name → category mapping
const FILE_CATEGORY: Record<string, string> = {
  'getting-started': '指南',
  'installation': '指南',
  'usage': '指南',
  'vue2': '指南',
  'mcp-server': '指南',
  'cli': '指南',
  'permission-i18n': '指南',
  'migration': '指南',
  'changelog': '指南',
  'crud-page': '组件',
}

const buildIndex = (): SearchEntry[] => {
  const entries: SearchEntry[] = []
  for (const filePath in mdModules) {
    const raw = mdModules[filePath]
    const fileName = filePath.split('/').pop()?.replace(/\.md$/, '') || ''
    const category = FILE_CATEGORY[fileName] || '文档'
    const routePath = `/guide/${fileName}`

    // Strip code blocks before scanning headings, so ``` ## ``` inside fences doesn't trigger
    const stripped = raw.replace(/```[\s\S]*?```/g, '')
    const lines = stripped.split('\n')

    let pageTitle = fileName
    const headings: { level: number; text: string; lineIdx: number }[] = []
    lines.forEach((line, idx) => {
      const m = /^(#{1,3})\s+(.+?)\s*$/.exec(line)
      if (m) {
        const level = m[1].length
        const text = m[2].replace(/[*_`]/g, '').trim()
        if (level === 1 && pageTitle === fileName) pageTitle = text
        headings.push({ level, text, lineIdx: idx })
      }
    })

    // Build per-heading entries (extract body up to next heading as content)
    headings.forEach((h, i) => {
      const next = headings[i + 1]
      const bodyLines = lines.slice(h.lineIdx + 1, next ? next.lineIdx : h.lineIdx + 20)
      const content = bodyLines
        .join(' ')
        .replace(/[#>*_`|\-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200)

      const path = h.level === 1 ? routePath : `${routePath}#${slugify(h.text)}`
      entries.push({
        title: h.level === 1 ? h.text : `${pageTitle} › ${h.text}`,
        path,
        category,
        content,
        level: h.level,
      })
    })
  }
  return entries
}

const searchData: SearchEntry[] = buildIndex()

const fuse = new Fuse(searchData, {
  keys: [
    { name: 'title', weight: 0.6 },
    { name: 'content', weight: 0.3 },
    { name: 'category', weight: 0.1 },
  ],
  threshold: 0.4,
  ignoreLocation: true,
  minMatchCharLength: 2,
})

const results = computed(() => {
  if (!searchQuery.value) return []
  return fuse.search(searchQuery.value).slice(0, 30).map(r => r.item)
})

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
})

const handleOpen = () => {
  searchQuery.value = ''
  selectedIndex.value = 0
  recentQueries.value = loadRecent()
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

    &.cat-组件 {
      background-color: rgba(103, 194, 58, 0.12);
      color: var(--success-color, #67c23a);
    }

    &.cat-文档 {
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

:deep(.el-dialog__header) {
  display: none;
}

:deep(.el-dialog__body) {
  padding: 0;
}
</style>
