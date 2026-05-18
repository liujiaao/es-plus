<template>
  <div class="example-sort-table">
    <es-table
      :data-source="tableData"
      :columns="columns"
      :options="{ border: true }"
      @change-table-sort="handleSort"
    />
    <div class="sort-info" v-if="lastSort">
      <el-alert
        :title="`当前排序: ${lastSort.prop} - ${lastSort.order === 'ascending' ? '升序' : '降序'}`"
        type="info"
        show-icon
      />
    </div>
  </div>
</template>

<script setup>
import { EsTable } from 'es-plus'
import { ref } from 'vue'

const tableData = ref([
  { name: '张三', age: 28, score: 85, salary: 15000 },
  { name: '李四', age: 32, score: 92, salary: 20000 },
  { name: '王五', age: 24, score: 78, salary: 12000 },
  { name: '赵六', age: 30, score: 88, salary: 18000 },
  { name: '孙七', age: 26, score: 95, salary: 22000 }
])

const columns = [
  { prop: 'name', label: '姓名', sortable: true },
  { prop: 'age', label: '年龄', sortable: true },
  { prop: 'score', label: '分数',  sortable: 'custom' },
  { prop: 'salary', label: '薪资', sortable: true }
]

const lastSort = ref(null)

const handleSort = ({ prop, order }) => {
  lastSort.value = { prop, order }
  // 实际项目中这里会触发后端排序
  console.log('排序:', prop, order)
}
</script>

<style scoped>
.example-sort-table {
  padding: 0;
}
.sort-info {
  margin-top: 16px;
}
</style>
