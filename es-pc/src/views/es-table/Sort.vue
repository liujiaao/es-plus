<template>
  <div class="example-sort-table">
    <es-table
      :data-source="tableData"
      :columns="columns"
      :options="{ border: true }"
      @change-table-sort="handleSort"
    />
    <div class="sort-info" v-if="lastSort">
      <a-alert
        :message="`当前排序: ${lastSort.prop} - ${lastSort.order === 'ascending' ? '升序' : '降序'}（数据由 handleSort 重排，等价于把请求参数发给后端）`"
        type="info"
        show-icon
      />
    </div>
  </div>
</template>

<script setup>
import { EsTable } from '@es-plus/adapter-antdv'
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
// 清除排序时用来还原的原始顺序
const originData = tableData.value.map((r) => ({ ...r }))

// a-table 的 sorter:true 是「排序事件」而不是本地排序 —— 组件把
// { prop, order } 交给你，由你决定怎么排（真实项目里是带上 order 重新请求后端）。
// 这里数据在本地，就直接重排，效果与后端排序一致。
const comparators = {
  name: (a, b) => a.name.localeCompare(b.name, 'zh'),
  age: (a, b) => a.age - b.age,
  score: (a, b) => a.score - b.score,
  salary: (a, b) => a.salary - b.salary
}

const handleSort = ({ prop, order }) => {
  lastSort.value = { prop, order }
  // 第三次点击会清除排序（order 为 null），此时恢复原始顺序
  if (!order) {
    tableData.value = originData.map((r) => ({ ...r }))
    return
  }
  const cmp = comparators[prop]
  if (cmp) tableData.value = [...tableData.value].sort((a, b) => (order === 'ascending' ? cmp(a, b) : -cmp(a, b)))
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
