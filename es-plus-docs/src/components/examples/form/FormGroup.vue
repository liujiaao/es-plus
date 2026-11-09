<template>
  <div class="form-group-demo">
    <el-alert type="info" :closable="false" class="intro-alert">
      <template #title>EsForm 是平铺的栅格表单，没有内置分组容器</template>
      <div class="intro-body">
        需要 Tabs / Steps / Collapse 时，用对应的容器组件包裹多个 EsForm：每组一份
        <code>formItemList</code>，共用同一个 <code>model</code>。难点在校验 ——
        字段藏在没打开的标签页里，用户看不见错误。下面的做法是：保存时逐组 <code>validate()</code>，
        第一个不通过的组自动切到前台；分步模式下「下一步」只校验当前步。
      </div>
    </el-alert>

    <div class="layout-switch">
      <span class="layout-label">布局：</span>
      <el-radio-group v-model="layoutType" size="small">
        <el-radio-button value="tabs">Tabs 分组</el-radio-button>
        <el-radio-button value="steps">Steps 分步</el-radio-button>
        <el-radio-button value="collapse">折叠面板</el-radio-button>
      </el-radio-group>
    </div>

    <!-- Tabs -->
    <el-tabs v-if="layoutType === 'tabs'" v-model="activeGroup">
      <el-tab-pane v-for="g in groups" :key="g.key" :label="g.label" :name="g.key">
        <es-form :ref="(el) => setFormRef(g.key, el)" :model="formModel" :form-item-list="g.items" :layout-form-props="layout" />
      </el-tab-pane>
    </el-tabs>

    <!-- Steps：一次只渲染当前步 -->
    <template v-else-if="layoutType === 'steps'">
      <el-steps :active="activeStep" finish-status="success" class="steps-bar">
        <el-step v-for="g in groups" :key="g.key" :title="g.label" />
      </el-steps>
      <es-form
        :key="groups[activeStep].key"
        :ref="(el) => setFormRef(groups[activeStep].key, el)"
        :model="formModel"
        :form-item-list="groups[activeStep].items"
        :layout-form-props="layout"
      />
    </template>

    <!-- Collapse -->
    <el-collapse v-else v-model="openPanels">
      <el-collapse-item v-for="g in groups" :key="g.key" :title="g.label" :name="g.key">
        <es-form :ref="(el) => setFormRef(g.key, el)" :model="formModel" :form-item-list="g.items" :layout-form-props="layout" />
      </el-collapse-item>
    </el-collapse>

    <div class="action-bar">
      <template v-if="layoutType === 'steps'">
        <el-button :disabled="activeStep === 0" @click="activeStep--">上一步</el-button>
        <el-button v-if="activeStep < groups.length - 1" type="primary" @click="nextStep">下一步</el-button>
        <el-button v-else type="primary" @click="save">提交</el-button>
      </template>
      <el-button v-else type="primary" @click="save">保存</el-button>
      <el-button @click="reset">重置</el-button>
    </div>

    <pre class="model-preview">{{ formModel }}</pre>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { EsForm } from '@es-plus/vue3'
import { ElMessage } from 'element-plus'

type GroupKey = 'basic' | 'work' | 'perm'

const layoutType = ref<'tabs' | 'steps' | 'collapse'>('tabs')
const activeGroup = ref<GroupKey>('basic')
const activeStep = ref(0)
const openPanels = ref<GroupKey[]>(['basic'])
const layout = { labelWidth: '90px' }

const emptyModel = () => ({ name: '', phone: '', email: '', department: '', position: '', roles: [] as string[], remark: '' })
const formModel = reactive(emptyModel())

const groups: { key: GroupKey; label: string; items: Record<string, unknown>[] }[] = [
  {
    key: 'basic',
    label: '基本信息',
    items: [
      { prop: 'name', label: '姓名', formtype: 'Input', span: 12, required: true },
      { prop: 'phone', label: '手机号', formtype: 'Input', span: 12,
        rules: [
          { required: true, message: '请输入手机号', trigger: 'blur' },
          { pattern: /^1\d{10}$/, message: '请输入 11 位手机号', trigger: 'blur' },
        ] },
      { prop: 'email', label: '邮箱', formtype: 'Input', span: 12 },
    ],
  },
  {
    key: 'work',
    label: '工作信息',
    items: [
      { prop: 'department', label: '部门', formtype: 'Select', span: 12, required: true,
        dataOptions: [
          { label: '研发部', value: 'dev' }, { label: '产品部', value: 'pm' },
          { label: '设计部', value: 'design' }, { label: '运营部', value: 'ops' },
        ] },
      { prop: 'position', label: '职位', formtype: 'Input', span: 12 },
    ],
  },
  {
    key: 'perm',
    label: '权限配置',
    items: [
      { prop: 'roles', label: '角色', formtype: 'Checkbox', span: 24, required: true,
        dataOptions: [{ label: '管理员', value: 'admin' }, { label: '编辑', value: 'editor' }, { label: '查看者', value: 'viewer' }] },
      { prop: 'remark', label: '备注', formtype: 'Input', span: 24, attrs: { type: 'textarea', rows: 3 } },
    ],
  },
]

// 每组一个表单实例；切换布局时旧实例卸载，回调收到 null 时清掉
const formRefs = new Map<GroupKey, { validate: () => Promise<unknown>; clearValidate: () => void }>()
function setFormRef(key: GroupKey, el: unknown) {
  if (el) formRefs.set(key, el as never)
  else formRefs.delete(key)
}
watch(layoutType, () => {
  formRefs.clear()
  activeStep.value = 0
})

async function isValid(key: GroupKey) {
  const form = formRefs.get(key)
  if (!form) return true
  try {
    await form.validate()
    return true
  } catch {
    return false
  }
}

async function nextStep() {
  if (await isValid(groups[activeStep.value].key)) activeStep.value++
}

async function save() {
  for (const g of groups) {
    if (!(await isValid(g.key))) {
      // 把出错的组切到前台，否则错误藏在看不见的标签页里
      activeGroup.value = g.key
      if (!openPanels.value.includes(g.key)) openPanels.value.push(g.key)
      ElMessage.warning(`「${g.label}」有未通过的字段`)
      return
    }
  }
  ElMessage.success(`已保存：${formModel.name}`)
}

function reset() {
  Object.assign(formModel, emptyModel())
  formRefs.forEach((f) => f.clearValidate())
  activeStep.value = 0
  activeGroup.value = 'basic'
}
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
.layout-switch {
  display: flex;
  gap: var(--es-space-2);
  margin-bottom: var(--es-space-4);
  align-items: center;
}
.layout-label {
  color: var(--es-text-secondary);
  font-size: var(--es-text-sm);
}
.steps-bar {
  margin-bottom: var(--es-space-4);
}
.action-bar {
  margin-top: var(--es-space-4);
  display: flex;
  gap: var(--es-space-2);
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
