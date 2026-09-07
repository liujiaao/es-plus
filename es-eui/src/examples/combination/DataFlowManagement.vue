<template>
  <div>
    <es-table
      ref="inlineEditTable"
      :columns="inlineEditColumns"
      :data-source="inlineEditData"
      :options="{ border: true }"
    />
    <div class="form-actions" style="margin-top: 15px;">
      <el-button type="primary" @click="saveAll">保存所有修改</el-button>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      inlineEditData: [
        { id: 1, name: '张三', age: 25, email: 'zhangsan@example.com', editing: false },
        { id: 2, name: '李四', age: 30, email: 'lisi@example.com', editing: false },
        { id: 3, name: '王五', age: 28, email: 'wangwu@example.com', editing: false }
      ],
      inlineEditColumns: []
    }
  },
  created() {
    this.initInlineEditColumns()
  },
  methods: {
    initInlineEditColumns() {
      this.inlineEditColumns = [
        { key: 'id', label: 'ID', width: 80 },
        {
          key: 'name',
          label: '姓名',
          width: 150,
          render: (h, { row }) => row.editing ? (
            <el-input v-model={row.name} size="small" />
          ) : <span>{row.name}</span>
        },
        {
          key: 'age',
          label: '年龄',
          render: (h, { row }) => row.editing ? (
            <el-input-number v-model={row.age} size="small" min={1} max={150} />
          ) : <span>{row.age}</span>
        },
        {
          key: 'email',
          label: '邮箱',
          render: (h, { row }) => row.editing ? (
            <el-input v-model={row.email} size="small" />
          ) : <span>{row.email}</span>
        },
        {
          key: 'action',
          label: '操作',
          width: 150,
          render: (h, { row }) => row.editing ? (
            <span>
              <el-button type="text" size="small" on-click={() => this.saveRow(row)}>保存</el-button>
              <el-button type="text" size="small" on-click={() => this.cancelRow(row)}>取消</el-button>
            </span>
          ) : (
            <el-button type="text" size="small" on-click={() => this.editRow(row)}>编辑</el-button>
          )
        }
      ]
    },
    editRow(row) {
      row.editing = true
      row._original = { ...row }
    },
    saveRow(row) {
      row.editing = false
      delete row._original
      this.$message.success('保存成功')
    },
    cancelRow(row) {
      Object.assign(row, row._original)
      row.editing = false
      delete row._original
    },
    saveAll() {
      console.log('保存所有数据:', this.inlineEditData)
      this.inlineEditData.forEach(item => {
        item.editing = false
      })
      this.$message.success('所有修改已保存')
    }
  }
}
</script>
