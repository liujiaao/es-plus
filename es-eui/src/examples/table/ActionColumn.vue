<template>
  <es-table
    :data-source="data"
    :columns="columns"
    :options="options"
  />
</template>

<script>
/**
 * 声明式操作列：列的 key 为 'operate' + 给 btns 数组，组件自动渲染行内按钮。
 * 不需要写 render、不需要手拼 el-button —— 按钮的文案 / 语义色 / 权限 / 显隐 /
 * 回调全在配置里。
 */
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
        {
          key: 'status',
          label: '状态',
          width: 100,
          render: (h, { row }) => (
            <el-tag type={row.status === '1' ? 'success' : 'info'} size="small">
              {row.status === '1' ? '已上架' : '未上架'}
            </el-tag>
          )
        },
        {
          key: 'operate',
          label: '操作',
          width: 200,
          btns: [
            { name: '查看', clickEvent: (row) => this.handleView(row) },
            { name: '编辑', type: 'primary', clickEvent: (row) => this.handleEdit(row) },
            // hidden 返回 true 时该行的这个按钮不渲染
            { name: '上架', type: 'success', hidden: (row) => row.status === '1', clickEvent: (row) => this.handlePublish(row) },
            { name: '删除', type: 'danger', clickEvent: (row) => this.handleDelete(row) }
          ]
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
