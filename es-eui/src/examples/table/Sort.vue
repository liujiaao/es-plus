<template>
  <div>
    <div style="margin-bottom: 12px; color: #909399; font-size: 13px;">
      点击列头排序图标即可排序；「分数」列使用自定义 sortMethod，「入职日期」列按时间戳排序。当前排序：{{ sortInfo }}
    </div>
    <es-table
      :data-source="data"
      :columns="columns"
      :options="options"
      @sort-change="handleSortChange"
    />
  </div>
</template>

<script lang="jsx">
/**
 * 表格排序 —— 演示 EsTable 列排序能力
 *
 * 关键点：
 *   1. 列配置加 `sortable: true` 即启用 el-table 内置的客户端排序
 *   2. `sortMethod` 自定义比较函数（如按数值/时间戳而非字符串排序）
 *   3. `@sort-change` 由 EsTable 通过 v-on="$listeners" 透传 el-table 原生事件，
 *      回调参数 { column, prop, order }，order 为 'ascending' | 'descending' | null
 *   4. `defaultSort` 通过 options 传入设置初始排序列
 */
import { defineComponent, reactive, ref } from '@vue/composition-api'

export default defineComponent({
  name: 'TableSort',
  setup() {
    const data = reactive([
      { id: 1, name: '张三', age: 28, score: 92, entryDate: '2021-03-15' },
      { id: 2, name: '李四', age: 35, score: 78, entryDate: '2019-07-22' },
      { id: 3, name: '王五', age: 24, score: 85, entryDate: '2022-11-08' },
      { id: 4, name: '赵六', age: 41, score: 66, entryDate: '2018-01-30' },
      { id: 5, name: '孙七', age: 30, score: 88, entryDate: '2020-09-12' }
    ])

    const sortInfo = ref('未排序')

    const columns = [
      { prop: 'id', label: 'ID', width: 80 },
      { prop: 'name', label: '姓名', width: 120 },
      { prop: 'age', label: '年龄', width: 120, sortable: true },
      {
        prop: 'score',
        label: '分数',
        width: 120,
        sortable: true,
        // 自定义排序：确保按数值大小而非字符串比较
        sortMethod: (a, b) => a.score - b.score
      },
      {
        prop: 'entryDate',
        label: '入职日期',
        sortable: true,
        // 按时间戳排序，避免字符串比较造成的误差
        sortMethod: (a, b) => new Date(a.entryDate) - new Date(b.entryDate)
      }
    ]

    const options = {
      border: true,
      // 初始按分数降序
      defaultSort: { prop: 'score', order: 'descending' }
    }

    const orderText = { ascending: '升序', descending: '降序' }
    const handleSortChange = ({ prop, order }) => {
      sortInfo.value = order ? `${prop} ${orderText[order]}` : '未排序'
    }

    return { data, columns, options, sortInfo, handleSortChange }
  }
})
</script>
