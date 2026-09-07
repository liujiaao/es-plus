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
        { id: 1, region: '华东区', quarter: 'Q1', month: '1月', sales: 120000, target: 100000, achievement: '120%' },
        { id: 2, region: '华东区', quarter: 'Q1', month: '2月', sales: 150000, target: 100000, achievement: '150%' },
        { id: 3, region: '华东区', quarter: 'Q1', month: '3月', sales: 90000, target: 100000, achievement: '90%' },
        { id: 4, region: '华东区', quarter: 'Q2', month: '4月', sales: 110000, target: 110000, achievement: '100%' },
        { id: 5, region: '华南区', quarter: 'Q1', month: '1月', sales: 80000, target: 80000, achievement: '100%' },
        { id: 6, region: '华南区', quarter: 'Q1', month: '2月', sales: 95000, target: 80000, achievement: '119%' },
        { id: 7, region: '华南区', quarter: 'Q2', month: '4月', sales: 105000, target: 90000, achievement: '117%' }
      ],
      columns: [
        { key: 'region', label: '区域' },
        { key: 'quarter', label: '季度', width: 80 },
        { key: 'month', label: '月份', width: 80 },
        { key: 'sales', label: '销售额' },
        { key: 'target', label: '目标', width: 100 },
        { key: 'achievement', label: '完成率' }
      ],
      options: {
        border: true,
        spanMethod: ({ row, column, rowIndex, columnIndex }) => {
          const data = this.data
          // 区域列 - 按 region 合并
          if (columnIndex === 0) {
            const rowSpan = this.getMergeSpan(data, rowIndex, 'region')
            if (rowSpan > 0) {
              return { rowspan: rowSpan, colspan: 1 }
            }
            return { rowspan: 0, colspan: 0 }
          }
          // 季度列 - 按 region + quarter 合并
          if (columnIndex === 1) {
            if (rowIndex > 0 && data[rowIndex - 1].quarter === row.quarter) {
              return { rowspan: 0, colspan: 0 }
            }
            let rowspan = 0
            for (let i = rowIndex; i < data.length; i++) {
              if (data[i].quarter === row.quarter) {
                rowspan++
              } else {
                break
              }
            }
            return { rowspan, colspan: 1 }
          }
          // 月份列 - 按 region + quarter + month 合并
          if (columnIndex === 2) {
            if (rowIndex > 0 && data[rowIndex - 1].month === row.month) {
              return { rowspan: 0, colspan: 0 }
            }
            let rowspan = 0
            for (let i = rowIndex; i < data.length; i++) {
              if (data[i].month === row.month) {
                rowspan++
              } else {
                break
              }
            }
            return { rowspan, colspan: 1 }
          }
        }
      }
    }
  },
  methods: {
    getMergeSpan(data, rowIndex, field) {
      if (rowIndex === 0) {
        let rowspan = 1
        for (let i = rowIndex + 1; i < data.length; i++) {
          if (data[i][field] === data[rowIndex][field]) {
            rowspan++
          } else {
            break
          }
        }
        return rowspan
      }
      if (data[rowIndex - 1][field] === data[rowIndex][field]) {
        return 0
      }
      let rowspan = 1
      for (let i = rowIndex + 1; i < data.length; i++) {
        if (data[i][field] === data[rowIndex][field]) {
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
