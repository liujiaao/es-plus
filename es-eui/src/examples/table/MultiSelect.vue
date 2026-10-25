<template>
  <div>
    <div style="margin-bottom: 15px; padding: 10px; background: #f5f7fa; border-radius: 4px;">
      <el-tag type="success" style="margin-right: 10px;">
        <i class="el-icon-check" /> 已选择 {{ selectedRows.length }} 项
      </el-tag>
      <el-button size="small" type="primary" plain @click="clearAllSelection">
        <i class="el-icon-delete" /> 清空选择
      </el-button>
      <el-button size="small" type="info" plain @click="getSelectionRows">
        <i class="el-icon-view" /> 查看选中项
      </el-button>
    </div>
    <es-table
      ref="table"
      :data-source="data"
      :columns="columns"
      :pagination="pagination"
      :options="options"
      @selection-change="syncSelection"
      @pagination-current-change="syncSelection"
    />
  </div>
</template>

<script>
export default {
  data() {
    return {
      selectedRows: [],
      data: [],
      columns: [
        { type: 'selection', width: 55 },
        { prop: 'id', label: 'ID', width: 80 },
        { prop: 'firstName', label: '名', width: 100 },
        { prop: 'lastName', label: '姓', width: 100 },
        { prop: 'age', label: '年龄', width: 80 },
        { prop: 'gender', label: '性别', width: 80 },
        { prop: 'email', label: '邮箱' }
      ],
      // 分页读 current（不是 pageIndex）；pageIndex 是「请求参数名」，由组件内部按 current 生成
      pagination: { current: 1, pageSize: 5, total: 0 },
      options: {
        isInitRun: true,
        border: true,
        multiSelect: true,
        // 跨页记忆：翻页后自动把上一页勾过的行勾回来
        cachePageSelection: true,
        rowkey: 'id',
        size: 'small',
        apiParams: {
          url: 'https://dummyjson.com/users',
          method: 'get'
        },
        httpRequest: (params) => this.fetchWithCORS(params),
        configTableOut: {
          total: 'total',
          pageSize: 'limit',
          tableData: 'users'
        },
        listenToCallBack: {
          brcb: (params) => ({
            limit: params.pageSize,
            skip: (params.pageIndex - 1) * params.pageSize
          })
        }
      }
    }
  },
  methods: {
    fetchWithCORS(params) {
      const { url, formParams, headers = {}, method = 'get' } = params

      let requestUrl = url
      if (method.toLowerCase() === 'get' && formParams) {
        const queryParams = new URLSearchParams()
        Object.keys(formParams).forEach(key => {
          if (formParams[key] !== undefined && formParams[key] !== null && formParams[key] !== '') {
            queryParams.append(key, formParams[key])
          }
        })
        const queryString = queryParams.toString()
        if (queryString) {
          requestUrl += (requestUrl.includes('?') ? '&' : '?') + queryString
        }
      }

      return fetch(requestUrl, {
        method: method.toUpperCase(),
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        credentials: 'omit'
      }).then(res => res.json())
    },
    // el-table 抛出的 selection-change 只是「当前页」的勾选数组；跨页累计要问表格实例
    // getSelectionRows()（cachePageSelection 打开后它返回所有页的勾选并集）。
    syncSelection() {
      this.$nextTick(() => {
        this.selectedRows = this.$refs.table?.getSelectionRows() || []
      })
    },
    clearAllSelection() {
      this.$refs.table?.clearAllSelection()
      this.selectedRows = []
    },
    getSelectionRows() {
      const allSelected = this.$refs.table?.getSelectionRows() || []
      if (allSelected.length === 0) {
        this.$message.warning('请至少选择一项')
        return
      }
      const names = allSelected.map(row => `${row.firstName} ${row.lastName}`).join(', ')
      this.$message.success(`共选择 ${allSelected.length} 项: ${names}`)
    }
  }
}
</script>
