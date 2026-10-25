<template>
  <div>
    <div style="margin-bottom: 10px; color: #909399; font-size: 13px;">
      自定义 httpRequest：在 fetch 上注入 X-Token 请求头、统一错误处理；beforeRequest 改写分页参数，
      afterResponse 拿到响应后统一提示（返回值会替换响应体，因此必须原样返回）。
    </div>
    <es-table
      :data-source="data"
      :columns="columns"
      :pagination="pagination"
      :options="options"
    />
  </div>
</template>

<script>
export default {
  data() {
    return {
      data: [],
      columns: [
        { prop: 'id', label: 'ID', width: 80 },
        { prop: 'title', label: '商品名称' },
        { prop: 'brand', label: '品牌', width: 120 },
        { prop: 'category', label: '分类', width: 120 },
        {
          prop: 'price',
          label: '价格',
          width: 100,
          render: (h, { row }) => (
            <span style="color: #f56c6c; font-weight: bold;">¥{row.price}</span>
          )
        },
        {
          prop: 'stock',
          label: '库存',
          width: 100,
          render: (h, { row }) => (
            <el-tag type={row.stock > 50 ? 'success' : 'warning'} size="small">{row.stock}</el-tag>
          )
        }
      ],
      // 分页读 current；请求里的 pageIndex 由组件按 current 生成
      pagination: { current: 1, pageSize: 10, total: 0 },
      options: {
        isInitRun: true,
        border: true,
        tabHeight: 350,
        heightType: 'height',
        size: 'mini',
        apiParams: {
          url: 'https://dummyjson.com/products',
          method: 'get'
        },
        httpRequest: (params) => this.customHttpRequest(params),
        configTableOut: {
          total: 'total',
          pageSize: 'limit',
          tableData: 'products'
        },
        listenToCallBack: {
          // beforeRequest：请求前把分页参数改写成后端认识的 limit / skip
          beforeRequest: (params) => {
            const { pageSize, pageIndex } = params
            return {
              limit: pageSize,
              skip: (pageIndex - 1) * pageSize
            }
          },
          // afterResponse：返回值会**替换**响应体，所以必须把 res 原样返回。
          // 只弹提示不返回，组件会把提示对象当数据，表格直接变空。
          // 注意 res 是 customHttpRequest 包过一层的 { data }，取业务字段要先剥这一层。
          afterResponse: (res) => {
            const body = res && res.data ? res.data : res
            this.$message.success(`数据加载成功，本页 ${body.products?.length ?? 0} 条`)
            return res
          }
        }
      }
    }
  },
  methods: {
    customHttpRequest(params) {
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

      const customHeaders = {
        'Content-Type': 'application/json',
        'X-Token': 'demo-token-123',
        'X-Request-Time': new Date().toISOString(),
        ...headers
      }

      return fetch(requestUrl, {
        method: method.toUpperCase(),
        headers: customHeaders,
        credentials: 'omit'
      })
        .then(res => {
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`)
          }
          return res.json()
        })
        .then(data => ({ data }))
        .catch(err => {
          this.$message.error('请求失败: ' + err.message)
          throw err
        })
    }
  }
}
</script>
