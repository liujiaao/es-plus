<template>
  <div class="example-form-tree-select">
    <es-form :model="formModel" :form-item-list="formItems" :config-btn="configBtn" />
    <p class="hint">
      TreeSelect 的值是<strong>节点 value</strong>（可选中任意层级）；Autocomplete 在选项集上边输边筛，存的是<strong>选中项的 value</strong>，不是输入文本。
    </p>
  </div>
</template>

<script setup>
import { EsForm } from '@es-plus/adapter-antdv'
import { reactive } from 'vue'
import { message } from 'ant-design-vue'

const formModel = reactive({
  dept: undefined,
  city: undefined
})

const deptOptions = [
  {
    label: '技术中心',
    value: 'tech',
    children: [
      { label: '前端组', value: 'fe' },
      { label: '后端组', value: 'be' },
      { label: '测试组', value: 'qa' }
    ]
  },
  {
    label: '产品中心',
    value: 'product',
    children: [
      { label: '产品组', value: 'pm' },
      { label: '设计组', value: 'design' }
    ]
  }
]

const cityOptions = [
  { label: '北京', value: 'bj' },
  { label: '上海', value: 'sh' },
  { label: '广州', value: 'gz' },
  { label: '深圳', value: 'sz' }
]

const formItems = [
  {
    prop: 'dept',
    label: '所属部门',
    formtype: 'TreeSelect',
    span: 12,
    dataOptions: deptOptions,
    attrs: { placeholder: '选择任意层级', allowClear: true }
  },
  {
    prop: 'city',
    label: '城市',
    formtype: 'Autocomplete',
    span: 12,
    dataOptions: cityOptions,
    attrs: { placeholder: '输入关键字筛选', allowClear: true }
  }
]

const configBtn = [
  {
    name: '提交',
    type: 'primary',
    click: (model) => {
      message.success('提交成功: ' + JSON.stringify(model))
    }
  }
]
</script>

<style scoped>
.example-form-tree-select {
  padding: var(--es-space-4);
}
.hint {
  margin-top: 12px;
  color: var(--es-text-secondary);
  font-size: var(--es-text-sm);
}
</style>
