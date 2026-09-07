<template>
  <div>
    <div style="margin-bottom: 12px; padding: 10px; background: #f5f7fa; border-radius: 4px;">
      <template v-if="currentRow">
        当前选中：<el-tag size="small">{{ currentRow.name }}</el-tag>
        订单号 {{ currentRow.orderNo }}，金额 ¥{{ currentRow.amount }}
      </template>
      <span v-else style="color: #909399;">点击任意行以高亮并查看详情</span>
    </div>
    <es-table
      :data-source="data"
      :columns="columns"
      :options="options"
      @current-change="handleCurrentChange"
    />
  </div>
</template>

<script lang="jsx">
/**
 * 当前行高亮 —— 演示单选行高亮 + current-change 事件
 *
 * 关键点：
 *   1. options.highlightCurrentRow 开启单行高亮（EsTable 默认即为 true）
 *   2. @current-change 是 el-table 原生事件，EsTable 通过 v-on="$listeners" 透传，
 *      回调参数为 (currentRow, oldCurrentRow)
 *   3. 与多选（selection）不同，当前行是「单选」语义，常用于主从表联动
 */
import { defineComponent, reactive, ref } from '@vue/composition-api'

export default defineComponent({
  name: 'TableCurrentRow',
  setup() {
    const data = reactive([
      { id: 1, name: '张三', orderNo: 'NO20240001', amount: 1280, status: '已支付' },
      { id: 2, name: '李四', orderNo: 'NO20240002', amount: 860, status: '待支付' },
      { id: 3, name: '王五', orderNo: 'NO20240003', amount: 3200, status: '已支付' },
      { id: 4, name: '赵六', orderNo: 'NO20240004', amount: 540, status: '已取消' }
    ])

    const currentRow = ref(null)

    const columns = [
      { prop: 'id', label: 'ID', width: 80 },
      { prop: 'name', label: '客户', width: 120 },
      { prop: 'orderNo', label: '订单号', width: 160 },
      { prop: 'amount', label: '金额', width: 120, render: (h, { row }) => <span>¥{row.amount}</span> },
      {
        prop: 'status',
        label: '状态',
        render: (h, { row }) => {
          const map = { 已支付: 'success', 待支付: 'warning', 已取消: 'info' }
          return <el-tag type={map[row.status]} size="small">{row.status}</el-tag>
        }
      }
    ]

    const options = {
      border: true,
      highlightCurrentRow: true
    }

    const handleCurrentChange = (row) => {
      currentRow.value = row
    }

    return { data, columns, options, currentRow, handleCurrentChange }
  }
})
</script>
