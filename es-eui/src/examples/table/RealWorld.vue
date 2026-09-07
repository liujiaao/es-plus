<template>
  <div class="policy-manage">
    <es-table
      ref="policyTable"
      :data-source="data"
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

export default {
  data() {
    return {
      data: [
        { id: 'P001', title: '夏季促销政策', status: '1', tags: '促销', publishingMethodName: '立即发布', scheduledReleaseTime: '2024-06-01', validDateStart: '2024-06-01', validDateEnd: '2024-08-31', createTime: '2024-05-25', createBy: '张三' },
        { id: 'P002', title: '新用户优惠', status: '0', tags: '优惠', publishingMethodName: '定时发布', scheduledReleaseTime: '2024-07-15', validDateStart: '2024-07-15', validDateEnd: '2024-12-31', createTime: '2024-06-10', createBy: '李四' }
      ],
      pagination: { pageIndex: 1, pageSize: 10, total: 2 },
      columns: [
        { key: 'id', label: '政策编号', fixed: 'left', width: 100 },
        { key: 'title', label: '政策标题', width: 150 },
        { key: 'tags', label: '政策标签', width: 100 },
        {
          key: 'status',
          label: '状态',
          width: 100,
          render: (h, { row }) => {
            const statusMap = { '0': '草稿', '1': '上架中', '2': '已下架' }
            return <el-tag type={row.status === '1' ? 'success' : 'info'} size="small">{statusMap[row.status]}</el-tag>
          }
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
          render: (h, { row }) => {
            return (
              <div>
                <el-button size="mini" type="text" on-click={() => this.handleView(row)}>查看</el-button>
                <el-button size="mini" type="text" on-click={() => this.handleEdit(row)}>编辑</el-button>
                {(row.status === '0' || row.status === '2') && (
                  <el-button size="mini" type="text" on-click={() => this.handlePublish(row)}>上架</el-button>
                )}
                {row.status === '1' && (
                  <el-button size="mini" type="text" on-click={() => this.handleUnpublish(row)}>下架</el-button>
                )}
                <el-button size="mini" type="text" style="color: #f56c6c;" on-click={() => this.handleDelete(row)}>删除</el-button>
              </div>
            )
          }
        }
      ],
      options: {
        border: true,
        tabHeight: 300,
        heightType: 'height',
        size: 'mini'
      },
      formData: {
        policyCode: '',
        policyTitle: '',
        policyStatus: '',
        policyTag: '',
        publishType: '',
        effectiveTimeRange: [],
        publishTimeRange: []
      },
      formConfig: [
        {
          prop: 'policyCode',
          label: '政策编号',
          span: 8,
          formtype: 'Input',
          formItemOptions: { labelWidth: '100px' },
          attrs: { placeholder: '请输入政策编号', clearable: true }
        },
        {
          prop: 'policyTitle',
          label: '政策名称',
          span: 8,
          formtype: 'Input',
          attrs: { placeholder: '请输入政策标题', clearable: true }
        },
        {
          prop: 'policyStatus',
          label: '文章状态',
          span: 8,
          formtype: 'Select',
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
          label: '政策生效时间范围',
          span: 8,
          formItemOptions: { labelWidth: '140px' },
          prop: 'effectiveTimeRange',
          formtype: 'datePicker',
          attrs: {
            valueFormat: 'yyyy-MM-dd HH:mm:ss',
            type: 'datetimerange',
            startPlaceholder: '开始日期',
            endPlaceholder: '结束日期',
            style: 'width: 100%'
          }
        }
      ],
      layoutProps: {
        fromLayProps: { minfoldRows: 1, labelWidth: '100px', size: 'small' },
        rowLayProps: { gutter: 20 }
      },
      configBtn: [
        { direction: 'left', name: '新增', icon: 'el-icon-plus', size: 'mini', type: 'primary', click: () => this.handleAdd() },
        { type: 'primary', size: 'mini', name: '查询', icon: 'el-icon-search', key: 'query', triggerEvent: true },
        { type: 'warning', key: 'rest', size: 'mini', name: '重置', icon: 'el-icon-refresh', triggerEvent: true }
      ]
    }
  },
  methods: {
    handleAdd() {
      policyDialog({
        title: '新增政策',
        width: '75%',
        isDraggable: true,
        closeOnClickModal: false,
        configBtn: [
          {
            key: 'save',
            type: 'primary',
            size: 'mini',
            name: '提交',
            click: (instance, { close, getRefs }) => {
              const { formData } = instance
              // 在实际项目中调用 API 提交数据
              this.$message.success('新增成功: ' + JSON.stringify(formData))
              close()
              this.$refs.policyTable?.httpRequestInstance()
            }
          },
          {
            key: 'cancel',
            size: 'mini',
            name: '取消',
            click: (instance, { close }) => close()
          }
        ],
        render: (h) => {
          return (
            <es-form
              ref="policyform"
              model={{}}
              form-item-list={[
                { prop: 'title', label: '政策标题', span: 24, formtype: 'Input', attrs: { placeholder: '请输入政策标题' } },
                { prop: 'tags', label: '政策标签', span: 24, formtype: 'Input', attrs: { placeholder: '请输入标签' } }
              ]}
              layout-form-props={{ fromLayProps: { labelWidth: '120px', size: 'small' } }}
            />
          )
        }
      })
    },
    handleView(row) {
      this.$message.info('查看: ' + row.title)
    },
    handleEdit(row) {
      this.$message.info('编辑: ' + row.title)
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
      }).then(() => {
        const idx = this.data.findIndex(item => item.id === row.id)
        if (idx > -1) this.data.splice(idx, 1)
        this.$message.success('删除成功: ' + row.title)
      }).catch(() => {})
    }
  }
}
</script>
