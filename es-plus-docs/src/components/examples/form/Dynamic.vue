<template>
  <div class="example-dynamic-form">
    <es-form
      :model="formModel"
      :form-item-list="dynamicItems"
    />
    <div class="actions">
      <el-button type="primary" :icon="Plus" @click="addField">添加字段</el-button>
      <el-button @click="showResult">查看结果</el-button>
    </div>
    <el-dialog v-model="resultVisible" title="表单数据" width="500px">
      <pre>{{ JSON.stringify(formModel.fields, null, 2) }}</pre>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, h } from 'vue'
import { Plus, Delete } from '@element-plus/icons-vue'
import { ElButton, ElMessageBox, ElDialog } from 'element-plus'
import EsForm from 'es-plus/components/es-form'

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
      render: (h, model, { row }) => h(ElButton, { 
        text: true, 
        type: 'danger',
        icon: Delete,
        onClick: () => removeField(index) 
      }, '删除')
    }
  ]).flat()
})

const addField = () => {
  formModel.value.fields.push({ name: `字段${formModel.value.fields.length + 1}`, value: '' })
}

const removeField = async (index) => {
  try {
    await ElMessageBox.confirm('确定删除该字段吗？', '提示', { type: 'warning' })
    formModel.value.fields.splice(index, 1)
  } catch {
    // 取消删除
  }
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
