<template>
  <div class="example-row-approval">
    <es-table
      ref="tableRef"
      :data-source="tableData"
      :columns="columns"
      :options="tableOptions"
      @selection-change="handleSelectionChange"
    >
      <template #default>
        <div class="toolbar">
          <el-button type="success" :disabled="!selectionCount" @click="openBatchDialog('approve')">批量通过 ({{ selectionCount }})</el-button>
          <el-button type="danger" :disabled="!selectionCount" @click="openBatchDialog('reject')">批量驳回 ({{ selectionCount }})</el-button>
        </div>
      </template>
    </es-table>
  </div>
</template>

<script setup lang="jsx">
import { ref, reactive } from 'vue'
import { ElMessage, ElTag, ElMessageBox } from 'element-plus'
import EsTable from 'es-plus/components/es-table'
import EsForm from 'es-plus/components/es-form'
import { useDialog } from 'es-plus'

const tableRef = ref(null)
const dialog = useDialog()
const selectionCount = ref(0)

const statusMap = {
  pending: { text: '待审批', type: 'warning' },
  approved: { text: '已通过', type: 'success' },
  rejected: { text: '已驳回', type: 'danger' }
}

const typeMap = { leave: 'danger', overtime: 'warning', travel: '', expense: 'success' }

const tableData = ref(
  Array.from({ length: 12 }, (_, i) => ({
    id: 1001 + i,
    applicant: ['张三', '李四', '王五', '赵六', '孙七'][i % 5],
    type: ['leave', 'overtime', 'travel', 'expense'][i % 4],
    reason: ['年假', '项目加班', '出差北京', '差旅报销'][i % 4],
    date: `2024-03-${String((i % 28) + 1).padStart(2, '0')}`,
    status: i < 4 ? 'pending' : i < 8 ? 'approved' : 'rejected',
    amount: [0, 0, 3500, 1280][i % 4]
  }))
)

const handleSelectionChange = (rows) => {
  selectionCount.value = rows?.length || 0
}

const columns = [
  { type: 'selection', width: 50 },
  { prop: 'id', label: '编号', width: 70 },
  { prop: 'applicant', label: '申请人', width: 90 },
  {
    prop: 'type', label: '类型', width: 90,
    render: (_, { row }) => <ElTag type={typeMap[row.type]} size="small">{row.reason}</ElTag>
  },
  { prop: 'date', label: '日期', width: 120 },
  {
    prop: 'amount', label: '金额', width: 100,
    formatter: (r) => r.amount ? `¥${r.amount.toLocaleString()}` : '-'
  },
  {
    prop: 'status', label: '状态', width: 100,
    render: (_, { row }) => {
      const s = statusMap[row.status] || { text: '-', type: 'info' }
      return <ElTag type={s.type} size="small">{s.text}</ElTag>
    }
  },
  {
    prop: 'operate', label: '操作', width: 160,
    btns: [
      { name: '通过', type: 'success', clickEvent: (row) => handleSingleApproval(row, 'approved') },
      { name: '驳回', type: 'danger', clickEvent: (row) => handleSingleApproval(row, 'rejected') }
    ]
  }
]

const tableOptions = {
  border: true,
  rowkey: 'id',
  multiSelect: true,
  heightType: 'height',
  tabHeight: 400
}

const handleSingleApproval = async (row, status) => {
  const label = status === 'approved' ? '通过' : '驳回'
  try {
    await ElMessageBox.confirm(`确定${label} "${row.applicant}" 的申请吗？`, '审批确认', { type: status === 'approved' ? 'success' : 'warning' })
    row.status = status
    ElMessage.success(`${label}成功`)
  } catch {}
}

const openBatchDialog = (action) => {
  const selection = tableRef.value?.getSelectionRows?.() || []
  if (!selection.length) {
    ElMessage.warning('请先选择要操作的数据')
    return
  }

  const label = action === 'approve' ? '通过' : '驳回'
  const formModel = reactive({ reason: '', action })

  dialog({
    title: `批量${label}`,
    width: '700px',
    render: (h, { registerRef }) => (
      <div>
        <EsTable
          dataSource={selection}
          columns={[
            { prop: 'applicant', label: '申请人', width: 100 },
            { prop: 'reason', label: '事由' },
            { prop: 'date', label: '日期', width: 120 }
          ]}
          options={{ border: true, size: 'small' }}
        />
        <div style={{ marginTop: '16px' }}>
          <EsForm
            ref={(el) => { if (el) registerRef('approvalForm', el) }}
            model={formModel}
            formItemList={[
              { prop: 'reason', label: `${label}原因`, formtype: 'Input', span: 24, attrs: { placeholder: `请输入${label}原因`, type: 'textarea', rows: 3 } }
            ]}
          />
        </div>
      </div>
    ),
    configBtn: [
      { name: '取消', click: (_, { close }) => close() },
      { name: `确定${label}`, type: action === 'approve' ? 'success' : 'danger', click: (_, { close }) => {
        selection.forEach(item => {
          const source = tableData.value.find(d => d.id === item.id)
          if (source) source.status = action === 'approve' ? 'approved' : 'rejected'
        })
        ElMessage.success(`已批量${label} ${selection.length} 条申请`)
        close()
        tableRef.value?.clearAllSelection?.()
        selectionCount.value = 0
      }}
    ]
  })
}
</script>

<style scoped>
.example-row-approval {
  padding: 0;
}
.toolbar {
  display: flex;
  gap: 8px;
  padding-bottom: 10px;
}
</style>
