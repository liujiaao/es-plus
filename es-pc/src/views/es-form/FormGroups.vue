<template>
  <div class="form-groups-demo">
    <a-alert
      message="分组容器是一份配置，不是三个 EsForm"
      type="info"
      show-icon
      class="intro-alert"
    >
      <template #description>
        字段上写 <code>group</code>，<code>layout</code> 里声明组的顺序与标题，Tabs / Steps / Collapse
        由 EsForm 自己渲染。没有 <code>group</code> 的字段按 <code>ungrouped</code> 策略处理
        （默认落进「其他」）。antdv 端的分桶规则与 Element Plus / Element UI 完全一致。
        <br />
        注意：<code>steps</code> 一次只渲染当前组，未渲染的字段不在表单实例里，
        <code>validate()</code> 只覆盖当前组。
      </template>
    </a-alert>

    <div class="toolbar">
      <span class="toolbar__label">容器：</span>
      <a-radio-group v-model:value="layoutType" size="small">
        <a-radio-button value="tabs">页签</a-radio-button>
        <a-radio-button value="steps">分步</a-radio-button>
        <a-radio-button value="collapse">折叠面板</a-radio-button>
      </a-radio-group>
      <a-checkbox v-model:checked="hideUngrouped">隐藏未分组字段（ungrouped: hidden）</a-checkbox>
    </div>

    <es-form
      :model="formModel"
      :form-item-list="formItems"
      :config-btn="configBtn"
      :layout-form-props="layoutProps"
    />

    <pre class="model-preview">{{ JSON.stringify(formModel, null, 2) }}</pre>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { EsForm } from '@es-plus/adapter-antdv'
import { message } from 'ant-design-vue'

const layoutType = ref<'tabs' | 'steps' | 'collapse'>('tabs')
const hideUngrouped = ref(false)

const formModel = reactive({
  name: '',
  phone: '',
  department: '',
  position: '',
  roles: [] as string[],
  remark: '',
  source: ''
})

// group 只写组 key；组的标题与顺序在 layout.groups 里声明一次
const formItems = [
  { prop: 'name', label: '姓名', formtype: 'Input' as const, span: 12, group: 'basic', required: true },
  { prop: 'phone', label: '手机号', formtype: 'Input' as const, span: 12, group: 'basic' },
  {
    prop: 'department',
    label: '部门',
    formtype: 'Select' as const,
    span: 12,
    group: 'work',
    dataOptions: [
      { label: '研发部', value: 'dev' },
      { label: '产品部', value: 'pm' },
      { label: '设计部', value: 'design' },
      { label: '运营部', value: 'ops' }
    ]
  },
  { prop: 'position', label: '职位', formtype: 'Input' as const, span: 12, group: 'work' },
  {
    prop: 'roles',
    label: '角色',
    formtype: 'Checkbox' as const,
    span: 24,
    group: 'perm',
    dataOptions: [
      { label: '管理员', value: 'admin' },
      { label: '编辑', value: 'editor' },
      { label: '查看者', value: 'viewer' }
    ]
  },
  {
    prop: 'remark',
    label: '备注',
    formtype: 'Input' as const,
    span: 24,
    group: 'perm',
    attrs: { type: 'textarea', rows: 3 }
  },
  // 没有 group：按 ungrouped 策略进「其他」，或被丢弃
  {
    prop: 'source',
    label: '来源渠道',
    formtype: 'Select' as const,
    span: 12,
    dataOptions: [
      { label: '官网', value: 'web' },
      { label: '转介绍', value: 'referral' },
      { label: '线下活动', value: 'event' }
    ]
  }
]

const layoutProps = computed(() => ({
  formLayProps: { labelCol: { span: 6 }, wrapperCol: { span: 16 } },
  layout: {
    type: layoutType.value,
    groups: [
      { key: 'basic', label: '基本信息' },
      { key: 'work', label: '工作信息' },
      // description 只有 steps 容器消费
      { key: 'perm', label: '权限配置', description: '角色决定可访问的菜单' }
    ],
    ungrouped: hideUngrouped.value ? 'hidden' : 'default',
    defaultLabel: '其他'
  }
}))

const configBtn = [
  {
    name: '重置',
    key: 'rest',
    direction: 'left',
    icon: 'RefreshLeft',
    click: (_model: unknown, formRef: any) => {
      formRef?.resetFields()
      message.info('已重置')
    }
  },
  {
    name: '保存',
    key: 'save',
    type: 'primary',
    icon: 'Check',
    click: async (model: any, formRef: any) => {
      try {
        await formRef?.validate()
        message.success(`已保存：${model.name || '(未命名)'}`)
      } catch {
        message.warning('当前可见的字段里有未通过的项')
      }
    }
  }
]
</script>

<style scoped>
.intro-alert {
  margin-bottom: var(--es-space-4);
}
.toolbar {
  display: flex;
  align-items: center;
  gap: var(--es-space-3);
  margin-bottom: var(--es-space-4);
  flex-wrap: wrap;
}
.toolbar__label {
  color: var(--es-text-secondary);
  font-size: var(--es-text-sm);
}
.model-preview {
  margin-top: var(--es-space-4);
  padding: var(--es-space-3) var(--es-space-4);
  background: var(--es-fill);
  border-radius: var(--es-radius-sm);
  font-size: var(--es-text-xs);
  color: var(--es-text-secondary);
}
</style>
