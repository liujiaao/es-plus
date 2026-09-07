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
        { key: 'category', label: '分类' },
        { key: 'product', label: '产品名称' },
        { key: 'sales', label: '销量' },
        { key: 'revenue', label: '销售额' }
      ],
      options: {
        border: true,
        spanMethod: ({ row, column, rowIndex, columnIndex }) => {
          if (columnIndex === 0) {
            const categoryRowSpan = this.getCategoryRowSpan(row.category, rowIndex)
            if (categoryRowSpan > 0) {
              return { rowspan: categoryRowSpan, colspan: 1 }
            } else {
              return { rowspan: 0, colspan: 0 }
            }
          }
        }
      }
    }
  },
  methods: {
    getCategoryRowSpan(category, rowIndex) {
      const data = this.data
      if (rowIndex === 0) {
        let rowspan = 1
        for (let i = rowIndex + 1; i < data.length; i++) {
          if (data[i].category === category) {
            rowspan++
          } else {
            break
          }
        }
        return rowspan
      }
      if (rowIndex > 0 && data[rowIndex - 1].category === category) {
        return 0
      }
      let rowspan = 1
      for (let i = rowIndex + 1; i < data.length; i++) {
        if (data[i].category === category) {
          rowspan++
        } else {
          break
        }
      }
      return rowspan
    }
  }
}
</script>
