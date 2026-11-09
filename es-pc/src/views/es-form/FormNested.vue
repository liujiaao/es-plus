<template>
  <div class="form-nested-demo">
    <a-alert
      message="一个对象 = 一行标题 + 一组子字段"
      type="info"
      show-icon
      class="intro-alert"
    >
      <template #description>
        父字段写 <code>children</code>：容器只出整行标题、不渲染控件也不绑定数据；子字段的
        <code>prop</code> 是相对路径（<code>province</code> → 绑定 <code>address.province</code>）。
        子字段栅格按容器内数量自动算，显式 <code>span</code> 优先。只支持一层。
        antdv 端会在拿到容器时补齐模型里的对象（<code>a-form-item</code> 的 name 路径解析要求它存在），
        与 Element Plus / Element UI 行为一致。
      </template>
    </a-alert>

    <div class="toolbar">
      <a-button size="small" @click="fillSample">填入示例数据</a-button>
      <a-button size="small" @click="clearAll">清空</a-button>
      <a-button size="small" type="primary" @click="submit">提交（校验嵌套字段）</a-button>
    </div>

    <es-form ref="formRef" :model="formModel" :form-item-list="formItems" :rules="formRules" />

    <pre class="model-preview">{{ JSON.stringify(formModel, null, 2) }}</pre>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { EsForm } from '@es-plus/adapter-antdv'
import { message } from 'ant-design-vue'
import type { FormItemOption } from '@es-plus/adapter-antdv'

const formRef = ref()

const formModel = reactive<Record<string, any>>({
  customerName: '',
  phone: '',
  address: { province: '', city: '', detail: '' },
  invoice: { title: '', taxNo: '' }
})

const formItems: FormItemOption[] = [
  { prop: 'customerName', label: '客户名称', formtype: 'Input', span: 12, required: true },
  { prop: 'phone', label: '联系电话', formtype: 'Input', span: 12 },
  {
    prop: 'address',
    label: '联系地址',
    children: [
      {
        prop: 'province',
        label: '省',
        formtype: 'Select',
        dataOptions: [
          { label: '浙江', value: 'zj' },
          { label: '江苏', value: 'js' },
          { label: '广东', value: 'gd' }
        ]
      },
      {
        prop: 'city',
        label: '市',
        formtype: 'Select',
        dataOptions: [
          { label: '杭州', value: 'hz' },
          { label: '南京', value: 'nj' },
          { label: '深圳', value: 'sz' }
        ]
      },
      { prop: 'detail', label: '详细地址', formtype: 'Input', span: 24, required: true }
    ]
  },
  {
    prop: 'invoice',
    label: '开票信息',
    children: [
      { prop: 'title', label: '抬头', formtype: 'Input' },
      { prop: 'taxNo', label: '税号', formtype: 'Input' }
    ]
  }
]

const formRules = {
  'address.detail': [{ required: true, message: '请填写详细地址', trigger: 'blur' }]
}

const fillSample = () => {
  formModel.customerName = '北辰商贸'
  formModel.phone = '0571-88886666'
  formModel.address = { province: 'zj', city: 'hz', detail: '文三路 478 号' }
  formModel.invoice = { title: '北辰商贸有限公司', taxNo: '91330100MA2XXXXX0A' }
}

const clearAll = () => {
  formRef.value?.resetFields()
  formModel.address = { province: '', city: '', detail: '' }
  formModel.invoice = { title: '', taxNo: '' }
}

const submit = async () => {
  try {
    await formRef.value?.validate()
    message.success(`已提交：${formModel.customerName} / ${formModel.address.city}`)
  } catch {
    message.warning('嵌套字段校验未通过')
  }
}
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
.model-preview {
  margin-top: var(--es-space-4);
  padding: var(--es-space-3) var(--es-space-4);
  background: var(--es-fill);
  border-radius: var(--es-radius-sm);
  font-size: var(--es-text-xs);
  color: var(--es-text-secondary);
}
</style>
