<template>
  <div>
    <div style="margin-bottom: 10px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
      <el-button size="mini" type="primary" @click="addRow">新增行</el-button>
      <el-button size="mini" type="success" @click="validateAndSave">校验并保存</el-button>
      <el-button size="mini" @click="revertAll">撤销</el-button>
      <el-tag v-if="insertCount > 0" size="mini" type="success">新增 {{ insertCount }}</el-tag>
      <el-tag v-if="updateCount > 0" size="mini" type="warning">修改 {{ updateCount }}</el-tag>
      <el-tag v-if="deleteCount > 0" size="mini" type="danger">删除 {{ deleteCount }}</el-tag>
    </div>
    <el-alert
      type="info"
      :closable="false"
      style="margin-bottom: 10px;"
      description="行模式编辑：点击行激活整行编辑；操作列提供行内删除按钮；vxeColumn.rules 声明校验规则，校验通过后批量提交"
    />
    <es-table
      ref="tableRef"
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
 * 行编辑 + 校验 —— editConfig(mode:'row') + vxeColumn.rules + CRUD 批量提交
 *
 * vxe 3.x 访问路径（关键）：grid 直接代理 insertAt / remove / validate /
 *   getInsertRecords / getUpdateRecords / getRemoveRecords / revertData，
 *   取 grid = tableRef.value.vxeEngineRef.vxeInstance() 即可调用。
 */
import { defineComponent, ref, computed } from '@vue/composition-api'
import { Message } from 'element-ui'

export default defineComponent({
  name: 'VxeTableRowEdit',
  setup() {
    const tableRef = ref(null)
    const insertCount = ref(0)
    const updateCount = ref(0)
    const deleteCount = ref(0)
    let idSeq = 20

    const getGrid = () => tableRef.value?.vxeEngineRef?.vxeInstance?.()

    const deptOptions = [
      { label: '技术部', value: '技术部' },
      { label: '产品部', value: '产品部' },
      { label: '设计部', value: '设计部' },
      { label: '市场部', value: '市场部' }
    ]

    const deleteRow = async (row) => {
      await getGrid()?.remove?.(row)
      refreshCounts()
    }

    const columns = [
      {
        prop: 'name', label: '姓名', minWidth: 120,
        editRender: { name: '$input', props: { placeholder: '必填' } },
        vxeColumn: { rules: [{ required: true, message: '姓名必填' }] }
      },
      { prop: 'department', label: '部门', width: 130, editRender: { name: '$select', options: deptOptions } },
      {
        prop: 'salary', label: '薪资', width: 120,
        editRender: { name: '$input', props: { type: 'number', min: 0 } },
        vxeColumn: { rules: [{ required: true, type: 'number', min: 1, message: '薪资必须 > 0' }] }
      },
      {
        prop: 'operate', label: '操作', width: 90,
        btns: [{ name: '删除', type: 'danger', clickEvent: (row) => deleteRow(row) }]
      }
    ]

    const tableOptions = {
      engine: 'vxe',
      border: true,
      rowkey: 'id',
      height: 420,
      heightType: 'height',
      keepSource: true,
      editConfig: { mode: 'row', trigger: 'click', showStatus: true },
      validConfig: { autoPos: true },
      vxeOn: { 'edit-closed': () => refreshCounts() }
    }

    const tableData = Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      name: `员工${i + 1}`,
      department: ['技术部', '产品部'][i % 2],
      salary: 8000 + i * 500
    }))

    // 客户端分页：total 有值才点亮分页器；事件回传完整 paginationConfig 对象
    const pagination = ref({ pageSize: 10, current: 1, total: tableData.length })
    const pagedData = computed(() => {
      const start = (pagination.value.current - 1) * pagination.value.pageSize
      return tableData.slice(start, start + pagination.value.pageSize)
    })
    const onCurrentChange = (pager) => { pagination.value.current = pager.current }
    const onSizeChange = (pager) => { pagination.value.pageSize = pager.pageSize; pagination.value.current = pager.current }

    function refreshCounts() {
      const g = getGrid()
      insertCount.value = g?.getInsertRecords?.()?.length ?? 0
      updateCount.value = g?.getUpdateRecords?.()?.length ?? 0
      deleteCount.value = g?.getRemoveRecords?.()?.length ?? 0
    }

    const addRow = async () => {
      await getGrid()?.insertAt?.({ id: ++idSeq, name: '', department: '技术部', salary: 8000 }, -1)
      refreshCounts()
    }

    const validateAndSave = async () => {
      const errMap = await getGrid()?.validate?.()
      if (errMap) { Message.error('校验失败，请修正错误'); return }
      const inserts = getGrid()?.getInsertRecords?.() ?? []
      const updates = getGrid()?.getUpdateRecords?.() ?? []
      Message.success(`保存成功：新增 ${inserts.length}，修改 ${updates.length}`)
    }

    const revertAll = () => {
      getGrid()?.revertData?.()
      refreshCounts()
      Message.info('已撤销所有修改')
    }

    return {
      tableRef, columns, tableOptions, pagedData, pagination,
      insertCount, updateCount, deleteCount,
      addRow, validateAndSave, revertAll,
      onCurrentChange, onSizeChange
    }
  }
})
</script>
