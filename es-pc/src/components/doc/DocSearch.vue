<template>
  <!-- 顶栏入口：形状与三站一致（放大镜 + 文案 + ⌘K），窄屏只留图标 -->
  <button
    ref="triggerEl"
    type="button"
    class="es-search-trigger"
    aria-label="搜索文档"
    data-track="search-open"
    @click="open"
  >
    <SearchOutlined />
    <span class="es-search-trigger-text">搜索文档</span>
    <kbd>Ctrl K</kbd>
  </button>

  <!-- 面板挂到 body：顶栏有 backdrop-filter / overflow，留在原地会被裁切或
       被 z-index 邻居盖住（主站搜索面板踩过同样的坑）。 -->
  <Teleport to="body">
    <div v-if="visible" class="es-search-overlay" @click.self="close">
      <div class="es-search-panel" role="dialog" aria-modal="true" aria-label="站内搜索">
        <input
          ref="inputEl"
          v-model="query"
          class="es-search-input"
          type="search"
          placeholder="搜索页面标题或路径…"
          aria-label="搜索页面标题或路径"
          autocomplete="off"
          spellcheck="false"
          @keydown="onKeydown"
        />

        <ul v-if="results.length" class="es-search-results" role="listbox" aria-label="搜索结果">
          <li
            v-for="(r, i) in results"
            :key="r.path"
            class="es-search-item"
            :class="{ 'is-active': i === active }"
            role="option"
            :aria-selected="String(i === active)"
            @mousemove="active = i"
            @click="go(r)"
          >
            <span class="es-search-item-title">{{ r.title }}</span>
            <span class="es-search-item-path">{{ r.path }}</span>
          </li>
        </ul>
        <p v-else class="es-search-empty">
          {{ query ? `没有匹配「${query}」的页面` : '输入页面名称开始搜索' }}
        </p>

        <div class="es-search-foot" aria-hidden="true">
          <span><kbd>↑</kbd> <kbd>↓</kbd> 选择</span>
          <span><kbd>Enter</kbd> 打开</span>
          <span><kbd>Esc</kbd> 关闭</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * 站内搜索（审计 P1-4：三站 header 都要有搜索）。
 *
 * 词表直接取自路由表的 `meta.title` —— 不另建清单，新增页面自动出现在搜索里。
 * 这是**页面检索**，不是全文检索：全文索引要单建（主站那套 search-index.ts），
 * 属于三站共享 chrome 的后续批次。样式在 docs/theme/docs-chrome.css（两站共用）。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { SearchOutlined } from '@ant-design/icons-vue'

interface Entry {
  title: string
  path: string
}

const router = useRouter()
const visible = ref(false)
const query = ref('')
const active = ref(0)
const inputEl = ref<HTMLInputElement | null>(null)
const triggerEl = ref<HTMLButtonElement | null>(null)

/** 只收「有标题、路径里没有参数」的叶子路由：参数路由（/ai-gallery/:id）
 *  没有 id 无法跳转，收进来点了就是 404。 */
const entries: Entry[] = (() => {
  const seen = new Map<string, Entry>()
  for (const r of router.getRoutes()) {
    const title = (r.meta as Record<string, unknown> | undefined)?.title
    if (typeof title !== 'string' || !title) continue
    if (r.path.includes(':') || r.path.includes('*')) continue
    if (!seen.has(r.path)) seen.set(r.path, { title, path: r.path })
  }
  return [...seen.values()]
})()

const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return entries.slice(0, 8)
  const rank = (e: Entry) => {
    const t = e.title.toLowerCase()
    if (t.startsWith(q)) return 0
    if (t.includes(q)) return 1
    if (e.path.toLowerCase().includes(q)) return 2
    return -1
  }
  return entries
    .map((e) => ({ e, r: rank(e) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r)
    .slice(0, 8)
    .map((x) => x.e)
})

function open() {
  visible.value = true
  query.value = ''
  active.value = 0
  document.body.style.overflow = 'hidden'
  nextTick(() => inputEl.value?.focus())
}

function close() {
  visible.value = false
  document.body.style.overflow = ''
  triggerEl.value?.focus()
}

function go(entry: Entry | undefined) {
  if (!entry) return
  close()
  router.push(entry.path)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    if (results.value.length) active.value = (active.value + 1) % results.value.length
    return
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    if (results.value.length) active.value = (active.value - 1 + results.value.length) % results.value.length
    return
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    go(results.value[active.value])
  }
}

/** Ctrl/⌘+K：与主站同一个手势。输入框内不劫持（浏览器/输入法可能要用）。 */
function onGlobalKeydown(event: KeyboardEvent) {
  const typing = ['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement)?.tagName)
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !typing) {
    event.preventDefault()
    if (visible.value) close()
    else open()
  }
}

onMounted(() => window.addEventListener('keydown', onGlobalKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
  document.body.style.overflow = ''
})
</script>
