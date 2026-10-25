<template>
  <div>
    <!-- 高级搜索：由工具栏按钮切出的一块筛选区，筛选在本地真实生效 -->
    <div v-if="advancedOpen" class="filter-bar">
      <el-input
        v-model="keyword"
        placeholder="按姓名 / 邮箱筛选"
        clearable
        style="width: 240px;"
      />
      <el-button size="small" @click="resetFilter">重置筛选</el-button>
      <span class="filter-tip">匹配 {{ filteredData.length }} / {{ data.length }} 条</span>
    </div>

    <es-table
      :data-source="filteredData"
      :columns="columns"
      :options="tableOptions"
    />

    <!-- 导入用隐藏文件框：工具栏「导入」只负责唤起，解析在 handleImportFile -->
    <input
      ref="importInput"
      type="file"
      accept=".csv,text/csv"
      style="display: none;"
      @change="handleImportFile"
    />
  </div>
</template>

<script>
export default {
  data() {
    return {
      data: [
        { id: 1, name: '张三', age: 25, email: 'zhangsan@example.com' },
        { id: 2, name: '李四', age: 30, email: 'lisi@example.com' },
        { id: 3, name: '王五', age: 28, email: 'wangwu@example.com' }
      ],
      columns: [
        { prop: 'id', label: 'ID', width: 80 },
        { prop: 'name', label: '姓名', width: 120 },
        { prop: 'age', label: '年龄', width: 80 },
        { prop: 'email', label: '邮箱' }
      ],
      advancedOpen: false,
      keyword: '',
      options: {
        border: true,
        configBtn: [
          {
            code: 1,
            name: '新增',
            icon: 'el-icon-plus',
            type: 'primary',
            click: () => {
              const nextId = this.data.reduce((max, r) => Math.max(max, r.id), 0) + 1
              this.data.unshift({ id: nextId, name: `新用户${nextId}`, age: 20, email: `user${nextId}@example.com` })
              this.$message.success('已新增一行')
            }
          },
          {
            code: 1,
            name: '导入',
            icon: 'el-icon-upload2',
            click: () => {
              // 只负责唤起文件框，真正的解析在 handleImportFile
              this.$refs.importInput?.click()
            }
          },
          {
            code: 2,
            name: '导出',
            icon: 'el-icon-download',
            type: 'warning',
            click: () => {
              // 导出「当前筛选后」的数据，和界面看到的一致
              const header = ['ID', '姓名', '年龄', '邮箱']
              const rows = this.filteredData.map((r) => [r.id, r.name, r.age, r.email])
              const csv = '\uFEFF' + [header, ...rows].map((cols) => cols.join(',')).join('\n')
              const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
              const a = document.createElement('a')
              a.href = url
              a.download = '用户列表.csv'
              a.click()
              URL.revokeObjectURL(url)
              this.$message.success(`已导出 ${this.filteredData.length} 条`)
            }
          },
          {
            code: 2,
            name: '高级搜索',
            icon: 'el-icon-search',
            click: () => {
              // code: 1 渲染左侧、code: 2 渲染右侧 —— 本例演示左右分栏 + 按钮驱动界面状态
              this.advancedOpen = !this.advancedOpen
              if (!this.advancedOpen) this.keyword = ''
            }
          }
        ]
      }
    }
  },
  computed: {
    filteredData() {
      const kw = this.keyword.trim().toLowerCase()
      if (!kw) return this.data
      return this.data.filter(
        (r) => r.name.toLowerCase().includes(kw) || r.email.toLowerCase().includes(kw)
      )
    },
    // leftText 是静态字符串，用 computed 跟随行数变化，避免写死一个会过期的数字
    tableOptions() {
      return { ...this.options, leftText: `共 ${this.filteredData.length} 条数据` }
    }
  },
  methods: {
    resetFilter() {
      this.keyword = ''
    },
    handleImportFile(e) {
      const file = e.target.files?.[0]
      if (!file) return
      file.text().then((text) => {
        const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim())
        if (lines.length < 2) {
          this.$message.warning('CSV 没有数据行')
          return
        }
        const header = lines[0].split(',').map((s) => s.trim())
        let id = this.data.reduce((max, r) => Math.max(max, r.id), 0)
        const added = lines.slice(1).map((line) => {
          const cells = line.split(',').map((s) => s.trim())
          const row = { id: ++id, name: '-', age: 0, email: '-' }
          header.forEach((key, i) => {
            if (cells[i] === undefined || cells[i] === '') return
            if (key === 'age' || key === 'id') row[key] = Number(cells[i])
            else if (key in row) row[key] = cells[i]
          })
          return row
        })
        this.data.unshift(...added)
        this.$message.success(`已导入 ${added.length} 条`)
      }).finally(() => {
        e.target.value = ''
      })
    }
  }
}
</script>

<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.filter-tip {
  font-size: 13px;
  color: #909399;
}
</style>
