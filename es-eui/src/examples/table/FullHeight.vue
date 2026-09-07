<template>
  <div style="height: 400px;">
    <es-table
      :data-source="data"
      :columns="columns"
      :options="options"
    />
  </div>
</template>

<script>
export default {
  data() {
    return {
      data: [
        { id: 1, name: '张三', age: 25, email: 'zhangsan@example.com', address: '北京市朝阳区建国路88号' },
        { id: 2, name: '李四', age: 30, email: 'lisi@example.com', address: '上海市浦东新区世纪大道1000号' },
        { id: 3, name: '王五', age: 28, email: 'wangwu@example.com', address: '广州市天河区天河路385号' },
        { id: 4, name: '赵六', age: 35, email: 'zhaoliu@example.com', address: '深圳市南山区科技园路1号' },
        { id: 5, name: '钱七', age: 27, email: 'qianqi@example.com', address: '杭州市西湖区文一路100号' },
        { id: 6, name: '孙八', age: 32, email: 'sunba@example.com', address: '成都市高新区天府大道200号' },
        { id: 7, name: '周九', age: 29, email: 'zhoujiu@example.com', address: '武汉市洪山区珞喻路300号' },
        { id: 8, name: '吴十', age: 31, email: 'wushi@example.com', address: '南京市鼓楼区中山路150号' }
      ],
      columns: [
        { key: 'id', label: 'ID', width: 80 },
        { key: 'name', label: '姓名', width: 100 },
        { key: 'age', label: '年龄', width: 80 },
        { key: 'email', label: '邮箱', width: 200 },
        { key: 'address', label: '地址' }
      ],
      options: {
        border: true,
        tabHeight: '100%',
        heightType: 'height'
      }
    }
  }
}
</script>
