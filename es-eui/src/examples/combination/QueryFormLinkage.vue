<template>
  <div>
    <!-- 查询表单区域 -->
    <div class="query-section">
      <es-form
        ref="queryForm"
        :form-item-list="queryFormItems"
        :model="queryFormData"
        :layout-form-props="{ fromLayProps: { size: 'mini' }, rowLayProps: { gutter: 10 } }"
        :configBtn="configBtn"
      />
    </div>

    <!-- 数据表格 -->
    <es-table
      ref="tableWithQuery"
      :columns="tableColumns"
      :data-source="tableData"
      :pagination="pagination"
      :options="{
        border: true,
        stripe: true,
        tabHeight: 250,
        heightType: 'height',
        isInitRun: false,
        apiParams: {
          url: 'https://dummyjson.com/users',
          method: 'get'
        },
        httpRequest: (params) => fetchWithCORS(params),
        configTableOut: {
          total: 'total',
          pageSize: 'limit',
          current: 'skip',
          tableData: 'users'
        },
        listenToCallBack: {
          brcb: (params) => {
            const { pageSize, pageIndex } = params
            return {
              limit: pageSize,
              skip: (pageIndex - 1) * pageSize
            }
          }
        }
      }"
    />
  </div>
</template>

<script>
export default {
  data() {
    return {
      queryFormData: {
        name: '',
        status: '',
        dateRange: []
      },
      configBtn: [
        { name: '查询', type: 'primary', click: this.onSearchClick },
        { name: '重置', click: this.onResetClick }
      ],
      queryFormItems: [
        { prop: 'name', label: '姓名', span: 6, formtype: 'Input', attrs: { placeholder: '请输入姓名' } },
        {
          prop: 'status',
          label: '状态',
          span: 6,
          formtype: 'Select',
          dataOptions: [
            { label: '全部', value: '' },
            { label: '启用', value: '1' },
            { label: '禁用', value: '0' }
          ]
        },
        {
          prop: 'dateRange',
          label: '时间范围',
          span: 8,
          formtype: 'DatePicker',
          attrs: {
            type: 'daterange',
            rangeSeparator: '至',
            startPlaceholder: '开始日期',
            endPlaceholder: '结束日期',
            valueFormat: 'yyyy-MM-dd'
          }
        }
      ],
      tableData: [],
      pagination: {
        pageIndex: 1,
        pageSize: 10,
        total: 0
      },
      tableColumns: [
        { key: 'id', label: 'ID', width: 80 },
        { key: 'firstName', label: '名', width: 120 },
        { key: 'lastName', label: '姓', width: 120 },
        { key: 'email', label: '邮箱' },
        {
          key: 'image',
          label: '头像',
          width: 80,
          render: (h, { row }) => (
            <el-avatar size="small" src={row.image} />
          )
        }
      ]
    }
  },
  methods: {
    onSearchClick() {
      console.log('links///')
      this.handleSearch()
    },
    onResetClick(model, refs) {
      this.handleReset(refs)
    },
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
    handleSearch() {
      this.$refs.tableWithQuery.httpRequestInstance()
    },
    handleReset(refs) {
      refs.resetFields()
      this.$nextTick(() => {
        this.handleSearch()
      })
    }
  }
}
</script>
