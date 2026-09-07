<template>
  <div class="form-table-container">
    <es-table
      ref="userTable"
      :data-source="tableData"
      :columns="tableColumns"
      :pagination="pagination"
      :options="{
        border: true,
        multiSelect: true,
        cachePageSelection: true,
        rowkey: 'id'
      }"
      @selection-change="handleSelectionChange"
    >
      <template #default>
        <es-form
          ref="searchForm"
          :form-item-list="formItemList"
          :model="searchForm"
          :layout-form-props="layoutFormProps"
          :config-btn="configBtn"
        />
      </template>
      <template #status="{ scope }">
        <el-tag :type="scope.row.status === 'active' ? 'success' : 'danger'">
          {{ scope.row.status === 'active' ? '启用' : '禁用' }}
        </el-tag>
      </template>
      <template #action="{ scope }">
        <el-button
          size="mini"
          @click="handleEdit(scope.row)"
        >
          编辑
        </el-button>
        <el-button
          size="mini"
          type="danger"
          @click="handleDelete(scope.row)"
        >
          删除
        </el-button>
      </template>
    </es-table>
  </div>
</template>

<script>
export default {
  name: 'FormTableDemo',
  data() {
    return {
      searchForm: {
        name: '',
        status: '',
        department: ''
      },
      tableData: [],
      pagination: {
        current: 1,
        pageSize: 10,
        total: 0
      },
      selectedRows: [],
      layoutFormProps: {
        fromLayProps: {
          labelWidth: '80px',
          size: 'small'
        },
        rowLayProps: {
          gutter: 10
        }
      },
      formItemList: [
        {
          prop: 'name',
          label: '姓名',
          span: 6,
          formtype: 'Input',
          attrs: {
            placeholder: '请输入姓名',
            clearable: true
          }
        },
        {
          prop: 'status',
          label: '状态',
          span: 6,
          formtype: 'Select',
          attrs: {
            placeholder: '请选择状态',
            clearable: true
          },
          dataOptions: [
            { label: '全部', value: '' },
            { label: '启用', value: 'active' },
            { label: '禁用', value: 'inactive' }
          ]
        },
        {
          prop: 'department',
          label: '部门',
          span: 6,
          formtype: 'Select',
          attrs: {
            placeholder: '请选择部门',
            clearable: true
          },
          dataOptions: [
            { label: '全部', value: '' },
            { label: '技术部', value: 'tech' },
            { label: '产品部', value: 'product' },
            { label: '运营部', value: 'operation' }
          ]
        }
      ],
      configBtn: [
        {
          name: '查询',
          type: 'primary',
          key: 'query',
          triggerEvent: true,
          onClick: () => this.handleSearch()
        },
        {
          name: '重置',
          key: 'reset',
          triggerEvent: true,
          onClick: () => this.handleReset()
        },
        {
          name: '批量删除',
          type: 'danger',
          key: 'batchDelete',
          disabled: true,
          onClick: () => this.handleBatchDelete()
        }
      ],
      tableColumns: [
        { prop: 'id', label: 'ID', width: 80 },
        { prop: 'name', label: '姓名', width: 120 },
        { prop: 'department', label: '部门', width: 120 },
        { prop: 'email', label: '邮箱' },
        { prop: 'status', label: '状态', width: 100, scopedSlots: { customRender: 'status' } },
        { prop: 'action', label: '操作', width: 150, scopedSlots: { customRender: 'action' } }
      ]
    }
  },
  mounted() {
    this.loadData()
  },
  methods: {
    handleSearch() {
      this.pagination.current = 1
      this.loadData()
    },
    handleReset() {
      this.$refs.searchForm.resetFields()
      this.searchForm = {
        name: '',
        status: '',
        department: ''
      }
      this.handleSearch()
    },
    loadData() {
      setTimeout(() => {
        const mockData = [
          { id: 1, name: '张三', department: 'tech', email: 'zhangsan@example.com', status: 'active' },
          { id: 2, name: '李四', department: 'product', email: 'lisi@example.com', status: 'inactive' },
          { id: 3, name: '王五', department: 'tech', email: 'wangwu@example.com', status: 'active' },
          { id: 4, name: '赵六', department: 'operation', email: 'zhaoliu@example.com', status: 'active' },
          { id: 5, name: '钱七', department: 'product', email: 'qianqi@example.com', status: 'inactive' }
        ]
        
        let filteredData = mockData.filter(item => {
          if (this.searchForm.name && !item.name.includes(this.searchForm.name)) return false
          if (this.searchForm.status && item.status !== this.searchForm.status) return false
          if (this.searchForm.department && item.department !== this.searchForm.department) return false
          return true
        })
        
        this.tableData = filteredData
        this.pagination.total = filteredData.length
      }, 300)
    },
    handleSelectionChange(selection) {
      this.selectedRows = selection
      const batchDeleteBtn = this.configBtn.find(btn => btn.key === 'batchDelete')
      if (batchDeleteBtn) {
        batchDeleteBtn.disabled = selection.length === 0
      }
    },
    handleEdit(row) {
      this.$message.info('编辑功能：' + row.name)
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
          this.pagination.total--
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
        this.pagination.total -= this.selectedRows.length
        this.selectedRows = []
        this.$message.success('批量删除成功')
      }).catch(() => {})
    }
  }
}
</script>

<style scoped>
.form-table-container {
  padding: 0;
  background: #fff;
  border-radius: 4px;
}
</style>