<template>
  <div class="es-search">
    <!-- 顶栏入口：与 es-pc / 主站同一形状（放大镜 + 文案 + Ctrl K） -->
    <button
      ref="trigger"
      type="button"
      class="es-search-trigger"
      aria-label="搜索文档"
      data-track="search-open"
      @click="open"
    >
      <i class="el-icon-search"></i>
      <span class="es-search-trigger-text">搜索文档</span>
      <kbd>Ctrl K</kbd>
    </button>

    <div v-if="visible" class="es-search-overlay" @click.self="close">
      <div class="es-search-panel" role="dialog" aria-modal="true" aria-label="站内搜索">
        <input
          ref="input"
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
  </div>
</template>

<script>
/**
 * 站内搜索（审计 P1-4：三站 header 都要有搜索；Vue 2 端）。
 *
 * 与 es-pc 的 DocSearch 同构：词表来自路由表 meta.title（新增页面自动可搜），
 * 面板样式来自 docs/theme/docs-chrome.css（三站共用，禁止在这里写第二套外观）。
 * 口径是**页面检索**，不是全文检索 —— 全文索引属于共享 chrome 的后续批次。
 *
 * Vue 2 端没有 Teleport：本组件挂在 <header> 内，而元素用的是 position: fixed，
 * 只要祖先没有 transform / filter / backdrop-filter 就不会被裁切。es-eui 的
 * .header 是 position: sticky + 阴影，不含这些属性，所以无需手动搬节点。
 */
function joinPath(base, path) {
  if (!path) return base || '/'
  if (path.startsWith('/')) return path
  if (!base || base === '/') return `/${path}`
  return `${base.replace(/\/$/, '')}/${path}`
}

function collect(routes, base = '') {
  const out = []
  for (const r of routes || []) {
    const path = joinPath(base, r.path)
    if (r.meta && r.meta.title && !path.includes(':') && !path.includes('*')) {
      out.push({ title: r.meta.title, path })
    }
    if (r.children) out.push(...collect(r.children, path))
  }
  return out
}

export default {
  name: 'DocSearch',
  data() {
    return { visible: false, query: '', active: 0, entries: [] }
  },
  computed: {
    results() {
      const q = this.query.trim().toLowerCase()
      if (!q) return this.entries.slice(0, 8)
      const rank = (e) => {
        const t = e.title.toLowerCase()
        if (t.indexOf(q) === 0) return 0
        if (t.indexOf(q) > -1) return 1
        if (e.path.toLowerCase().indexOf(q) > -1) return 2
        return -1
      }
      return this.entries
        .map((e) => ({ e, r: rank(e) }))
        .filter((x) => x.r >= 0)
        .sort((a, b) => a.r - b.r)
        .slice(0, 8)
        .map((x) => x.e)
    },
  },
  watch: {
    query() {
      this.active = 0
    },
  },
  created() {
    // 去重：同一路径可能被父子两层同时登记（父层有 title 时）
    const seen = {}
    this.entries = collect(this.$router.options.routes).filter((e) => {
      if (seen[e.path]) return false
      seen[e.path] = true
      return true
    })
  },
  mounted() {
    window.addEventListener('keydown', this.onGlobalKeydown)
  },
  beforeDestroy() {
    window.removeEventListener('keydown', this.onGlobalKeydown)
    document.body.style.overflow = ''
  },
  methods: {
    open() {
      this.visible = true
      this.query = ''
      this.active = 0
      document.body.style.overflow = 'hidden'
      this.$nextTick(() => {
        if (this.$refs.input) this.$refs.input.focus()
      })
    },
    close() {
      this.visible = false
      document.body.style.overflow = ''
      if (this.$refs.trigger) this.$refs.trigger.focus()
    },
    go(entry) {
      if (!entry) return
      this.close()
      if (this.$route.path !== entry.path) this.$router.push(entry.path)
    },
    onKeydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        this.close()
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        if (this.results.length) this.active = (this.active + 1) % this.results.length
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        if (this.results.length) this.active = (this.active - 1 + this.results.length) % this.results.length
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        this.go(this.results[this.active])
      }
    },
    onGlobalKeydown(event) {
      const tag = event.target && event.target.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA'
      if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 'k' && !typing) {
        event.preventDefault()
        if (this.visible) this.close()
        else this.open()
      }
    },
  },
}
</script>
