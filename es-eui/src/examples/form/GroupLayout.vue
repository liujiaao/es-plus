<template>
  <div class="group-layout-demo">
    <div class="intro-wrap">
      <el-alert
        title="EsForm 是平铺的栅格表单，没有内置分组容器"
        type="info"
        :closable="false"
        show-icon
      >用 el-tabs 包裹多个 EsForm：每组一份 formItemList，共用同一个 model。
        保存前逐组 validate()，否则藏在未打开标签页里的错误用户看不见。</el-alert>
    </div>

    <el-tabs v-model="activeTab" type="border-card">
      <el-tab-pane label="基本信息" name="basic">
        <es-form
          ref="basicRef"
          :model="model"
          :form-item-list="basicItems"
          :config-btn="[]"
          :layout-form-props="{ labelWidth: '100px' }"
        />
      </el-tab-pane>
      <el-tab-pane label="工作信息" name="work">
        <es-form
          ref="workRef"
          :model="model"
          :form-item-list="workItems"
          :config-btn="[]"
          :layout-form-props="{ labelWidth: '100px' }"
        />
      </el-tab-pane>
      <el-tab-pane label="权限设置" name="perm">
        <es-form
          ref="permRef"
          :model="model"
          :form-item-list="permItems"
          :config-btn="[]"
          :layout-form-props="{ labelWidth: '100px' }"
        />
      </el-tab-pane>
    </el-tabs>

    <div class="action-bar">
      <el-button @click="handleReset">重置</el-button>
      <el-button type="primary" @click="handleSubmit">提交</el-button>
    </div>

    <pre v-if="submitted" class="model-preview">{{ JSON.stringify(model, null, 2) }}</pre>
  </div>
</template>

<script>
import { defineComponent, ref, reactive } from '@vue/composition-api'
import Message from 'element-ui/lib/message'

export default defineComponent({
  name: 'GroupLayout',
  setup() {
    const activeTab = ref('basic')
    const submitted = ref(false)
    const basicRef = ref()
    const workRef = ref()
    const permRef = ref()

    const model = reactive({
      name: '', phone: '', email: '',
      department: '', role: '', salary: undefined,
      permissions: [],
    })

    const basicItems = [
      { prop: 'name', label: '姓名', formtype: 'Input', span: 12, required: true },
      { prop: 'phone', label: '手机号', formtype: 'Input', span: 12 },
      { prop: 'email', label: '邮箱', formtype: 'Input', span: 24,
        rules: [{ type: 'email', message: '请输入合法邮箱', trigger: 'blur' }] },
    ]

    const workItems = [
      { prop: 'department', label: '部门', formtype: 'Select', span: 12, required: true,
        dataOptions: [
          { label: '技术部', value: 'tech' }, { label: '产品部', value: 'product' },
          { label: '运营部', value: 'ops' }, { label: '市场部', value: 'market' },
        ] },
      { prop: 'role', label: '职位', formtype: 'Select', span: 12,
        dataOptions: [
          { label: '工程师', value: 'engineer' }, { label: '技术负责人', value: 'lead' },
        ] },
      { prop: 'salary', label: '薪资（元）', formtype: 'InputNumber', span: 12,
        attrs: { min: 0, max: 999999, step: 1000 } },
    ]

    const permItems = [
      { prop: 'permissions', label: '功能权限', formtype: 'Checkbox', span: 24,
        dataOptions: [
          { label: '查看', value: 'view' }, { label: '编辑', value: 'edit' },
          { label: '删除', value: 'delete' }, { label: '导出', value: 'export' },
        ] },
    ]

    // 逐组校验；第一个不通过的组切到前台 —— 否则错误藏在没打开的标签页里
    async function handleSubmit() {
      const groups = [
        { prop: 'basic', label: '基本信息', form: basicRef },
        { prop: 'work', label: '工作信息', form: workRef },
        { prop: 'perm', label: '权限设置', form: permRef },
      ]
      for (const g of groups) {
        try {
          await g.form.value?.validate()
        } catch (e) {
          activeTab.value = g.prop
          Message.error('「' + g.label + '」有未通过的字段')
          return
        }
      }
      submitted.value = true
      Message.success('提交成功')
    }

    function handleReset() {
      Object.assign(model, { name: '', phone: '', email: '', department: '', role: '', salary: undefined, permissions: [] })
      submitted.value = false
      activeTab.value = 'basic'
    }

    return { activeTab, submitted, model, basicItems, workItems, permItems, basicRef, workRef, permRef, handleSubmit, handleReset }
  },
})
</script>

<style scoped>
.group-layout-demo {
  max-width: 900px;
}
.intro-wrap {
  margin-bottom: var(--es-space-3);
}
.action-bar {
  display: flex;
  justify-content: flex-end;
  gap: var(--es-space-2);
  margin-top: var(--es-space-3);
}
.model-preview {
  background: var(--es-fill-light);
  padding: var(--es-space-3);
  border-radius: var(--es-radius-xs);
  margin-top: var(--es-space-3);
  font-size: var(--es-text-xs);
}
</style>
