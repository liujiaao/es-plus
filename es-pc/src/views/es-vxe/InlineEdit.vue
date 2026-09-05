<template>
  <div class="example-vxe-inline-edit">
    <es-table
      ref="tableRef"
      :data-source="tableData"
      :columns="columns"
      :options="{
        engine: 'vxe',
        border: true,
        rowkey: 'id',
        editConfig: { trigger: 'click', mode: 'cell' },
      }"
    />
    <a-button type="primary" size="small" style="margin-top: 12px" @click="getUpdates">
      获取改动记录
    </a-button>
    <a-alert
      v-if="updates.length"
      style="margin-top: 8px"
      type="success"
      :message="`共 ${updates.length} 条改动`"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { EsTable } from '@es-plus/adapter-antdv'

const tableRef = ref(null)
const updates = ref([])

const tableData = [
  { id: 1, name: '张三', age: 28, dept: '研发部' },
  { id: 2, name: '李四', age: 32, dept: '市场部' },
  { id: 3, name: '王五', age: 24, dept: '设计部' },
]

const columns = [
  { prop: 'name', label: '姓名', minWidth: 120, editRender: { name: 'input' } },
  { prop: 'age', label: '年龄', width: 100, editRender: { name: 'input', props: { type: 'number' } } },
  { prop: 'dept', label: '部门', minWidth: 120, editRender: { name: 'input' } },
]

const getUpdates = () => {
  updates.value = tableRef.value?.getUpdateRecords?.() || []
}
</script>
