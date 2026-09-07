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
        {
          id: 1,
          name: '张三',
          age: 25,
          phone: '13800138000',
          email: 'zhangsan@example.com',
          address: '北京市朝阳区建国路88号'
        },
        {
          id: 2,
          name: '李四',
          age: 30,
          phone: '13900139000',
          email: 'lisi@example.com',
          address: '上海市浦东新区世纪大道1000号'
        },
        {
          id: 3,
          name: '王五',
          age: 28,
          phone: '13700137000',
          email: 'wangwu@example.com',
          address: '广州市天河区天河路385号'
        }
      ],
      columns: [
        {
          key: 'id',
          label: 'ID',
          width: 60,
          type: 'expand',
          render: (h, { row }) => {
            return (
              <div style="padding: 20px;">
                <el-descriptions column={2} border>
                  <el-descriptions-item label="姓名">{row.name}</el-descriptions-item>
                  <el-descriptions-item label="年龄">{row.age}</el-descriptions-item>
                  <el-descriptions-item label="手机号">{row.phone}</el-descriptions-item>
                  <el-descriptions-item label="邮箱">{row.email}</el-descriptions-item>
                  <el-descriptions-item label="地址" span={2}>{row.address}</el-descriptions-item>
                  <el-descriptions-item label="备注" span={2}>
                    <el-tag size="small">用户ID: {row.id}</el-tag>
                  </el-descriptions-item>
                </el-descriptions>
              </div>
            )
          }
        },
        { key: 'name', label: '姓名', width: 100 },
        { key: 'age', label: '年龄', width: 80 },
        { key: 'phone', label: '手机', width: 130 },
        { key: 'email', label: '邮箱' }
      ],
      options: {
        border: true,
        rowKey: 'id',
        expandRowKeys: [1]
      }
    }
  }
}
</script>
