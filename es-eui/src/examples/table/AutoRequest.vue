<template>
  <es-table
    :data-source="data"
    :columns="columns"
    :pagination="pagination"
    :options="options"
  />
</template>

<script>
export default {
  data() {
    return {
      data: [],
      columns: [
        { prop: 'id', label: 'ID', width: 80 },
        { prop: 'firstName', label: '名', width: 120 },
        { prop: 'lastName', label: '姓', width: 120 },
        { prop: 'email', label: '邮箱' },
        {
          prop: 'image',
          label: '头像',
          width: 80,
          render: (h, { row }) => (
            <el-avatar size="small" src={row.image} />
          )
        }
      ],
      // 分页读 current；请求里的 pageIndex 由组件按 current 生成
      pagination: { current: 1, pageSize: 10, total: 0 },
      options: {
        isInitRun: true,
        border: true,
        tabHeight: 350,
        heightType: 'height',
        apiParams: {
          url: 'https://dummyjson.com/users',
          method: 'get'
        },
        configTableOut: {
          total: 'total',
          pageSize: 'limit',
          tableData: 'users'
        },
        listenToCallBack: {
          // brcb（beforeRequest 的简写）把分页参数改写成 dummyjson 的 limit / skip；
          // 返回值会整体替换请求参数，所以后端要的字段必须一次写全
          brcb: (params) => {
            const { pageSize, pageIndex } = params
            return {
              limit: pageSize,
              skip: (pageIndex - 1) * pageSize
            }
          }
        }
      }
    }
  }
}
</script>
