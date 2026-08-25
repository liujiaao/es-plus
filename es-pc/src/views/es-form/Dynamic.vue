<template>
  <div class="example-dynamic-form">
    <es-form
      :model="formModel"
      :form-item-list="dynamicItems"
    />
    <div class="actions">
      <a-button type="primary" @click="addField">
        <PlusOutlined /> 添加字段
      </a-button>
      <a-button @click="showResult">查看结果</a-button>
    </div>
    <a-modal v-model:open="resultVisible" title="表单数据" width="500px">
      <pre>{{ JSON.stringify(formModel.fields, null, 2) }}</pre>
    </a-modal>
  </div>
</template>

<script setup>
import { EsForm } from '@es-plus/adapter-antdv'
import { ref, computed, h } from 'vue'
import { Button, Modal } from 'ant-design-vue'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons-vue'

const formModel = ref({
  fields: [{ name: '字段1', value: '' }]
})

const resultVisible = ref(false)

const dynamicItems = computed(() => {
  return formModel.value.fields.map((item, index) => [
    {
      prop: `fields[${index}].name`,
      label: `名称${index + 1}`,
      formtype: 'Input',
      span: 10,
      attrs: { placeholder: '字段名称' }
    },
    {
      prop: `fields[${index}].value`,
      label: '值',
      formtype: 'Input',
      span: 10,
      attrs: { placeholder: '字段值' }
    },
    {
      prop: `delete_${index}`,
      label: ' ',
      span: 4,
      render: () => h(Button, {
        type: 'link',
        danger: true,
        onClick: () => removeField(index)
      }, { default: () => [h(DeleteOutlined), ' 删除'] })
    }
  ]).flat()
})

const addField = () => {
  formModel.value.fields.push({ name: `字段${formModel.value.fields.length + 1}`, value: '' })
}

const removeField = async (index) => {
  Modal.confirm({
    title: '提示',
    content: '确定删除该字段吗？',
    onOk: () => {
      formModel.value.fields.splice(index, 1)
    }
  })
}

const showResult = () => {
  resultVisible.value = true
}
</script>

<style scoped>
.example-dynamic-form {
  padding: 20px;
}
.actions {
  margin-top: 20px;
  display: flex;
  gap: 12px;
}
pre {
  background: #f5f7fa;
  padding: 16px;
  border-radius: 4px;
  font-size: 13px;
}
</style>
