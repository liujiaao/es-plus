<template>
  <div class="advanced-doc-page">
    <div class="doc-main">
      <!-- 面包屑 -->
      <div class="doc-breadcrumb">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item :to="{ path: '/' }">{{ t('breadcrumb.home') }}</el-breadcrumb-item>
          <el-breadcrumb-item>{{ t('sidebar.section.advanced') }}</el-breadcrumb-item>
          <el-breadcrumb-item>{{ currentDoc.title }}</el-breadcrumb-item>
        </el-breadcrumb>
      </div>
      
      <!-- 标题 -->
      <div class="doc-header">
        <h1 class="doc-title">{{ currentDoc.title }}</h1>
        <p class="doc-desc">{{ currentDoc.description }}</p>
      </div>
      
      <!-- 内容 -->
      <article class="doc-content">
        <!-- 特性介绍 -->
        <section class="doc-section" v-if="currentDoc.features" id="features">
          <h2 class="section-title">{{ t('advancedDoc.features') }}</h2>
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
        <section class="doc-section" id="examples">
          <h2 class="section-title">{{ t('advancedDoc.examples') }}</h2>
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
                  <el-alert :title="example.title" type="info" />
                </div>
              </template>
            </CodePlayground>
          </div>
        </section>
        
        <!-- API -->
        <section class="doc-section" v-if="currentDoc.api" id="api">
          <h2 class="section-title">{{ t('advancedDoc.api') }}</h2>
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
      <div class="doc-footer-nav">
        <router-link v-if="prevDoc" :to="prevDoc.path" class="footer-nav prev">
          <span class="nav-label">{{ t('componentDoc.previous') }}</span>
          <span class="nav-title">{{ prevDoc.title }}</span>
        </router-link>
        <div v-else></div>
        <router-link v-if="nextDoc" :to="nextDoc.path" class="footer-nav next">
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
          @click.prevent="scrollToHeading(heading.id)"
        >
          {{ heading.text }}
        </a>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import CodePlayground from '@/components/doc/CodePlayground.vue'

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

const toc = computed(() => [
  { id: 'features', text: t('advancedDoc.features') },
  { id: 'examples', text: t('advancedDoc.examples') },
  { id: 'api', text: t('advancedDoc.api') }
])

const scrollToHeading = (id) => {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth' })
}

const prevDoc = ref(null)
const nextDoc = ref(null)

watch(() => route.params.name, (name) => {
  const keys = Object.keys(docsData)
  const idx = keys.indexOf(name)
  prevDoc.value = idx > 0 ? { path: `/advanced/${keys[idx-1]}`, title: docsData[keys[idx-1]].title } : null
  nextDoc.value = idx < keys.length - 1 ? { path: `/advanced/${keys[idx+1]}`, title: docsData[keys[idx+1]].title } : null
}, { immediate: true })
</script>

<style lang="scss" scoped>
.advanced-doc-page {
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
.doc-header {
  padding: 0 24px 24px;
  border-bottom: 1px solid var(--border-color-lighter);
  margin-bottom: 24px;
}
.doc-title {
  font-size: 32px;
  font-weight: 600;
  color: var(--text-color-primary);
  margin-bottom: 12px;
}
.doc-desc {
  font-size: 16px;
  color: var(--text-color-secondary);
}
.doc-section {
  padding: 0 24px 32px;
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
.feature-card {
  padding: 24px;
  background-color: var(--fill-color-light);
  border-radius: 8px;
  text-align: center;
  border: 1px solid var(--border-color-lighter);
}
.feature-icon {
  color: var(--primary-color);
  margin-bottom: 12px;
}
.feature-card h4 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-color-primary);
}
.feature-card p {
  font-size: 14px;
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
}
.aside-title {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-color-secondary);
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
  &:hover, &.active {
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
