<template>
  <div class="example-dynamic-form">
    <es-form
      ref="formRef"
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
import { EsForm } from '@es-plus/vue3'
import { ref, computed, h } from 'vue'
import { Plus, Delete } from '@element-plus/icons-vue'
import { ElButton, ElMessageBox, ElDialog } from 'element-plus'

const formModel = ref({
  fields: [{ name: '字段1', value: '' }]
})

const formRef = ref(null)
const resultVisible = ref(false)

const dynamicItems = computed(() => {
  return formModel.value.fields.map((item, index) => [
    {
      prop: `fields[${index}].name`,
      label: `名称${index + 1}`,
      formtype: 'Input',
      span: 10,
      attrs: { placeholder: '字段名称' },
      // 规则随动态字段一起声明：新加的每一行都自带必填校验
      rules: [{ required: true, message: '请输入字段名称', trigger: 'blur' }]
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
      }, () => '删除')
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

const showResult = async () => {
  // 动态字段的 rules 同样走 el-form 校验：任一行名称为空都会拦住
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
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
