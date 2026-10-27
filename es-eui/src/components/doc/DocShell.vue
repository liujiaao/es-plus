<template>
  <div class="docs-page">
    <!-- 左侧导航：条目由 DOC_NAV 派生（utils/doc-nav.js），组序由 groups 决定。
         此前两个壳各手写一份 router-link 列表，页面改名/挪组要同步多处且不会报错。 -->
    <aside class="side-nav">
      <div
        v-for="section in sections"
        :key="section.title"
        class="nav-group"
      >
        <div class="nav-title">
          {{ section.title }}
        </div>
        <router-link
          v-for="item in section.items"
          :key="item.key"
          :to="item.key"
          class="nav-item"
          exact
        >
          {{ item.title }}
        </router-link>
      </div>
    </aside>

    <!-- 右侧内容：正文 + 右栏目录（.es-doc-with-toc 由 docs-chrome.css 定义）。
         非文档页（DOC_NAV 未登记）时 docEntry 为 undefined，chrome 整体不渲染。 -->
    <div class="content es-doc-content es-doc-with-toc">
      <div class="es-doc-body">
        <!-- 面包屑：分组来自 DOC_NAV -->
        <nav
          v-if="docEntry"
          class="es-doc-crumbs"
          aria-label="面包屑"
        >
          <router-link to="/">
            首页
          </router-link>
          <span class="es-doc-crumbs-sep">/</span>
          <span>{{ docEntry.group }}</span>
          <span class="es-doc-crumbs-sep">/</span>
          <span class="is-current">{{ docEntry.title }}</span>
        </nav>

        <router-view />

        <!-- 上下篇：顺序即 DOC_NAV 的阅读顺序 -->
        <nav
          v-if="prevDoc || nextDoc"
          class="es-doc-pager"
          aria-label="上下篇"
        >
          <router-link
            v-if="prevDoc"
            :to="prevDoc.key"
            class="es-doc-pager-link"
          >
            <span class="es-doc-pager-label">← 上一篇</span>
            <span class="es-doc-pager-title">{{ prevDoc.title }}</span>
          </router-link>
          <router-link
            v-if="nextDoc"
            :to="nextDoc.key"
            class="es-doc-pager-link is-next"
          >
            <span class="es-doc-pager-label">下一篇 →</span>
            <span class="es-doc-pager-title">{{ nextDoc.title }}</span>
          </router-link>
        </nav>

        <doc-meta
          v-if="docEntry"
          :source-path="docEntry.source"
          :title="docEntry.title"
          :updated="updated"
        />
      </div>

      <!-- 右栏目录：<1280px 由 docs-chrome.css 收起 -->
      <aside
        v-if="docEntry && toc.length"
        class="es-doc-toc"
      >
        <div class="es-doc-toc-title">
          本页目录
        </div>
        <router-link
          v-for="heading in toc"
          :key="heading.id"
          :to="{ hash: '#' + heading.id }"
          class="es-doc-toc-link"
          :class="{ 'is-active': activeHeading === heading.id, 'is-sub': heading.level >= 3 }"
          @click.native="onTocClick(heading.id)"
        >
          {{ heading.text }}
        </router-link>
      </aside>
    </div>
  </div>
</template>

<script>
/**
 * 文档外壳：guide / component 两个路由壳共用同一份 chrome 实现。
 *
 * 为什么抽成一个组件而不是在两个 index.vue 里各写一遍：三站共用的类名契约
 * （docs-chrome.css）只规定了样式，行为（标题发号、滚动高亮、上下篇顺序、
 * 最后更新取数）此前只有 es-plus-docs 有。壳层写一次，两个壳各传一个 groups
 * 就够了；写成两份迟早分叉。
 */
import { collectHeadings, createScrollSpy, scrollToHeading, lastUpdatedFor } from '@/utils/doc-chrome'
import { docEntryForRouteName, docNeighbors, docSections } from '@/utils/doc-nav'
import DocMeta from './DocMeta.vue'

export default {
  name: 'DocShell',
  components: { DocMeta },
  props: {
    // 要显示的侧栏分组（按给定顺序）
    groups: { type: Array, required: true }
  },
  data() {
    return {
      toc: [],
      activeHeading: '',
      // 路由视图是异步组件：route 变了 DOM 还没到，收集不到标题就再等一帧
      tocRetry: 0
    }
  },
  computed: {
    sections() {
      return docSections(this.groups)
    },
    docEntry() {
      return docEntryForRouteName(this.$route.name)
    },
    prevDoc() {
      return docNeighbors(this.docEntry).prev
    },
    nextDoc() {
      return docNeighbors(this.docEntry).next
    },
    updated() {
      return this.docEntry ? lastUpdatedFor(this.docEntry.key) : ''
    }
  },
  watch: {
    // 只认 path，不认 fullPath：点目录项只会改 hash，正文没换，重建 spy 会把
    // 「钉住被点小节」的状态一起丢掉 —— 表现就是平滑滚动途中高亮又一路跳过去。
    '$route.path'() {
      this.refreshToc()
    }
  },
  mounted() {
    this.refreshToc()
  },
  beforeDestroy() {
    this.stopSpy()
  },
  methods: {
    stopSpy() {
      if (this.scrollSpy) {
        this.scrollSpy.stop()
        this.scrollSpy = null
      }
    },
    collectToc() {
      this.stopSpy()
      const root = this.$el.querySelector('.es-doc-body')
      const headings = root ? collectHeadings(root) : []
      this.toc = headings
      if (!headings.length) {
        this.activeHeading = ''
        // 最多再试 20 次（≈2s）：内容还没长出来之前目录是空的
        if (this.tocRetry < 20) {
          this.tocRetry += 1
          setTimeout(this.collectToc, 100)
        }
        return
      }
      this.tocRetry = 0
      this.scrollSpy = createScrollSpy(headings, {
        onChange: (id) => {
          this.activeHeading = id
        }
      })
    },
    refreshToc() {
      this.tocRetry = 0
      this.$nextTick(this.collectToc)
    },
    // 链接本身负责跳转（右键复制/新标签都能用），这里只做两件事 ——
    // 先把高亮交给被点的那一节，以及 hash 没变时补一次原地滚动。
    onTocClick(id) {
      if (this.scrollSpy) this.scrollSpy.focus(id)
      if (this.$route.hash === '#' + id) scrollToHeading(id)
    }
  }
}
</script>
