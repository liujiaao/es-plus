<template>
  <div class="example-form-search">
    <es-form
      ref="formRef"
      :model="formModel"
      :form-item-list="formItems"
      :config-btn="configBtn"
      :layout-form-props="layoutProps"
    />
    <div class="search-result" v-if="resultVisible">
      <el-alert type="success" :closable="false" :title="`查询到 ${resultCount} 条结果`" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { EsForm } from 'es-plus'
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'

const formRef = ref()
const resultVisible = ref(false)
const resultCount = ref(0)
const showMore = ref(false)

const formModel = reactive({
  keyword: '',
  type: '',
  status: '',
  priority: '',
  dateRange: [],
  assignee: ''
})

// 模拟异步加载选项
const mockFetchOptions = (type: string): Promise<{ label: string; value: string }[]> => {
  const data: Record<string, { label: string; value: string }[]> = {
    type: [
      { label: '需求', value: 'feature' },
      { label: '缺陷', value: 'bug' },
      { label: '优化', value: 'improvement' },
      { label: '文档', value: 'docs' }
    ],
    assignee: [
      { label: '张三', value: 'zhangsan' },
      { label: '李四', value: 'lisi' },
      { label: '王五', value: 'wangwu' }
    ]
  }
  return new Promise(resolve => setTimeout(() => resolve(data[type] || []), 300))
}

const formItems = [
  {
    prop: 'keyword',
    label: '关键词',
    span: 6,
    formtype: 'Input' as const,
    attrs: { placeholder: '搜索标题/描述', clearable: true }
  },
  {
    prop: 'type',
    label: '类型',
    span: 6,
    formtype: 'Select' as const,
    apiParams: { url: '/api/options/type' },
    httpRequest: () => mockFetchOptions('type'),
    listenToCallBack: {
      crtn: (data: any) => data
    },
    attrs: { placeholder: '请选择', clearable: true }
  },
  {
    prop: 'status',
    label: '状态',
    span: 6,
    formtype: 'Select' as const,
    dataOptions: [
      { label: '待处理', value: 'pending' },
      { label: '进行中', value: 'active' },
      { label: '已完成', value: 'done' },
      { label: '已关闭', value: 'closed' }
    ],
    attrs: { placeholder: '请选择', clearable: true }
  },
  {
    prop: 'priority',
    label: '优先级',
    span: 6,
    formtype: 'Select' as const,
    dataOptions: [
      { label: '紧急', value: 'urgent' },
      { label: '高', value: 'high' },
      { label: '中', value: 'medium' },
      { label: '低', value: 'low' }
    ],
    attrs: { placeholder: '请选择', clearable: true },
    isHidden: () => !showMore.value
  },
  {
    prop: 'assignee',
    label: '负责人',
    span: 6,
    formtype: 'Select' as const,
    apiParams: { url: '/api/options/assignee' },
    httpRequest: () => mockFetchOptions('assignee'),
    listenToCallBack: {
      crtn: (data: any) => data
    },
    attrs: { placeholder: '请选择', clearable: true },
    isHidden: () => !showMore.value
  },
  {
    prop: 'dateRange',
    label: '创建时间',
    span: 12,
    formtype: 'datePicker' as const,
    attrs: { type: 'daterange', startPlaceholder: '开始日期', endPlaceholder: '结束日期', clearable: true },
    isHidden: () => !showMore.value
  }
]

const configBtn = [
  {
    name: showMore.value ? '收起' : '更多',
    direction: 'left',
    icon: showMore.value ? 'ArrowUp' : 'ArrowDown',
    click: () => { showMore.value = !showMore.value }
  },
  {
    name: '查询',
    key: 'query',
    type: 'primary',
    direction: 'right',
    icon: 'Search',
    click: (model: Record<string, unknown>) => {
      resultCount.value = Math.floor(Math.random() * 50) + 1
      resultVisible.value = true
      ElMessage.success('查询完成')
      console.log('查询条件:', model)
    }
  },
  {
    name: '重置',
    direction: 'right',
    icon: 'RefreshLeft',
    click: (_: unknown, formRefInstance: { resetFields: () => void } | null) => {
      formRefInstance?.resetFields()
      resultVisible.value = false
    }
  }
]

const layoutProps = {
  fromLayProps: { labelWidth: '80px', size: 'small', minFoldRows: 4, btnColSpan: 24 },
  rowLayProps: { gutter: 16 }
}
</script>

<style scoped>
.example-form-search { padding: 20px; }
.search-result { margin-top: 12px; }
</style>
