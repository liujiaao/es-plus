<template>
  <div class="form-groups-demo">
    <el-alert type="info" :closable="false" class="intro-alert">
      <template #title>分组容器是一份配置，不是三个 EsForm</template>
      <div class="intro-body">
        字段上写 <code>group</code>，<code>layout</code> 里声明组的顺序与标题，容器由组件自己渲染。
        三端（Element Plus / Element UI / Ant Design Vue）共用同一套分桶规则：未声明的组按首次出现排序，
        没有 <code>group</code> 的字段落进<code>ungrouped</code> 指定的去处（默认「其他」）。
        <br />
        注意：<code>steps</code> 一次只渲染当前组，未渲染的字段不在表单实例里，
        <code>validate()</code> 只覆盖当前组 —— 需要跨步校验时按『分步组合』示例逐组校验。
      </div>
    </el-alert>

    <div class="toolbar">
      <span class="toolbar__label">容器：</span>
      <el-radio-group v-model="layoutType" size="small">
        <el-radio-button value="tabs">页签</el-radio-button>
        <el-radio-button value="steps">分步</el-radio-button>
        <el-radio-button value="collapse">折叠面板</el-radio-button>
      </el-radio-group>
      <el-checkbox v-model="hideUngrouped">隐藏未分组字段（ungrouped: hidden）</el-checkbox>
    </div>

    <es-form :model="formModel" :form-item-list="formItems" :config-btn="configBtn" :layout-form-props="layoutProps" />

    <pre class="model-preview">{{ formModel }}</pre>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { EsForm } from '@es-plus/vue3'
import { ElMessage } from 'element-plus'

const layoutType = ref('tabs')
const hideUngrouped = ref(false)

const formModel = reactive({
  name: '',
  phone: '',
  department: '',
  position: '',
  roles: [],
  remark: '',
  source: ''
})

// group 只写组 key；组的标题与顺序在 layout.groups 里声明一次
const formItems = [
  { prop: 'name', label: '姓名', formtype: 'Input', span: 12, group: 'basic', required: true },
  { prop: 'phone', label: '手机号', formtype: 'Input', span: 12, group: 'basic' },
  {
    prop: 'department',
    label: '部门',
    formtype: 'Select',
    span: 12,
    group: 'work',
    dataOptions: [
      { label: '研发部', value: 'dev' },
      { label: '产品部', value: 'pm' },
      { label: '设计部', value: 'design' },
      { label: '运营部', value: 'ops' }
    ]
  },
  { prop: 'position', label: '职位', formtype: 'Input', span: 12, group: 'work' },
  {
    prop: 'roles',
    label: '角色',
    formtype: 'Checkbox',
    span: 24,
    group: 'perm',
    dataOptions: [
      { label: '管理员', value: 'admin' },
      { label: '编辑', value: 'editor' },
      { label: '查看者', value: 'viewer' }
    ]
  },
  { prop: 'remark', label: '备注', formtype: 'Input', span: 24, group: 'perm', attrs: { type: 'textarea', rows: 3 } },
  // 没有 group：按 ungrouped 策略进「其他」，或被丢弃
  {
    prop: 'source',
    label: '来源渠道',
    formtype: 'Select',
    span: 12,
    dataOptions: [
      { label: '官网', value: 'web' },
      { label: '转介绍', value: 'referral' },
      { label: '线下活动', value: 'event' }
    ]
  }
]

const layoutProps = computed(() => ({
  formLayProps: { labelWidth: '90px' },
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
    click: (_, formRef) => {
      formRef?.resetFields()
      ElMessage.info('已重置')
    }
  },
  {
    name: '保存',
    key: 'save',
    type: 'primary',
    icon: 'Check',
    click: async (model, formRef) => {
      try {
        await formRef?.validate()
        ElMessage.success(`已保存：${model.name || '(未命名)'}`)
      } catch {
        ElMessage.warning('当前可见的字段里有未通过的项')
      }
    }
  }
]
</script>

<style scoped>
.intro-alert {
  margin-bottom: var(--es-space-4);
}
.intro-body {
  font-size: var(--es-text-sm);
  margin-top: var(--es-space-2);
  line-height: 1.6;
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
  background: var(--el-fill-color-light);
  border-radius: var(--es-radius-sm);
  font-size: var(--es-text-xs);
  color: var(--el-text-color-secondary);
}
</style>
