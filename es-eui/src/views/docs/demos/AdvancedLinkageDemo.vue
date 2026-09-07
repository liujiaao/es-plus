<template>
  <div class="advanced-linkage">
    <es-table
      ref="mainTable"
      :data-source="mainTableData"
      :columns="mainTableColumns"
      :pagination="mainPagination"
      :options="{
        border: true,
        multiSelect: true,
        cachePageSelection: true,
        rowkey: 'id'
      }"
      @selection-change="handleMainSelectionChange"
    >
      <template #default>
        <es-form
          ref="mainForm"
          :form-item-list="mainFormItemList"
          :model="mainSearchForm"
          :layout-form-props="mainLayoutProps"
          :config-btn="mainConfigBtn"
        />
      </template>
      <template #status="{ scope }">
        <el-tag :type="getStatusType(scope.row.status)">
          {{ getStatusText(scope.row.status) }}
        </el-tag>
      </template>
      <template #action="{ scope }">
        <el-button
          size="mini"
          @click="handleViewDetail(scope.row)"
        >
          详情
        </el-button>
        <el-button
          size="mini"
          type="primary"
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
import { useDialog, EsForm, EsTable } from '@es-plus/vue2'

const createDialog = useDialog()

export default {
  name: 'AdvancedLinkageDemo',
  components: {
    EsForm,
    EsTable
  },
  data() {
    return {
      mainSearchForm: {
        keyword: '',
        category: '',
        status: ''
      },
      mainTableData: [],
      mainPagination: {
        current: 1,
        pageSize: 10,
        total: 0
      },
      selectedMainRows: [],
      mainLayoutProps: {
        fromLayProps: {
          labelWidth: '80px',
          size: 'small'
        },
        rowLayProps: {
          gutter: 10
        }
      },
      mainFormItemList: [
        {
          prop: 'keyword',
          label: '关键词',
          span: 8,
          formtype: 'Input',
          attrs: {
            placeholder: '请输入关键词',
            clearable: true
          }
        },
        {
          prop: 'category',
          label: '分类',
          span: 8,
          formtype: 'Select',
          attrs: {
            placeholder: '请选择分类',
            clearable: true
          },
          dataOptions: [
            { label: '全部', value: '' },
            { label: '电子产品', value: 'electronics' },
            { label: '服装', value: 'clothing' },
            { label: '食品', value: 'food' }
          ]
        },
        {
          prop: 'status',
          label: '状态',
          span: 8,
          formtype: 'Select',
          attrs: {
            placeholder: '请选择状态',
            clearable: true
          },
          dataOptions: [
            { label: '全部', value: '' },
            { label: '待审核', value: 'pending' },
            { label: '已上架', value: 'published' },
            { label: '已下架', value: 'unpublished' }
          ]
        }
      ],
      mainConfigBtn: [
        {
          name: '查询',
          type: 'primary',
          key: 'search',
          onClick: () => this.handleMainSearch()
        },
        {
          name: '重置',
          key: 'reset',
          onClick: () => this.handleMainReset()
        },
        {
          name: '批量上架',
          type: 'success',
          key: 'batchPublish',
          disabled: true,
          onClick: () => this.handleBatchPublish()
        },
        {
          name: '批量下架',
          type: 'warning',
          key: 'batchUnpublish',
          disabled: true,
          onClick: () => this.handleBatchUnpublish()
        }
      ],
      mainTableColumns: [
        { prop: 'id', label: 'ID', width: 80 },
        { prop: 'name', label: '商品名称', width: 200 },
        { prop: 'category', label: '分类', width: 120 },
        { prop: 'price', label: '价格', width: 100 },
        { prop: 'stock', label: '库存', width: 100 },
        { prop: 'status', label: '状态', width: 100, scopedSlots: { customRender: 'status' } },
        { prop: 'action', label: '操作', width: 200, scopedSlots: { customRender: 'action' } }
      ]
    }
  },
  mounted() {
    this.loadMainData()
  },
  created() {
    this.editForm = {
      name: '',
      price: 0,
      stock: 0,
      status: 'pending'
    }
  },
  methods: {
    getStatusType(status) {
      const map = {
        pending: 'warning',
        published: 'success',
        unpublished: 'info'
      }
      return map[status] || 'info'
    },
    getStatusText(status) {
      const map = {
        pending: '待审核',
        published: '已上架',
        unpublished: '已下架'
      }
      return map[status] || status
    },
    loadMainData() {
      const mockData = [
        { id: 1, name: 'iPhone 15', category: 'electronics', price: 5999, stock: 100, status: 'published' },
        { id: 2, name: 'MacBook Pro', category: 'electronics', price: 12999, stock: 50, status: 'published' },
        { id: 3, name: '运动T恤', category: 'clothing', price: 99, stock: 200, status: 'pending' },
        { id: 4, name: '牛仔裤', category: 'clothing', price: 199, stock: 150, status: 'unpublished' },
        { id: 5, name: '有机苹果', category: 'food', price: 29, stock: 300, status: 'published' }
      ]
      
      let filteredData = mockData.filter(item => {
        if (this.mainSearchForm.keyword && !item.name.includes(this.mainSearchForm.keyword)) return false
        if (this.mainSearchForm.category && item.category !== this.mainSearchForm.category) return false
        if (this.mainSearchForm.status && item.status !== this.mainSearchForm.status) return false
        return true
      })
      
      this.mainTableData = filteredData
      this.mainPagination.total = filteredData.length
    },
    handleMainSearch() {
      this.mainPagination.current = 1
      this.loadMainData()
    },
    handleMainReset() {
      this.$refs.mainForm.resetFields()
      this.mainSearchForm = {
        keyword: '',
        category: '',
        status: ''
      }
      this.handleMainSearch()
    },
    handleMainSelectionChange(selection) {
      this.selectedMainRows = selection
      const hasPublished = selection.some(row => row.status === 'published')
      const hasUnpublished = selection.some(row => row.status === 'unpublished')
      
      const publishBtn = this.mainConfigBtn.find(btn => btn.key === 'batchPublish')
      const unpublishBtn = this.mainConfigBtn.find(btn => btn.key === 'batchUnpublish')
      
      if (publishBtn) publishBtn.disabled = selection.length === 0 || hasPublished
      if (unpublishBtn) unpublishBtn.disabled = selection.length === 0 || hasUnpublished
    },
    handleViewDetail(row) {
      createDialog({
        title: '商品详情',
        width: '600px',
        render: (h) => {
          return h('div', { style: { padding: '20px' } }, [
            h('el-descriptions', {
              props: { column: 2, border: true }
            }, [
              h('el-descriptions-item', { props: { label: '商品ID' } }, row.id),
              h('el-descriptions-item', { props: { label: '商品名称' } }, row.name),
              h('el-descriptions-item', { props: { label: '分类' } }, row.category),
              h('el-descriptions-item', { props: { label: '价格' } }, '¥' + row.price),
              h('el-descriptions-item', { props: { label: '库存' } }, row.stock),
              h('el-descriptions-item', { props: { label: '状态' } }, this.getStatusText(row.status))
            ])
          ])
        },
        configBtn: [
          {
            name: '关闭',
            key: 'close',
            onClick: (vm, { close }) => close()
          }
        ]
      })
    },
    handleEdit(row) {
      this.editForm = { ...row }
      this.editFormConfig = [
        {
          prop: 'name',
          label: '商品名称',
          span: 24,
          formtype: 'Input',
          attrs: {
            placeholder: '请输入商品名称'
          }
        },
        {
          prop: 'price',
          label: '价格',
          span: 12,
          formtype: 'Input',
          attrs: {
            type: 'number',
            min: 0
          }
        },
        {
          prop: 'stock',
          label: '库存',
          span: 12,
          formtype: 'Input',
          attrs: {
            type: 'number',
            min: 0
          }
        },
        {
          prop: 'status',
          label: '状态',
          span: 24,
          formtype: 'Select',
          attrs: {
            placeholder: '请选择状态'
          },
          dataOptions: [
            { label: '待审核', value: 'pending' },
            { label: '已上架', value: 'published' },
            { label: '已下架', value: 'unpublished' }
          ]
        }
      ]
      createDialog({
        title: '编辑商品',
        width: '600px',
        render: (h) => {
          return h('div', { style: { padding: '20px' } }, [
            h(EsForm, {
              props: {
                formItemList: this.editFormConfig,
                model: this.editForm,
                layoutFormProps: {
                  fromLayProps: {
                    labelWidth: '100px',
                    size: 'small'
                  }
                }
              }
            })
          ])
        },
        configBtn: [
          {
            name: '取消',
            key: 'cancel',
            onClick: (vm, { close }) => close()
          },
          {
            name: '保存',
            type: 'primary',
            key: 'save',
            onClick: (vm, { close }) => {
              const index = this.mainTableData.findIndex(item => item.id === row.id)
              if (index > -1) {
                this.mainTableData[index] = { ...this.mainTableData[index], ...this.editForm }
                this.$message.success('保存成功')
                close()
              }
            }
          }
        ]
      })
    },
    handleDelete(row) {
      this.$confirm('确定要删除该商品吗？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        const index = this.mainTableData.findIndex(item => item.id === row.id)
        if (index > -1) {
          this.mainTableData.splice(index, 1)
          this.mainPagination.total--
          this.$message.success('删除成功')
        }
      }).catch(() => {})
    },
    handleBatchPublish() {
      this.$confirm(`确定要上架选中的 ${this.selectedMainRows.length} 个商品吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'success'
      }).then(() => {
        this.selectedMainRows.forEach(row => {
          const index = this.mainTableData.findIndex(item => item.id === row.id)
          if (index > -1) {
            this.mainTableData[index].status = 'published'
          }
        })
        this.selectedMainRows = []
        this.$message.success('批量上架成功')
      }).catch(() => {})
    },
    handleBatchUnpublish() {
      this.$confirm(`确定要下架选中的 ${this.selectedMainRows.length} 个商品吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        this.selectedMainRows.forEach(row => {
          const index = this.mainTableData.findIndex(item => item.id === row.id)
          if (index > -1) {
            this.mainTableData[index].status = 'unpublished'
          }
        })
        this.selectedMainRows = []
        this.$message.success('批量下架成功')
      }).catch(() => {})
    }
  }
}
</script>

<style scoped>
.advanced-linkage {
  padding: 0;
  background: #fff;
  border-radius: 4px;
}
</style>