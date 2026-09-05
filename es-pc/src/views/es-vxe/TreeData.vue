<template>
  <div>
    <a-space style="margin-bottom: 10px">
      <a-button size="small" @click="expandAll">展开全部</a-button>
      <a-button size="small" @click="collapseAll">折叠全部</a-button>
    </a-space>
    <a-alert
      type="info"
      show-icon
      style="margin-bottom: 10px"
      message="treeConfig：rowField 行ID，parentField 父ID，通过扁平数据构造树形；transform:true 自动转换"
    />
    <es-table
      ref="tableRef"
      :columns="columns"
      :options="tableOptions"
      v-model:data-source="treeData"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { EsTable } from '@es-plus/adapter-antdv'

const tableRef = ref(null)

const columns = [
  { prop: 'name', label: '部门/姓名', minWidth: 200, treeNode: true },
  { prop: 'type', label: '类型', width: 100 },
  { prop: 'headCount', label: '人数', width: 100, align: 'center' },
  { prop: 'budget', label: '预算(万)', width: 110, align: 'right' },
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
    transform: true,
  },
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
  { id: 15, parentId: 12, name: '周九', type: '员工', headCount: 1, budget: 0 },
])

function getGrid() {
  return tableRef.value?.vxeInstance?.()
}

onMounted(() => nextTick(() => {
  setTimeout(() => getGrid()?.setAllTreeExpand?.(true), 50)
}))

function expandAll() {
  getGrid()?.setAllTreeExpand?.(true)
}

function collapseAll() {
  getGrid()?.setAllTreeExpand?.(false)
}
</script>
