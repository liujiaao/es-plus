<template>
  <div class="example-dialog-form">
    <el-button type="primary" @click="openAddDialog">新增数据</el-button>
    <el-button @click="openEditDialog">编辑数据</el-button>
    <div v-if="lastResult" class="result-box">
      <h4>上次操作结果:</h4>
      <pre>{{ JSON.stringify(lastResult, null, 2) }}</pre>
    </div>
  </div>
</template>

<script setup lang="jsx">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { EsForm,  useDialog } from 'es-plus'

const dialog = useDialog()
const lastResult = ref(null)

const typeOptions = [
  { label: '类型A', value: 'A' },
  { label: '类型B', value: 'B' },
  { label: '类型C', value: 'C' }
]

const statusOptions = [
  { label: '启用', value: 'active' },
  { label: '禁用', value: 'inactive' }
]

const formRules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
  desc: [
    { required: true, message: '请输入描述', trigger: 'blur' },
    { min: 5, max: 200, message: '描述长度在 5 到 200 个字符', trigger: 'blur' }
  ]
}

const addFormItems = [
  { prop: 'name', label: '名称', formtype: 'Input', span: 12, attrs: { placeholder: '请输入名称' } },
  { prop: 'type', label: '类型', formtype: 'Select', span: 12, dataOptions: typeOptions, attrs: { placeholder: '请选择类型' } },
  { prop: 'status', label: '状态', formtype: 'Radio', span: 24, dataOptions: statusOptions },
  { prop: 'desc', label: '描述', formtype: 'Input', span: 24, attrs: { type: 'textarea', rows: 3 } }
]

const editFormItems = [
  { prop: 'name', label: '名称', formtype: 'Input', span: 12 },
  { prop: 'type', label: '类型', formtype: 'Select', span: 12, dataOptions: typeOptions },
  { prop: 'status', label: '状态', formtype: 'Radio', span: 24, dataOptions: statusOptions },
  { prop: 'desc', label: '描述', formtype: 'Input', span: 24, attrs: { type: 'textarea', rows: 3 } }
]

const layoutProps = { fromLayProps: { labelWidth: '80px' } }

const openAddDialog = () => {
  const formData = ref({ name: '', type: '', status: 'active', desc: '' })

  dialog({
    title: '新增数据',
    width: '550px',
    // render 第二个参数 instance 包含 registerRef，用于向 dialog 注册命名引用
    // 注册后可通过 getRefs('formRef') 获取 EsForm 组件实例
    render: (h, { registerRef }) => (
      <EsForm
        ref={(el) => { if (el) registerRef('formRef', el) }}
        model={formData.value}
        formItemList={addFormItems}
        rules={formRules}
        layoutFormProps={layoutProps}
      />
    ),
    configBtn: [
      { name: '取消', click: (_, { close }) => close() },
      {
        name: '确认提交',
        type: 'primary',
        icon: 'Check',
        click: (instance, { close, getRefs }) => {
          const formRef = getRefs('formRef')
          formRef?.validate()
            .then(() => {
              lastResult.value = { action: '新增', data: { ...formData.value } }
              ElMessage.success('新增成功')
              close()
            })
            .catch(() => {})
        }
      }
    ]
  })
}

const openEditDialog = () => {
  const formData = ref({ name: '示例数据', type: 'A', status: 'active', desc: '这是示例描述' })

  dialog({
    title: '编辑数据',
    width: '550px',
    render: (h, { registerRef }) => (
      <EsForm
        ref={(el) => { if (el) registerRef('formRef', el) }}
        model={formData.value}
        formItemList={editFormItems}
        rules={formRules}
        layoutFormProps={layoutProps}
      />
    ),
    configBtn: [
      { name: '取消', click: (_, { close }) => close() },
      {
        name: '保存修改',
        type: 'primary',
        icon: 'Check',
        click: (instance, { close, getRefs }) => {
          const formRef = getRefs('formRef')
          formRef?.validate()
            .then(() => {
              lastResult.value = { action: '编辑', data: { ...formData.value } }
              ElMessage.success('保存成功')
              close()
            })
            .catch(() => {})
        }
      }
    ]
  })
}
</script>

<style scoped>
.example-dialog-form {
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
