<template>
  <div>
    <div style="margin-bottom: 12px; color: #909399; font-size: 13px;">
      每行「通过 / 驳回」按钮通过声明式 operate 列 btns 配置；驳回需在弹窗中填写原因；已处理行的按钮自动隐藏
    </div>
    <es-table
      :data-source="data"
      :columns="columns"
      :options="options"
    />
  </div>
</template>

<script lang="jsx">
/**
 * 行审批（组合）—— 声明式 operate 列 btns + 行级状态流转 + 驳回弹窗
 *
 * 关键点：
 *   1. operate 列用声明式 btns 配置：{ name, type, hidden, clickEvent }，
 *      key/prop 为 'operate' 且不写 render 时，EsTable 自动渲染按钮
 *   2. btns 的 hidden 支持函数 (row) => boolean，据行状态动态显隐
 *   3. clickEvent(row) 拿到当前行；驳回复用 useDialog 收集原因后回写状态
 */
import { defineComponent, reactive } from '@vue/composition-api'
import { useDialog } from '@es-plus/vue2'
import { Message } from 'element-ui'

const statusTag = { 待审批: 'warning', 已通过: 'success', 已驳回: 'danger' }

export default defineComponent({
  name: 'CombinationRowApproval',
  setup() {
    const data = reactive([
      { id: 1, applicant: '张三', type: '报销', amount: 1280, status: '待审批', reason: '' },
      { id: 2, applicant: '李四', type: '请假', amount: 0, status: '待审批', reason: '' },
      { id: 3, applicant: '王五', type: '采购', amount: 8600, status: '已通过', reason: '' }
    ])
    const dialog = useDialog()

    const approve = (row) => {
      row.status = '已通过'
      Message.success(`已通过 ${row.applicant} 的申请`)
    }

    const reject = (row) => {
      let reason = ''
      dialog({
        title: `驳回 - ${row.applicant}`,
        width: '420px',
        // eslint-disable-next-line no-unused-vars -- h 供 JSX 使用（setup 内无 this.$createElement）
        render: (h) => (
          <el-input
            type="textarea"
            rows={3}
            placeholder="请填写驳回原因"
            value={reason}
            on-input={(v) => { reason = v }}
          />
        ),
        configBtn: [
          { name: '取消', key: 'cancel', click: (_, { close }) => close() },
          {
            name: '确认驳回',
            type: 'danger',
            key: 'confirm',
            click: (_, { close }) => {
              if (!reason.trim()) {
                Message.warning('请填写驳回原因')
                return
              }
              row.status = '已驳回'
              row.reason = reason
              Message.success('已驳回')
              close()
            }
          }
        ]
      })
    }

    const columns = [
      { prop: 'id', label: 'ID', width: 70 },
      { prop: 'applicant', label: '申请人', width: 110 },
      { prop: 'type', label: '类型', width: 100 },
      {
        prop: 'amount',
        label: '金额',
        width: 120,
        render: (h, { row }) => <span>{row.amount ? `¥${row.amount}` : '—'}</span>
      },
      {
        prop: 'status',
        label: '状态',
        width: 110,
        render: (h, { row }) => (
          <el-tag type={statusTag[row.status]} size="small">{row.status}</el-tag>
        )
      },
      { prop: 'reason', label: '驳回原因', render: (h, { row }) => <span>{row.reason || '—'}</span> },
      {
        prop: 'operate',
        label: '操作',
        width: 140,
        btns: [
          { name: '通过', type: 'primary', hidden: (row) => row.status !== '待审批', clickEvent: approve },
          { name: '驳回', type: 'danger', hidden: (row) => row.status !== '待审批', clickEvent: reject }
        ]
      }
    ]

    const options = { border: true }

    return { data, columns, options }
  }
})
</script>
