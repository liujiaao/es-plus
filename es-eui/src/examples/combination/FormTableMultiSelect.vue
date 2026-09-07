<template>
  <div>
    <es-form
      ref="form"
      :form-item-list="formItems"
      :model="formData"
    />
    <es-table
      ref="table"
      :columns="tableColumns"
      :data-source="tableData"
      :options="{ border: true, multiSelect: true }"
      @selection-change="handleSelectionChange"
    />
    <div class="form-actions">
      <el-button type="primary" @click="handleSubmit">提交</el-button>
      <el-button @click="handleReset">重置</el-button>
    </div>
    <div v-if="selection.length" class="selected-info">
      已选择 {{ selection.length }} 条记录
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      formData: {
        name: '',
        status: ''
      },
      formItems: [
        { prop: 'name', label: '名称', span: 12, formtype: 'Input', attrs: { placeholder: '请输入名称' } },
        {
          prop: 'status',
          label: '状态',
          span: 12,
          formtype: 'Select',
          dataOptions: [
            { label: '全部', value: '' },
            { label: '启用', value: '1' },
            { label: '禁用', value: '0' }
          ]
        }
      ],
      tableData: [
        { id: 1, name: '张三', department: '技术部', position: '工程师' },
        { id: 2, name: '李四', department: '产品部', position: '产品经理' },
        { id: 3, name: '王五', department: '运营部', position: '运营专员' },
        { id: 4, name: '赵六', department: '运维部', position: '运维工程师' }
      ],
      tableColumns: [
        { key: 'id', label: 'ID', width: 80 },
        { key: 'name', label: '姓名', width: 120 },
        { key: 'department', label: '部门', width: 150 },
        { key: 'position', label: '职位' }
      ],
      selection: []
    }
  },
  methods: {
    handleSelectionChange(selection) {
      this.selection = selection
    },
    handleSubmit() {
      if (this.selection.length === 0) {
        this.$message.warning('请至少选择一条记录')
        return
      }
      console.log('提交数据：', {
        formData: this.formData,
        selection: this.selection
      })
      this.$message.success('提交成功')
    },
    handleReset() {
      this.$refs.form.resetFields()
      this.selection = []
    }
  }
}
</script>
