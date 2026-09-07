<template>
  <es-table
    :data-source="data"
    :columns="columns"
    :options="options"
  />
</template>

<script>
export default {
  data() {
    return {
      data: [
        { id: 1, name: '政策A', status: '1' },
        { id: 2, name: '政策B', status: '0' }
      ],
      columns: [
        { key: 'id', label: 'ID', width: 80 },
        { key: 'name', label: '名称' },
        { key: 'status', label: '状态' },
        {
          key: 'action',
          label: '操作',
          width: 200,
          render: (h, { row }) => {
            return (
              <div>
                <el-button size="mini" type="text" on-click={() => this.handleView(row)}>查看</el-button>
                <el-button size="mini" type="text" on-click={() => this.handleEdit(row)}>编辑</el-button>
                {row.status === '0' && (
                  <el-button size="mini" type="text" on-click={() => this.handlePublish(row)}>上架</el-button>
                )}
                <el-button size="mini" type="text" style="color: #f56c6c;" on-click={() => this.handleDelete(row)}>删除</el-button>
              </div>
            )
          }
        }
      ],
      options: { border: true }
    }
  },
  methods: {
    handleView(row) {
      this.$message.info(`查看: ${row.name}`)
    },
    handleEdit(row) {
      this.$message.info(`编辑: ${row.name}`)
    },
    handlePublish(row) {
      row.status = '1'
      this.$message.success(`${row.name} 上架成功`)
    },
    handleDelete(row) {
      this.$confirm(`确定删除 ${row.name} 吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        const idx = this.data.findIndex(item => item.id === row.id)
        if (idx > -1) this.data.splice(idx, 1)
        this.$message.success('删除成功')
      }).catch(() => {})
    }
  }
}
</script>
