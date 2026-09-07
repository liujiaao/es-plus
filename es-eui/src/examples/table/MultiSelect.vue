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
      @selection-change="handleSelectionChange"
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
        { key: 'id', label: 'ID', width: 80 },
        { key: 'firstName', label: '名', width: 100 },
        { key: 'lastName', label: '姓', width: 100 },
        { key: 'age', label: '年龄', width: 80 },
        { key: 'gender', label: '性别', width: 80 },
        { key: 'email', label: '邮箱' }
      ],
      pagination: { pageIndex: 1, pageSize: 5, total: 0 },
      options: {
        isInitRun: true,
        border: true,
        multiSelect: true,
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
          current: 'skip',
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
    handleSelectionChange(rows) {
      this.selectedRows = rows
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
      console.log('【跨页选择】所有选中项:', allSelected)
      console.log('【跨页选择】选中项ID:', allSelected.map(row => row.id))
    }
  }
}
</script>
