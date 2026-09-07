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
          name: '北京市分公司',
          leader: '张三',
          memberCount: 50,
          children: [
            {
              id: 11,
              name: '朝阳区营业部',
              leader: '李四',
              memberCount: 20,
              children: [
                { id: 111, name: '朝阳一部', leader: '王五', memberCount: 8 },
                { id: 112, name: '朝阳二部', leader: '赵六', memberCount: 12 }
              ]
            },
            { id: 12, name: '海淀区营业部', leader: '钱七', memberCount: 30 }
          ]
        },
        {
          id: 2,
          name: '上海市分公司',
          leader: '孙八',
          memberCount: 40,
          children: [
            { id: 21, name: '浦东新区营业部', leader: '周九', memberCount: 25 },
            { id: 22, name: '徐汇区营业部', leader: '吴十', memberCount: 15 }
          ]
        },
        {
          id: 3,
          name: '广州市分公司',
          leader: '郑十一',
          memberCount: 35,
          children: []
        }
      ],
      columns: [
        { key: 'name', label: '组织名称' },
        { key: 'leader', label: '负责人' },
        {
          key: 'memberCount',
          label: '成员数量',
          render: (h, { row }) => {
            return (
              <el-tag size="mini" type={row.memberCount > 20 ? 'success' : 'info'}>
                {row.memberCount}人
              </el-tag>
            )
          }
        }
      ],
      options: {
        border: true,
        rowKey: 'id',
        defaultExpandAll: true,
        treeProps: {
          children: 'children',
          hasChildren: 'hasChildren'
        }
      }
    }
  }
}
</script>
