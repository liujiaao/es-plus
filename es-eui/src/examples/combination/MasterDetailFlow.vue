<template>
  <div class="master-detail-flow">
    <p class="flow-hint">
      点左侧任意订单 → 右侧明细按订单号重新请求；点一条明细再「编辑明细」，保存后
      <strong>主表金额与「已修改」标记同步回写</strong>。两张表、一个弹窗，全部由
      <code>columns + options</code> 配置驱动，没有一行手写的表格模板。
    </p>

    <div class="flow-body">
      <section class="flow-pane flow-pane--master">
        <h4>订单（主表）</h4>
        <es-table
          ref="masterRef"
          :columns="masterColumns"
          :options="masterOptions"
          :data-source="orderRows"
          @row-click="handleMasterRowClick"
        />
      </section>

      <section class="flow-pane flow-pane--detail">
        <header class="flow-detail-head">
          <h4>
            明细（从表）
            <span v-if="selectedOrder" class="flow-order-no">{{ selectedOrder.orderNo }}</span>
            <span v-else class="flow-empty">未选择订单</span>
          </h4>
          <div class="flow-detail-actions">
            <span class="flow-sum">
              共 {{ currentLines.length }} 行 · 合计 ¥{{ totalAmount.toLocaleString() }}
            </span>
            <el-button type="primary" size="mini" :disabled="!selectedLine" @click="openLineEditor">
              编辑明细
            </el-button>
          </div>
        </header>
        <es-table
          ref="detailRef"
          :columns="detailColumns"
          :options="detailOptions"
          @row-click="handleDetailRowClick"
        />
      </section>
    </div>

    <el-dialog
      title="编辑明细"
      :visible.sync="editorVisible"
      width="460px"
      append-to-body
    >
      <es-form
        ref="lineFormRef"
        :model="lineForm"
        :form-item-list="lineFormItems"
        :layout-form-props="lineFormLayout"
      />
      <span slot="footer">
        <el-button size="small" @click="editorVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="saveLine">保存</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script lang="jsx">
/**
 * 主子联动：一次点选 → 三处响应
 *
 * 1. 主表 `@row-click` 只做一件事：记住选中订单；
 * 2. 从表 `options.httpRequest` 在请求发出时才读选中订单，因此宿主只需 `reload()`；
 * 3. 弹窗保存后改「假后端」→ 从表重取 → 主表金额/行数/「已修改」标记回写。
 *
 * 从表刻意返回 `{ code, result: { lines, total } }` 这种嵌套信封，用
 * `configTableOut` 声明映射（递归找 key），这是「适配任意后端」的一半；
 * 另一半 `listenToCallBack.afterResponse` 在响应到达后统一加工（补上每行小计）。
 * 注意：`listenToCallBack` 是「响应/参数的转换钩子」，不是跨组件信号——
 * 主子通信走的是这里的状态 + reload，二者不要混用。
 */
import { defineComponent, ref, reactive, computed, watch } from '@vue/composition-api'
import { Message } from 'element-ui'

export default defineComponent({
  name: 'CombinationMasterDetailFlow',
  setup() {
    // ── 假后端：订单明细按订单号存放，弹窗保存改的就是它 ──
    const detailStore = reactive({
      'SO-2026-1001': [
        { lineNo: 1, product: '伺服电机 A2', spec: '400W', qty: 4, price: 3200, edited: false },
        { lineNo: 2, product: '减速机 R7', spec: 'i=25', qty: 2, price: 5600, edited: false },
        { lineNo: 3, product: '编码器线缆', spec: '5m', qty: 4, price: 180, edited: false }
      ],
      'SO-2026-1002': [
        { lineNo: 1, product: '工业相机 C1', spec: '500万像素', qty: 2, price: 8600, edited: false },
        { lineNo: 2, product: '镜头 M12', spec: '8mm', qty: 2, price: 1250, edited: false }
      ],
      'SO-2026-1003': [
        { lineNo: 1, product: 'PLC 主机', spec: 'CPU1215C', qty: 1, price: 7800, edited: false },
        { lineNo: 2, product: '数字量模块', spec: '16DI/16DO', qty: 3, price: 980, edited: false },
        { lineNo: 3, product: '导轨电源', spec: '24V 10A', qty: 1, price: 420, edited: false }
      ],
      'SO-2026-1004': [
        { lineNo: 1, product: '工控机 IPC', spec: 'i7/16G', qty: 1, price: 12800, edited: false },
        { lineNo: 2, product: '固态硬盘', spec: '1TB', qty: 1, price: 760, edited: false }
      ]
    })

    const orders = ref([
      { orderNo: 'SO-2026-1001', customer: '华东制造', status: '待确认', updatedAt: '2026-10-21 09:12' },
      { orderNo: 'SO-2026-1002', customer: '苏州精工', status: '已确认', updatedAt: '2026-10-21 14:05' },
      { orderNo: 'SO-2026-1003', customer: '宁波自动化', status: '待确认', updatedAt: '2026-10-22 10:40' },
      { orderNo: 'SO-2026-1004', customer: '无锡智造', status: '已发货', updatedAt: '2026-10-22 16:28' }
    ])

    const selectedOrder = ref(null)
    const selectedLine = ref(null)
    const masterRef = ref(null)
    const detailRef = ref(null)

    const sumOf = (lines) => lines.reduce((sum, line) => sum + line.qty * line.price, 0)

    // 主表金额不是死数据：由明细实时求和，保存明细后自动回写
    const orderRows = computed(() =>
      orders.value.map((order) => {
        const lines = detailStore[order.orderNo] || []
        return {
          ...order,
          lineCount: lines.length,
          amount: sumOf(lines),
          edited: lines.some((line) => line.edited)
        }
      })
    )

    const currentLines = computed(() =>
      selectedOrder.value ? detailStore[selectedOrder.value.orderNo] || [] : []
    )
    const totalAmount = computed(() => sumOf(currentLines.value))

    // 从表请求：发出时才读 selectedOrder，所以换订单只需 reload()
    const fetchLines = () =>
      new Promise((resolve) => {
        const orderNo = selectedOrder.value && selectedOrder.value.orderNo
        setTimeout(() => {
          const lines = orderNo ? detailStore[orderNo] || [] : []
          resolve({ code: 0, result: { lines, total: lines.length } })
        }, 260)
      })

    const addSubtotal = (response) => ({
      ...response,
      result: {
        ...response.result,
        lines: ((response && response.result && response.result.lines) || []).map((line) => ({
          ...line,
          subtotal: line.qty * line.price
        }))
      }
    })

    const masterColumns = [
      { prop: 'orderNo', label: '订单号', minWidth: 140 },
      { prop: 'customer', label: '客户', minWidth: 110 },
      { prop: 'lineCount', label: '明细', width: 64, align: 'center' },
      {
        prop: 'amount',
        label: '金额',
        width: 110,
        align: 'right',
        formatter: (row) => `¥${row.amount.toLocaleString()}`
      },
      {
        prop: 'status',
        label: '状态',
        width: 90,
        render: (h, { row }) => (
          <el-tag size="small" type={row.status === '待确认' ? 'warning' : 'success'}>{row.status}</el-tag>
        )
      },
      {
        prop: 'edited',
        label: '联动',
        width: 80,
        render: (h, { row }) =>
          row.edited ? (
            <el-tag size="small" type="danger" effect="plain">已修改</el-tag>
          ) : (
            <span style="color: #c0c4cc">—</span>
          )
      }
    ]

    const masterOptions = {
      border: true,
      stripe: true,
      rowkey: 'orderNo',
      highlightCurrentRow: true,
      size: 'small',
      maxHeight: 360
    }

    const detailColumns = [
      { prop: 'lineNo', label: '行', width: 56, align: 'center' },
      { prop: 'product', label: '物料', minWidth: 140 },
      { prop: 'spec', label: '规格', minWidth: 100 },
      { prop: 'qty', label: '数量', width: 80, align: 'right' },
      { prop: 'price', label: '单价', width: 100, align: 'right', formatter: (row) => `¥${row.price.toLocaleString()}` },
      { prop: 'subtotal', label: '小计', width: 110, align: 'right', formatter: (row) => `¥${(row.subtotal || 0).toLocaleString()}` },
      {
        prop: 'edited',
        label: '本次',
        width: 80,
        render: (h, { row }) =>
          row.edited ? <el-tag size="small" type="danger">已保存</el-tag> : <span style="color: #c0c4cc">—</span>
      }
    ]

    const detailOptions = computed(() => ({
      border: true,
      stripe: true,
      rowkey: 'lineNo',
      highlightCurrentRow: true,
      size: 'small',
      heightType: 'height',
      tabHeight: 300,
      httpRequest: fetchLines,
      // 真实项目里这里就是 GET /api/orders/:orderNo/lines
      apiParams: {
        url: `/api/orders/${(selectedOrder.value && selectedOrder.value.orderNo) || '-'}/lines`,
        model: {}
      },
      // 嵌套信封：{ code, result: { lines, total } } —— 声明映射，不写适配函数
      configTableOut: { tableData: 'lines', total: 'total' },
      // 响应到达后统一加工（补 subtotal），不是跨组件通信
      listenToCallBack: { afterResponse: addSubtotal }
    }))

    const handleMasterRowClick = (row) => {
      if (selectedOrder.value && selectedOrder.value.orderNo === row.orderNo) return
      selectedOrder.value = row
      selectedLine.value = null
    }

    const handleDetailRowClick = (row) => {
      selectedLine.value = row
    }

    // 换订单后让从表重取；fetchLines 在请求发出时才读 selectedOrder，
    // 所以即使 reload 早于渲染完成也一定能拿到新订单。
    watch(selectedOrder, () => {
      if (detailRef.value) detailRef.value.reload()
    })

    const editorVisible = ref(false)
    const editingLineNo = ref(null)
    const lineForm = reactive({ qty: 1, price: 0 })
    const lineFormRef = ref(null)
    const lineFormLayout = { formLayProps: { labelWidth: '64px', size: 'small' } }
    const lineFormItems = [
      {
        prop: 'qty',
        label: '数量',
        formtype: 'InputNumber',
        span: 24,
        attrs: { min: 1 },
        formItemOptions: { rules: [{ required: true, message: '请输入数量' }] }
      },
      {
        prop: 'price',
        label: '单价',
        formtype: 'InputNumber',
        span: 24,
        attrs: { min: 0, precision: 2 },
        formItemOptions: { rules: [{ required: true, message: '请输入单价' }] }
      }
    ]

    const openLineEditor = () => {
      const line = selectedLine.value
      if (!line) return
      editingLineNo.value = line.lineNo
      lineForm.qty = line.qty
      lineForm.price = line.price
      editorVisible.value = true
    }

    const saveLine = async () => {
      // 校验不通过是 reject，catch 成 false 才能停在弹窗
      const ok = await (lineFormRef.value && lineFormRef.value.validate().catch(() => false))
      if (!ok) return
      const orderNo = selectedOrder.value.orderNo
      const target = (detailStore[orderNo] || []).find((item) => item.lineNo === editingLineNo.value)
      if (target) {
        target.qty = Number(lineForm.qty)
        target.price = Number(lineForm.price)
        target.edited = true
      }
      selectedLine.value = null
      editorVisible.value = false
      detailRef.value && detailRef.value.reload()
      Message.success('明细已保存：主表金额同步回写')
    }

    return {
      orders,
      orderRows,
      selectedOrder,
      selectedLine,
      currentLines,
      totalAmount,
      masterRef,
      detailRef,
      masterColumns,
      masterOptions,
      detailColumns,
      detailOptions,
      handleMasterRowClick,
      handleDetailRowClick,
      editorVisible,
      lineForm,
      lineFormRef,
      lineFormLayout,
      lineFormItems,
      openLineEditor,
      saveLine
    }
  }
})
</script>

<style scoped>
.master-detail-flow {
  padding: 0;
}

.flow-hint {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.8;
  color: #606266;
}

.flow-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
  gap: 16px;
  align-items: start;
}

@media (max-width: 900px) {
  .flow-body {
    grid-template-columns: 1fr;
  }
}

.flow-pane {
  min-width: 0;
}

.flow-pane h4 {
  margin: 0 0 8px;
  font-size: 14px;
  color: #303133;
}

.flow-detail-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.flow-detail-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.flow-order-no,
.flow-empty {
  margin-left: 6px;
  font-size: 12px;
  font-weight: normal;
  color: #909399;
  font-family: 'Fira Code', monospace;
}

.flow-empty {
  font-family: inherit;
}

.flow-sum {
  font-size: 12px;
  color: #909399;
}
</style>
