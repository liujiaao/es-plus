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
              const nextId = this.data.reduce((max, r) => Math.max(max, r.id), 0) + 1
              this.data.unshift({ id: nextId, name: `新用户${nextId}`, age: 20, email: `user${nextId}@example.com` })
              this.$message.success('已新增一行')
            }
          },
          {
            code: 1,
            name: '导入',
            icon: 'el-icon-upload2',
            click: () => {
              // 导入依赖真实的文件选择与后端接口，示例里不伪造上传结果
              this.$message.info('导入需接入后端上传接口（示例未接）')
            }
          },
          {
            code: 2,
            name: '导出',
            icon: 'el-icon-download',
            type: 'warning',
            click: () => {
              const header = ['ID', '姓名', '年龄', '邮箱']
              const rows = this.data.map((r) => [r.id, r.name, r.age, r.email])
              const csv = '﻿' + [header, ...rows].map((cols) => cols.join(',')).join('\n')
              const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
              const a = document.createElement('a')
              a.href = url
              a.download = '用户列表.csv'
              a.click()
              URL.revokeObjectURL(url)
              this.$message.success(`已导出 ${this.data.length} 条`)
            }
          },
          {
            code: 2,
            name: '高级搜索',
            icon: 'el-icon-search',
            isHide: false,
            click: () => {
              // code: 1 渲染左侧、code: 2 渲染右侧 —— 本例演示左右分栏
              this.$message.info('高级搜索（右侧按钮区）')
            }
          }
        ],
        leftText: '已选择 0 项'
      }
    }
  }
}
</script>
