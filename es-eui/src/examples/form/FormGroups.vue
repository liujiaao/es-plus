<template>
  <div class="form-groups-demo">
    <div class="intro-wrap">
      <el-alert
        title="分组容器是一份配置，不是三个 EsForm"
        type="info"
        :closable="false"
        show-icon
      >字段上写 group，layout 里声明组的顺序与标题，Tabs / Steps / Collapse 由 EsForm 自己渲染。
        没有 group 的字段按 ungrouped 策略处理（默认落进「其他」）。Element UI 端的分桶规则与
        Element Plus / Ant Design Vue 完全一致。steps 一次只渲染当前组，validate() 只覆盖当前组。</el-alert>
    </div>

    <div class="toolbar">
      <span class="toolbar__label">容器：</span>
      <el-radio-group v-model="layoutType" size="small">
        <el-radio-button label="tabs">页签</el-radio-button>
        <el-radio-button label="steps">分步</el-radio-button>
        <el-radio-button label="collapse">折叠面板</el-radio-button>
      </el-radio-group>
      <el-checkbox v-model="hideUngrouped">隐藏未分组字段（ungrouped: hidden）</el-checkbox>
    </div>

    <es-form :model="model" :form-item-list="formItems" :config-btn="[]" :layout-form-props="layoutProps" />

    <pre class="model-preview">{{ JSON.stringify(model, null, 2) }}</pre>
  </div>
</template>

<script>
import { defineComponent, ref, reactive, computed } from '@vue/composition-api'

export default defineComponent({
  name: 'FormGroups',
  setup() {
    const layoutType = ref('tabs')
    const hideUngrouped = ref(false)

    const model = reactive({
      name: '', phone: '', department: '', position: '',
      roles: [], remark: '', source: ''
    })

    // group 只写组 key；组的标题与顺序在 layout.groups 里声明一次
    const formItems = [
      { prop: 'name', label: '姓名', formtype: 'Input', span: 12, group: 'basic', required: true },
      { prop: 'phone', label: '手机号', formtype: 'Input', span: 12, group: 'basic' },
      { prop: 'department', label: '部门', formtype: 'Select', span: 12, group: 'work',
        dataOptions: [
          { label: '技术部', value: 'tech' }, { label: '产品部', value: 'product' },
          { label: '运营部', value: 'ops' }, { label: '市场部', value: 'market' },
        ] },
      { prop: 'position', label: '职位', formtype: 'Input', span: 12, group: 'work' },
      { prop: 'roles', label: '角色', formtype: 'Checkbox', span: 24, group: 'perm',
        dataOptions: [
          { label: '管理员', value: 'admin' }, { label: '编辑', value: 'editor' },
          { label: '查看者', value: 'viewer' },
        ] },
      { prop: 'remark', label: '备注', formtype: 'Input', span: 24, group: 'perm',
        attrs: { type: 'textarea', rows: 3 } },
      // 没有 group：按 ungrouped 策略进「其他」，或被丢弃
      { prop: 'source', label: '来源渠道', formtype: 'Select', span: 12,
        dataOptions: [
          { label: '官网', value: 'web' }, { label: '转介绍', value: 'referral' },
          { label: '线下活动', value: 'event' },
        ] },
    ]

    const layoutProps = computed(() => ({
      formLayProps: { labelWidth: '90px' },
      layout: {
        type: layoutType.value,
        groups: [
          { key: 'basic', label: '基本信息' },
          { key: 'work', label: '工作信息' },
          // description 只有 steps 容器消费
          { key: 'perm', label: '权限配置', description: '角色决定可访问的菜单' },
        ],
        ungrouped: hideUngrouped.value ? 'hidden' : 'default',
        defaultLabel: '其他',
      },
    }))

    return { layoutType, hideUngrouped, model, formItems, layoutProps }
  },
})
</script>

<style scoped>
.form-groups-demo {
  max-width: 900px;
}
.intro-wrap {
  margin-bottom: var(--es-space-3);
}
.toolbar {
  display: flex;
  align-items: center;
  gap: var(--es-space-3);
  margin-bottom: var(--es-space-3);
  flex-wrap: wrap;
}
.toolbar__label {
  color: var(--es-text-secondary);
  font-size: var(--es-text-sm);
}
.model-preview {
  background: var(--es-fill-light);
  padding: var(--es-space-3);
  border-radius: var(--es-radius-xs);
  margin-top: var(--es-space-3);
  font-size: var(--es-text-xs);
}
</style>
