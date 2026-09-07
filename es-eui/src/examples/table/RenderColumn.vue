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
        { id: 1, name: '张三', status: '1', score: 85 },
        { id: 2, name: '李四', status: '0', score: 92 },
        { id: 3, name: '王五', status: '2', score: 78 }
      ],
      columns: [
        { key: 'id', label: 'ID', width: 80 },
        { key: 'name', label: '姓名' },
        {
          key: 'status',
          label: '状态',
          render: (h, { row }) => {
            const statusMap = {
              '0': { text: '草稿', type: 'info' },
              '1': { text: '已上架', type: 'success' },
              '2': { text: '已下架', type: 'danger' }
            }
            const status = statusMap[row.status]
            return <el-tag type={status.type}>{status.text}</el-tag>
          }
        },
        {
          key: 'score',
          label: '评分',
          render: (h, { row }) => {
            const color = row.score >= 90 ? '#67c23a' : row.score >= 80 ? '#e6a23c' : '#f56c6c'
            return (
              <div style="display: flex; align-items: center; gap: 10px;">
                <el-progress percentage={row.score} color={color} style="width: 100px;" />
                <span style={{ color }}>{row.score}分</span>
              </div>
            )
          }
        }
      ],
      options: { border: true }
    }
  }
}
</script>
