<template>
  <!-- es-doc-chrome + docs-chrome.css：面包屑 / 右栏目录 / 上下篇 / 收尾条
       的类名与外观由 docs/theme/docs-chrome.css 统一规定，三站同源。 -->
  <div class="doc-page es-doc-chrome">
    <div class="doc-main">
      <!-- 面包屑 -->
      <nav class="es-doc-crumbs" aria-label="面包屑">
        <router-link to="/">{{ t('breadcrumb.home') }}</router-link>
        <span class="es-doc-crumbs-sep">/</span>
        <span>{{ currentCategory }}</span>
        <span class="es-doc-crumbs-sep">/</span>
        <span class="is-current">{{ currentTitle }}</span>
      </nav>

      <!-- 文档内容 -->
      <article class="doc-content">
        <!-- <h1 class="doc-title">{{ currentDoc.title }}</h1> -->
        <div ref="contentRef" class="markdown-content es-doc-content" v-html="renderedContent"></div>
      </article>

      <!-- 底部导航 -->
      <nav v-if="prevDoc || nextDoc" class="es-doc-pager" aria-label="上下篇">
        <router-link v-if="prevDoc" :to="prevDoc.path" class="es-doc-pager-link">
          <span class="es-doc-pager-label">← {{ t('content.previous') }}</span>
          <span class="es-doc-pager-title">{{ prevDoc.title }}</span>
        </router-link>
        <router-link v-if="nextDoc" :to="nextDoc.path" class="es-doc-pager-link is-next">
          <span class="es-doc-pager-label">{{ t('content.next') }} →</span>
          <span class="es-doc-pager-title">{{ nextDoc.title }}</span>
        </router-link>
      </nav>

      <!-- 编辑此页 · 报告问题 · 最后更新 -->
      <DocMeta :source-path="sourcePath" :title="currentTitle" :updated="updated" />
    </div>

    <!-- 右侧目录：<1280px 由 docs-chrome.css 收起 -->
    <aside class="es-doc-toc">
      <div class="es-doc-toc-title">{{ t('componentDoc.toc') }}</div>
      <router-link
        v-for="heading in toc"
        :key="heading.id"
        :to="{ hash: `#${heading.id}` }"
        class="es-doc-toc-link"
        :class="{ 'is-active': activeHeading === heading.id, 'is-sub': heading.level === 3 }"
        @click="onTocClick(heading.id)"
      >
        {{ heading.text }}
      </router-link>
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
import DocMeta from '@/components/doc/DocMeta.vue'
import { installAppPlugins } from '@/utils/install-app-plugins'
import { renderDocMarkdown } from '@/utils/doc-markdown.mjs'
// 代码块行为（复制 / 折叠）与三站共用同一份实现，结构由 doc-markdown 产出
import { enhanceCodeBlocks } from '@/utils/code-block.js'
// 目录行为（标题发号 + 滚动高亮）与三站共用同一份实现
import { collectHeadings, createScrollSpy, scrollToHeading } from '@/utils/doc-chrome.js'
import type { DocHeading } from '@/utils/doc-chrome.js'
import { lastUpdatedFor } from '@/utils/doc-source'

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

// 「编辑此页」指向正文源文件；「最后更新」取该文件最后一次提交日期（构建期注入）
const sourcePath = computed(() => `es-plus-docs/src/docs/${route.params.name}.md`)
const updated = computed(() => lastUpdatedFor(`guide/${route.params.name}`))

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

const toc = ref<DocHeading[]>([])
const activeHeading = ref('')
const showBackTop = ref(false)
const contentRef = ref<HTMLElement | null>(null)

// 代码块的复制 / 折叠：事件委托绑在正文容器上（utils/code-block.js），
// 每次 v-html 重渲染只需要重新标记一遍新的 wrapper。
const enhanceRendered = () => {
  if (contentRef.value) enhanceCodeBlocks(contentRef.value)
}

// 目录与高亮：标题发号 + 轨迹计算都在共用实现里（utils/doc-chrome.js）。
// 每次正文重渲染都要重建 —— 旧的 spy 闭包攥着已经不在文档里的标题元素。
let scrollSpy: { stop: () => void; focus: (id: string) => void } | null = null

const extractToc = () => {
  nextTick(() => {
    scrollSpy?.stop()
    scrollSpy = null
    toc.value = collectHeadings(document.querySelector('.markdown-content'))
    if (!toc.value.length) {
      activeHeading.value = ''
      return
    }
    scrollSpy = createScrollSpy(toc.value, {
      onChange: (id) => { activeHeading.value = id }
    })
  })
}

// 回到顶部按钮只需知道「滚过首屏」，与目录高亮分开：目录隐藏时按钮仍然要有
const updateBackTop = () => { showBackTop.value = window.scrollY > 400 }

watch(renderedContent, extractToc, { immediate: true })

type DocNav = { path: string; title: string } | null
const prevDoc = ref<DocNav>(null)
const nextDoc = ref<DocNav>(null)

// 目录项是真正的链接（router-link + hash）：右键复制、新标签打开都拿到可用地址，
// 滚动交给路由的 scrollBehavior。唯一它管不到的是「hash 没变」——
// 已经在同一节时再点一次，不会触发导航，这里补一次原地平滑滚动。
const onTocClick = (id: string) => {
  // 先亮起被点的那一节：路由的平滑滚动一路上还会经过好几节，不该由它们抢高亮
  scrollSpy?.focus(id)
  if (route.hash === `#${id}`) scrollToHeading(id)
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
  nextTick(() => {
    mountDemos()
    enhanceRendered()
  })
}, { flush: 'post' })

onMounted(() => {
  // 高亮在 markdown 渲染时一次完成（见 utils/doc-markdown.mjs）。
  // 这里曾经再对 `pre code` 跑一遍 hljs.highlightElement —— 它会把已经注入的
  // 代码块 wrapper 当纯文本转义，正是线上代码块显示 "bash 复制 …" 的原因。
  window.addEventListener('scroll', updateBackTop, { passive: true })
  updateBackTop()
  nextTick(() => {
    mountDemos()
    enhanceRendered()
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateBackTop)
  scrollSpy?.stop()
  unmountDemos()
})
</script>

<style lang="scss" scoped>
/* 面包屑 / 右栏目录 / 上下篇 / 收尾条的外观全部来自 docs-chrome.css（单一权威源），
   这里只保留本页特有的壳层度量与「回到顶部」按钮。 */
.doc-page {
  padding: 24px clamp(16px, 4vw, 48px);
  max-width: 1200px;
  margin: 0 auto;
}

.doc-main {
  flex: 1;
  min-width: 0;
}

.doc-title {
  padding: 0 0 24px;
  font-size: var(--es-text-3xl);
  font-weight: 600;
  color: var(--text-color-primary);
}

.doc-content {
  max-width: var(--es-content-width);
  min-height: 400px;
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
  transition: color var(--es-duration-base) var(--es-ease), background-color var(--es-duration-base) var(--es-ease), border-color var(--es-duration-base) var(--es-ease), box-shadow var(--es-duration-base) var(--es-ease), transform var(--es-duration-base) var(--es-ease), opacity var(--es-duration-base) var(--es-ease);

  &:hover {
    color: var(--primary-color);
    border-color: var(--primary-color);
    transform: translateY(-2px);
  }
}

.back-top-fade-enter-active,
.back-top-fade-leave-active {
  transition: opacity var(--es-duration-slow) var(--es-ease);
}

.back-top-fade-enter-from,
.back-top-fade-leave-to {
  opacity: 0;
}
</style>
