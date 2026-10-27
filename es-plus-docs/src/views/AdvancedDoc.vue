<template>
  <!-- es-doc-chrome + docs-chrome.css：面包屑 / 右栏目录 / 上下篇 / 收尾条
       的类名与外观由 docs/theme/docs-chrome.css 统一规定，三站同源。 -->
  <div class="advanced-doc-page es-doc-chrome">
    <div class="doc-main">
      <!-- 面包屑 -->
      <nav class="es-doc-crumbs" aria-label="面包屑">
        <router-link to="/">{{ t('breadcrumb.home') }}</router-link>
        <span class="es-doc-crumbs-sep">/</span>
        <span>{{ t('breadcrumb.advanced') }}</span>
        <span class="es-doc-crumbs-sep">/</span>
        <span class="is-current">{{ currentDoc.title }}</span>
      </nav>

      <!-- 标题 -->
      <div class="doc-header">
        <h1 class="doc-title">{{ currentDoc.title }}</h1>
        <p class="doc-desc">{{ currentDoc.description }}</p>
      </div>

      <!-- 内容 -->
      <article class="doc-content">
        <!-- 特性介绍 -->
        <section class="doc-section" v-if="currentDoc.features">
          <!-- id 挂在标题上：目录项与 #features 锚点都落到这一行，滚动偏移才对得准 -->
          <h2 class="section-title" id="features">{{ t('advancedDoc.features') }}</h2>
          <div class="features-grid">
            <div v-for="feature in currentDoc.features" :key="feature.name" class="feature-card">
              <el-icon :size="32" class="feature-icon">
                <component :is="feature.icon" />
              </el-icon>
              <h4>{{ feature.name }}</h4>
              <p>{{ feature.desc }}</p>
            </div>
          </div>
        </section>

        <!-- 案例列表 -->
        <section class="doc-section">
          <h2 class="section-title" id="examples">{{ t('advancedDoc.examples') }}</h2>
          <p class="examples-note">
            {{ t('advancedDoc.crossNote') }}
          </p>
          <div class="examples-list">
            <!--
              :id 让每个示例有自己的落点（/advanced/vxe-table#demo-cell-edit）。
              锚点名由 examples[].key 决定，check:cases-links 按同一规则从
              advanced-doc.data.ts 反查——改 key 会让案例卡的链接失效，那是**故意的**。
            -->
            <CodePlayground
              v-for="(example, index) in currentDoc.examples"
              :key="index"
              :id="'demo-' + example.key"
              :title="example.title"
              :description="example.description"
              :code="example.code"
              :level="levelOf(Number(index), currentDoc.examples.length)"
            >
              <template #preview>
                <component :is="example.component" v-if="example.component" />
                <div v-else class="placeholder-preview">
                  <el-alert :title="example.title" type="info" />
                </div>
              </template>
            </CodePlayground>
          </div>
        </section>

        <!-- API -->
        <section class="doc-section" v-if="currentDoc.api">
          <h2 class="section-title" id="api">{{ t('advancedDoc.api') }}</h2>
          <div v-for="(items, key) in currentDoc.api" :key="key" class="api-block">
            <h3 class="api-subtitle">{{ apiTitleMap[key] || key }}</h3>
            <el-table :data="items" border>
              <el-table-column prop="name" label="名称" width="220" />
              <el-table-column prop="type" label="类型" width="220" />
              <el-table-column prop="desc" label="说明" />
            </el-table>
          </div>
        </section>
      </article>

      <!-- 底部导航 -->
      <nav v-if="prevDoc || nextDoc" class="es-doc-pager" aria-label="上下篇">
        <router-link v-if="prevDoc" :to="prevDoc.path" class="es-doc-pager-link">
          <span class="es-doc-pager-label">← {{ t('componentDoc.previous') }}</span>
          <span class="es-doc-pager-title">{{ prevDoc.title }}</span>
        </router-link>
        <router-link v-if="nextDoc" :to="nextDoc.path" class="es-doc-pager-link is-next">
          <span class="es-doc-pager-label">{{ t('componentDoc.next') }} →</span>
          <span class="es-doc-pager-title">{{ nextDoc.title }}</span>
        </router-link>
      </nav>

      <!-- 编辑此页 · 报告问题 · 最后更新 -->
      <DocMeta source-path="es-plus-docs/src/views/advanced-doc.data.ts" :title="currentDoc.title" :updated="updated" />
    </div>

    <!-- 右侧目录：<1280px 由 docs-chrome.css 收起 -->
    <aside class="es-doc-toc">
      <div class="es-doc-toc-title">{{ t('componentDoc.toc') }}</div>
      <router-link
        v-for="heading in toc"
        :key="heading.id"
        :to="{ hash: `#${heading.id}` }"
        class="es-doc-toc-link"
        :class="{ 'is-active': activeHeading === heading.id, 'is-sub': heading.level >= 3 }"
        @click="onTocClick(heading.id)"
      >
        {{ heading.text }}
      </router-link>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import CodePlayground from '@/components/doc/CodePlayground.vue'
import { realignToHash } from '@/utils/hash-anchor'
import DocMeta from '@/components/doc/DocMeta.vue'
// 目录行为（标题发号 + 滚动高亮）与三站共用同一份实现
import { collectHeadings, createScrollSpy, scrollToHeading } from '@/utils/doc-chrome.js'
import { lastUpdatedFor } from '@/utils/doc-source'

const { t } = useI18n()
import { docsData as rawDocsData } from './advanced-doc.data'

const route = useRoute()

const docsData = rawDocsData

const apiTitleMap: Record<string, string> = {
  Options: 'DialogOptions 弹窗配置',
  DialogOptions: 'DialogOptions 弹窗配置',
  'configBtn click': 'configBtn click 回调'
}

// 组件由 advanced-doc.data.ts 通过 import.meta.glob 自动填充
const currentDoc = computed(() => {
  const name = route.params.name
  return docsData[name] || { title: '未找到', description: '', examples: [] }
})

// 案例难度梯度：按案例在分类中的位置推断（案例已按 01→N 从简单到复杂排序）
// L1 入门 / L2 基础 / L3 进阶 / L4 高级 / L5 复杂
const levelOf = (index: number, total: number): number => {
  if (total <= 2) return index === 0 ? 1 : 3
  const ratio = index / (total - 1)
  if (ratio < 0.25) return 1
  if (ratio < 0.5) return 2
  if (ratio < 0.75) return 3
  if (ratio < 0.9) return 4
  return 5
}

// 目录从渲染后的 DOM 收集（含 API 表里的 H3）：三个大节标题的 id 已在模板里写死
// （features / examples / api），H3 由共用实现按文本发号 —— 页面之间不会撞车。
const toc = ref([])
const activeHeading = ref('')
let scrollSpy: { stop: () => void; focus: (id: string) => void } | null = null

const refreshToc = () => {
  nextTick(() => {
    if (scrollSpy) { scrollSpy.stop(); scrollSpy = null }
    toc.value = collectHeadings(document.querySelector('.doc-content'))
    if (!toc.value.length) {
      activeHeading.value = ''
      return
    }
    scrollSpy = createScrollSpy(toc.value, {
      onChange: (id) => { activeHeading.value = id }
    })
  })
}

const updated = computed(() => lastUpdatedFor('advanced'))

const onTocClick = (id) => {
  // 先亮起被点的那一节：路由的平滑滚动一路上还会经过好几节，不该由它们抢高亮
  scrollSpy?.focus(id)
  if (route.hash === `#${id}`) scrollToHeading(id)
}

const prevDoc = ref(null)
const nextDoc = ref(null)

watch(() => route.params.name, (name) => {
  const keys = Object.keys(docsData)
  const idx = keys.indexOf(name)
  prevDoc.value = idx > 0 ? { path: `/advanced/${keys[idx-1]}`, title: docsData[keys[idx-1]].title } : null
  nextDoc.value = idx < keys.length - 1 ? { path: `/advanced/${keys[idx+1]}`, title: docsData[keys[idx+1]].title } : null
}, { immediate: true })

// 换页 = 整块正文重渲染：目录跟着重建，否则高亮还盯着上一页的标题元素
watch(() => route.params.name, refreshToc, { immediate: true })

// 示例是异步组件：路由先把页面滚到 `#demo-xxx`，内容随后撑开会把落点推走。
// 这里盯到内容长完为止（用户一动手就让位）
let stopRealign = () => {}
watch(
  () => route.hash,
  (hash) => {
    stopRealign()
    stopRealign = realignToHash(String(hash || ''))
  },
)
onMounted(() => { stopRealign = realignToHash(String(route.hash || '')) })
onBeforeUnmount(() => {
  stopRealign()
  if (scrollSpy) scrollSpy.stop()
})
// 高级指南的标题跟着当前文档走（registry 里每篇都有自己的 title / description）。
import { usePageMeta } from '@/utils/page-meta'

usePageMeta(() => ({
  title: currentDoc.value.title,
  description: currentDoc.value.description || `${currentDoc.value.title} - ES-Plus 高级用法`,
}))
</script>

<style lang="scss" scoped>
.advanced-doc-page {
  display: flex;
  padding: 24px clamp(16px, 4vw, 48px);
  max-width: calc(var(--es-layout-max) - var(--es-sidebar-width));
  margin: 0 auto;
}
.doc-main {
  flex: 1;
  min-width: 0;
}
.doc-header {
  max-width: var(--es-content-width);
  padding: 0 0 24px;
  border-bottom: 1px solid var(--border-color-lighter);
  margin-bottom: 24px;
}
.doc-title {
  font-size: var(--es-text-3xl);
  font-weight: 700;
  color: var(--text-color-primary);
  margin-bottom: 12px;
}
.doc-desc {
  font-size: 16px;
  color: var(--text-color-secondary);
}
.doc-section {
  max-width: var(--es-content-width);
  padding: 0 0 32px;
}
.section-title {
  font-size: var(--es-text-2xl);
  font-weight: 600;
  color: var(--text-color-primary);
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color-lighter);
}
.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
}
.feature-card {
  padding: 28px 24px;
  background-color: var(--bg-color);
  border-radius: 14px;
  text-align: center;
  border: 1px solid var(--border-color-lighter);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: transform var(--es-duration-slow) var(--es-ease), box-shadow var(--es-duration-slow) var(--es-ease), border-color var(--es-duration-slow) var(--es-ease);
}
.feature-card:hover {
  transform: translateY(-4px);
  border-color: var(--primary-color);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.08);
}
.feature-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 14px;
  color: var(--primary-color);
  background: var(--primary-color-light, rgba(59, 130, 246, 0.1));
  margin-bottom: 16px;
}
.feature-card h4 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-color-primary);
}
.feature-card p {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-color-secondary);
}
.examples-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.api-block {
  margin-bottom: 24px;
}
.api-subtitle {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--text-color-primary);
}
</style>
