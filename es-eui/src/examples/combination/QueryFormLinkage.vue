<template>
  <div>
    <!-- 查询表单区域 -->
    <div class="query-section">
      <es-form
        :form-item-list="queryFormItems"
        :model="queryFormData"
        :layout-form-props="{ formLayProps: { size: 'mini' }, rowLayProps: { gutter: 10 } }"
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
        isInitRun: true,
        apiParams: {
          url: 'https://dummyjson.com/users',
          method: 'get'
        },
        httpRequest: (params) => this.requestUsers(params),
        configTableOut: {
          total: 'total',
          pageSize: 'limit',
          tableData: 'users'
        }
      }"
    />
  </div>
</template>

<script lang="jsx">
/**
 * 查询表单联动 —— 演示「表单条件 → 表格数据」的联动
 *
 * 关键点：
 *   1. 表单与表格是兄弟节点：表格不会自动收集表单值，筛选条件统一由 requestUsers
 *      读取组件上的 queryFormData；查询按钮再调 `httpRequestInstance(model, { keepPage: false })`
 *      回到第 1 页（keepPage=false 表示搜索语义）
 *   2. `watch(queryFormData, deep)` 让条件变化自动触发查询（与页面描述一致）
 *   3. 筛选在 `httpRequest` 里真正作用于数据，而不是只改 URL 参数
 */
export default {
  data() {
    return {
      queryFormData: {
        name: '',
        gender: '',
        birthRange: []
      },
      configBtn: [
        { name: '查询', type: 'primary', click: () => this.handleSearch() },
        { name: '重置', click: (model, formRef) => formRef && formRef.resetFields() }
      ],
      queryFormItems: [
        { prop: 'name', label: '姓名', span: 6, formtype: 'Input', attrs: { placeholder: '请输入姓名' } },
        {
          prop: 'gender',
          label: '性别',
          span: 6,
          formtype: 'Select',
          dataOptions: [
            { label: '全部', value: '' },
            { label: '男', value: 'male' },
            { label: '女', value: 'female' }
          ]
        },
        {
          prop: 'birthRange',
          label: '出生日期',
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
      // 分页读 current（不是 pageIndex）
      pagination: {
        current: 1,
        pageSize: 10,
        total: 0
      },
      tableColumns: [
        { prop: 'id', label: 'ID', width: 80 },
        { prop: 'firstName', label: '名', width: 120 },
        { prop: 'lastName', label: '姓', width: 120 },
        { prop: 'email', label: '邮箱' },
        {
          prop: 'image',
          label: '头像',
          width: 80,
          render: (h, { row }) => (
            <el-avatar size="small" src={row.image} />
          )
        }
      ]
    }
  },
  watch: {
    // 条件一变就查（deep 才能捕捉 dateRange 数组内的变化）
    queryFormData: {
      deep: true,
      handler() {
        this.handleSearch()
      }
    }
  },
  created() {
    // 一次性拉全量后缓存在实例上，后续筛选/分页都在本地做
    this.allUsers = null
  },
  methods: {
    async fetchAllUsers() {
      if (!this.allUsers) {
        const res = await fetch('https://dummyjson.com/users?limit=100', { credentials: 'omit' })
        if (!res.ok) throw new Error(`拉取用户失败：HTTP ${res.status}`)
        const json = await res.json()
        this.allUsers = json.users || []
      }
      return this.allUsers
    },
    async requestUsers(params) {
      const { pageIndex = 1, pageSize = 10 } = params || {}
      const users = await this.fetchAllUsers()
      // 直接读组件的查询条件而不是 params.formParams：表单是表格的兄弟节点，
      // 翻页请求只带 pageIndex/pageSize，不会带表单值 —— 用 formParams 会让第 2 页丢筛选
      const query = this.queryFormData
      const keyword = String(query.name || '').trim().toLowerCase()

      const rows = users.filter((u) => {
        if (keyword && !`${u.firstName}${u.lastName}`.toLowerCase().includes(keyword)) return false
        if (query.gender && u.gender !== query.gender) return false
        const range = query.birthRange
        if (Array.isArray(range) && range.length === 2) {
          const birth = String(u.birthDate || '').slice(0, 10)
          const [start, end] = range
          if (!birth || birth < start || birth > end) return false
        }
        return true
      })

      const start = (pageIndex - 1) * pageSize
      return {
        users: rows.slice(start, start + pageSize),
        total: rows.length,
        limit: pageSize,
        skip: start
      }
    },
    // 查询语义 = 回到第 1 页；keepPage: false 由组件内部把 current 置 1
    handleSearch() {
      this.$refs.tableWithQuery?.httpRequestInstance(this.queryFormData, { keepPage: false })
    }
  }
}
</script>
