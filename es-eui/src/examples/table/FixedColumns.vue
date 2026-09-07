<template>
  <es-table
    :data-source="data"
    :columns="columns"
    :options="options"
  />
</template>

<script lang="jsx">
/**
 * 固定列 —— 演示左右固定列 + 横向滚动
 *
 * 关键点：
 *   1. 列配置 `fixed: 'left'` / `fixed: 'right'` 固定在两侧，中间列横向滚动
 *   2. 必须给足够的列宽（width）使总宽超出容器，才会出现横向滚动条
 *   3. options 配 `heightType: 'height'` + `tabHeight` 固定高度，配合固定列体验最佳
 */
import { defineComponent, reactive } from '@vue/composition-api'

export default defineComponent({
  name: 'TableFixedColumns',
  setup() {
    const data = reactive(
      Array.from({ length: 8 }).map((_, i) => ({
        id: i + 1,
        name: `员工${i + 1}`,
        dept: ['研发部', '市场部', '财务部', '人事部'][i % 4],
        phone: `1380013${String(8000 + i).padStart(4, '0')}`,
        email: `user${i + 1}@example.com`,
        address: `北京市朝阳区某某路 ${i + 1} 号院`,
        salary: 8000 + i * 500,
        entryDate: `2021-0${(i % 9) + 1}-15`,
        status: i % 2 === 0 ? '在职' : '离职'
      }))
    )

    const columns = [
      { prop: 'id', label: 'ID', width: 70, fixed: 'left' },
      { prop: 'name', label: '姓名', width: 120, fixed: 'left' },
      { prop: 'dept', label: '部门', width: 140 },
      { prop: 'phone', label: '手机号', width: 160 },
      { prop: 'email', label: '邮箱', width: 220 },
      { prop: 'address', label: '住址', width: 260 },
      { prop: 'salary', label: '薪资', width: 140 },
      { prop: 'entryDate', label: '入职日期', width: 160 },
      {
        prop: 'operate',
        label: '操作',
        width: 120,
        fixed: 'right',
        render: (h, { row }) => (
          <el-tag type={row.status === '在职' ? 'success' : 'info'} size="small">{row.status}</el-tag>
        )
      }
    ]

    const options = {
      border: true,
      heightType: 'height',
      tabHeight: 360
    }

    return { data, columns, options }
  }
})
</script>
