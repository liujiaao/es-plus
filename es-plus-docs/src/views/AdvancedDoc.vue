<template>
  <div class="advanced-doc-page">
    <div class="doc-main">
      <!-- 面包屑 -->
      <div class="doc-breadcrumb">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
          <el-breadcrumb-item>高级用法</el-breadcrumb-item>
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
          <h2 class="section-title">核心特性</h2>
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
          <h2 class="section-title">实战案例</h2>
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
                  <el-alert :title="example.title" type="info" />
                </div>
              </template>
            </CodePlayground>
          </div>
        </section>
        
        <!-- API -->
        <section class="doc-section" v-if="currentDoc.api" id="api">
          <h2 class="section-title">API 参考</h2>
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
          <span class="nav-label">上一个</span>
          <span class="nav-title">{{ prevDoc.title }}</span>
        </router-link>
        <div v-else></div>
        <router-link v-if="nextDoc" :to="nextDoc.path" class="footer-nav next">
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
import CodePlayground from '@/components/doc/CodePlayground.vue'
import { docsData as rawDocsData } from './advanced-doc.data'

// 导入案例组件
import DialogBasic from '@/components/examples/dialog/Basic.vue'
import DialogForm from '@/components/examples/dialog/Form.vue'
import DialogConfirm from '@/components/examples/dialog/Confirm.vue'
import DialogNestedModal from '@/components/examples/dialog/NestedModal.vue'
import DialogAdvanced from '@/components/examples/dialog/Advanced.vue'
import DialogAsync from '@/components/examples/dialog/Async.vue'
import DialogDetailPreview from '@/components/examples/dialog/DetailPreview.vue'
import DialogTableDialog from '@/components/examples/dialog/TableDialog.vue'
import DialogStepDialog from '@/components/examples/dialog/StepDialog.vue'
import DialogDynamicBtn from '@/components/examples/dialog/DynamicBtn.vue'
import DialogMultiInstance from '@/components/examples/dialog/MultiInstance.vue'
import DialogFormTableDialog from '@/components/examples/dialog/FormTableDialog.vue'
import AdvancedFormTable from '@/components/examples/advanced/FormTable.vue'
import AdvancedZeroCodeQuery from '@/components/examples/advanced/ZeroCodeQuery.vue'
import AdvancedCrossPageSelect from '@/components/examples/advanced/CrossPageSelect.vue'
import AdvancedStepForm from '@/components/examples/advanced/StepForm.vue'
import AdvancedFormTableDialog from '@/components/examples/advanced/FormTableDialog.vue'
import AdvancedOrderExpandTable from '@/components/examples/advanced/OrderExpandTable.vue'
import AdvancedOneLineCrud from '@/components/examples/advanced/OneLineCrud.vue'
import AdvancedRowApproval from '@/components/examples/advanced/RowApproval.vue'
import AdvancedAutoFitHeight from '@/components/examples/advanced/AutoFitHeight.vue'
import AdvancedAnyBackendApi from '@/components/examples/advanced/AnyBackendApi.vue'
import AdvancedConditionalBtns from '@/components/examples/advanced/ConditionalBtns.vue'
import AdvancedDialogTableForm from '@/components/examples/advanced/DialogTableForm.vue'
import AdvancedDynamicFormQuery from '@/components/examples/advanced/DynamicFormQuery.vue'
import AdvancedCascadeFormTable from '@/components/examples/advanced/CascadeFormTable.vue'
import AdvancedStepImportWizard from '@/components/examples/advanced/StepImportWizard.vue'
import AdvancedAdminPage from '@/components/examples/advanced/AdminPage.vue'

const route = useRoute()

const docsData = rawDocsData

const apiTitleMap: Record<string, string> = {
  Options: 'DialogOptions 弹窗配置',
  DialogOptions: 'DialogOptions 弹窗配置',
  'configBtn click': 'configBtn click 回调'
}

// Assign imported components by key
const dialogComponents: Record<string, any> = {
  basic: DialogBasic, form: DialogForm, confirm: DialogConfirm,
  'nested-modal': DialogNestedModal, advanced: DialogAdvanced, async: DialogAsync,
  'detail-preview': DialogDetailPreview, 'table-dialog': DialogTableDialog,
  'step-dialog': DialogStepDialog, 'dynamic-btn': DialogDynamicBtn,
  'multi-instance': DialogMultiInstance, 'form-table-dialog': DialogFormTableDialog
}
const linkageComponents: Record<string, any> = {
  'form-table': AdvancedFormTable, 'zero-code-query': AdvancedZeroCodeQuery,
  'cross-page-select': AdvancedCrossPageSelect, 'step-form': AdvancedStepForm,
  'form-table-dialog': AdvancedFormTableDialog, 'order-expand-table': AdvancedOrderExpandTable,
  'one-line-crud': AdvancedOneLineCrud, 'row-approval': AdvancedRowApproval,
  'auto-fit-height': AdvancedAutoFitHeight, 'any-backend-api': AdvancedAnyBackendApi,
  'conditional-btns': AdvancedConditionalBtns, 'dialog-table-form': AdvancedDialogTableForm,
  'dynamic-form-query': AdvancedDynamicFormQuery, 'cascade-form-table': AdvancedCascadeFormTable,
  'step-import-wizard': AdvancedStepImportWizard,
  'admin-page': AdvancedAdminPage
}

docsData['use-dialog'].examples.forEach((ex: any) => { ex.component = dialogComponents[ex.key] })
docsData['linkage'].examples.forEach((ex: any) => { ex.component = linkageComponents[ex.key] })

const currentDoc = computed(() => {
  const name = route.params.name
  return docsData[name] || { title: '未找到', description: '', examples: [] }
})

const toc = ref([
  { id: 'features', text: '核心特性' },
  { id: 'examples', text: '实战案例' },
  { id: 'api', text: 'API 参考' }
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
