<template>
  <es-table
    :data-source="data"
    :columns="columns"
    :options="options"
  />
</template>

<script>
export default {
  data() {
    return {
      data: [
        { id: 1, category: '电子产品', product: 'iPhone 15', sales: 1200, revenue: 1200000 },
        { id: 2, category: '电子产品', product: 'MacBook Pro', sales: 800, revenue: 1600000 },
        { id: 3, category: '电子产品', product: 'iPad Pro', sales: 600, revenue: 600000 },
        { id: 4, category: '服装', product: '运动T恤', sales: 2000, revenue: 400000 },
        { id: 5, category: '服装', product: '牛仔裤', sales: 1500, revenue: 450000 },
        { id: 6, category: '食品', product: '有机牛奶', sales: 5000, revenue: 250000 }
      ],
      columns: [
        { prop: 'category', label: '分类' },
        { prop: 'product', label: '产品名称' },
        { prop: 'sales', label: '销量' },
        { prop: 'revenue', label: '销售额' }
      ],
      options: {
        border: true,
        // 声明式合并：同一份 JSON 在三端（el-table / a-table / vxe）都成立，
        // 不需要手写 span 函数。rowsBy 里的列按「相邻行值相等」切段合并。
        mergeConfig: { rowsBy: ['category'] }
      }
    }
  }
}
</script>
