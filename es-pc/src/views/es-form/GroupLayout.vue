<template>
  <div class="group-layout-demo">
    <a-alert
      message="进阶：多实例组合 + 逐组校验"
      type="info"
      show-icon
      class="intro-alert"
    >
      <template #description>
        只想把字段分到 Tabs / Steps / Collapse 里，用内置的 layout: { type, groups } 就够了
        （见「分组容器：页签 / 分步 / 折叠面板」）。需要每组独立校验时才用这里的写法：
        用 a-tabs 包裹多个 EsForm，每组一份 formItemList，共用同一个 model。
        保存前逐组 validate()，否则藏在未打开标签页里的错误用户看不见。
      </template>
    </a-alert>

    <a-tabs v-model:activeKey="activeTab" type="card">
      <a-tab-pane key="basic" tab="基本信息" force-render>
        <es-form
          ref="basicRef"
          :model="formModel"
          :form-item-list="basicItems"
          :config-btn="[]"
          :layout-form-props="{ labelCol: { span: 5 }, wrapperCol: { span: 16 } }"
        />
      </a-tab-pane>
      <a-tab-pane key="work" tab="工作信息" force-render>
        <es-form
          ref="workRef"
          :model="formModel"
          :form-item-list="workItems"
          :config-btn="[]"
          :layout-form-props="{ labelCol: { span: 5 }, wrapperCol: { span: 16 } }"
        />
      </a-tab-pane>
      <a-tab-pane key="perm" tab="权限设置" force-render>
        <es-form
          ref="permRef"
          :model="formModel"
          :form-item-list="permItems"
          :config-btn="[]"
          :layout-form-props="{ labelCol: { span: 5 }, wrapperCol: { span: 16 } }"
        />
      </a-tab-pane>
    </a-tabs>

    <div class="action-bar">
      <a-button @click="handleReset">重置</a-button>
      <a-button type="primary" @click="handleSubmit">提交</a-button>
    </div>

    <pre v-if="submitted" class="model-preview">{{ JSON.stringify(formModel, null, 2) }}</pre>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { EsForm } from '@es-plus/adapter-antdv'
import { message } from 'ant-design-vue'

const activeTab = ref('basic')
const submitted = ref(false)
const basicRef = ref()
const workRef = ref()
const permRef = ref()

const formModel = reactive({
  name: '', phone: '', email: '',
  department: '', role: '', salary: undefined as number | undefined,
  permissions: [] as string[],
})

const basicItems = [
  { prop: 'name', label: '姓名', formtype: 'Input' as const, span: 12, required: true },
  { prop: 'phone', label: '手机号', formtype: 'Input' as const, span: 12 },
  { prop: 'email', label: '邮箱', formtype: 'Input' as const, span: 24,
    rules: [{ type: 'email', message: '请输入合法邮箱', trigger: 'blur' }] },
]

const workItems = [
  {
    prop: 'department', label: '部门', formtype: 'Select' as const, span: 12, required: true,
    dataOptions: [
      { label: '技术部', value: 'tech' }, { label: '产品部', value: 'product' },
      { label: '运营部', value: 'ops' }, { label: '市场部', value: 'market' },
    ],
  },
  {
    prop: 'role', label: '职位', formtype: 'Select' as const, span: 12,
    dataOptions: [
      { label: '工程师', value: 'engineer' }, { label: '技术负责人', value: 'lead' },
    ],
  },
  { prop: 'salary', label: '薪资（元）', formtype: 'InputNumber' as const, span: 12,
    attrs: { min: 0, max: 999999, step: 1000 } },
]

const permItems = [
  {
    prop: 'permissions', label: '功能权限', formtype: 'Checkbox' as const, span: 24,
    dataOptions: [
      { label: '查看', value: 'view' }, { label: '编辑', value: 'edit' },
      { label: '删除', value: 'delete' }, { label: '导出', value: 'export' },
    ],
  },
]

// 逐组校验；第一个不通过的组切到前台 —— 否则错误藏在没打开的标签页里
async function handleSubmit() {
  const groups = [
    { key: 'basic', label: '基本信息', form: basicRef },
    { key: 'work', label: '工作信息', form: workRef },
    { key: 'perm', label: '权限设置', form: permRef },
  ]
  for (const g of groups) {
    try {
      await g.form.value?.validate()
    } catch {
      activeTab.value = g.key
      message.error(`「${g.label}」有未通过的字段`)
      return
    }
  }
  submitted.value = true
  message.success('提交成功')
}

function handleReset() {
  Object.assign(formModel, { name: '', phone: '', email: '', department: '', role: '', salary: undefined, permissions: [] })
  submitted.value = false
  activeTab.value = 'basic'
}
</script>

<style scoped>
.group-layout-demo {
  max-width: 820px;
}
.intro-alert {
  margin-bottom: var(--es-space-4);
}
.action-bar {
  display: flex;
  justify-content: flex-end;
  gap: var(--es-space-2);
  margin-top: var(--es-space-4);
}
.model-preview {
  background: var(--es-fill-light);
  padding: var(--es-space-3);
  border-radius: var(--es-radius-xs);
  margin-top: var(--es-space-3);
  font-size: var(--es-text-xs);
}
</style>
