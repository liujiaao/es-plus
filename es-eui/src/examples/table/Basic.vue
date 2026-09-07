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
      options: { border: true }
    }
  }
}
</script>
