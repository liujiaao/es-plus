<template>
  <el-dialog
    v-model="dialogVisible"
    :show-close="false"
    width="600px"
    class="doc-search-dialog"
    @open="handleOpen"
  >
    <div class="search-container">
      <div class="search-input-wrapper">
        <el-icon class="search-icon"><Search /></el-icon>
        <input
          ref="searchInputRef"
          v-model="searchQuery"
          type="text"
          class="search-input"
          placeholder="搜索文档..."
          @input="handleSearch"
        />
        <div class="search-shortcut">ESC</div>
      </div>

      <div class="search-results" v-if="searchQuery">
        <div v-if="results.length === 0" class="no-results">
          没有找到相关结果
        </div>
        <div v-else class="results-list">
          <div
            v-for="(result, index) in results"
            :key="index"
            class="result-item"
            @click="handleSelect(result)"
          >
            <div class="result-title">{{ result.title }}</div>
            <div class="result-path">{{ result.path }}</div>
          </div>
        </div>
      </div>

      <div class="search-tips" v-else>
        <div class="tips-title">快速链接</div>
        <div class="quick-links">
          <div class="quick-link" @click="navigateTo('/guide/getting-started')">
            <el-icon><Document /></el-icon>
            <span>快速开始</span>
          </div>
          <div class="quick-link" @click="navigateTo('/components/es-form')">
            <el-icon><Edit /></el-icon>
            <span>EsForm 表单</span>
          </div>
          <div class="quick-link" @click="navigateTo('/components/es-table')">
            <el-icon><Grid /></el-icon>
            <span>EsTable 表格</span>
          </div>
          <div class="quick-link" @click="navigateTo('/advanced/use-dialog')">
            <el-icon><ChatDotRound /></el-icon>
            <span>useDialog 弹窗</span>
          </div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import Fuse from 'fuse.js'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const router = useRouter()

const searchQuery = ref('')
const searchInputRef = ref<HTMLInputElement>()

const searchData = [
  // Guide
  { title: '快速开始', path: '/guide/getting-started', category: '指南', content: '了解如何快速上手 ES-Plus，安装和基础使用' },
  { title: '安装', path: '/guide/installation', category: '指南', content: 'npm yarn pnpm 安装方式 环境要求 浏览器兼容性' },
  { title: '使用', path: '/guide/usage', category: '指南', content: '全局引入 按需引入 基本使用示例' },
  // Components
  { title: 'EsForm 高级表单', path: '/components/es-form', category: '组件', content: '配置化表单 formItemList 字段配置 联动验证 异步加载' },
  { title: 'EsTable 高级表格', path: '/components/es-table', category: '组件', content: '配置化表格 columns 分页 远程数据 选择 排序 自适应高度' },
  // Advanced
  { title: 'useDialog 弹窗', path: '/advanced/use-dialog', category: '高级', content: '编程式弹窗 JSX渲染 表单集成 嵌套弹窗 拖拽 registerRef' },
  { title: '高级联动组合', path: '/advanced/linkage', category: '高级', content: '表单表格联动 CRUD 零代码查询 跨页选择 分步向导' },
  // Tools
  { title: 'Playground', path: '/playground', category: '工具', content: '在线体验 实时预览 交互式配置' },
  // Specific features
  { title: '基础配置表单', path: '/components/es-form', category: '示例', content: 'formItemList JSON配置 Input Select DatePicker' },
  { title: '条件联动表单', path: '/components/es-form', category: '示例', content: 'isHidden 字段联动 条件显隐 动态表单' },
  { title: '表单验证', path: '/components/es-form', category: '示例', content: 'rules validate pattern validator 校验' },
  { title: '异步数据表单', path: '/components/es-form', category: '示例', content: 'apiParams 远程选项 级联联动 httpRequest' },
  { title: '分页表格', path: '/components/es-table', category: '示例', content: 'pagination configTableOut httpRequest 远程数据请求' },
  { title: '多选与跨页记忆', path: '/components/es-table', category: '示例', content: 'multiSelect cachePageSelection rowkey selection' },
  { title: '自定义列渲染', path: '/components/es-table', category: '示例', content: 'render scopedSlots formatter 自定义列' },
  { title: '零代码查询', path: '/advanced/linkage', category: '示例', content: 'triggerEvent apiParams.model 自动联动查询重置' },
  { title: 'CRUD弹窗', path: '/advanced/linkage', category: '示例', content: 'useDialog EsForm 增删改查 弹窗表单' },
  { title: '全局配置', path: '/guide/usage', category: '指南', content: 'app.use $httpRequest paginationLayout configQueryFieldOutput fieldFieldOutput' }
]

const fuse = new Fuse(searchData, {
  keys: ['title', 'content', 'category'],
  threshold: 0.3
})

const results = computed(() => {
  if (!searchQuery.value) return []
  return fuse.search(searchQuery.value).map(r => r.item)
})

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
})

const handleOpen = () => {
  searchQuery.value = ''
  setTimeout(() => {
    searchInputRef.value?.focus()
  }, 100)
}

const handleSearch = () => {
  // Fuse.js handles search reactively via computed
}

const handleSelect = (result: typeof searchData[0]) => {
  router.push(result.path)
  dialogVisible.value = false
}

const navigateTo = (path: string) => {
  router.push(path)
  dialogVisible.value = false
}
</script>

<style lang="scss" scoped>
.search-container {
  padding: 8px 0;
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background-color: var(--fill-color);
  border-radius: 8px;
  gap: 12px;

  .search-icon {
    font-size: 20px;
    color: var(--text-color-secondary);
  }

  .search-input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-size: 16px;
    color: var(--text-color-primary);

    &::placeholder {
      color: var(--text-color-secondary);
    }
  }

  .search-shortcut {
    padding: 4px 8px;
    font-size: 12px;
    color: var(--text-color-secondary);
    background-color: var(--bg-color);
    border-radius: 4px;
    border: 1px solid var(--border-color-lighter);
  }
}

.search-results {
  margin-top: 16px;
  max-height: 400px;
  overflow-y: auto;
}

.no-results {
  padding: 24px;
  text-align: center;
  color: var(--text-color-secondary);
}

.results-list {
  display: flex;
  flex-direction: column;
}

.result-item {
  padding: 12px 16px;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--fill-color-light);
  }

  .result-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-color-primary);
    margin-bottom: 4px;
  }

  .result-path {
    font-size: 12px;
    color: var(--text-color-secondary);
  }
}

.search-tips {
  margin-top: 16px;

  .tips-title {
    padding: 8px 16px;
    font-size: 12px;
    color: var(--text-color-secondary);
  }
}

.quick-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 16px;
}

.quick-link {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background-color: var(--fill-color);
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-color-regular);
  transition: all 0.2s;

  &:hover {
    background-color: var(--fill-color-light);
    color: var(--primary-color);
  }
}

:deep(.el-dialog__header) {
  display: none;
}

:deep(.el-dialog__body) {
  padding: 0;
}
</style>
