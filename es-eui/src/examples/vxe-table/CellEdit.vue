<template>
  <div>
    <div style="margin-bottom: 10px; display: flex; gap: 8px; align-items: center;">
      <el-button size="mini" type="primary" @click="saveChanges">保存修改</el-button>
      <el-button size="mini" @click="revertAll">撤销全部</el-button>
      <span v-if="updateCount > 0" style="font-size: 13px; color: #e6a23c;">
        {{ updateCount }} 条待保存
      </span>
    </div>
    <el-alert
      type="info"
      :closable="false"
      style="margin-bottom: 10px;"
      description="单击单元格进入编辑模式（cell 模式）；部门列为下拉选择，其余为文本输入"
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
 * 单元格编辑 —— editRender + editConfig(mode:'cell')
 *
 * vxe 3.x 访问路径（关键）：
 *   getRefMaps 是 vxe-4 API，3.x 不存在。CRUD 方法（getUpdateRecords/clearEdit/
 *   revertData）由 vxe-grid 直接代理，故取 grid 实例即可调用：
 *     grid = tableRef.value.vxeEngineRef.vxeInstance()
 *   keepSource:true 让 vxe 保存原始快照，getUpdateRecords() 才能识别已改行。
 */
import { defineComponent, ref, computed } from '@vue/composition-api'
import { Message } from 'element-ui'

export default defineComponent({
  name: 'VxeTableCellEdit',
  setup() {
    const tableRef = ref(null)
    const updateCount = ref(0)

    // vxe 3.x：grid 直接代理内部 <vxe-table> 的 CRUD 方法
    const getGrid = () => tableRef.value?.vxeEngineRef?.vxeInstance?.()

    const deptOptions = [
      { label: '技术部', value: '技术部' },
      { label: '产品部', value: '产品部' },
      { label: '设计部', value: '设计部' },
      { label: '市场部', value: '市场部' },
      { label: '运营部', value: '运营部' }
    ]

    const columns = [
      { prop: 'id', label: 'ID', width: 70 },
      { prop: 'name', label: '姓名', minWidth: 130, editRender: { name: '$input', props: { placeholder: '请输入姓名' } } },
      { prop: 'department', label: '部门', width: 130, editRender: { name: '$select', options: deptOptions } },
      { prop: 'salary', label: '薪资', width: 130, editRender: { name: '$input', props: { type: 'number', min: 0 } } },
      { prop: 'joinDate', label: '入职日期', width: 130 }
    ]

    const tableOptions = {
      engine: 'vxe',
      border: true,
      rowkey: 'id',
      height: 420,
      heightType: 'height',
      keepSource: true,
      editConfig: { mode: 'cell', trigger: 'click' },
      vxeOn: {
        'edit-closed': () => {
          updateCount.value = getGrid()?.getUpdateRecords?.()?.length ?? 0
        }
      }
    }

    const departments = ['技术部', '产品部', '设计部', '市场部', '运营部']
    const tableData = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      name: `员工${i + 1}`,
      department: departments[i % departments.length],
      salary: 8000 + i * 500,
      joinDate: `2021-${String((i % 12) + 1).padStart(2, '0')}-01`
    }))

    // 客户端分页：total 有值才点亮分页器；事件回传完整 paginationConfig 对象
    // 编辑作用于行对象引用，翻页不丢失；getUpdateRecords 按当前页可见行统计
    const pagination = ref({ pageSize: 10, current: 1, total: tableData.length })
    const pagedData = computed(() => {
      const start = (pagination.value.current - 1) * pagination.value.pageSize
      return tableData.slice(start, start + pagination.value.pageSize)
    })
    const onCurrentChange = (pager) => { pagination.value.current = pager.current }
    const onSizeChange = (pager) => { pagination.value.pageSize = pager.pageSize; pagination.value.current = pager.current }

    const saveChanges = async () => {
      const grid = getGrid()
      if (!grid) { Message.warning('vxe 引擎未就绪'); return }
      await grid.clearEdit?.()
      const rows = grid.getUpdateRecords?.() ?? []
      if (!rows.length) { Message.info('没有修改的数据'); return }
      Message.success(`已保存 ${rows.length} 条修改`)
      updateCount.value = 0
    }

    const revertAll = async () => {
      await getGrid()?.revertData?.()
      updateCount.value = 0
      Message.info('已撤销所有修改')
    }

    return { tableRef, columns, tableOptions, pagedData, pagination, updateCount, saveChanges, revertAll, onCurrentChange, onSizeChange }
  }
})
</script>
