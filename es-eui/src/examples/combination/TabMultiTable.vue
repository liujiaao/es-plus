<template>
  <div>
    <el-tabs v-model="activeTab" type="border-card">
      <el-tab-pane
        v-for="tab in tabs"
        :key="tab.name"
        :label="tab.label"
        :name="tab.name"
      >
        <es-table
          :ref="'table_' + tab.name"
          :columns="tab.columns"
          :data-source="tab.dataSource"
          :options="{
            border: true,
            stripe: true,
            tabHeight: 250,
            heightType: 'height',
            isInitRun: true,
            apiParams: tab.apiParams,
            httpRequest: (params) => fetchWithCORS(params),
            configTableOut: tab.configTableOut,
            listenToCallBack: tab.listenToCallBack
          }"
        />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script>
export default {
  data() {
    return {
      activeTab: 'users',
      tabs: [
        {
          name: 'users',
          label: '用户列表',
          dataSource: [],
          columns: [
            { key: 'id', label: 'ID', width: 80 },
            { key: 'firstName', label: '名', width: 120 },
            { key: 'lastName', label: '姓', width: 120 },
            { key: 'email', label: '邮箱' }
          ],
          apiParams: {
            url: 'https://dummyjson.com/users',
            method: 'get'
          },
          configTableOut: {
            total: 'total',
            pageSize: 'limit',
            current: 'skip',
            tableData: 'users'
          },
          listenToCallBack: {
            brcb: (params) => {
              const { pageSize, pageIndex } = params
              return { limit: pageSize, skip: (pageIndex - 1) * pageSize }
            }
          }
        },
        {
          name: 'posts',
          label: '文章列表',
          dataSource: [],
          columns: [
            { key: 'id', label: 'ID', width: 80 },
            { key: 'title', label: '标题', width: 300 },
            {
              key: 'body',
              label: '内容',
              render: (h, { row }) => row.body.substring(0, 60) + '...'
            }
          ],
          apiParams: {
            url: 'https://dummyjson.com/posts',
            method: 'get'
          },
          configTableOut: {
            total: 'total',
            pageSize: 'limit',
            current: 'skip',
            tableData: 'posts'
          },
          listenToCallBack: {
            brcb: (params) => {
              const { pageSize, pageIndex } = params
              return { limit: pageSize, skip: (pageIndex - 1) * pageSize }
            }
          }
        },
        {
          name: 'products',
          label: '产品列表',
          dataSource: [],
          columns: [
            { key: 'id', label: 'ID', width: 80 },
            { key: 'title', label: '产品名称', width: 200 },
            { key: 'price', label: '价格', width: 100 },
            { key: 'brand', label: '品牌', width: 150 }
          ],
          apiParams: {
            url: 'https://dummyjson.com/products',
            method: 'get'
          },
          configTableOut: {
            total: 'total',
            pageSize: 'limit',
            current: 'skip',
            tableData: 'products'
          },
          listenToCallBack: {
            brcb: (params) => {
              const { pageSize, pageIndex } = params
              return { limit: pageSize, skip: (pageIndex - 1) * pageSize }
            }
          }
        }
      ]
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
    }
  }
}
</script>
