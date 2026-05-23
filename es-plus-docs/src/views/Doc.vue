<template>
  <div class="doc-page">
    <div class="doc-main">
      <!-- 面包屑 -->
      <div class="doc-breadcrumb">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
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
          <span class="nav-label">上一页</span>
          <span class="nav-title">{{ prevDoc.title }}</span>
        </router-link>
        <div v-else></div>
        <router-link v-if="nextDoc" :to="nextDoc.path" class="footer-nav next">
          <span class="nav-label">下一页</span>
          <span class="nav-title">{{ nextDoc.title }}</span>
        </router-link>
      </div>
    </div>
    
    <!-- 右侧目录 -->
    <aside class="doc-aside">
      <div class="aside-title">本页目录</div>
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
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'

// Raw markdown imports — eliminates template-string escaping issues
import gettingStartedMd from '@/docs/getting-started.md?raw'
import installationMd from '@/docs/installation.md?raw'
import usageMd from '@/docs/usage.md?raw'
import mcpServerMd from '@/docs/mcp-server.md?raw'
import cliMd from '@/docs/cli.md?raw'
import permissionI18nMd from '@/docs/permission-i18n.md?raw'
import migrationMd from '@/docs/migration.md?raw'

const route = useRoute()

hljs.configure({ ignoreUnescapedHTML: true })

// 初始化 markdown-it
const md = new MarkdownIt({
  html: true,
  linkify: false,
  typographer: true,
  highlight: (str, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang }).value}</code></pre>`
      } catch {}
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`
  }
})

// 文档数据 — content is sourced from .md files via ?raw imports
const docsData = {
  'getting-started': { title: '快速开始', content: gettingStartedMd },
  'installation': { title: '安装', content: installationMd },
  'usage': { title: '使用', content: usageMd },
  'mcp-server': { title: 'MCP Server', content: mcpServerMd },
  'cli': { title: 'CLI 工具', content: cliMd },
  'permission-i18n': { title: '权限与国际化', content: permissionI18nMd },
  'migration': { title: '迁移指南', content: migrationMd }
}

const currentDoc = computed(() => {
  const name = route.params.name
  return docsData[name] || { title: '未找到', content: '# 页面未找到' }
})

const currentTitle = computed(() => currentDoc.value.title)

const currentCategory = computed(() => {
  const path = route.path
  if (path.includes('/guide/')) return '指南'
  if (path.includes('/components/')) return '组件'
  if (path.includes('/advanced/')) return '高级'
  return ''
})

const renderedContent = computed(() => {
  const html = md.render(currentDoc.value.content)
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

const prevDoc = ref(null)
const nextDoc = ref(null)

const scrollToHeading = (id) => {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth' })
}

watch(() => route.params.name, (name) => {
  const keys = Object.keys(docsData)
  const idx = keys.indexOf(name)
  prevDoc.value = idx > 0 ? { path: `/guide/${keys[idx-1]}`, title: docsData[keys[idx-1]].title } : null
  nextDoc.value = idx < keys.length - 1 ? { path: `/guide/${keys[idx+1]}`, title: docsData[keys[idx+1]].title } : null
}, { immediate: true })

onMounted(() => {
  setTimeout(() => {
    document.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block)
    })
  }, 100)
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
