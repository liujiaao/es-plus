<template>
  <div>
    <el-button
      type="primary"
      @click="openDialog"
    >
      打开弹窗
    </el-button>
  </div>
</template>

<script>
import { useDialog, EsForm, EsTable } from '@es-plus/vue2'

const createDialog = useDialog()

export default {
  name: 'DialogFormTableDemo',
  data() {
    return {
      dialogFormData: {
        name: '',
        email: '',
        phone: '',
        department: ''
      },
      tableData: [
        { id: 1, name: '张三', email: 'zhangsan@example.com', phone: '13800138001', department: '技术部' },
        { id: 2, name: '李四', email: 'lisi@example.com', phone: '13800138002', department: '产品部' },
        { id: 3, name: '王五', email: 'wangwu@example.com', phone: '13800138003', department: '技术部' }
      ],
      selectedRows: [],
      dialogFormConfig: [
        {
          prop: 'name',
          label: '姓名',
          span: 8,
          formtype: 'Input',
          attrs: {
            placeholder: '请输入姓名',
            clearable: true
          }
        },
        {
          prop: 'department',
          label: '部门',
          span: 8,
          formtype: 'Select',
          attrs: {
            placeholder: '请选择部门',
            clearable: true
          },
          dataOptions: [
            { label: '技术部', value: '技术部' },
            { label: '产品部', value: '产品部' },
            { label: '运营部', value: '运营部' }
          ]
        }
      ],
      dialogLayoutProps: {
        fromLayProps: {
          labelWidth: '80px',
          size: 'small'
        },
        rowLayProps: {
          gutter: 10
        }
      }
    }
  },
  computed: {
    dialogTableColumns() {
      return [
        { prop: 'id', label: 'ID', width: 80 },
        { prop: 'name', label: '姓名', width: 120 },
        { prop: 'email', label: '邮箱' },
        { prop: 'phone', label: '电话', width: 130 },
        { prop: 'department', label: '部门', width: 100 },
        {
          prop: 'action',
          label: '操作',
          width: 150,
          render: (h, row) => {
            return h('div', [
              h('el-button', {
                props: { size: 'mini', type: 'text' },
                on: { click: () => this.handleEdit(row) }
              }, '编辑'),
              h('el-button', {
                props: { size: 'mini', type: 'text' },
                style: { color: '#f56c6c' },
                on: { click: () => this.handleDelete(row) }
              }, '删除')
            ])
          }
        }
      ]
    }
  },
  methods: {
    openDialog() {
      createDialog({
        title: '用户管理',
        width: '900px',
        isDraggable: true,
        render: (h) => {
          return h('div', { style: { padding: '20px' } }, [
            h('div', { style: { marginBottom: '20px', padding: '15px', background: '#f5f7fa', borderRadius: '4px' } }, [
              h(EsForm, {
                props: {
                  formItemList: this.dialogFormConfig,
                  model: this.dialogFormData,
                  layoutFormProps: this.dialogLayoutProps,
                  configBtn: [
                    {
                      name: '查询',
                      type: 'primary',
                      key: 'search',
                      onClick: () => this.handleDialogSearch()
                    },
                    {
                      name: '重置',
                      key: 'reset',
                      onClick: () => this.handleDialogReset()
                    }
                  ]
                }
              })
            ]),
            h(EsTable, {
              props: {
                dataSource: this.tableData,
                columns: this.dialogTableColumns,
                options: {
                  border: true,
                  multiSelect: true,
                  highlightCurrentRow: true
                }
              },
              on: {
                'selection-change': (selection) => {
                  this.selectedRows = selection
                }
              }
            }),
            h('div', {
              style: { marginTop: '15px', textAlign: 'right', color: '#909399', fontSize: '14px' }
            }, `共 ${this.tableData.length} 条数据，已选择 ${this.selectedRows.length} 条`)
          ])
        },
        configBtn: [
          {
            name: '新增用户',
            type: 'primary',
            icon: 'el-icon-plus',
            key: 'add',
            onClick: () => this.handleAddUser()
          },
          {
            name: '批量删除',
            type: 'danger',
            icon: 'el-icon-delete',
            key: 'batchDelete',
            disabled: true,
            onClick: () => this.handleBatchDelete()
          },
          {
            name: '关闭',
            key: 'close',
            onClick: (vm, { close }) => close()
          }
        ]
      })
    },
    handleDialogSearch() {
      this.$message.success('查询成功')
    },
    handleDialogReset() {
      this.dialogFormData = {
        name: '',
        email: '',
        phone: '',
        department: ''
      }
      this.$message.info('已重置')
    },
    handleAddUser() {
      this.$message.info('新增用户')
    },
    handleEdit(row) {
      this.$message.info('编辑用户：' + row.name)
    },
    handleDelete(row) {
      this.$confirm('确定要删除该用户吗？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        const index = this.tableData.findIndex(item => item.id === row.id)
        if (index > -1) {
          this.tableData.splice(index, 1)
          this.$message.success('删除成功')
        }
      }).catch(() => {})
    },
    handleBatchDelete() {
      if (this.selectedRows.length === 0) {
        this.$message.warning('请先选择要删除的数据')
        return
      }
      this.$confirm(`确定要删除选中的 ${this.selectedRows.length} 条数据吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        const selectedIds = this.selectedRows.map(row => row.id)
        this.tableData = this.tableData.filter(item => !selectedIds.includes(item.id))
        this.selectedRows = []
        this.$message.success('批量删除成功')
      }).catch(() => {})
    }
  }
}
</script>