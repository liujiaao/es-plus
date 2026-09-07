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
          phone2: '',
          email: 'zhangsan@example.com',
          qq: '123456789',
          wechat: 'zhangsan_wx',
          address: '北京市朝阳区',
          score: { chinese: 85, math: 90, english: 88 }
        },
        {
          id: 2,
          name: '李四',
          age: 30,
          phone: '13900139000',
          phone2: '',
          email: 'lisi@example.com',
          qq: '987654321',
          wechat: 'lisi_wx',
          address: '上海市浦东新区',
          score: { chinese: 78, math: 95, english: 82 }
        },
        {
          id: 3,
          name: '王五',
          age: 28,
          phone: '13700137000',
          phone2: '',
          email: 'wangwu@example.com',
          qq: '111222333',
          wechat: 'wangwu_wx',
          address: '广州市天河区',
          score: { chinese: 92, math: 88, english: 90 }
        }
      ],
      columns: [
        {
          label: '基本信息',
          prop: 'baseInfo',
          groups: [
            { key: 'id', label: 'ID', width: 60 },
            { key: 'name', label: '姓名', width: 100 },
            { key: 'age', label: '年龄', width: 80 }
          ]
        },
        {
          label: '联系方式',
          prop: 'contact',
          groups: [
            { key: 'phone', label: '手机号', width: 130 },
            { key: 'phone2', label: '备用电话', width: 130 },
            { key: 'email', label: '邮箱', width: 180 },
            {
              key: 'qq',
              label: 'QQ号',
              width: 120,
              render: (h, { row }) => <el-tag size="mini">{row.qq}</el-tag>
            },
            { key: 'wechat', label: '微信', width: 120 }
          ]
        },
        {
          label: '其他信息',
          prop: 'other',
          groups: [
            { key: 'address', label: '地址', width: 160 },
            { key: 'score.chinese', label: '语文', width: 80 },
            { key: 'score.math', label: '数学', width: 80 },
            { key: 'score.english', label: '英语', width: 80 }
          ]
        }
      ],
      options: { border: true }
    }
  }
}
</script>
