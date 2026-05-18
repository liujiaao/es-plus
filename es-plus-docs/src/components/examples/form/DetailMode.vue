<template>
  <div class="example-form-detail">
    <div class="mode-toggle">
      <span>模式：</span>
      <el-switch v-model="isEdit" active-text="编辑" inactive-text="详情" @change="onModeChange" />
    </div>
    <es-form
      ref="formRef"
      :model="formModel"
      :form-item-list="currentFormItems"
      :config-btn="isEdit ? configBtn : undefined"
      :layout-form-props="layoutProps"
    />
  </div>
</template>

<script setup lang="ts">
import { EsForm } from 'es-plus'
import { ref, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'

const formRef = ref()
const isEdit = ref(false)

const formModel = reactive({
  name: '张三',
  department: 'tech',
  role: 'admin',
  email: 'zhangsan@example.com',
  phone: '13800138000',
  status: true
})

const departmentMap: Record<string, string> = { tech: '技术部', product: '产品部', design: '设计部' }
const roleMap: Record<string, string> = { admin: '管理员', editor: '编辑者', viewer: '查看者' }

const baseFormItems = [
  {
    prop: 'name',
    label: '姓名',
    span: 8,
    formtype: 'Input' as const,
    attrs: { placeholder: '请输入姓名' }
  },
  {
    prop: 'department',
    label: '部门',
    span: 8,
    formtype: 'Select' as const,
    dataOptions: [
      { label: '技术部', value: 'tech' },
      { label: '产品部', value: 'product' },
      { label: '设计部', value: 'design' }
    ],
    attrs: { placeholder: '请选择部门' }
  },
  {
    prop: 'role',
    label: '角色',
    span: 8,
    formtype: 'Select' as const,
    dataOptions: [
      { label: '管理员', value: 'admin' },
      { label: '编辑者', value: 'editor' },
      { label: '查看者', value: 'viewer' }
    ],
    attrs: { placeholder: '请选择角色' }
  },
  {
    prop: 'email',
    label: '邮箱',
    span: 12,
    formtype: 'Input' as const,
    attrs: { placeholder: '请输入邮箱' }
  },
  {
    prop: 'phone',
    label: '手机号',
    span: 12,
    formtype: 'Input' as const,
    attrs: { placeholder: '请输入手机号' }
  },
  {
    prop: 'status',
    label: '启用状态',
    span: 12,
    formtype: 'Switch' as const,
    attrs: { activeText: '启用', inactiveText: '禁用' }
  }
]

// 详情模式：全部禁用
const detailFormItems = baseFormItems.map(item => ({
  ...item,
  attrs: { ...item.attrs, disabled: true }
}))

const currentFormItems = computed(() => isEdit.value ? baseFormItems : detailFormItems)

const onModeChange = (edit: boolean) => {
  if (!edit) {
    // 切到详情时，取消验证
    setTimeout(() => formRef.value?.clearValidate?.(), 0)
  }
}

const configBtn = [
  {
    name: '保存',
    type: 'primary',
    direction: 'right',
    icon: 'Check',
    click: (model: Record<string, unknown>) => {
      ElMessage.success('保存成功')
      isEdit.value = false
      console.log('保存数据:', model)
    }
  },
  {
    name: '取消',
    direction: 'right',
    click: (_: unknown, formRefInstance: { resetFields: () => void } | null) => {
      formRefInstance?.resetFields()
      isEdit.value = false
    }
  }
]

const layoutProps = {
  fromLayProps: { labelWidth: '100px', size: 'small' },
  rowLayProps: { gutter: 16 }
}
</script>

<style scoped>
.example-form-detail { padding: 20px; }
.mode-toggle {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  gap: 8px;
  font-size: 14px;
  color: #606266;
}
</style>
