<template>
  <div>
    <es-table
      :columns="columns"
      :options="tableOptions"
      v-model:data-source="pagedData"
      v-model:pagination="pagination"
    >
      <!-- 展开行内容通过 scopedSlots 自定义 -->
      <!-- <template #expand="{ row }">
        <div style="padding: 16px; background: #f5f7fa; border-radius: 4px;">
          <el-descriptions :column="3" border size="small">
            <el-descriptions-item label="员工ID">{{ row.id }}</el-descriptions-item>
            <el-descriptions-item label="姓名">{{ row.name }}</el-descriptions-item>
            <el-descriptions-item label="部门">{{ row.department }}</el-descriptions-item>
            <el-descriptions-item label="职位">{{ row.position }}</el-descriptions-item>
            <el-descriptions-item label="手机">{{ row.phone }}</el-descriptions-item>
            <el-descriptions-item label="邮箱">{{ row.email }}</el-descriptions-item>
            <el-descriptions-item label="薪资" :span="3">
              <el-tag type="success">{{ row.salary }} 元/月</el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </div>
      </template> -->
    </es-table>
  </div>
</template>

<script setup lang="tsx">
import { ref, computed } from 'vue'
import { EsTable } from 'es-plus'

const columns = [
  { type: 'expand', width: 50, render: (h, { row }) => { return  <div style="padding: 16px; background: #f5f7fa; border-radius: 4px;">
          <el-descriptions column={3} border size="small">
            <el-descriptions-item label="员工ID">{ row.id }</el-descriptions-item>
            <el-descriptions-item label="姓名">{ row.name }</el-descriptions-item>
            <el-descriptions-item label="部门">{row.department }</el-descriptions-item>
            <el-descriptions-item label="职位">{row.position }</el-descriptions-item>
            <el-descriptions-item label="手机">{ row.phone }</el-descriptions-item>
            <el-descriptions-item label="邮箱">{row.email }</el-descriptions-item>
            <el-descriptions-item label="薪资" span={3}>
              <el-tag type="success">{row.salary } 元/月</el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </div> } },
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'name', label: '姓名', minWidth: 120 },
  { prop: 'department', label: '部门', width: 130 },
  { prop: 'position', label: '职位', width: 130 },
]

const tableOptions = {
  engine: 'vxe' as const,
  border: true,
  rowkey: 'id',
  expandConfig: { trigger: 'row' },
}

const pagination = ref({ pageSize: 10, current: 1, total: 0 })

const positions = ['工程师', '高级工程师', '架构师', '经理', '总监']
const departments = ['技术部', '产品部', '设计部', '市场部']
const allData = Array.from({ length: 15 }, (_, i) => ({
  id: i + 1,
  name: `员工${i + 1}`,
  department: departments[i % departments.length],
  position: positions[i % positions.length],
  phone: `138${String(10000000 + i).slice(-8)}`,
  email: `user${i + 1}@company.com`,
  salary: (8000 + i * 800).toLocaleString(),
}))
pagination.value.total = allData.length

const pagedData = computed(() => {
  const start = (pagination.value.current - 1) * pagination.value.pageSize
  return allData.slice(start, start + pagination.value.pageSize)
})
</script>
