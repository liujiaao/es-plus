<template>
  <div>
    <div class="demo-toolbar">
      <el-button size="mini" type="primary" @click="showSelected">查看已选</el-button>
      <el-button size="mini" @click="clearAll">清空选择</el-button>
      <span class="demo-hint">跨页已选 {{ totalCount }} 项 · 上次 selection-change 载荷 {{ eventCount }} 项（当前页）</span>
    </div>
    <el-alert
      type="info"
      :closable="false"
      class="demo-alert"
      description="type:'selection' 多选列 + type:'index' 序号列。翻页后勾选不丢（rowkey 驱动 reserve）：selection-change 只报当前页，跨页全集用 getSelectionRows() 取。"
    />
    <es-table
      ref="tableRef"
      :columns="columns"
      :options="tableOptions"
      :data-source="pagedData"
      :pagination="pagination"
      @selection-change="onSelectionChange"
      @pagination-current-change="onCurrentChange"
      @size-change="onSizeChange"
    />
    <el-dialog title="已选数据（跨页全集）" :visible.sync="dialogVisible" width="520px" append-to-body>
      <pre class="demo-json">{{ selectedJson }}</pre>
    </el-dialog>
  </div>
</template>

<script lang="jsx">
/**
 * 多选 + 序号 + 跨页勾选 —— selection / index 列，选中项通过 EsTable 暴露方法读取
 *
 * 关键点：
 *   · rowkey 是跨页勾选的唯一依据；显式 type:'selection' 列与 options.multiSelect 等价；
 *   · selection-change 只带当前页（与 el-table 一致），跨页全集走 getSelectionRows()；
 *   · clearSelection() 连 vxe 的 reserve 一起清（内部 clearCheckboxRow 会清保留记录）。
 */
import { defineComponent, ref, computed, nextTick } from '@vue/composition-api'
import { Message } from 'element-ui'

export default defineComponent({
  name: 'VxeTableSelectionIndex',
  setup() {
    const tableRef = ref(null)
    const dialogVisible = ref(false)
    const selected = ref([])
    const eventCount = ref(0)

    const columns = [
      { type: 'selection', width: 50 },
      { type: 'index', label: '序号', width: 70 },
      { prop: 'name', label: '姓名', minWidth: 120 },
      { prop: 'department', label: '部门', width: 130 },
      {
        prop: 'salary',
        label: '薪资',
        width: 130,
        align: 'right',
        formatter: (row) => `¥${Number(row.salary).toLocaleString()}`
      }
    ]

    const departments = ['技术部', '产品部', '设计部', '市场部', '运营部']
    const tableData = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      name: `员工${i + 1}`,
      department: departments[i % departments.length],
      salary: 8000 + i * 600
    }))

    const tableOptions = { engine: 'vxe', border: true, rowkey: 'id', height: 420, heightType: 'height' }

    // 客户端分页：total 有值才点亮分页器；pagination-current-change/size-change 回传完整 paginationConfig 对象
    const pagination = ref({ pageSize: 10, current: 1, total: tableData.length })
    const pagedData = computed(() => {
      const start = (pagination.value.current - 1) * pagination.value.pageSize
      return tableData.slice(start, start + pagination.value.pageSize)
    })
    const onCurrentChange = (pager) => {
      pagination.value.current = pager.current
      // 翻页不触发 selection-change，但回到含已选行的页时 reserve 会重新勾上
      nextTick(refreshTotal)
    }
    const onSizeChange = (pager) => {
      pagination.value.pageSize = pager.pageSize
      pagination.value.current = pager.current
      nextTick(refreshTotal)
    }

    const totalCount = computed(() => selected.value.length)
    const selectedJson = computed(() => JSON.stringify(selected.value, null, 2))

    function refreshTotal() {
      selected.value = tableRef.value?.getSelectionRows?.() || []
    }

    // 事件载荷只有当前页 —— 与 el-table 同一口径；跨页全集等下一轮再读
    const onSelectionChange = (rows) => {
      eventCount.value = (rows || []).length
      nextTick(refreshTotal)
    }

    const showSelected = () => {
      refreshTotal()
      if (!selected.value.length) {
        Message.info('尚未选择任何数据')
        return
      }
      dialogVisible.value = true
    }

    const clearAll = () => {
      tableRef.value?.clearSelection?.()
      selected.value = []
      eventCount.value = 0
    }

    return {
      tableRef, columns, tableOptions, pagedData, pagination,
      selected, totalCount, eventCount, selectedJson, dialogVisible,
      onSelectionChange, showSelected, clearAll,
      onCurrentChange, onSizeChange
    }
  }
})
</script>

<style scoped>
.demo-toolbar {
  margin-bottom: 10px;
  display: flex;
  gap: 8px;
  align-items: center;
}
.demo-alert {
  margin-bottom: 10px;
}
.demo-hint {
  font-size: 13px;
  color: #909399;
}
.demo-json {
  max-height: 360px;
  overflow: auto;
  background: #f5f7fa;
  padding: 12px;
  border-radius: 4px;
  font-size: 12px;
}
</style>
