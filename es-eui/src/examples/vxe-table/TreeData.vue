<template>
  <div>
    <div style="margin-bottom: 10px; display: flex; gap: 8px;">
      <el-button size="mini" @click="expandAll">展开全部</el-button>
      <el-button size="mini" @click="collapseAll">折叠全部</el-button>
    </div>
    <el-alert
      type="info"
      :closable="false"
      style="margin-bottom: 10px;"
      description="treeConfig：rowField 行ID，parentField 父ID，transform:true 由扁平数据自动构造树形"
    />
    <es-table
      ref="tableRef"
      :columns="columns"
      :options="tableOptions"
      :data-source="treeData"
    />
  </div>
</template>

<script lang="jsx">
/**
 * 树形表格 —— treeConfig.transform 由扁平数据自动构造树
 *
 * vxe 3.x 访问路径（关键）：setAllTreeExpand 由 grid 直接代理，
 *   grid = tableRef.value.vxeEngineRef.vxeInstance()。首次渲染后延迟展开确保生效。
 */
import { defineComponent, ref, onMounted, nextTick } from '@vue/composition-api'

export default defineComponent({
  name: 'VxeTableTreeData',
  setup() {
    const tableRef = ref(null)
    const getGrid = () => tableRef.value?.vxeEngineRef?.vxeInstance?.()

    const columns = [
      { prop: 'name', label: '部门/姓名', minWidth: 200, treeNode: true },
      { prop: 'type', label: '类型', width: 100 },
      { prop: 'headCount', label: '人数', width: 100, align: 'center' },
      { prop: 'budget', label: '预算(万)', width: 110, align: 'right' }
    ]

    const tableOptions = {
      engine: 'vxe',
      border: true,
      rowkey: 'id',
      treeConfig: {
        rowField: 'id',
        parentField: 'parentId',
        children: 'children',
        mapChildren: '_X_ROW_CHILD',
        transform: true
      }
    }

    const treeData = ref([
      { id: 1, parentId: null, name: '技术中心', type: '中心', headCount: 80, budget: 500 },
      { id: 2, parentId: 1, name: '前端组', type: '小组', headCount: 20, budget: 120 },
      { id: 3, parentId: 1, name: '后端组', type: '小组', headCount: 30, budget: 200 },
      { id: 4, parentId: 1, name: '测试组', type: '小组', headCount: 15, budget: 80 },
      { id: 5, parentId: 1, name: 'DevOps组', type: '小组', headCount: 15, budget: 100 },
      { id: 6, parentId: 2, name: '张三', type: '员工', headCount: 1, budget: 0 },
      { id: 7, parentId: 2, name: '李四', type: '员工', headCount: 1, budget: 0 },
      { id: 8, parentId: 3, name: '王五', type: '员工', headCount: 1, budget: 0 },
      { id: 9, parentId: 3, name: '赵六', type: '员工', headCount: 1, budget: 0 },
      { id: 10, parentId: 4, name: '钱七', type: '员工', headCount: 1, budget: 0 },
      { id: 11, parentId: null, name: '产品中心', type: '中心', headCount: 30, budget: 200 },
      { id: 12, parentId: 11, name: 'B端产品组', type: '小组', headCount: 12, budget: 80 },
      { id: 13, parentId: 11, name: 'C端产品组', type: '小组', headCount: 10, budget: 70 },
      { id: 14, parentId: 12, name: '孙八', type: '员工', headCount: 1, budget: 0 },
      { id: 15, parentId: 12, name: '周九', type: '员工', headCount: 1, budget: 0 }
    ])

    onMounted(() => nextTick(() => {
      // vxe-grid 内部 <vxe-table> 初始化需极短时间，延迟确保 setAllTreeExpand 有效
      setTimeout(() => getGrid()?.setAllTreeExpand?.(true), 50)
    }))

    const expandAll = () => getGrid()?.setAllTreeExpand?.(true)
    const collapseAll = () => getGrid()?.setAllTreeExpand?.(false)

    return { tableRef, columns, tableOptions, treeData, expandAll, collapseAll }
  }
})
</script>
