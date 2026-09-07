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
        { id: 1, name: '张三', age: 25, email: 'zhangsan@example.com' },
        { id: 2, name: '李四', age: 30, email: 'lisi@example.com' },
        { id: 3, name: '王五', age: 28, email: 'wangwu@example.com' }
      ],
      columns: [
        { key: 'id', label: 'ID', width: 80 },
        { key: 'name', label: '姓名', width: 120 },
        { key: 'age', label: '年龄', width: 80 },
        { key: 'email', label: '邮箱' }
      ],
      options: {
        border: true,
        configBtn: [
          {
            code: 1,
            name: '新增',
            icon: 'el-icon-plus',
            type: 'primary',
            click: () => {
              this.$message.success('点击了新增按钮')
            }
          },
          {
            code: 1,
            name: '导入',
            icon: 'el-icon-upload2',
            click: () => {
              this.$message.info('点击了导入按钮')
            }
          },
          {
            code: 2,
            name: '导出',
            icon: 'el-icon-download',
            type: 'warning',
            click: () => {
              this.$message.info('点击了导出按钮')
            }
          },
          {
            code: 2,
            name: '高级搜索',
            icon: 'el-icon-search',
            isHide: false,
            click: () => {
              this.$message.info('点击了高级搜索按钮')
            }
          }
        ],
        leftText: '已选择 0 项'
      }
    }
  }
}
</script>
