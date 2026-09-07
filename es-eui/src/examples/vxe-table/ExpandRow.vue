<template>
  <div>
    <el-alert
      type="info"
      :closable="false"
      style="margin-bottom: 10px;"
      description="type:'expand' 展开行，render 自定义展开内容；expandConfig.trigger:'row' 点击整行展开"
    />
    <es-table
      :columns="columns"
      :options="tableOptions"
      :data-source="pagedData"
      :pagination="pagination"
      @pagination-current-change="onCurrentChange"
      @size-change="onSizeChange"
    />
  </div>
</template>

<script lang="jsx">
/**
 * 展开行 —— type:'expand' 列，render(h,{row}) 返回展开区内容
 *
 * 关键点：expandConfig.trigger:'row' 点击整行展开；展开区用 el-descriptions 展示明细。
 */
import { defineComponent, ref, computed } from '@vue/composition-api'

export default defineComponent({
  name: 'VxeTableExpandRow',
  setup() {
    const columns = [
      {
        type: 'expand',
        width: 50,
        render: (h, { row }) => (
          <div style="padding: 12px 24px;">
            <el-descriptions column={3} border size="small">
              <el-descriptions-item label="邮箱">{row.email}</el-descriptions-item>
              <el-descriptions-item label="手机">{row.phone}</el-descriptions-item>
              <el-descriptions-item label="入职日期">{row.joinDate}</el-descriptions-item>
              <el-descriptions-item label="职位">{row.position}</el-descriptions-item>
              <el-descriptions-item label="直属上级">{row.leader}</el-descriptions-item>
              <el-descriptions-item label="办公地点">{row.location}</el-descriptions-item>
            </el-descriptions>
          </div>
        )
      },
      { prop: 'name', label: '姓名', minWidth: 120 },
      { prop: 'department', label: '部门', width: 130 },
      { prop: 'position', label: '职位', width: 140 }
    ]

    const departments = ['技术部', '产品部', '设计部', '市场部']
    const positions = ['工程师', '高级工程师', '架构师', '经理']
    const tableData = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      name: `员工${i + 1}`,
      department: departments[i % departments.length],
      position: positions[i % positions.length],
      email: `user${i + 1}@example.com`,
      phone: `138${String(10000000 + i).slice(0, 8)}`,
      joinDate: `2021-${String((i % 12) + 1).padStart(2, '0')}-01`,
      leader: `主管${(i % 4) + 1}`,
      location: ['北京', '上海', '深圳', '杭州'][i % 4]
    }))

    const tableOptions = {
      engine: 'vxe',
      border: true,
      rowkey: 'id',
      expandConfig: { trigger: 'row' },
      height: 420,
      heightType: 'height'
    }

    // 客户端分页：total 有值才点亮分页器；事件回传完整 paginationConfig 对象
    const pagination = ref({ pageSize: 10, current: 1, total: tableData.length })
    const pagedData = computed(() => {
      const start = (pagination.value.current - 1) * pagination.value.pageSize
      return tableData.slice(start, start + pagination.value.pageSize)
    })
    const onCurrentChange = (pager) => { pagination.value.current = pager.current }
    const onSizeChange = (pager) => { pagination.value.pageSize = pager.pageSize; pagination.value.current = pager.current }

    return { columns, tableOptions, pagedData, pagination, onCurrentChange, onSizeChange }
  }
})
</script>
