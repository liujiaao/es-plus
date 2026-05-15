<template>
  <div class="example-dialog-crud">
    <el-button type="primary" @click="openCRUD">增删改查弹窗</el-button>
  </div>
</template>

<script setup lang="jsx">
import { ref } from 'vue'
import { ElMessage, ElTag, ElMessageBox } from 'element-plus'
import { useDialog } from 'es-plus'
import EsForm from 'es-plus/components/es-form'
import EsTable from 'es-plus/components/es-table'

const crudDialog = useDialog()
const tableData = ref([
  { id: 1, name: '项目 Alpha', status: 'active', manager: '张三', budget: 50000 },
  { id: 2, name: '项目 Beta', status: 'pending', manager: '李四', budget: 30000 },
  { id: 3, name: '项目 Gamma', status: 'completed', manager: '王五', budget: 80000 },
  { id: 4, name: '项目 Delta', status: 'active', manager: '赵六', budget: 45000 }
])

const statusMap = { active: { text: '进行中', type: 'success' }, pending: { text: '待启动', type: 'warning' }, completed: { text: '已完成', type: 'info' } }
const statusOptions = [
  { label: '进行中', value: 'active' }, { label: '待启动', value: 'pending' }, { label: '已完成', value: 'completed' }
]

const formItems = [
  { prop: 'name', label: '项目名称', formtype: 'Input', span: 24 },
  { prop: 'status', label: '状态', formtype: 'Select', span: 12, dataOptions: statusOptions },
  { prop: 'budget', label: '预算', formtype: 'Input', span: 12, attrs: { placeholder: '请输入预算金额' } },
  { prop: 'manager', label: '负责人', formtype: 'Input', span: 24 }
]
const formRules = {
  name: [{ required: true, message: '请输入项目名称', trigger: 'blur' }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }]
}

const columns = [
  { prop: 'id', label: 'ID', width: 60 },
  { prop: 'name', label: '项目名称' },
  { prop: 'status', label: '状态', width: 100, render: (_, { row }) => {
    const s = statusMap[row.status] || {}
    return <ElTag type={s.type} size="small">{s.text}</ElTag>
  }},
  { prop: 'manager', label: '负责人' },
  { prop: 'budget', label: '预算', width: 120, formatter: (r) => `¥${r.budget.toLocaleString()}` }
]

const tableOptions = {
  border: true,
  leftText: '项目列表',
  btns: [
    { name: '编辑', type: 'primary', size: 'small', clickEvent: (row) => openEditDialog(row) },
    { name: '删除', type: 'danger', size: 'small', clickEvent: (row) => handleDelete(row) }
  ]
}

const openEditDialog = (row) => {
  const formData = ref({ ...row })
  crudDialog({
    title: '编辑项目',
    width: '500px',
    render: (h, { registerRef }) => (
      <EsForm
        ref={(el) => { if (el) registerRef('formRef', el) }}
        model={formData.value}
        formItemList={formItems}
        rules={formRules}
        layoutFormProps={{ fromLayProps: { labelWidth: '80px' } }}
      />
    ),
    configBtn: [
      { name: '取消', click: (_, { close }) => close() },
      {
        name: '保存', type: 'primary', icon: 'Check',
        click: (_, { close, getRefs }) => {
          getRefs('formRef')?.validate()
            .then(() => {
              const idx = tableData.value.findIndex((r) => r.id === row.id)
              if (idx !== -1) tableData.value[idx] = { ...formData.value }
              ElMessage.success('保存成功')
              close()
            })
            .catch(() => {})
        }
      }
    ]
  })
}

const handleDelete = (row) => {
  ElMessageBox.confirm(`确定要删除「${row.name}」吗？`, '删除确认', { type: 'warning' })
    .then(() => {
      tableData.value = tableData.value.filter((r) => r.id !== row.id)
      ElMessage.success('删除成功')
    })
    .catch(() => {})
}

const openCRUD = () => {
  crudDialog({
    title: '项目管理',
    width: '750px',
    render: () => (
      <EsTable
        data-source={tableData.value}
        columns={columns}
        options={tableOptions}
        pagination={{ pageSize: 10, current: 1, total: tableData.value.length }}
      />
    ),
    configBtn: [
      {
        name: '新增项目', type: 'primary', icon: 'Plus',
        click: () => {
          const formData = ref({ id: Date.now(), name: '', status: '', manager: '', budget: 0 })
          crudDialog({
            title: '新增项目',
            width: '500px',
            render: (h, { registerRef }) => (
              <EsForm
                ref={(el) => { if (el) registerRef('formRef', el) }}
                model={formData.value}
                formItemList={formItems}
                rules={formRules}
                layoutFormProps={{ fromLayProps: { labelWidth: '80px' } }}
              />
            ),
            configBtn: [
              { name: '取消', click: (_, { close }) => close() },
              {
                name: '提交', type: 'primary', icon: 'Check',
                click: (_, { close, getRefs }) => {
                  getRefs('formRef')?.validate()
                    .then(() => {
                      tableData.value.push({ ...formData.value })
                      ElMessage.success('新增成功')
                      close()
                    })
                    .catch(() => {})
                }
              }
            ]
          })
        }
      },
      { name: '关闭', click: (_, { close }) => close() }
    ]
  })
}
</script>

<style scoped>
.example-dialog-crud {
  padding: 20px;
}
</style>
