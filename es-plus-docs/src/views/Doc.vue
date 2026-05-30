<template>
  <div class="doc-page">
    <div class="doc-main">
      <!-- 面包屑 -->
      <div class="doc-breadcrumb">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item :to="{ path: '/' }">{{ t('breadcrumb.home') }}</el-breadcrumb-item>
          <el-breadcrumb-item>{{ currentCategory }}</el-breadcrumb-item>
          <el-breadcrumb-item>{{ currentTitle }}</el-breadcrumb-item>
        </el-breadcrumb>
      </div>
      
      <!-- 文档内容 -->
      <article class="doc-content">
        <!-- <h1 class="doc-title">{{ currentDoc.title }}</h1> -->
        <div class="markdown-content" v-html="renderedContent"></div>
      </article>
      
      <!-- 底部导航 -->
      <div class="doc-footer-nav">
        <router-link v-if="prevDoc" :to="prevDoc.path" class="footer-nav prev">
          <span class="nav-label">{{ t('content.previous') }}</span>
          <span class="nav-title">{{ prevDoc.title }}</span>
        </router-link>
        <div v-else></div>
        <router-link v-if="nextDoc" :to="nextDoc.path" class="footer-nav next">
          <span class="nav-label">{{ t('content.next') }}</span>
          <span class="nav-title">{{ nextDoc.title }}</span>
        </router-link>
      </div>
    </div>
    
    <!-- 右侧目录 -->
    <aside class="doc-aside">
      <div class="aside-title">{{ t('componentDoc.toc') }}</div>
      <div class="aside-toc">
        <a
          v-for="heading in toc"
          :key="heading.id"
          :href="`#${heading.id}`"
          class="toc-link"
          @click.prevent="scrollToHeading(heading.id)"
        >
          {{ heading.text }}
        </a>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick, createApp, type App } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import DemoBlock from '@/components/doc/DemoBlock.vue'
import { installAppPlugins } from '@/utils/install-app-plugins'

// Raw markdown imports — eliminates template-string escaping issues
import gettingStartedMd from '@/docs/getting-started.md?raw'
import installationMd from '@/docs/installation.md?raw'
import usageMd from '@/docs/usage.md?raw'
import vue2Md from '@/docs/vue2.md?raw'
import mcpServerMd from '@/docs/mcp-server.md?raw'
import cliMd from '@/docs/cli.md?raw'
import permissionI18nMd from '@/docs/permission-i18n.md?raw'
import migrationMd from '@/docs/migration.md?raw'
import changelogMd from '@/docs/changelog.md?raw'
import schemaSetupMd from '@/docs/schema-setup.md?raw'
import whyEsPlusMd from '@/docs/why-es-plus.md?raw'
// English variants (only translated anchor docs exist)
import gettingStartedEnMd from '@/docs/getting-started.en.md?raw'
import mcpServerEnMd from '@/docs/mcp-server.en.md?raw'
import vue2EnMd from '@/docs/vue2.en.md?raw'
import whyEsPlusEnMd from '@/docs/why-es-plus.en.md?raw'
import { useHead } from '@unhead/vue'

const route = useRoute()

hljs.configure({ ignoreUnescapedHTML: true })

const escapeAttr = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const wrapCode = (highlighted: string, lang: string, raw: string) => {
  const langLabel = lang || 'text'
  const rawAttr = escapeAttr(raw)
  return `<div class="code-block-wrapper">
    <div class="code-block-header">
      <span class="code-block-lang">${langLabel}</span>
      <button class="code-copy-btn" type="button" data-code="${rawAttr}" aria-label="复制代码">
        <span class="copy-icon"></span>
        <span class="copy-text">复制</span>
      </button>
    </div>
    <pre class="hljs"><code>${highlighted}</code></pre>
  </div>`
}

// 初始化 markdown-it
const md: MarkdownIt = new MarkdownIt({
  html: true,
  linkify: false,
  typographer: true,
  highlight: (str: string, lang: string): string => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        const out = hljs.highlight(str, { language: lang }).value
        return wrapCode(out, lang, str)
      } catch {}
    }
    return wrapCode(md.utils.escapeHtml(str), lang, str)
  }
})

// 文档数据 — content is sourced from .md files via ?raw imports
type DocEntry = { title: string; content: string; titleEn?: string; contentEn?: string }
const docsData: Record<string, DocEntry> = {
  'why-es-plus': { title: '为什么是 ES-Plus', content: whyEsPlusMd, titleEn: 'Why ES-Plus', contentEn: whyEsPlusEnMd },
  'getting-started': { title: '快速开始', content: gettingStartedMd, titleEn: 'Getting Started', contentEn: gettingStartedEnMd },
  'installation': { title: '安装', content: installationMd },
  'usage': { title: '使用', content: usageMd },
  'vue2': { title: 'Vue 2 指南', content: vue2Md, titleEn: 'Vue 2 Guide', contentEn: vue2EnMd },
  'mcp-server': { title: 'MCP Server', content: mcpServerMd, titleEn: 'MCP Server', contentEn: mcpServerEnMd },
  'cli': { title: 'CLI 工具', content: cliMd },
  'permission-i18n': { title: '权限与国际化', content: permissionI18nMd },
  'schema-setup': { title: 'IDE 配置自动补全', content: schemaSetupMd },
  'migration': { title: '迁移指南', content: migrationMd },
  'changelog': { title: '更新日志', content: changelogMd }
}

const { t, locale } = useI18n()

const currentDoc = computed(() => {
  const name = route.params.name as string
  const entry = docsData[name]
  if (!entry) return { title: '未找到', content: '# 页面未找到', isFallback: false }
  if (locale.value === 'en-US') {
    if (entry.contentEn) {
      return { title: entry.titleEn || entry.title, content: entry.contentEn, isFallback: false }
    }
    // Fallback to Chinese with banner
    const banner = `> ${t('doc.untranslatedNotice')} [GitHub](https://github.com/liujiaao/es-plus)\n\n`
    return { title: entry.title, content: banner + entry.content, isFallback: true }
  }
  return { title: entry.title, content: entry.content, isFallback: false }
})

const currentTitle = computed(() => currentDoc.value.title)

useHead({
  title: () => currentDoc.value.title,
  meta: [
    { name: 'description', content: () => `${currentDoc.value.title} - ES-Plus 文档` },
    { property: 'og:title', content: () => `${currentDoc.value.title} · ES-Plus` },
    { property: 'og:description', content: () => `${currentDoc.value.title} - ES-Plus Vue 3 高级 CRUD 组件库文档` },
  ],
})

const currentCategory = computed(() => {
  const path = route.path
  if (path.includes('/guide/')) return t('breadcrumb.guide')
  if (path.includes('/components/')) return t('breadcrumb.components')
  if (path.includes('/advanced/')) return t('breadcrumb.advanced')
  return ''
})

const renderedContent = computed(() => {
  // Pre-process: convert <demo name="..." /> (and </demo> form) to placeholder divs
  // so markdown-it passes them through cleanly and we can mount components on them later.
  const preprocessed = currentDoc.value.content
    .replace(/<demo\s+name="([^"]+)"\s*\/>/g, '\n<div class="demo-block-placeholder" data-demo-name="$1"></div>\n')
    .replace(/<demo\s+name="([^"]+)"\s*>\s*<\/demo>/g, '\n<div class="demo-block-placeholder" data-demo-name="$1"></div>\n')

  const html = md.render(preprocessed)
  // Add IDs to headings for TOC linking
  return html.replace(/<h([23])>(.*?)<\/h[23]>/g, (_match, level, content) => {
    const text = content.replace(/<[^>]+>/g, '').trim()
    const id = text.toLowerCase().replace(/[^\w一-龥]+/g, '-').replace(/^-|-$/g, '')
    return `<h${level} id="${id}">${content}</h${level}>`
  })
})

const toc = ref<{ id: string; text: string }[]>([])

const extractToc = () => {
  nextTick(() => {
    const headings = document.querySelectorAll('.doc-content h2, .doc-content h3')
    toc.value = Array.from(headings).map((h) => ({
      id: h.id,
      text: h.textContent || ''
    })).filter(h => h.id && h.text)
  })
}

watch(renderedContent, extractToc, { immediate: true })

type DocNav = { path: string; title: string } | null
const prevDoc = ref<DocNav>(null)
const nextDoc = ref<DocNav>(null)

const scrollToHeading = (id) => {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth' })
}

const navTitleFor = (key: string): string => {
  const entry = docsData[key]
  if (!entry) return ''
  return locale.value === 'en-US' ? (entry.titleEn || entry.title) : entry.title
}

const updateNav = () => {
  const name = route.params.name as string
  const keys = Object.keys(docsData)
  const idx = keys.indexOf(name)
  prevDoc.value = idx > 0 ? { path: `/guide/${keys[idx-1]}`, title: navTitleFor(keys[idx-1]) } : null
  nextDoc.value = idx < keys.length - 1 ? { path: `/guide/${keys[idx+1]}`, title: navTitleFor(keys[idx+1]) } : null
}

watch(() => route.params.name, updateNav, { immediate: true })
watch(locale, updateNav)

const copyCode = async (btn: HTMLButtonElement) => {
  const code = btn.getAttribute('data-code') || ''
  const decoded = code
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
  try {
    await navigator.clipboard.writeText(decoded)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = decoded
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
  const text = btn.querySelector('.copy-text')
  if (text) {
    const original = text.textContent
    text.textContent = '已复制'
    btn.classList.add('copied')
    setTimeout(() => {
      text.textContent = original
      btn.classList.remove('copied')
    }, 1500)
  }
}

const handleContentClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  const btn = target.closest('.code-copy-btn') as HTMLButtonElement | null
  if (btn) {
    e.preventDefault()
    copyCode(btn)
  }
}

// Track mounted demo apps so we can unmount them when the doc changes or component unmounts
const mountedDemoApps: App[] = []

const unmountDemos = () => {
  mountedDemoApps.forEach((app) => {
    try { app.unmount() } catch {}
  })
  mountedDemoApps.length = 0
}

const mountDemos = () => {
  const placeholders = document.querySelectorAll<HTMLElement>('.demo-block-placeholder')
  placeholders.forEach((el) => {
    const name = el.dataset.demoName
    if (!name) return
    // Avoid double-mounting the same placeholder
    if (el.dataset.demoMounted === '1') return
    el.dataset.demoMounted = '1'
    const app = createApp(DemoBlock, { name })
    installAppPlugins(app)
    app.mount(el)
    mountedDemoApps.push(app)
  })
}

watch(renderedContent, () => {
  unmountDemos()
  nextTick(() => mountDemos())
}, { flush: 'post' })

onMounted(() => {
  setTimeout(() => {
    document.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block as HTMLElement)
    })
  }, 100)
  const content = document.querySelector('.markdown-content') as HTMLElement | null
  content?.addEventListener('click', handleContentClick)
  nextTick(() => mountDemos())
})

onBeforeUnmount(() => {
  unmountDemos()
})
</script>

<style lang="scss" scoped>
.doc-page {
  display: flex;
  padding: 24px 0;
  max-width: 1400px;
  margin: 0 auto;
}

.doc-main {
  flex: 1;
  min-width: 0;
  padding-right: 24px;
}

.doc-breadcrumb {
  padding: 0 24px 16px;
}

.doc-title {
  padding: 0 24px 24px;
  font-size: 32px;
  font-weight: 600;
  color: var(--text-color-primary);
}

.doc-content {
  padding: 0 24px;
  min-height: 400px;
}

.doc-footer-nav {
  display: flex;
  justify-content: space-between;
  padding: 24px;
  margin-top: 48px;
  border-top: 1px solid var(--border-color-lighter);
}

.footer-nav {
  display: flex;
  flex-direction: column;
  text-decoration: none;
  padding: 12px 16px;
  border-radius: 8px;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: var(--fill-color-light);
  }
  
  .nav-label {
    font-size: 12px;
    color: var(--text-color-secondary);
    margin-bottom: 4px;
  }
  
  .nav-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--primary-color);
  }
  
  &.next {
    text-align: right;
  }
}

.doc-aside {
  width: 240px;
  flex-shrink: 0;
  position: sticky;
  top: 84px;
  height: fit-content;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
}

.aside-title {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-color-secondary);
  text-transform: uppercase;
}

.aside-toc {
  padding: 8px 0;
}

.toc-link {
  display: block;
  padding: 6px 12px;
  font-size: 13px;
  color: var(--text-color-regular);
  text-decoration: none;
  border-left: 2px solid transparent;
  transition: all 0.2s;
  
  &:hover {
    color: var(--primary-color);
    border-left-color: var(--primary-color);
  }
}

@media (max-width: 1200px) {
  .doc-aside {
    display: none;
  }
}
</style>
