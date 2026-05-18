<template>
  <div class="component-doc-page">
    <div class="doc-main">
      <!-- 面包屑 -->
      <div class="doc-breadcrumb">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
          <el-breadcrumb-item>组件文档</el-breadcrumb-item>
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
          <h2 class="section-title">组件特性</h2>
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
          <h2 class="section-title">使用案例</h2>
          <div class="examples-list">
            <CodePlayground
              v-for="(example, index) in currentDoc.examples"
              :key="index"
              :title="example.title"
              :description="example.description"
              :code="example.code"
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
          <h2 class="section-title">API 文档</h2>

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
          <span class="nav-label">上一个</span>
          <span class="nav-title">{{ prevDoc.title }}</span>
        </router-link>
        <div v-else></div>
        
        <router-link 
          v-if="nextDoc" 
          :to="nextDoc.path" 
          class="footer-nav next"
        >
          <span class="nav-label">下一个</span>
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
import CodePlayground from '@/components/doc/CodePlayground.vue'
import { docsData as rawDocsData } from './component-doc.data'

// 导入案例组件
import FormBasic from '@/components/examples/form/Basic.vue'
import FormLayout from '@/components/examples/form/Layout.vue'
import FormConditional from '@/components/examples/form/Conditional.vue'
import FormDynamic from '@/components/examples/form/Dynamic.vue'
import FormValidation from '@/components/examples/form/Validation.vue'
import FormAsyncOptions from '@/components/examples/form/AsyncOptions.vue'
import FormCustomRender from '@/components/examples/form/CustomRender.vue'
import FormDialog from '@/components/examples/form/Dialog.vue'
import FormDateTimeRange from '@/components/examples/form/DateTimeRange.vue'
import FormCascader from '@/components/examples/form/Cascader.vue'
import FormAdvancedButtons from '@/components/examples/form/AdvancedButtons.vue'
import FormUpload from '@/components/examples/form/Upload.vue'
import FormFileUpload from '@/components/examples/form/FileUpload.vue'
import FormPreferences from '@/components/examples/form/Preferences.vue'
import FormComputedFields from '@/components/examples/form/ComputedFields.vue'
import FormCustomButton from '@/components/examples/form/CustomButton.vue'
import FormDetailMode from '@/components/examples/form/DetailMode.vue'
import FormSearchForm from '@/components/examples/form/SearchForm.vue'

import TableBasic from '@/components/examples/table/Basic.vue'
import TableToolbar from '@/components/examples/table/Toolbar.vue'
import TableCustom from '@/components/examples/table/Custom.vue'
import TableSelection from '@/components/examples/table/Selection.vue'
import TableEdit from '@/components/examples/table/Edit.vue'
import TableSort from '@/components/examples/table/Sort.vue'
import TableGroup from '@/components/examples/table/Group.vue'
import TableFixed from '@/components/examples/table/Fixed.vue'
import TablePagination from '@/components/examples/table/Pagination.vue'
import TableRemoteData from '@/components/examples/table/RemoteData.vue'
import TableExpand from '@/components/examples/table/Expand.vue'
import TableCellMerge from '@/components/examples/table/CellMerge.vue'
import TableQueryTable from '@/components/examples/table/QueryTable.vue'
import TableRowActions from '@/components/examples/table/RowActions.vue'
import TableDynamicColumns from '@/components/examples/table/DynamicColumns.vue'
import TableCallbackPipeline from '@/components/examples/table/CallbackPipeline.vue'
import TableCurrentRow from '@/components/examples/table/CurrentRow.vue'
import TableTableHeight from '@/components/examples/table/TableHeight.vue'

const route = useRoute()

// 组件文档数据
const docsData = rawDocsData

// Assign imported components to their examples by key
const formComponents: Record<string, any> = {
  basic: FormBasic, layout: FormLayout, conditional: FormConditional,
  dynamic: FormDynamic, validation: FormValidation, 'async-options': FormAsyncOptions,
  'custom-render': FormCustomRender, dialog: FormDialog, 'datetime-range': FormDateTimeRange,
  cascader: FormCascader, 'advanced-buttons': FormAdvancedButtons, upload: FormUpload,
  'file-upload': FormFileUpload, preferences: FormPreferences, 'computed-fields': FormComputedFields,
  'custom-button': FormCustomButton, 'detail-mode': FormDetailMode, 'search-form': FormSearchForm
}
const tableComponents: Record<string, any> = {
  basic: TableBasic, toolbar: TableToolbar, custom: TableCustom,
  selection: TableSelection, edit: TableEdit, sort: TableSort,
  group: TableGroup, fixed: TableFixed, pagination: TablePagination,
  'remote-data': TableRemoteData, expand: TableExpand, 'cell-merge': TableCellMerge,
  'query-table': TableQueryTable, 'row-actions': TableRowActions, 'dynamic-columns': TableDynamicColumns,
  'callback-pipeline': TableCallbackPipeline, 'current-row': TableCurrentRow, 'table-height': TableTableHeight
}

docsData['es-form'].examples.forEach((ex: any) => { ex.component = formComponents[ex.key] })
docsData['es-table'].examples.forEach((ex: any) => { ex.component = tableComponents[ex.key] })

const currentDoc = computed(() => {
  const name = route.params.name as string
  return docsData[name] || { title: '未找到', description: '', examples: [], api: {} }
})

const toc = ref([
  { id: 'features', text: '组件特性', level: 2 },
  { id: 'examples', text: '使用案例', level: 2 },
  { id: 'api', text: 'API 文档', level: 2 }
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
  'configBtn click': 'configBtn click 回调'
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

.component-header {
  padding: 0 24px 24px;
  border-bottom: 1px solid var(--border-color-lighter);
  margin-bottom: 24px;
}

.component-title {
  font-size: 32px;
  font-weight: 600;
  color: var(--text-color-primary);
  margin-bottom: 12px;
}

.component-desc {
  font-size: 16px;
  color: var(--text-color-secondary);
  line-height: 1.6;
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

.feature-item {
  display: flex;
  align-items: flex-start;
  padding: 20px;
  background-color: var(--fill-color-light);
  border-radius: 8px;
  border: 1px solid var(--border-color-lighter);
}

.feature-icon {
  color: var(--primary-color);
  margin-right: 12px;
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
