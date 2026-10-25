<template>
  <es-table
    :columns="columns"
    :pagination="pagination"
    :options="options"
  >
    <es-form
      :form-item-list="formConfig"
      :model="formData"
      :layout-form-props="layoutProps"
      :config-btn="configBtn"
    />
  </es-table>
</template>

<script>
/**
 * 查询表单联动 + 请求参数改写 + 分页
 *
 * 链路：EsForm 查询按钮 → es-table 收集表单模型 → beforeRequest 改写参数
 *      → 自定义 httpRequest 取数 → configTableOut 映射回分页
 * 表单里的每一格都真的参与过滤，翻页也真的换数据。
 */
export default {
  data() {
    return {
      postsCache: null,
      columns: [
        { prop: 'id', label: '编号', width: 80 },
        { prop: 'title', label: '标题' },
        {
          prop: 'userId',
          label: '用户ID',
          width: 100,
          render: (h, { row }) => <el-tag size="mini">用户{row.userId}</el-tag>
        },
        {
          prop: 'body',
          label: '内容',
          render: (h, { row }) => <span>{String(row.body || '').slice(0, 50)}...</span>
        }
      ],
      pagination: { current: 1, pageSize: 10, total: 0 },
      options: {
        isInitRun: true,
        border: true,
        heightType: 'maxHeight',
        apiParams: {
          url: 'https://jsonplaceholder.typicode.com/posts',
          method: 'get'
        },
        // 真实取数：jsonplaceholder 的 /posts 不支持分页参数，所以一次拉全量再本地切片
        httpRequest: (params) => this.fetchPosts(params),
        configTableOut: {
          total: 'total',
          pageSize: 'pageSize',
          current: 'pageIndex',
          tableData: 'data'
        },
        listenToCallBack: {
          // 请求前拦截：把「标题搜索」映射成后端认识的 q，其余参数原样保留
          beforeRequest: (params) => {
            const { title, ...rest } = params
            const q = typeof title === 'string' ? title.trim() : ''
            return q ? { ...rest, q } : rest
          }
        }
      },
      formData: {
        userId: '',
        title: ''
      },
      formConfig: [
        {
          prop: 'userId',
          label: '用户ID',
          span: 8,
          formtype: 'Select',
          attrs: { placeholder: '请选择用户', clearable: true },
          dataOptions: [
            { label: '全部', value: '' },
            { label: '用户1', value: '1' },
            { label: '用户2', value: '2' },
            { label: '用户3', value: '3' }
          ]
        },
        {
          prop: 'title',
          label: '标题搜索',
          span: 8,
          formtype: 'Input',
          attrs: { placeholder: '请输入标题关键词', clearable: true }
        }
      ],
      layoutProps: {
        formLayProps: { labelWidth: '80px', size: 'small' },
        rowLayProps: { gutter: 20 }
      },
      configBtn: [
        { name: '查询', type: 'primary', key: 'query', triggerEvent: true, icon: 'el-icon-search' },
        { name: '重置', key: 'rest', triggerEvent: true, icon: 'el-icon-refresh' }
      ]
    }
  },
  methods: {
    /** 全量只拉一次，后续查询 / 翻页都走内存 */
    async loadPosts() {
      if (!this.postsCache) {
        const res = await fetch('https://jsonplaceholder.typicode.com/posts')
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
        this.postsCache = await res.json()
      }
      return this.postsCache
    },
    async fetchPosts(params = {}) {
      const { formParams = {} } = params
      const { userId, q, pageIndex = 1, pageSize = 10 } = formParams
      const all = await this.loadPosts()
      const keyword = String(q || '').toLowerCase()
      const filtered = all.filter((post) => {
        if (userId && String(post.userId) !== String(userId)) return false
        if (keyword && !post.title.toLowerCase().includes(keyword)) return false
        return true
      })
      const start = (pageIndex - 1) * pageSize
      return {
        data: filtered.slice(start, start + pageSize),
        total: filtered.length,
        pageIndex,
        pageSize
      }
    }
  }
}
</script>
