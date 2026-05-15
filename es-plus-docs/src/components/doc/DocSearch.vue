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
          :placeholder="t('header.search')"
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
          <div class="quick-link" @click="navigateTo('/components/button')">
            <el-icon><Grid /></el-icon>
            <span>Button 组件</span>
          </div>
          <div class="quick-link" @click="navigateTo('/guide/installation')">
            <el-icon><Download /></el-icon>
            <span>安装指南</span>
          </div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import Fuse from 'fuse.js'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const { t } = useI18n()
const router = useRouter()

const searchQuery = ref('')
const searchInputRef = ref<HTMLInputElement>()

// 模拟搜索数据
const searchData = [
  { title: '快速开始', path: '/guide/getting-started', content: '了解如何快速上手 ES-Plus' },
  { title: '安装', path: '/guide/installation', content: 'npm 安装方式' },
  { title: '使用', path: '/guide/usage', content: '如何在项目中使用组件' },
  { title: 'Button 按钮', path: '/components/button', content: '按钮组件的使用方法' },
  { title: 'Input 输入框', path: '/components/input', content: '输入框组件的使用方法' },
  { title: 'Select 选择器', path: '/components/select', content: '选择器组件的使用方法' }
]

const fuse = new Fuse(searchData, {
  keys: ['title', 'content'],
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
  // 搜索逻辑
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
      color: var(--text-color-placeholder);
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
