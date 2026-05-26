<template>
  <div class="crud-page-demo">
    <h4 style="margin-bottom: 12px; color: #606266;">EsCrudPage 一键 CRUD — 订单管理</h4>
    <es-crud-page
      ref="crudRef"
      :schema="pageSchema"
      @dialog-confirm="handleDialogConfirm"
      @btn-click="handleBtnClick"
    />
  </div>
</template>

<script setup lang="tsx">
import { ref } from 'vue'
import { EsCrudPage } from 'es-plus'
import { ElMessage } from 'element-plus'

const crudRef = ref<InstanceType<typeof EsCrudPage> | null>(null)

// ─── Mock Data ───

const channelOptions = [
  { label: '线上商城', value: 'online' },
  { label: '线下门店', value: 'offline' },
  { label: '第三方平台', value: 'third' },
  { label: '直播带货', value: 'live' }
]

const statusOptions = [
  { label: '待付款', value: 'pending' },
  { label: '已付款', value: 'paid' },
  { label: '已发货', value: 'shipped' },
  { label: '已完成', value: 'completed' },
  { label: '已取消', value: 'cancelled' }
]

const fulfillOptions = [
  { label: '快递配送', value: 'express' },
  { label: '同城配送', value: 'city' },
  { label: '到店自提', value: 'pickup' }
]

const mockOrders = [
  { id: 1, goods: '华为 Mate 60 Pro', orderNo: 'ORD20240101001', channel: 'online', workOrderNo: 'WO001', totalPrice: 6999, status: 'completed', rewardPoints: 200, customer: '张三', phone: '13800138001', createTime: '2024-01-15 09:30', completeTime: '2024-01-20 14:00', batch: 'B2024-01' },
  { id: 2, goods: 'iPhone 15 Pro Max', orderNo: 'ORD20240101002', channel: 'offline', workOrderNo: 'WO002', totalPrice: 9999, status: 'shipped', rewardPoints: 300, customer: '李四', phone: '13800138002', createTime: '2024-02-10 11:20', completeTime: '', batch: 'B2024-01' },
  { id: 3, goods: '小米14 Ultra', orderNo: 'ORD20240201003', channel: 'live', workOrderNo: 'WO003', totalPrice: 5999, status: 'paid', rewardPoints: 150, customer: '王五', phone: '13800138003', createTime: '2024-03-05 16:45', completeTime: '', batch: 'B2024-02' },
  { id: 4, goods: 'MacBook Pro 16', orderNo: 'ORD20240301004', channel: 'third', workOrderNo: 'WO004', totalPrice: 19999, status: 'pending', rewardPoints: 500, customer: '赵六', phone: '13800138004', createTime: '2024-03-18 08:00', completeTime: '', batch: 'B2024-02' },
  { id: 5, goods: 'iPad Air 6', orderNo: 'ORD20240301005', channel: 'online', workOrderNo: 'WO005', totalPrice: 4799, status: 'completed', rewardPoints: 120, customer: '钱七', phone: '13800138005', createTime: '2024-04-02 10:30', completeTime: '2024-04-08 09:15', batch: 'B2024-03' },
  { id: 6, goods: 'Samsung Galaxy S24', orderNo: 'ORD20240401006', channel: 'offline', workOrderNo: 'WO006', totalPrice: 7999, status: 'cancelled', rewardPoints: 0, customer: '孙八', phone: '13800138006', createTime: '2024-04-15 14:20', completeTime: '', batch: 'B2024-03' },
  { id: 7, goods: 'OPPO Find X7', orderNo: 'ORD20240401007', channel: 'live', workOrderNo: 'WO007', totalPrice: 4999, status: 'completed', rewardPoints: 130, customer: '周九', phone: '13800138007', createTime: '2024-05-01 09:00', completeTime: '2024-05-06 17:30', batch: 'B2024-04' },
  { id: 8, goods: 'vivo X100 Pro', orderNo: 'ORD20240501008', channel: 'online', workOrderNo: 'WO008', totalPrice: 4999, status: 'paid', rewardPoints: 130, customer: '吴十', phone: '13800138008', createTime: '2024-05-20 13:10', completeTime: '', batch: 'B2024-04' }
]

// ─── 通用 httpRequest ───

const mockHttpRequest = async ({ pageIndex, pageSize, formParams }: any) => {
  await new Promise(resolve => setTimeout(resolve, 300))
  let filtered = [...mockOrders]
  if (formParams?.channel) filtered = filtered.filter(i => i.channel === formParams.channel)
  if (formParams?.orderNo) filtered = filtered.filter(i => i.orderNo.includes(formParams.orderNo))
  if (formParams?.customer) filtered = filtered.filter(i => i.customer.includes(formParams.customer))
  if (formParams?.phone) filtered = filtered.filter(i => i.phone.includes(formParams.phone))
  if (formParams?.goods) filtered = filtered.filter(i => i.goods.includes(formParams.goods))
  if (formParams?.status) filtered = filtered.filter(i => i.status === formParams.status)
  if (formParams?.workOrderNo) filtered = filtered.filter(i => i.workOrderNo.includes(formParams.workOrderNo))
  if (formParams?.batch) filtered = filtered.filter(i => i.batch.includes(formParams.batch))
  const start = (pageIndex - 1) * pageSize
  return { data: filtered.slice(start, start + pageSize), total: filtered.length, pageIndex, pageSize }
}

// ─── 下载弹窗内嵌 EsCrudPage 的 schema ───

const downloadCrudSchema: any = {
  formItems: [
    { prop: 'channel', label: '来源渠道', formtype: 'Select', span: 8, dataOptions: channelOptions },
    { prop: 'orderNo', label: '订单编号', formtype: 'Input', span: 8 },
    { prop: 'status', label: '订单状态', formtype: 'Select', span: 8, dataOptions: statusOptions }
  ],
  columns: [
    { type: 'index', label: '序号', width: 60 },
    { prop: 'goods', label: '商品信息', minWidth: 140 },
    { prop: 'orderNo', label: '订单编号', minWidth: 140 },
    { prop: 'channel', label: '来源渠道', width: 100 },
    { prop: 'totalPrice', label: '订单总价', width: 100 },
    { prop: 'status', label: '订单状态', width: 100 }
  ],
  tableOptions: {
    border: true,
    multiSelect: true,
    apiParams: { url: '/api/orders/download' },
    httpRequest: mockHttpRequest,
    configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' }
  },
  pagination: { pageSize: 5 },
  operationColumn: false
}

// ─── 主页面 Schema ───

const pageSchema: any = {
  // 查询表单（11 个字段，折叠为 2 行）
  formItems: [
    { prop: 'channel', label: '来源渠道', formtype: 'Select', span: 6, dataOptions: channelOptions },
    { prop: 'orderNo', label: '订单编号', formtype: 'Input', span: 6,
      formItemOptions: { rules: [{ required: true, message: '请输入订单编号' }] } },
    { prop: 'customer', label: '客户姓名', formtype: 'Input', span: 6 },
    { prop: 'phone', label: '客户手机号', formtype: 'Input', span: 6 },
    { prop: 'goods', label: '商品名称', formtype: 'Input', span: 6 },
    { prop: 'fulfillType', label: '履约方式', formtype: 'Select', span: 6, dataOptions: fulfillOptions },
    { prop: 'workOrderNo', label: '工单号', formtype: 'Input', span: 6 },
    { prop: 'status', label: '订单状态', formtype: 'Select', span: 6, dataOptions: statusOptions },
    { prop: 'createTime', label: '下单时间', formtype: 'datePicker', span: 8,
      attrs: { type: 'daterange', valueFormat: 'YYYY-MM-DD', 'start-placeholder': '开始日期', 'end-placeholder': '结束日期' } },
    { prop: 'completeTime', label: '完成时间', formtype: 'datePicker', span: 8,
      attrs: { type: 'daterange', valueFormat: 'YYYY-MM-DD', 'start-placeholder': '开始日期', 'end-placeholder': '结束日期' } },
    { prop: 'batch', label: '订单批次', formtype: 'Input', span: 6 }
  ],

  // 表单折叠：超过 2 行时收起
  formLayout: { labelWidth: '100px', minFoldRows: 2 },

  // 表格工具栏按钮（左侧：下载、新增 | 右侧：excel导入）
  tableBtns: [
    { name: '下载', icon: 'Download', code: 1, dialogKey: 'download' },
    { name: '新增', type: 'primary', icon: 'Plus', code: 1, dialogKey: 'add' },
    { name: 'excel导入', icon: 'Upload', code: 2, key: 'import', actionType: 'import' }
  ],

  // 表格列
  columns: [
    { type: 'index', label: '序号', width: 60 },
    { prop: 'goods', label: '商品信息', minWidth: 150 },
    { prop: 'orderNo', label: '订单编号', minWidth: 140 },
    { prop: 'channel', label: '来源渠道', width: 100 },
    { prop: 'workOrderNo', label: '工单信息', width: 100 },
    { prop: 'totalPrice', label: '订单总价', width: 100 },
    { prop: 'status', label: '订单状态', width: 100 },
    { prop: 'rewardPoints', label: '奖励成长值', width: 100 }
  ],

  // 表格选项
  tableOptions: {
    border: true,
    multiSelect: true,
    rowkey: 'id',
    apiParams: { url: '/api/orders' },
    httpRequest: mockHttpRequest,
    configTableOut: { total: 'total', tableData: 'data', pageSize: 'pageSize', current: 'pageIndex' }
  },

  pagination: { pageSize: 5 },

  // 操作列
  operationColumn: {
    label: '操作',
    width: 150,
    fixed: 'right',
    btns: [
      { name: '查看', type: 'primary', key: 'view', dialogKey: 'view' },
      { name: '删除', type: 'danger', key: 'delete', confirm: '确定删除该订单吗？此操作不可恢复。' }
    ]
  },

  // 弹窗配置
  dialogs: {
    // ─── 下载表格弹窗：render 嵌套 EsCrudPage ───
    download: {
      title: '下载表格',
      width: '900px',
      render: (_h: any, { registerRef }: any) => (
        <EsCrudPage
          ref={(el: any) => el && registerRef('downloadCrud', el)}
          schema={downloadCrudSchema}
        />
      ),
      configBtn: [
        { name: '取消', action: 'cancel' },
        { name: '保存', type: 'primary', action: 'confirm' }
      ]
    },

    // ─── 新增弹窗（丰富表单类型） ───
    add: {
      title: '新增订单',
      width: '700px',
      formItems: [
        { prop: 'channel', label: '来源渠道', formtype: 'Select', span: 12, dataOptions: channelOptions },
        { prop: 'status', label: '订单状态', formtype: 'Select', span: 12, dataOptions: statusOptions },
        { prop: 'customer', label: '客户姓名', formtype: 'Input', span: 12,
          formItemOptions: { rules: [{ required: true, message: '请输入客户姓名' }] } },
        { prop: 'phone', label: '客户手机号', formtype: 'Input', span: 12,
          formItemOptions: { rules: [{ required: true, message: '请输入客户手机号' }] } },
        { prop: 'goods', label: '商品名称', formtype: 'Input', span: 24 },
        { prop: 'enabled', label: '滑动按钮', formtype: 'Switch', span: 12 },
        { prop: 'createTime', label: '下单时间', formtype: 'datePicker', span: 12,
          attrs: { type: 'daterange', valueFormat: 'YYYY-MM-DD', 'start-placeholder': '开始', 'end-placeholder': '结束' },
          formItemOptions: { rules: [{ required: true, message: '请选择下单时间' }] } },
        { prop: 'completeTime', label: '完成时间', formtype: 'timePicker', span: 12,
          attrs: { isRange: true, 'start-placeholder': '开始时间', 'end-placeholder': '结束时间' },
          formItemOptions: { rules: [{ required: true, message: '请选择完成时间' }] } },
        { prop: 'checkbox', label: '勾选', formtype: 'Checkbox', span: 12,
          dataOptions: [{ label: '选项A', value: 'a' }, { label: '选项B', value: 'b' }, { label: '选项C', value: 'c' }],
          formItemOptions: { rules: [{ required: true, message: '请至少选择一项' }] } },
        { prop: 'radio', label: '单选按钮', formtype: 'Radio', span: 12,
          dataOptions: [{ label: '选项一', value: '1' }, { label: '选项二', value: '2' }, { label: '选项三', value: '3' }],
          formItemOptions: { rules: [{ required: true, message: '请选择一项' }] } },
        { prop: 'photos', label: '照片墙', formtype: 'Upload', span: 24,
          attrs: { listType: 'picture-card', action: '#', autoUpload: false, limit: 5 } }
      ],
      formLayout: { labelWidth: '100px' }
    },

    // ─── 查看弹窗 ───
    view: {
      title: (row) => `查看订单 — ${row?.orderNo || ''}`,
      width: '600px',
      isHiddenFooter: true,
      formItems: [
        { prop: 'orderNo', label: '订单编号', formtype: 'Input', span: 12, attrs: { disabled: true } },
        { prop: 'goods', label: '商品信息', formtype: 'Input', span: 12, attrs: { disabled: true } },
        { prop: 'customer', label: '客户姓名', formtype: 'Input', span: 12, attrs: { disabled: true } },
        { prop: 'phone', label: '手机号', formtype: 'Input', span: 12, attrs: { disabled: true } },
        { prop: 'channel', label: '来源渠道', formtype: 'Input', span: 12, attrs: { disabled: true } },
        { prop: 'status', label: '订单状态', formtype: 'Input', span: 12, attrs: { disabled: true } },
        { prop: 'totalPrice', label: '订单总价', formtype: 'Input', span: 12, attrs: { disabled: true } },
        { prop: 'rewardPoints', label: '奖励成长值', formtype: 'Input', span: 12, attrs: { disabled: true } }
      ]
    }
  }
}

// ─── 事件处理 ───

function handleDialogConfirm(dialogKey: string, data: Record<string, any>) {
  if (dialogKey === 'add') {
    ElMessage.success(`新增订单成功: ${data.goods || data.customer}`)
  } else if (dialogKey === 'download') {
    ElMessage.success('下载任务已提交')
  }
  crudRef.value?.refresh()
}

function handleBtnClick(key: string, payload?: Record<string, any>) {
  if (key === 'delete') {
    ElMessage.success(`已删除订单: ${payload?.orderNo}`)
    crudRef.value?.refresh()
  }
  if (key === 'import') {
    ElMessage.info('正在打开 Excel 导入...')
  }
}
</script>

<style scoped>
.crud-page-demo {
  padding: 0;
}
</style>
