<template>
  <es-table
    :data-source="data"
    :columns="columns"
    :pagination="pagination"
    :options="options"
  />
</template>

<script>
export default {
  data() {
    return {
      data: [],
      columns: [
        { key: 'id', label: 'ID', width: 80 },
        { key: 'title', label: '商品名称' },
        { key: 'brand', label: '品牌', width: 120 },
        { key: 'category', label: '分类', width: 120 },
        {
          key: 'price',
          label: '价格',
          width: 100,
          render: (h, { row }) => (
            <span style="color: #f56c6c; font-weight: bold;">¥{row.price}</span>
          )
        },
        {
          key: 'stock',
          label: '库存',
          width: 100,
          render: (h, { row }) => (
            <el-tag type={row.stock > 50 ? 'success' : 'warning'} size="small">{row.stock}</el-tag>
          )
        }
      ],
      pagination: { pageIndex: 1, pageSize: 10, total: 0 },
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
          current: 'skip',
          tableData: 'products'
        },
        listenToCallBack: {
          brcb: (params) => {
            console.log('【自定义请求拦截】请求参数:', params)
            const { pageSize, pageIndex } = params
            return {
              limit: pageSize,
              skip: (pageIndex - 1) * pageSize
            }
          },
          qrcb: (res) => {
            console.log('【自定义响应拦截】响应结果:', res)
            this.$message.success('数据加载成功（通过自定义 httpRequest）')
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
        'X-Custom-Header': 'es-table-demo',
        'X-Request-Time': new Date().toISOString(),
        ...headers
      }

      console.log('【自定义 httpRequest】请求配置:', {
        url: requestUrl,
        method,
        headers: customHeaders,
        formParams
      })

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
        .then(data => {
          console.log('【自定义 httpRequest】响应数据:', data)
          return { data }
        })
        .catch(err => {
          console.error('【自定义 httpRequest】请求失败:', err)
          this.$message.error('请求失败: ' + err.message)
          throw err
        })
    }
  }
}
</script>
