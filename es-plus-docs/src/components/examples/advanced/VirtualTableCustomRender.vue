<template>
  <div class="virtual-render-demo">
    <h4 style="margin-bottom: 12px; color: #606266;">虚拟表格 — 自定义渲染 + Tooltip + 格式化</h4>
    <es-table
      ref="tableRef"
      :columns="columns"
      :options="tableOptions"
      v-model:data-source="tableData"
      v-model:pagination="pagination"
    >
      <template #address="{ row }">
        <span style="color: #409eff;">{{ row.province }} - {{ row.city }}</span>
      </template>
    </es-table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import { ElProgress, ElTag } from 'element-plus'
import { EsTable } from 'es-plus'

const tableRef = ref<InstanceType<typeof EsTable> | null>(null)

const columns = [
  { prop: 'id', label: 'ID', width: 70 },
  { prop: 'name', label: '姓名', width: 100 },
  { prop: 'description', label: '个人简介', width: 200, ellipsis: true },
  { prop: 'progress', label: '完成进度', width: 180,
    render: (_h: any, { row }: any) => {
      const val = row.progress as number
      const status = val >= 100 ? 'success' : val >= 60 ? '' : 'warning'
      return h(ElProgress, {
        percentage: val,
        status,
        strokeWidth: 6,
        style: { width: '140px' },
      })
    }
  },
  { prop: 'tags', label: '标签', width: 200,
    render: (_h: any, { row }: any) => {
      const tags = row.tags as string[]
      return h('div', { style: { display: 'flex', gap: '4px', flexWrap: 'wrap' } },
        tags.map(tag => h(ElTag, { size: 'small', type: tag.length > 2 ? 'warning' : 'success' }, () => tag))
      )
    }
  },
  { prop: 'address', label: '地址', minWidth: 180,
    scopedSlots: { customRender: 'address' }
  },
  { prop: 'salary', label: '月薪', width: 120, align: 'right',
    formatter: (row: any) => `¥${Number(row.salary).toLocaleString()}`
  },
  { prop: 'joinDate', label: '入职日期', width: 120 },
]

const tableOptions = {
  virtual: true,
  border: true,
  rowkey: 'id',
  rowHeight: 52,
  heightType: 'height' as const,
  tabHeight: 480,
}

const pagination = ref({ pageSize: 50000, current: 1, total: 0 })

const provinces = ['广东', '浙江', '江苏', '北京', '上海']
const cities: Record<string, string[]> = {
  '广东': ['广州', '深圳', '东莞'],
  '浙江': ['杭州', '宁波', '温州'],
  '江苏': ['南京', '苏州', '无锡'],
  '北京': ['朝阳', '海淀', '丰台'],
  '上海': ['浦东', '徐汇', '静安'],
}
const tagPool = ['前端', '后端', 'AI', '全栈', '测试', '运维', '架构师', 'PM']

function generateData(count: number) {
  const data: Record<string, unknown>[] = []
  for (let i = 1; i <= count; i++) {
    const province = provinces[i % provinces.length]
    const cityList = cities[province]
    const tags: string[] = []
    const tagCount = 1 + (i % 3)
    for (let j = 0; j < tagCount; j++) {
      tags.push(tagPool[(i + j) % tagPool.length])
    }
    data.push({
      id: i,
      name: `员工${i}`,
      description: `这是员工${i}的详细个人简介信息，包含丰富的职业经历和专业技能描述，用于展示文本溢出省略效果。`,
      progress: Math.min(100, Math.round(Math.random() * 120)),
      tags,
      province,
      city: cityList[i % cityList.length],
      salary: 8000 + Math.floor(Math.random() * 42000),
      joinDate: `2020-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
    })
  }
  return data
}

const tableData = ref<Record<string, unknown>[]>([])

onMounted(() => {
  tableData.value = generateData(50000)
  pagination.value.total = tableData.value.length
})
</script>

<style scoped>
.virtual-render-demo {
  padding: 0;
}
</style>
