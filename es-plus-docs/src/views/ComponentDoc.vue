<template>
  <div class="component-doc-page">
    <div class="doc-main">
      <!-- 面包屑 -->
      <div class="doc-breadcrumb">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item :to="{ path: '/' }">{{ t('breadcrumb.home') }}</el-breadcrumb-item>
          <el-breadcrumb-item>{{ t('breadcrumb.componentDoc') }}</el-breadcrumb-item>
          <el-breadcrumb-item>{{ currentDoc.title }}</el-breadcrumb-item>
        </el-breadcrumb>
      </div>
      
      <!-- 组件标题 -->
      <div class="component-header">
        <h1 class="component-title">{{ currentDoc.title }}</h1>
        <p class="component-desc">{{ currentDoc.description }}</p>
      </div>
      
      <!-- 文档内容 -->
      <article class="doc-content">
        <!-- 组件特性介绍 -->
        <section class="doc-section" v-if="currentDoc.features" id="features">
          <h2 class="section-title">{{ t('componentDoc.features') }}</h2>
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
        <section class="doc-section" id="examples">
          <h2 class="section-title">{{ t('componentDoc.examples') }}</h2>
          <p class="examples-note">
            {{ t('advancedDoc.crossNote') }}
          </p>
          <div class="examples-list">
            <CodePlayground
              v-for="(example, index) in currentDoc.examples"
              :key="index"
              :title="example.title"
              :description="example.description"
              :code="example.code"
              :level="levelOf(index, currentDoc.examples.length)"
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
        <section class="doc-section" v-if="currentDoc.api" id="api">
          <h2 class="section-title">{{ t('componentDoc.api') }}</h2>

          <template v-for="(items, key) in currentDoc.api" :key="key">
            <div class="api-block">
              <h3 class="api-subtitle">{{ apiTitleMap[key as string] || key }}</h3>
              <el-table :data="items" border>
                <el-table-column prop="name" label="名称" width="220" />
                <el-table-column prop="type" label="类型" width="220" />
                <el-table-column v-if="(items as any[]).some((it: any) => it.default !== undefined)" prop="default" label="默认值" width="120" />
                <el-table-column v-if="(items as any[]).some((it: any) => it.params !== undefined)" prop="params" label="参数" width="200" />
                <el-table-column prop="desc" label="说明" />
              </el-table>
            </div>
          </template>
        </section>
      </article>
      
      <!-- 底部导航 -->
      <div class="doc-footer-nav">
        <router-link
          v-if="prevDoc"
          :to="prevDoc.path"
          class="footer-nav prev"
        >
          <span class="nav-label">{{ t('componentDoc.previous') }}</span>
          <span class="nav-title">{{ prevDoc.title }}</span>
        </router-link>
        <div v-else></div>

        <router-link
          v-if="nextDoc"
          :to="nextDoc.path"
          class="footer-nav next"
        >
          <span class="nav-label">{{ t('componentDoc.next') }}</span>
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
          :style="{ paddingLeft: `${(heading.level - 1) * 12 + 12}px` }"
          @click.prevent="scrollToHeading(heading.id)"
        >
          {{ heading.text }}
        </a>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@unhead/vue'
import CodePlayground from '@/components/doc/CodePlayground.vue'
import { docsData as rawDocsData } from './component-doc.data'

const { t } = useI18n()

const route = useRoute()

// 组件文档数据（component 字段由 component-doc.data.ts 通过 import.meta.glob 自动填充）
const docsData = rawDocsData

const currentDoc = computed(() => {
  const name = route.params.name as string
  return docsData[name] || { title: '未找到', description: '', examples: [], api: {} }
})

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

const toc = computed(() => [
  { id: 'features', text: t('componentDoc.features'), level: 2 },
  { id: 'examples', text: t('componentDoc.examples'), level: 2 },
  { id: 'api', text: t('componentDoc.api'), level: 2 }
])

const apiTitleMap: Record<string, string> = {
  props: 'Props',
  events: 'Events',
  methods: 'Methods',
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

const scrollToHeading = (id: string) => {
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' })
  }
}

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

onMounted(() => {
  // hljs highlighting handled by CodePlayground component
})
</script>

<style lang="scss" scoped>
.component-doc-page {
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
  max-width: 860px;
  padding: 0 0 16px;
}

.component-header {
  max-width: 860px;
  padding: 0 0 24px;
  border-bottom: 1px solid var(--border-color-lighter);
  margin-bottom: 24px;
}

.component-title {
  font-size: 32px;
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
  max-width: 860px;
  padding: 0 0 32px;
}

.section-title {
  font-size: 24px;
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
  transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
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

.doc-footer-nav {
  display: flex;
  justify-content: space-between;
  max-width: 860px;
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
  }
  
  &.active {
    color: var(--primary-color);
    border-left-color: var(--primary-color);
  }
}

.selected-info {
  margin-top: 16px;
  padding: 12px 16px;
  background-color: var(--fill-color-light);
  border-radius: 4px;
}

@media (max-width: 1200px) {
  .doc-aside {
    display: none;
  }
}
</style>
