<template>
  <div class="example-form-search">
    <es-form
      :model="formModel"
      :form-item-list="formItems"
      :config-btn="configBtn"
      :layout-form-props="layoutProps"
    />
    <div class="search-result" v-if="resultVisible">
      <a-alert type="success" :closable="false" :message="`查询到 ${resultCount} 条结果（本地模拟数据）`" />
      <ul class="result-list">
        <li v-for="item in matchedPreview" :key="item.title">{{ item.title }}</li>
        <li v-if="resultCount > matchedPreview.length">… 还有 {{ resultCount - matchedPreview.length }} 条</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { EsForm } from '@es-plus/adapter-antdv'
import { ref, reactive, computed } from 'vue'
import { message } from 'ant-design-vue'

const resultVisible = ref(false)
const resultCount = ref(0)
const matchedPreview = ref<{ title: string }[]>([])
const showMore = ref(false)

// 本地模拟数据：查询结果是真算出来的，不是随机数
const issuePool = Array.from({ length: 48 }, (_, i) => ({
  title: `${['登录页', '订单列表', '报表导出', '权限配置', '消息中心'][i % 5]}问题 ${i + 1}`,
  type: ['feature', 'bug', 'improvement', 'docs'][i % 4],
  status: ['pending', 'active', 'done', 'closed'][(i * 3) % 4],
  priority: ['urgent', 'high', 'medium', 'low'][i % 4],
  assignee: ['zhangsan', 'lisi', 'wangwu'][i % 3]
}))

function queryIssues(model: Record<string, any>) {
  const keyword = String(model.keyword || '').trim()
  return issuePool.filter((it) =>
    (!keyword || it.title.includes(keyword)) &&
    (!model.type || it.type === model.type) &&
    (!model.status || it.status === model.status) &&
    (!model.priority || it.priority === model.priority) &&
    (!model.assignee || it.assignee === model.assignee)
  )
}

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
    attrs: { placeholder: '搜索标题/描述', allowClear: true }
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
    attrs: { placeholder: '请选择', allowClear: true }
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
    attrs: { placeholder: '请选择', allowClear: true }
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
    attrs: { placeholder: '请选择', allowClear: true },
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
    attrs: { placeholder: '请选择', allowClear: true },
    isHidden: () => !showMore.value
  },
  {
    prop: 'dateRange',
    label: '创建时间',
    span: 12,
    formtype: 'DatePicker' as const,
    attrs: { type: 'daterange', startPlaceholder: '开始日期', endPlaceholder: '结束日期', allowClear: true },
    isHidden: () => !showMore.value
  }
]

const configBtn = computed(() => [
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
      const rows = queryIssues(model)
      resultCount.value = rows.length
      matchedPreview.value = rows.slice(0, 5)
      resultVisible.value = true
      message.success('查询完成')
    }
  },
  {
    name: '重置',
    direction: 'right',
    icon: 'RefreshLeft',
    click: (_: unknown, formRefInstance: { resetFields: () => void } | null) => {
      formRefInstance?.resetFields()
      resultVisible.value = false
      matchedPreview.value = []
    }
  }
])

const layoutProps = {
  formLayProps: { labelWidth: '80px', size: 'small', minFoldRows: 4, btnColSpan: 24 },
  rowLayProps: { gutter: 16 }
}
</script>

<style scoped>
.example-form-search { padding: 20px; }
.search-result { margin-top: 12px; }
.result-list { margin: 8px 0 0; padding-left: 20px; color: #606266; font-size: 13px; line-height: 1.9; }
.result-list { margin: 8px 0 0; padding-left: 20px; color: #606266; font-size: 13px; line-height: 1.9; }
</style>
