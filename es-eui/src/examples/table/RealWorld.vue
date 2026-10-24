<template>
  <div class="policy-manage">
    <es-table
      ref="policyTable"
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
  </div>
</template>

<script>
import { useDialog } from '@es-plus/vue2'

const policyDialog = useDialog()

const STATUS_MAP = { '0': '草稿', '1': '上架中', '2': '已下架' }

/**
 * 本地数据源。查询、新增、编辑、删除全部真正作用在 allPolicies 上，
 * 再由 httpRequest 按当前查询条件分页返回 —— 这样刷新之后数据不会
 * 又变回初始那几条，也不会出现「提示成功但表格没变」的假 CRUD。
 */
const seedPolicies = () => [
  { id: 'P001', title: '夏季促销政策', tags: '促销', status: '1', publishingMethodName: '立即发布', scheduledReleaseTime: '2024-06-01', validDateStart: '2024-06-01', validDateEnd: '2024-08-31', createTime: '2024-05-25', createBy: '张三' },
  { id: 'P002', title: '新用户优惠', tags: '优惠', status: '0', publishingMethodName: '定时发布', scheduledReleaseTime: '2024-07-15', validDateStart: '2024-07-15', validDateEnd: '2024-12-31', createTime: '2024-06-10', createBy: '李四' },
  { id: 'P003', title: '老客复购返券', tags: '复购', status: '1', publishingMethodName: '立即发布', scheduledReleaseTime: '2024-07-01', validDateStart: '2024-07-01', validDateEnd: '2024-09-30', createTime: '2024-06-24', createBy: '王五' },
  { id: 'P004', title: '国庆满减', tags: '活动', status: '2', publishingMethodName: '定时发布', scheduledReleaseTime: '2024-10-01', validDateStart: '2024-10-01', validDateEnd: '2024-10-07', createTime: '2024-09-20', createBy: '赵六' },
  { id: 'P005', title: '会员日双倍积分', tags: '积分', status: '0', publishingMethodName: '立即发布', scheduledReleaseTime: '2024-08-08', validDateStart: '2024-08-08', validDateEnd: '2024-08-08', createTime: '2024-07-30', createBy: '钱七' }
]

export default {
  data() {
    return {
      allPolicies: seedPolicies(),
      pagination: { current: 1, pageSize: 10, total: 0 },
      // 弹窗表单的模型：结构与表格行一致，编辑时直接覆盖，新增时用空模板
      dialogModel: {},
      columns: [
        { key: 'id', label: '政策编号', fixed: 'left', width: 100 },
        { key: 'title', label: '政策标题', width: 150 },
        { key: 'tags', label: '政策标签', width: 100 },
        {
          key: 'status',
          label: '状态',
          width: 100,
          render: (h, { row }) => (
            <el-tag type={row.status === '1' ? 'success' : row.status === '2' ? 'info' : 'warning'} size="small">
              {STATUS_MAP[row.status] || '-'}
            </el-tag>
          )
        },
        { key: 'publishingMethodName', label: '发布方式', width: 100 },
        { key: 'scheduledReleaseTime', label: '发布时间', width: 140 },
        { key: 'validDateStart', label: '生效时间', width: 140 },
        { key: 'validDateEnd', label: '失效时间', width: 140 },
        { key: 'createTime', label: '创建时间', width: 140 },
        { key: 'createBy', label: '创建人', width: 100 },
        {
          key: 'action',
          label: '操作',
          width: 220,
          fixed: 'right',
          render: (h, { row }) => (
            <div>
              <el-button size="mini" type="text" on-click={() => this.handleView(row)}>查看</el-button>
              <el-button size="mini" type="text" on-click={() => this.openPolicyDialog('edit', row)}>编辑</el-button>
              {row.status === '1'
                ? <el-button size="mini" type="text" on-click={() => this.handleUnpublish(row)}>下架</el-button>
                : <el-button size="mini" type="text" on-click={() => this.handlePublish(row)}>上架</el-button>}
              <el-button size="mini" type="text" style="color: #f56c6c;" on-click={() => this.handleDelete(row)}>删除</el-button>
            </div>
          )
        }
      ],
      options: {
        isInitRun: true,
        border: true,
        tabHeight: 300,
        heightType: 'height',
        size: 'mini',
        apiParams: { url: '/api/policy/list', method: 'get' },
        // 真实请求函数：读本地数据源并按查询表单过滤 + 分页
        httpRequest: (params) => this.fetchPolicies(params),
        configTableOut: { total: 'total', tableData: 'list', pageSize: 'pageSize', current: 'pageIndex' }
      },
      formData: {
        policyCode: '',
        policyTitle: '',
        policyStatus: '',
        effectiveTimeRange: []
      },
      formConfig: [
        { prop: 'policyCode', label: '政策编号', span: 8, formtype: 'Input', formItemOptions: { labelWidth: '100px' }, attrs: { placeholder: '请输入政策编号', clearable: true } },
        { prop: 'policyTitle', label: '政策名称', span: 8, formtype: 'Input', attrs: { placeholder: '请输入政策标题', clearable: true } },
        {
          prop: 'policyStatus', label: '文章状态', span: 8, formtype: 'Select',
          formItemOptions: { labelWidth: '100px' },
          attrs: { placeholder: '请选择文章状态', clearable: true },
          dataOptions: [
            { label: '全部', value: '' },
            { label: '草稿', value: '0' },
            { label: '上架中', value: '1' },
            { label: '已下架', value: '2' }
          ]
        },
        {
          prop: 'effectiveTimeRange', label: '政策生效时间范围', span: 8, formtype: 'datePicker',
          formItemOptions: { labelWidth: '140px' },
          attrs: { valueFormat: 'yyyy-MM-dd', type: 'daterange', startPlaceholder: '开始日期', endPlaceholder: '结束日期', style: 'width: 100%' }
        }
      ],
      dialogFormItems: [
        { prop: 'title', label: '政策标题', span: 24, formtype: 'Input', attrs: { placeholder: '请输入政策标题' }, formItemOptions: { rules: [{ required: true, message: '请输入政策标题', trigger: 'blur' }] } },
        { prop: 'tags', label: '政策标签', span: 24, formtype: 'Input', attrs: { placeholder: '如：促销 / 优惠' } },
        {
          prop: 'status', label: '状态', span: 24, formtype: 'Select',
          dataOptions: [
            { label: '草稿', value: '0' },
            { label: '上架中', value: '1' },
            { label: '已下架', value: '2' }
          ]
        },
        {
          prop: 'publishingMethodName', label: '发布方式', span: 24, formtype: 'Select',
          dataOptions: [
            { label: '立即发布', value: '立即发布' },
            { label: '定时发布', value: '定时发布' }
          ]
        },
        { prop: 'scheduledReleaseTime', label: '发布时间', span: 24, formtype: 'datePicker', attrs: { type: 'date', valueFormat: 'yyyy-MM-dd', style: 'width: 100%' } },
        { prop: 'validDateStart', label: '生效时间', span: 12, formtype: 'datePicker', attrs: { type: 'date', valueFormat: 'yyyy-MM-dd', style: 'width: 100%' } },
        { prop: 'validDateEnd', label: '失效时间', span: 12, formtype: 'datePicker', attrs: { type: 'date', valueFormat: 'yyyy-MM-dd', style: 'width: 100%' } },
        { prop: 'createBy', label: '创建人', span: 24, formtype: 'Input', attrs: { placeholder: '请输入创建人' } }
      ],
      layoutProps: {
        formLayProps: { minFoldRows: 1, labelWidth: '100px', size: 'small' },
        rowLayProps: { gutter: 20 }
      },
      configBtn: [
        { direction: 'left', name: '新增', icon: 'el-icon-plus', size: 'mini', type: 'primary', click: () => this.openPolicyDialog('add') },
        { type: 'primary', size: 'mini', name: '查询', icon: 'el-icon-search', key: 'query', triggerEvent: true },
        { type: 'warning', key: 'rest', size: 'mini', name: '重置', icon: 'el-icon-refresh', triggerEvent: true }
      ]
    }
  },
  methods: {
    /** es-table 的请求函数：查询表单 + 分页 → 本地数据源切片 */
    fetchPolicies(params = {}) {
      const { pageIndex = 1, pageSize = 10, formParams = {} } = params
      const q = formParams || {}
      const [start, end] = Array.isArray(q.effectiveTimeRange) ? q.effectiveTimeRange : []
      const rows = this.allPolicies.filter((row) => {
        if (q.policyCode && !row.id.includes(q.policyCode)) return false
        if (q.policyTitle && !row.title.includes(q.policyTitle)) return false
        if (q.policyStatus && row.status !== q.policyStatus) return false
        // 时间范围按「区间有交集」过滤，而不是要求完全包含
        if (start && row.validDateEnd < start) return false
        if (end && row.validDateStart > end) return false
        return true
      })
      const from = (pageIndex - 1) * pageSize
      return Promise.resolve({
        list: rows.slice(from, from + pageSize),
        total: rows.length,
        pageIndex,
        pageSize
      })
    },
    refresh(keepPage = false) {
      return this.$refs.policyTable?.httpRequestInstance(undefined, { keepPage })?.catch(() => {})
    },
    openPolicyDialog(mode, row) {
      const isEdit = mode === 'edit'
      this.dialogModel = isEdit
        ? { ...row }
        : { id: '', title: '', tags: '', status: '0', publishingMethodName: '立即发布', scheduledReleaseTime: '', validDateStart: '', validDateEnd: '', createBy: '当前用户' }
      policyDialog({
        title: isEdit ? `编辑政策 — ${row.title}` : '新增政策',
        width: '620px',
        isDraggable: true,
        closeOnClickModal: false,
        configBtn: [
          {
            key: 'save',
            type: 'primary',
            size: 'mini',
            name: '保存',
            click: (instance, { close, getRefs }) => {
              const form = getRefs('policyForm')
              const commit = () => {
                this.commitPolicy()
                close()
                this.refresh(true)
              }
              // EsForm 暴露的 validate() 校验不通过时 reject，这里据它拦截非法提交
              if (form && typeof form.validate === 'function') form.validate().then(commit).catch(() => {})
              else commit()
            }
          },
          { key: 'cancel', size: 'mini', name: '取消', click: (instance, { close }) => close() }
        ],
        render: (h) => (
          <es-form
            ref="policyForm"
            model={this.dialogModel}
            form-item-list={this.dialogFormItems}
            layout-form-props={{ formLayProps: { labelWidth: '110px', size: 'small' }, rowLayProps: { gutter: 16 } }}
          />
        )
      })
    },
    commitPolicy() {
      const model = this.dialogModel
      if (model.id) {
        const target = this.allPolicies.find((row) => row.id === model.id)
        if (target) Object.assign(target, model)
        this.$message.success(`已保存：${model.title}`)
      } else {
        const seq = this.allPolicies.reduce((max, row) => Math.max(max, Number(String(row.id).slice(1)) || 0), 0) + 1
        this.allPolicies.unshift({
          ...model,
          id: `P${String(seq).padStart(3, '0')}`,
          createTime: new Date().toISOString().slice(0, 10)
        })
        this.$message.success(`已新增：${model.title}`)
      }
    },
    handleView(row) {
      this.$message.info(`查看：${row.title}（${STATUS_MAP[row.status]}）`)
    },
    handlePublish(row) {
      row.status = '1'
      this.$message.success('上架成功: ' + row.title)
    },
    handleUnpublish(row) {
      row.status = '2'
      this.$message.warning('已下架: ' + row.title)
    },
    handleDelete(row) {
      this.$confirm(`确定删除 "${row.title}" 吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
        .then(() => {
          const idx = this.allPolicies.findIndex((item) => item.id === row.id)
          if (idx > -1) this.allPolicies.splice(idx, 1)
          this.$message.success('删除成功: ' + row.title)
          this.refresh(true)
        })
        .catch(() => {})
    }
  }
}
</script>
