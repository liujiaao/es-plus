<template>
  <div class="example-form-dialog">
    <el-button type="primary" @click="openDialog">打开表单弹窗</el-button>
    <el-button @click="openEditDialog">编辑数据</el-button>
    
    <div class="result-box" v-if="lastResult">
      <h4>上次提交结果:</h4>
      <pre>{{ JSON.stringify(lastResult, null, 2) }}</pre>
    </div>
  </div>
</template>

<script lang="jsx" setup>
import { ref, h } from 'vue'
import { ElMessage, ElButton } from 'element-plus'
import { useDialog } from 'es-plus'
import EsForm from 'es-plus/components/es-form'

const dialog = useDialog()
const lastResult = ref(null)

const openDialog = () => {
  const formData = ref({ name: '', desc: '', category: '' })
  
  const formItems = [
    { prop: 'name', label: '名称', formtype: 'Input', span: 24, attrs: { placeholder: '请输入名称' } },
    { 
      prop: 'category', 
      label: '分类', 
      formtype: 'Select', 
      span: 24,
      dataOptions: [
        { label: '分类A', value: 'A' },
        { label: '分类B', value: 'B' },
        { label: '分类C', value: 'C' }
      ]
    },
    { prop: 'desc', label: '描述', formtype: 'Input', span: 24, attrs: { type: 'textarea', rows: 3 } }
  ]
  
  dialog({
    title: '新增数据',
    width: '500px',
    render: (h,instance) => h(EsForm, {
      model: formData.value,
      formItemList: formItems,
      layoutFormProps: { fromLayProps: { labelWidth: '80px' } }
    }),
    onSubmit: (close) => {
      if (!formData.value.name) {
        ElMessage.warning('请输入名称')
        return
      }
      lastResult.value = { ...formData.value, action: '新增' }
      ElMessage.success('提交成功')
      close()
    }
  })
}

const openEditDialog = () => {
  const editData = ref({ name: '现有数据', desc: '这是描述', category: 'A' })
  
  const formItems = [
    { prop: 'name', label: '名称', formtype: 'Input', span: 24 },
    { 
      prop: 'category', 
      label: '分类', 
      formtype: 'Select', 
      span: 24,
      dataOptions: [
        { label: '分类A', value: 'A' },
        { label: '分类B', value: 'B' },
        { label: '分类C', value: 'C' }
      ]
    },
    { prop: 'desc', label: '描述', formtype: 'Input', span: 24, attrs: { type: 'textarea', rows: 3 } }
  ]
  
  dialog({
    title: '编辑数据',
    width: '500px',
    render: () => {
        return <EsForm model={editData.value}
        formItemList={formItems}
        layoutFormProps={{ fromLayProps: { labelWidth: '80px' } }} />
    },
    onSubmit: (close) => {
      lastResult.value = { ...editData.value, action: '编辑' }
      ElMessage.success('保存成功')
      close()
    }
  })
}
</script>

<style scoped>
.example-form-dialog {
  padding: 20px;
}
.result-box {
  margin-top: 24px;
  padding: 16px;
  background-color: #f5f7fa;
  border-radius: 4px;
}
.result-box h4 {
  margin-bottom: 12px;
  color: #606266;
}
.result-box pre {
  margin: 0;
  font-size: 13px;
  color: #409eff;
}
</style>
