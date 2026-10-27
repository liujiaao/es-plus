<template>
  <!-- es-doc-chrome + docs-chrome.css：面包屑 / 右栏目录 / 上下篇 / 收尾条
       的类名与外观由 docs/theme/docs-chrome.css 统一规定，三站同源。 -->
  <div class="component-doc-page es-doc-chrome">
    <div class="doc-main">
      <!-- 面包屑 -->
      <nav class="es-doc-crumbs" aria-label="面包屑">
        <router-link to="/">{{ t('breadcrumb.home') }}</router-link>
        <span class="es-doc-crumbs-sep">/</span>
        <span>{{ t('breadcrumb.componentDoc') }}</span>
        <span class="es-doc-crumbs-sep">/</span>
        <span class="is-current">{{ currentDoc.title }}</span>
      </nav>

      <!-- 组件标题 -->
      <div class="component-header">
        <h1 class="component-title">{{ currentDoc.title }}</h1>
        <p class="component-desc">{{ currentDoc.description }}</p>
        <!-- 状态徽章 + since（路线图 2.4 · T3 Reference）。
             徽章**不手填**：由三端的 since 反推 —— 三端都有首发版本 = Stable，任何一端没有 =
             Beta，显式标了 legacy 才是 Legacy。手填的状态会随发版过期，反推的不会。 -->
        <div class="component-meta" v-if="currentDoc.since">
          <span class="component-badge" :class="'is-' + status.kind">
            {{ t('componentDoc.status.' + status.kind) }}
          </span>
          <span class="component-since">
            {{ t('componentDoc.since', { version: currentDoc.since.vue3 }) }}
          </span>
          <span class="component-targets">
            <span
              v-for="tg in TARGETS"
              :key="tg.key"
              class="component-target"
              :class="{ 'is-missing': !currentDoc.since[tg.key] }"
            >
              {{ tg.label }} ·
              {{ currentDoc.since[tg.key] ? 'v' + currentDoc.since[tg.key] : t('componentDoc.notPublished') }}
            </span>
          </span>
          <span class="component-reviewed" v-if="currentDoc.reviewed">
            {{ t('componentDoc.reviewed', { date: currentDoc.reviewed }) }}
          </span>
        </div>
      </div>

      <!-- 文档内容 -->
      <article class="doc-content">
        <!-- 组件特性介绍 -->
        <section class="doc-section" v-if="currentDoc.features">
          <!-- id 挂在标题上：目录项与 #features 锚点都落到这一行，滚动偏移才对得准 -->
          <h2 class="section-title" id="features">{{ t('componentDoc.features') }}</h2>
          <div class="features-grid">
            <div 
              v-for="feature in currentDoc.features" 
              :key="feature.name"
              class="feature-item"
            >
              <el-icon :size="24" class="feature-icon">
                <component :is="feature.icon" />
              </el-icon>
              <div class="feature-info">
                <h4>{{ feature.name }}</h4>
                <p>{{ feature.desc }}</p>
              </div>
            </div>
          </div>
        </section>

        <!-- 使用案例 -->
        <section class="doc-section">
          <h2 class="section-title" id="examples">{{ t('componentDoc.examples') }}</h2>
          <p class="examples-note">
            {{ t('advancedDoc.crossNote') }}
          </p>
          <div class="examples-list">
            <!--
              :id 让每个示例有自己的落点（/components/es-table#demo-selection）。
              锚点名由 examples[].key 决定，check:cases-links 按同一规则从
              component-doc.data.ts 反查——改 key 会让案例卡的链接失效，那是**故意的**。
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
                  <el-alert :title="`案例 ${Number(index) + 1}: ${example.title}`" type="info" />
                </div>
              </template>
            </CodePlayground>
          </div>
        </section>

        <!-- API 文档 -->
        <section class="doc-section" v-if="currentDoc.api">
          <h2 class="section-title" id="api">{{ t('componentDoc.api') }}</h2>
          <!-- 表里的 Since 列以 vue3 为基准：三端各自的版本在标题下方已经逐端写明，
               这里再重复一遍会让人以为某个 prop 是三端分叉的 -->
          <p class="api-note" v-if="currentDoc.since">
            {{
              t('componentDoc.apiSinceNote', {
                // 包名当插值传进来，不写进文案：vue-i18n 的 @ 是「链接消息」语法，
                // 文案里直接写 @es-plus/vue3 会抛 Invalid linked format，整页变空白
                pkg: '@es-plus/vue3',
                version: currentDoc.since.vue3,
                date: currentDoc.reviewed,
              })
            }}
          </p>

          <template v-for="(items, key) in currentDoc.api" :key="key">
            <div class="api-block" v-if="Array.isArray(items) && items.length">
              <h3 class="api-subtitle">{{ apiTitleMap[key as string] || key }}</h3>
              <el-table :data="items" border>
                <el-table-column prop="name" label="名称" width="220" />
                <el-table-column prop="type" label="类型" width="220" />
                <el-table-column v-if="(items as any[]).some((it: any) => it.default !== undefined)" prop="default" label="默认值" width="120" />
                <el-table-column v-if="(items as any[]).some((it: any) => it.params !== undefined)" prop="params" label="参数" width="200" />
                <el-table-column prop="desc" label="说明" />
                <el-table-column v-if="currentDoc.since" label="Since" width="96">
                  <template #default="scope">v{{ scope.row.since || currentDoc.since.vue3 }}</template>
                </el-table-column>
              </el-table>
            </div>
          </template>

          <!-- 缺的表也要有落点：T3 要求 Props / Events / Slots / Expose 四张表都能找到，
               「没有」本身是要交代的结论（如 EsForm 不派发事件），不允许整节静默消失。 -->
          <div class="api-block" v-for="key in missingApiKeys" :key="'missing-' + key">
            <h3 class="api-subtitle">{{ apiTitleMap[key] || key }}</h3>
            <p class="api-empty">{{ (currentDoc.notes && currentDoc.notes[key]) || t('componentDoc.noApiEntry') }}</p>
          </div>
        </section>

        <!-- 主题变量（路线图 2.4）：只列组件源码真的消费了的变量，没有就老实说没有 -->
        <section class="doc-section" v-if="currentDoc.theme">
          <h2 class="section-title" id="theme">{{ t('componentDoc.theme') }}</h2>
          <p class="api-note">{{ currentDoc.theme.note }}</p>
          <el-table v-if="currentDoc.theme.vars && currentDoc.theme.vars.length" :data="currentDoc.theme.vars" border>
            <el-table-column prop="name" label="CSS 变量" width="280" />
            <el-table-column prop="fallback" :label="t('componentDoc.themeFallback')" width="220" />
            <el-table-column prop="desc" :label="t('componentDoc.themeDesc')" />
          </el-table>
        </section>

        <!-- 可访问性（路线图 2.4）：每条结论都带证据文件，页面上可核对 -->
        <section class="doc-section" v-if="currentDoc.a11y && currentDoc.a11y.length">
          <h2 class="section-title" id="a11y">{{ t('componentDoc.a11y') }}</h2>
          <ul class="a11y-list">
            <li v-for="(item, i) in currentDoc.a11y" :key="i" class="a11y-item">
              <p class="a11y-text">{{ item.text }}</p>
              <code class="a11y-evidence">
                {{ t('componentDoc.a11yEvidence') }}：{{ item.evidence.file }} →
                <span class="a11y-token">{{ item.evidence.contains }}</span>
                <template v-if="item.absent">（且无 {{ item.absent.contains }}）</template>
              </code>
            </li>
          </ul>
        </section>

        <!-- 相关组件（路线图 2.4）：只说「为什么相关」，不复述对方是干什么的 -->
        <section class="doc-section" v-if="currentDoc.related && currentDoc.related.length">
          <h2 class="section-title" id="related">{{ t('componentDoc.related') }}</h2>
          <ul class="related-list">
            <li v-for="item in currentDoc.related" :key="item.key" class="related-item">
              <router-link class="related-link" :to="'/components/' + item.key">
                {{ docsData[item.key]?.title || item.key }}
              </router-link>
              <span class="related-why">{{ item.why }}</span>
            </li>
          </ul>
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
      <DocMeta source-path="es-plus-docs/src/views/component-doc.data.ts" :title="currentDoc.title" :updated="updated" />
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
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@unhead/vue'
import CodePlayground from '@/components/doc/CodePlayground.vue'
import DocMeta from '@/components/doc/DocMeta.vue'
// 目录行为（标题发号 + 滚动高亮）与三站共用同一份实现
import { collectHeadings, createScrollSpy, scrollToHeading as scrollToHeadingImpl } from '@/utils/doc-chrome.js'
import type { DocHeading } from '@/utils/doc-chrome.js'
import { lastUpdatedFor } from '@/utils/doc-source'
import { realignToHash } from '@/utils/hash-anchor'
import { docsData as rawDocsData } from './component-doc.data'

const { t } = useI18n()

const route = useRoute()

// 组件文档数据（component 字段由 component-doc.data.ts 通过 import.meta.glob 自动填充）
const docsData = rawDocsData

const currentDoc = computed(() => {
  const name = route.params.name as string
  return docsData[name] || { title: '未找到', description: '', examples: [], api: {} }
})

/**
 * 三端清单：since 徽章与「三端各自首发版本」都按这个顺序排。
 * 顺序固定，读者在三页之间横跳时位置不会变。
 */
const TARGETS = [
  { key: 'vue3', label: 'Vue 3' },
  { key: 'vue2', label: 'Vue 2' },
  { key: 'antdv', label: 'AntDV' }
]

/**
 * 状态徽章由 since 反推，不手填（见 component-doc.data.ts 的字段说明）：
 * 少一端发布就是 Beta —— 那正是读者要提前知道的事。
 */
const status = computed(() => {
  const doc = currentDoc.value
  if (doc.legacy) return { kind: 'legacy' }
  const missing = TARGETS.filter((tg) => !(doc.since && doc.since[tg.key]))
  return { kind: missing.length ? 'beta' : 'stable' }
})

/** T3 的四张表：Props / Events / Slots / Expose。缺的要写清楚为什么缺，而不是不渲染 */
const API_TABLES = ['props', 'events', 'slots', 'methods']
const missingApiKeys = computed(() =>
  API_TABLES.filter((key) => !(currentDoc.value.api && currentDoc.value.api[key]?.length))
)

// 案例难度梯度：按案例在分类中的位置推断（案例已按 01→N 从简单到复杂排序）
const levelOf = (index: number, total: number): number => {
  if (total <= 2) return index === 0 ? 1 : 3
  const ratio = index / (total - 1)
  if (ratio < 0.25) return 1
  if (ratio < 0.5) return 2
  if (ratio < 0.75) return 3
  if (ratio < 0.9) return 4
  return 5
}

useHead({
  title: () => currentDoc.value.title,
  meta: [
    { name: 'description', content: () => currentDoc.value.description || `${currentDoc.value.title} - ES-Plus 组件 API 与示例` },
    { property: 'og:title', content: () => `${currentDoc.value.title} · ES-Plus` },
    { property: 'og:description', content: () => currentDoc.value.description || '' },
  ],
})

// 目录改为从渲染后的 DOM 收集（含 API 表里的 H3）：三个大节标题的 id 已在模板里写死
// （features / examples / api），H3 由共用实现按文本发号 —— 页面之间不会撞车。
const toc = ref<DocHeading[]>([])
let scrollSpy: { stop: () => void; focus: (id: string) => void } | null = null

const refreshToc = () => {
  nextTick(() => {
    scrollSpy?.stop()
    scrollSpy = null
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

const updated = computed(() => lastUpdatedFor('components'))

const onTocClick = (id: string) => {
  // 先亮起被点的那一节：路由的平滑滚动一路上还会经过好几节，不该由它们抢高亮
  scrollSpy?.focus(id)
  if (route.hash === `#${id}`) scrollToHeadingImpl(id)
}

const apiTitleMap: Record<string, string> = {
  props: 'Props',
  events: 'Events',
  // methods 表记录的是 defineExpose 出去的实例方法，按 T3 的称呼叫 Expose 更准确
  methods: 'Expose（模板 ref 可调用）',
  slots: 'Slots',
  FormItemOption: 'FormItemOption 配置',
  LayoutFormProps: 'LayoutFormProps 布局配置',
  BtnConfig: 'BtnConfig 按钮配置',
  TableColumn: 'TableColumn 列配置',
  TableOptions: 'TableOptions 选项配置',
  DialogOptions: 'DialogOptions 弹窗配置',
  'configBtn click': 'configBtn click 回调',
  CrudPageSchema: 'CrudPageSchema 配置',
  CrudBtnConfig: 'CrudBtnConfig 工具栏按钮配置',
  OperationColumnConfig: 'OperationColumnConfig 操作列配置',
  RowBtnConfig: 'RowBtnConfig 行按钮配置',
  CrudDialogConfig: 'CrudDialogConfig 弹窗配置'
}

const activeHeading = ref('')
const prevDoc = ref<{ path: string; title: string } | null>(null)
const nextDoc = ref<{ path: string; title: string } | null>(null)


// 更新导航
const updateNav = () => {
  const name = route.params.name as string
  const docKeys = Object.keys(docsData)
  const currentIndex = docKeys.indexOf(name)
  
  if (currentIndex > 0) {
    const prevKey = docKeys[currentIndex - 1]
    prevDoc.value = { path: `/components/${prevKey}`, title: docsData[prevKey]?.title || '' }
  } else {
    prevDoc.value = null
  }
  
  if (currentIndex < docKeys.length - 1) {
    const nextKey = docKeys[currentIndex + 1]
    nextDoc.value = { path: `/components/${nextKey}`, title: docsData[nextKey]?.title || '' }
  } else {
    nextDoc.value = null
  }
}

watch(() => route.params.name, updateNav, { immediate: true })
// 换组件页 = 整块正文重渲染：目录要跟着重建，否则高亮还盯着上一页的标题元素
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
  scrollSpy?.stop()
})
</script>

<style lang="scss" scoped>
.component-doc-page {
  display: flex;
  padding: 24px clamp(16px, 4vw, 48px);
  max-width: calc(var(--es-layout-max) - var(--es-sidebar-width));
  margin: 0 auto;
}

.doc-main {
  flex: 1;
  min-width: 0;
}

.component-header {
  max-width: var(--es-content-width);
  padding: 0 0 24px;
  border-bottom: 1px solid var(--border-color-lighter);
  margin-bottom: 24px;
}

.component-title {
  font-size: var(--es-text-3xl);
  font-weight: 700;
  color: var(--text-color-primary);
  margin-bottom: 12px;
}

.component-desc {
  font-size: 16px;
  color: var(--text-color-secondary);
  line-height: 1.6;
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
  border-bottom: 2px solid var(--primary-color-light);
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 22px;
  background-color: var(--bg-color);
  border-radius: 14px;
  border: 1px solid var(--border-color-lighter);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: transform var(--es-duration-slow) var(--es-ease), box-shadow var(--es-duration-slow) var(--es-ease), border-color var(--es-duration-slow) var(--es-ease);
}

.feature-item:hover {
  transform: translateY(-4px);
  border-color: var(--primary-color);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.08);
}

.feature-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  color: var(--primary-color);
  background: var(--primary-color-light, rgba(59, 130, 246, 0.1));
  flex-shrink: 0;
}

.feature-info {
  h4 {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 6px;
    color: var(--text-color-primary);
  }
  
  p {
    font-size: 14px;
    color: var(--text-color-secondary);
    line-height: 1.5;
  }
}

.examples-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.placeholder-preview {
  padding: 20px;
}

.api-block {
  margin-bottom: 24px;

  // 统一 el-table 与 markdown 原生表格外观（表头浅底/正文次级色/悬停高亮）
  :deep(.el-table) {
    font-size: 14px;
    --el-table-border-color: var(--border-color-lighter);
    --el-table-header-bg-color: var(--fill-color-light);
    --el-table-header-text-color: var(--text-color-primary);
    --el-table-text-color: var(--text-color-regular);
    --el-table-row-hover-bg-color: var(--fill-color-light);
  }

  :deep(.el-table th.el-table__cell) {
    font-weight: 600;
  }

  :deep(.el-table .cell) {
    padding: 0 16px;
  }
}

.api-subtitle {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--text-color-primary);
}

/* ---- 状态徽章 + since（路线图 2.4） ----
   一行读完三件事：稳不稳（Stable/Beta/Legacy）、从哪个版本起、三端齐不齐。
   颜色只落在文字与描边上（底色沿用 --fill-color-light），深色站点不必另配一套。 */
.component-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin-top: 16px;
  font-size: 13px;
  color: var(--text-color-secondary);
}

.component-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border: 1px solid currentColor;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
  letter-spacing: 0.02em;
  background-color: var(--fill-color-light);

  &.is-stable {
    color: var(--success-color);
  }

  &.is-beta {
    color: var(--warning-color);
  }

  &.is-legacy {
    color: var(--text-color-secondary);
  }
}

.component-since,
.component-reviewed,
.component-target {
  font-variant-numeric: tabular-nums;
}

.component-targets {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px 8px;
}

.component-target {
  padding: 1px 8px;
  border-radius: var(--es-radius-sm);
  background-color: var(--fill-color-light);
  font-size: 12px;

  /* 该端没有发布：划掉并转成警示色 —— 「有但没写」和「确实没有」必须一眼分得开 */
  &.is-missing {
    color: var(--danger-color);
    text-decoration: line-through;
  }
}

/* 核对日期贴右：它是元信息，不该挤在 since 和版本号中间抢注意力 */
.component-reviewed {
  margin-left: auto;
}

.api-note {
  margin: -8px 0 20px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-color-secondary);
}

/* 「这张表没有」也要有视觉重量：整节静默消失会让读者以为文档漏了 */
.api-empty {
  padding: 12px 16px;
  border-left: 3px solid var(--border-color-lighter);
  border-radius: 0 var(--es-radius-sm) var(--es-radius-sm) 0;
  background-color: var(--fill-color-light);
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-color-regular);
}

.a11y-list,
.related-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.a11y-item {
  padding-left: 16px;
  border-left: 3px solid var(--primary-color-light);
}

.a11y-text {
  font-size: 14px;
  line-height: 1.75;
  color: var(--text-color-regular);
}

/* 证据路径用等宽字体且可断行：它是给人核对源码用的，折行比溢出强 */
.a11y-evidence {
  display: block;
  margin-top: 6px;
  font-family: var(--es-font-mono);
  font-size: 12px;
  color: var(--text-color-secondary);
  word-break: break-all;
}

/* 证据里的代码片段：与路径区分开，读者能直接照着 grep */
.a11y-token {
  padding: 0 4px;
  border-radius: 3px;
  background-color: var(--fill-color-light);
  color: var(--text-color-primary);
}

.related-item {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
  font-size: 14px;
  line-height: 1.75;
}

.related-link {
  font-weight: 600;
  color: var(--primary-color);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.related-why {
  color: var(--text-color-regular);
}

.selected-info {
  margin-top: 16px;
  padding: 12px 16px;
  background-color: var(--fill-color-light);
  border-radius: 4px;
}
</style>
