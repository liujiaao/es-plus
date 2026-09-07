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
        { id: 1, name: '北京市分公司', leader: '张三', memberCount: 50, hasChildren: true },
        { id: 2, name: '上海市分公司', leader: '孙八', memberCount: 40, hasChildren: true },
        { id: 3, name: '广州市分公司', leader: '郑十一', memberCount: 35, hasChildren: true }
      ],
      columns: [
        { key: 'name', label: '组织名称' },
        { key: 'leader', label: '负责人' },
        {
          key: 'memberCount',
          label: '成员数量',
          render: (h, { row }) => <el-tag size="mini">{row.memberCount}人</el-tag>
        }
      ],
      options: {
        border: true,
        rowKey: 'id',
        lazy: true,
        treeProps: {
          children: 'children',
          hasChildren: 'hasChildren'
        },
        lazyLoad: (row, treeNode, resolve) => {
          setTimeout(() => {
            const childrenData = this.getChildrenByParent(row.id)
            resolve(childrenData)
          }, 500)
        }
      }
    }
  },
  methods: {
    getChildrenByParent(parentId) {
      const mockData = {
        1: [
          { id: 11, name: '朝阳区营业部', leader: '李四', memberCount: 20, hasChildren: true },
          { id: 12, name: '海淀区营业部', leader: '钱七', memberCount: 30, hasChildren: false }
        ],
        11: [
          { id: 111, name: '朝阳一部', leader: '王五', memberCount: 8, hasChildren: false },
          { id: 112, name: '朝阳二部', leader: '赵六', memberCount: 12, hasChildren: false }
        ],
        2: [
          { id: 21, name: '浦东新区营业部', leader: '周九', memberCount: 25, hasChildren: false },
          { id: 22, name: '徐汇区营业部', leader: '吴十', memberCount: 15, hasChildren: false }
        ],
        3: [
          { id: 31, name: '天河区营业部', leader: '陈十二', memberCount: 18, hasChildren: false },
          { id: 32, name: '越秀区营业部', leader: '林十三', memberCount: 17, hasChildren: false }
        ]
      }
      return mockData[parentId] || []
    }
  }
}
</script>
