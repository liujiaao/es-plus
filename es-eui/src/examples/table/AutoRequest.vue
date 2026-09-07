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
        { key: 'id', label: 'ID', width: 80 },
        { key: 'firstName', label: '名', width: 120 },
        { key: 'lastName', label: '姓', width: 120 },
        { key: 'email', label: '邮箱' },
        {
          key: 'image',
          label: '头像',
          width: 80,
          render: (h, { row }) => (
            <el-avatar size="small" src={row.image} />
          )
        }
      ],
      pagination: { pageIndex: 1, pageSize: 10, total: 0 },
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
          current: 'skip',
          tableData: 'users'
        },
        listenToCallBack: {
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
