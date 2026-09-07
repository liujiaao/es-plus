<template>
  <div>
    <div class="batch-actions" style="margin-bottom: 15px;">
      <el-button type="danger" @click="handleBatchDelete" :disabled="selection.length === 0">
        批量删除
      </el-button>
      <el-button type="primary" @click="handleBatchUpdate" :disabled="selection.length === 0">
        批量更新
      </el-button>
    </div>
    <es-table
      ref="batchTable"
      :columns="tableColumns"
      :data-source="tableData"
      :options="{ border: true, multiSelect: true }"
      @selection-change="handleSelectionChange"
    />
  </div>
</template>

<script>
import { useDialog } from '@es-plus/vue2'

const dialog = useDialog()

export default {
  data() {
    return {
      selection: [],
      tableData: [
        { id: 1, name: '张三', status: '启用', createTime: '2024-01-15' },
        { id: 2, name: '李四', status: '启用', createTime: '2024-02-20' },
        { id: 3, name: '王五', status: '禁用', createTime: '2024-03-10' },
        { id: 4, name: '赵六', status: '启用', createTime: '2024-04-05' }
      ],
      tableColumns: [
        { key: 'id', label: 'ID', width: 80 },
        { key: 'name', label: '姓名', width: 120 },
        { key: 'status', label: '状态', width: 100 },
        { key: 'createTime', label: '创建时间' }
      ]
    }
  },
  methods: {
    handleSelectionChange(selection) {
      this.selection = selection
    },
    handleBatchDelete() {
      if (this.selection.length === 0) {
        this.$message.warning('请先选择要删除的记录')
        return
      }
      dialog({
        title: '确认删除',
        render: () => <p>确定要删除选中的 {this.selection.length} 条记录吗？此操作不可恢复。</p>,
        configBtn: [
          {
            name: '取消',
            key: 'cancel',
            click: (_, { close }) => close()
          },
          {
            name: '确定删除',
            type: 'danger',
            key: 'confirm',
            click: (_, { close }) => {
              const ids = this.selection.map(item => item.id)
              this.tableData = this.tableData.filter(item => !ids.includes(item.id))
              this.selection = []
              this.$message.success(`已删除 ${ids.length} 条记录`)
              close()
            }
          }
        ]
      })
    },
    handleBatchUpdate() {
      if (this.selection.length === 0) {
        this.$message.warning('请先选择要更新的记录')
        return
      }
      const selectedNames = this.selection.map(item => item.name).join(', ')
      dialog({
        title: '批量更新状态',
        render: () => <p>将 <strong>{selectedNames}</strong> 共 {this.selection.length} 条记录的状态更新为"启用"？</p>,
        configBtn: [
          {
            name: '取消',
            key: 'cancel',
            click: (_, { close }) => close()
          },
          {
            name: '确认更新',
            type: 'primary',
            key: 'confirm',
            click: (_, { close }) => {
              const ids = this.selection.map(item => item.id)
              this.tableData.forEach(item => {
                if (ids.includes(item.id)) {
                  item.status = '启用'
                }
              })
              this.selection = []
              this.$message.success(`已更新 ${ids.length} 条记录`)
              close()
            }
          }
        ]
      })
    }
  }
}
</script>
