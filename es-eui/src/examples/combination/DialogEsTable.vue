<template>
  <div>
    <el-button type="primary" @click="openEsTableDialog">打开表格选择弹窗</el-button>
    <div v-if="selectedUser" class="selected-info">
      已选择用户：<el-tag>{{ selectedUser.name }}</el-tag>
    </div>
  </div>
</template>

<script>
import { useDialog } from '@es-plus/vue2'

const dialog = useDialog(undefined, { onlyInstance: true })

export default {
  data() {
    return {
      selectedUser: null
    }
  },
  methods: {
    openEsTableDialog() {
      const tableData = [
        { id: 1, name: '张三', department: '技术部', position: '工程师' },
        { id: 2, name: '李四', department: '产品部', position: '产品经理' },
        { id: 3, name: '王五', department: '运营部', position: '运营专员' }
      ]
      let selectedRow = null

      dialog({
        title: '选择用户',
        width: '700px',
        isDraggable: true,
        render: (h) => (
          <es-table
            key='table-dialog'
            ref="selectTable"
            data-source={tableData}
            columns={[
              { key: 'id', label: 'ID', width: 80 },
              { key: 'name', label: '姓名', width: 120 },
              { key: 'department', label: '部门', width: 150 },
              { key: 'position', label: '职位' }
            ]}
            options={{
              border: true,
              highlightCurrentRow: true
            }}
            on-current-change={(row) => {
              selectedRow = row
            }}
          />
        ),
        configBtn: [
          {
            name: '取消',
            key: 'cancel',
            click: (_, { close }) => close()
          },
          {
            name: '确定',
            type: 'primary',
            key: 'confirm',
            click: (_, { close }) => {
              if (selectedRow) {
                this.selectedUser = selectedRow
                this.$message.success(`已选择: ${selectedRow.name}`)
                close()
              } else {
                this.$message.warning('请先选择用户')
              }
            }
          }
        ]
      })
    }
  }
}
</script>
