<template>
  <div>
    <el-button @click="openTableDialog">EsTable 表格弹窗</el-button>
  </div>
</template>

<script>
import { useDialog } from '@es-plus/vue2'

export default {
  data() {
    return {
      tableData: [
        { id: 1, name: '张三', age: 25, email: 'zhangsan@example.com' },
        { id: 2, name: '李四', age: 30, email: 'lisi@example.com' },
        { id: 3, name: '王五', age: 28, email: 'wangwu@example.com' }
      ],
      selectedRows: []
    }
  },
  methods: {
    openTableDialog() {
      const { close } = useDialog()({
        title: '选择用户',
        width: '800px',
        // 使用 JSX 渲染 EsTable
        render: (h, ctx) => (
          <es-table
            data-source={this.tableData}
            columns={[
              { key: 'id', label: 'ID', width: 80 },
              { key: 'name', label: '姓名', width: 120 },
              { key: 'age', label: '年龄', width: 80 },
              { key: 'email', label: '邮箱' }
            ]}
            options={{ border: true, multiSelect: true }}
            on-selection-change={(selection) => {
              this.selectedRows = selection
            }}
          />
        ),
        configBtn: [
          {
            name: '取消',
            key: 'cancel',
            click: (_, { close }) => close()
          },
          {
            name: '确定',
            type: 'primary',
            key: 'confirm',
            click: (_, { close }) => {
              console.log('选中的行：', this.selectedRows)
              this.$message.success(`已选择 ${this.selectedRows.length} 个用户`)
              close()
            }
          }
        ]
      })
    }
  }
}
</script>
