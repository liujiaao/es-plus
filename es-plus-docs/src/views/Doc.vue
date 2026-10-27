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
        <div class="markdown-content es-doc-content" v-html="renderedContent"></div>
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
          :class="{ active: activeHeading === heading.id }"
          @click.prevent="scrollToHeading(heading.id)"
        >
          {{ heading.text }}
        </a>
      </div>
    </aside>

    <!-- 回到顶部 -->
    <transition name="back-top-fade">
      <button v-show="showBackTop" class="back-to-top" title="回到顶部" @click="scrollToTop">
        <el-icon :size="18"><Top /></el-icon>
      </button>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick, createApp, type App } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Top } from '@element-plus/icons-vue'
import DemoBlock from '@/components/doc/DemoBlock.vue'
import { installAppPlugins } from '@/utils/install-app-plugins'
import { renderDocMarkdown } from '@/utils/doc-markdown.mjs'

// 指南注册表（Doc.vue 与搜索索引共用的单一来源）
import { docsData } from '@/docs/doc-registry'
import { useHead } from '@unhead/vue'

const route = useRoute()

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
    { property: 'og:description', content: () => `${currentDoc.value.title} - ES-Plus 中后台 CRUD 的配置层（Vue 3 + Element Plus）` },
  ],
})

const currentCategory = computed(() => {
  const path = route.path
  if (path.includes('/guide/')) return t('breadcrumb.guide')
  if (path.includes('/components/')) return t('breadcrumb.components')
  if (path.includes('/advanced/')) return t('breadcrumb.advanced')
  return ''
})

// 渲染流水线（容器 / fence / 标题 id / 站内链接）全部在 utils/doc-markdown.mjs：
// 守卫脚本与站点必须跑同一份实现，否则「渲染后」的缺陷仍然只能靠肉眼发现。
const renderedContent = computed(() => renderDocMarkdown(currentDoc.value.content))

const toc = ref<{ id: string; text: string }[]>([])
const activeHeading = ref('')
const showBackTop = ref(false)

const extractToc = () => {
  nextTick(() => {
    const headings = document.querySelectorAll('.doc-content h2, .doc-content h3')
    toc.value = Array.from(headings).map((h) => ({
      id: h.id,
      text: h.textContent || ''
    })).filter(h => h.id && h.text)
    updateActiveHeading()
  })
}

// scroll-spy：高亮当前阅读章节 + 控制回到顶部按钮
const updateActiveHeading = () => {
  showBackTop.value = window.scrollY > 400
  const headings = Array.from(
    document.querySelectorAll<HTMLElement>('.doc-content h2, .doc-content h3')
  ).filter((h) => h.id)
  if (!headings.length) return
  const offset = 100
  let current = headings[0].id
  for (const h of headings) {
    if (h.getBoundingClientRect().top - offset <= 0) current = h.id
    else break
  }
  activeHeading.value = current
}

watch(renderedContent, extractToc, { immediate: true })

type DocNav = { path: string; title: string } | null
const prevDoc = ref<DocNav>(null)
const nextDoc = ref<DocNav>(null)

const scrollToHeading = (id: string) => {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth' })
}

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// 上/下篇顺序与侧边栏（AppSidebar）分组阅读顺序一致，而非 docsData 对象键序
const NAV_ORDER = [
  'getting-started', 'installation', 'usage', 'why-es-plus',
  'mcp-server', 'cli',
  'vue2', 'adapter-antdv', 'migration', 'permission-i18n', 'schema-setup', 'changelog',
]

const navTitleFor = (key: string): string => {
  const entry = docsData[key]
  if (!entry) return ''
  return locale.value === 'en-US' ? (entry.titleEn || entry.title) : entry.title
}

const updateNav = () => {
  const name = route.params.name as string
  const idx = NAV_ORDER.indexOf(name)
  if (idx < 0) { prevDoc.value = null; nextDoc.value = null; return }
  prevDoc.value = idx > 0 ? { path: `/guide/${NAV_ORDER[idx-1]}`, title: navTitleFor(NAV_ORDER[idx-1]) } : null
  nextDoc.value = idx < NAV_ORDER.length - 1 ? { path: `/guide/${NAV_ORDER[idx+1]}`, title: navTitleFor(NAV_ORDER[idx+1]) } : null
}

watch(() => route.params.name, updateNav, { immediate: true })
watch(locale, updateNav)

const copyCode = async (btn: HTMLButtonElement) => {
  // 原文直接从 DOM 的 <code> 取：高亮只加标签、不改字符，textContent 就是源码。
  // 不再用 data-code 属性存一份副本 —— 属性转义/还原一旦不一致，复制的内容就会坏。
  const code = btn.closest('.code-block-wrapper')?.querySelector('code')?.textContent ?? ''
  try {
    await navigator.clipboard.writeText(code)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = code
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
  // 高亮在 markdown 渲染时一次完成（见 utils/doc-markdown.mjs）。
  // 这里曾经再对 `pre code` 跑一遍 hljs.highlightElement —— 它会把已经注入的
  // 代码块 wrapper 当纯文本转义，正是线上代码块显示 "bash 复制 …" 的原因。
  const content = document.querySelector('.markdown-content') as HTMLElement | null
  content?.addEventListener('click', handleContentClick)
  window.addEventListener('scroll', updateActiveHeading, { passive: true })
  nextTick(() => mountDemos())
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateActiveHeading)
  unmountDemos()
})
</script>

<style lang="scss" scoped>
.doc-page {
  display: flex;
  padding: 24px clamp(16px, 4vw, 48px);
  max-width: 1200px;
  margin: 0 auto;
}

.doc-main {
  flex: 1;
  min-width: 0;
  padding-right: 32px;
}

.doc-breadcrumb {
  max-width: var(--es-content-width);
  padding: 0 0 16px;
}

.doc-title {
  padding: 0 0 24px;
  font-size: 32px;
  font-weight: 600;
  color: var(--text-color-primary);
}

.doc-content {
  max-width: var(--es-content-width);
  min-height: 400px;
}

.doc-footer-nav {
  display: flex;
  justify-content: space-between;
  max-width: var(--es-content-width);
  padding: 24px 0;
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

  &.active {
    color: var(--primary-color);
    border-left-color: var(--primary-color);
    font-weight: 600;
    background: var(--primary-color-light, rgba(59, 130, 246, 0.08));
  }
}

/* 回到顶部 */
.back-to-top {
  position: fixed;
  right: 32px;
  bottom: 40px;
  z-index: 90;
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-color-lighter);
  border-radius: 50%;
  background: var(--bg-color);
  color: var(--text-color-regular);
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  transition: all 0.2s;

  &:hover {
    color: var(--primary-color);
    border-color: var(--primary-color);
    transform: translateY(-2px);
  }
}

.back-top-fade-enter-active,
.back-top-fade-leave-active {
  transition: opacity 0.25s ease;
}

.back-top-fade-enter-from,
.back-top-fade-leave-to {
  opacity: 0;
}

@media (max-width: 992px) {
  .doc-aside {
    display: none;
  }
}
</style>
