<template>
  <div>
    <div style="margin-bottom: 10px; display: flex; gap: 8px; align-items: center;">
      <el-button size="mini" type="primary" @click="showSelected">查看已选</el-button>
      <el-button size="mini" @click="clearAll">清空选择</el-button>
      <span style="font-size: 13px; color: #909399;">已选 {{ selectedCount }} 项</span>
    </div>
    <el-alert
      type="info"
      :closable="false"
      style="margin-bottom: 10px;"
      description="type:'selection' 多选列 + type:'index' 序号列；通过 EsTable 暴露的 getSelectionRows() / clearSelection() 操作选中项"
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
    <el-dialog title="已选数据" :visible.sync="dialogVisible" width="520px" append-to-body>
      <pre style="max-height: 360px; overflow: auto; background: #f5f7fa; padding: 12px; border-radius: 4px; font-size: 12px;">{{ selectedJson }}</pre>
    </el-dialog>
  </div>
</template>

<script lang="jsx">
/**
 * 多选 + 序号 —— selection / index 列，选中项通过 EsTable 暴露方法读取
 *
 * 关键点：vxe 3.x 引擎下多选/清空委托给 EsTable 暴露的
 *   getSelectionRows() / clearSelection()（内部代理 vxe checkbox API）。
 */
import { defineComponent, ref, computed } from '@vue/composition-api'
import { Message } from 'element-ui'

export default defineComponent({
  name: 'VxeTableSelectionIndex',
  setup() {
    const tableRef = ref(null)
    const selected = ref([])
    const dialogVisible = ref(false)

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
    const onCurrentChange = (pager) => { pagination.value.current = pager.current }
    const onSizeChange = (pager) => { pagination.value.pageSize = pager.pageSize; pagination.value.current = pager.current }

    const selectedCount = computed(() => selected.value.length)
    const selectedJson = computed(() => JSON.stringify(selected.value, null, 2))

    const onSelectionChange = (rows) => { selected.value = rows || [] }

    const showSelected = () => {
      const rows = tableRef.value?.getSelectionRows?.() || []
      selected.value = rows
      if (!rows.length) {
        Message.info('尚未选择任何数据')
        return
      }
      dialogVisible.value = true
    }

    const clearAll = () => {
      tableRef.value?.clearSelection?.()
      selected.value = []
    }

    return {
      tableRef, columns, tableOptions, pagedData, pagination,
      selected, selectedCount, selectedJson, dialogVisible,
      onSelectionChange, showSelected, clearAll,
      onCurrentChange, onSizeChange
    }
  }
})
</script>
