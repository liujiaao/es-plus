<template>
  <div class="example-dialog-drawer">
    <div class="example-dialog-drawer__bar">
      <span class="example-dialog-drawer__label">弹出方向</span>
      <a-radio-group v-model:value="direction" size="small">
        <a-radio-button value="rtl">右侧</a-radio-button>
        <a-radio-button value="ltr">左侧</a-radio-button>
        <a-radio-button value="btt">底部</a-radio-button>
      </a-radio-group>
      <span class="example-dialog-drawer__tip">
        同一次 dialog() 调用，换 direction 只是换一条边；render / configBtn / beforeClose 都不变
      </span>
    </div>

    <a-table
      :dataSource="orders"
      :columns="columns"
      :pagination="false"
      size="small"
      bordered
      rowKey="id"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'amount'">¥{{ record.amount.toLocaleString() }}</template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="statusMap[record.status].color">{{ statusMap[record.status].text }}</a-tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-button type="link" size="small" @click="openDetail(record)">详情</a-button>
          <a-button type="link" size="small" @click="openEdit(record)">编辑</a-button>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script setup lang="jsx">
/**
 * 抽屉底座 —— 「列表 → 抽屉详情 / 抽屉编辑」（Vue 3 + Ant Design Vue）
 *
 * 关键点：
 *   1. `type: 'drawer'` 把底座换成 a-drawer，弹窗的能力一个不少：render 内容、
 *      configBtn 按钮、beforeClose 关闭闸门、cacheKey 实例缓存全部走同一套实现。
 *   2. antd 没有「方向」概念，抽屉用 placement（right/left/top/bottom）——
 *      组件的 direction（rtl/ltr/ttb/btt）就是它的映射。
 *   3. 横向抽屉（rtl/ltr）的 `width` 是宽度；纵向（ttb/btt）时同一个旋钮是**高度**。
 *   4. 抽屉不是可拖拽、也没有全屏态：`isDraggable` / `fullscreen` 在 drawer 下被忽略，
 *      头部只剩一个关闭按钮。
 */
import { ref, reactive } from 'vue'
import { Descriptions, Modal, Tag } from 'ant-design-vue'
import { useDialog } from '@es-plus/adapter-antdv'

const DescriptionsItem = Descriptions.Item

const dialog = useDialog()

const direction = ref('rtl')

const statusMap = {
  paid: { text: '已支付', color: 'success' },
  pending: { text: '待支付', color: 'warning' },
  shipped: { text: '已发货', color: 'processing' }
}

const orders = reactive([
  { id: 'ORD-20240115-0032', customer: '张三', amount: 12999, status: 'shipped', address: '北京市朝阳区望京SOHO T3 2801', phone: '138****6789', remark: '加急配送，工作日白天送达' },
  { id: 'ORD-20240115-0031', customer: '李四', amount: 2680, status: 'paid', address: '上海市浦东新区张江高科技园区', phone: '139****2233', remark: '' },
  { id: 'ORD-20240115-0030', customer: '王五', amount: 458, status: 'pending', address: '广州市天河区体育西路 103 号', phone: '137****8899', remark: '发票随货' },
  { id: 'ORD-20240115-0029', customer: '赵六', amount: 15999, status: 'paid', address: '成都市高新区天府大道 666 号', phone: '135****4455', remark: '' }
])

const columns = [
  { title: '单号', dataIndex: 'id', key: 'id', width: 150 },
  { title: '客户', dataIndex: 'customer', key: 'customer', width: 110 },
  { title: '金额', dataIndex: 'amount', key: 'amount', width: 110 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '收货地址', dataIndex: 'address', key: 'address' },
  { title: '操作', key: 'action', width: 130, align: 'right' }
]

/** 横向抽屉吃宽度、纵向抽屉吃高度 —— 同一个 width 键，两种量纲 */
const drawerSize = () => (direction.value === 'btt' ? 360 : 440)

const openDetail = (row) => {
  dialog({
    type: 'drawer',
    direction: direction.value,
    width: drawerSize(),
    title: `订单详情 · ${row.id}`,
    render: () => (
      <Descriptions column={1} bordered size="small" class="drawer-detail">
        <DescriptionsItem label="单号">{row.id}</DescriptionsItem>
        <DescriptionsItem label="客户">{row.customer}</DescriptionsItem>
        <DescriptionsItem label="金额">¥{row.amount.toLocaleString()}</DescriptionsItem>
        <DescriptionsItem label="状态">
          <Tag color={statusMap[row.status].color}>{statusMap[row.status].text}</Tag>
        </DescriptionsItem>
        <DescriptionsItem label="电话">{row.phone}</DescriptionsItem>
        <DescriptionsItem label="收货地址">{row.address}</DescriptionsItem>
        <DescriptionsItem label="备注">{row.remark || '-'}</DescriptionsItem>
      </Descriptions>
    ),
    configBtn: [{ name: '关闭', click: (_, { close }) => close() }]
  })
}

const openEdit = (row) => {
  // 草稿与列表行分离：保存才回写，取消/关闭都不动原数据
  const draft = reactive({ customer: row.customer, amount: row.amount, address: row.address })
  let dirty = false
  const touch = () => { dirty = true }

  const field = (label, value, onInput) => (
    <div class="drawer-detail__row">
      <span class="drawer-detail__label">{label}</span>
      <input class="drawer-detail__input" value={String(value)} onInput={onInput} />
    </div>
  )

  dialog({
    type: 'drawer',
    direction: direction.value,
    width: drawerSize(),
    title: `编辑订单 · ${row.id}`,
    beforeClose: (done) => {
      // X / 遮罩 / ESC 都经这道闸门；「取消」按钮是明确放弃，自己把 dirty 清掉再关
      if (!dirty) return done()
      Modal.confirm({
        title: '改动还没保存，确定关闭吗？',
        content: '关闭后本次修改会丢失',
        okText: '放弃',
        cancelText: '继续编辑',
        onOk: done
      })
    },
    render: () => (
      <div class="drawer-detail drawer-detail--form">
        {field('客户', draft.customer, (e) => { draft.customer = e.target.value; touch() })}
        {field('金额', draft.amount, (e) => { draft.amount = Number(e.target.value) || 0; touch() })}
        {field('地址', draft.address, (e) => { draft.address = e.target.value; touch() })}
      </div>
    ),
    configBtn: [
      {
        name: '保存',
        type: 'primary',
        click: (_, { close }) => {
          row.customer = draft.customer
          row.amount = draft.amount
          row.address = draft.address
          dirty = false
          close()
        }
      },
      { name: '取消', click: (_, { close }) => { dirty = false; close() } }
    ]
  })
}
</script>

<style scoped>
.example-dialog-drawer__bar {
  display: flex;
  align-items: center;
  gap: var(--es-space-2);
  margin-bottom: var(--es-space-3);
  flex-wrap: wrap;
}

.example-dialog-drawer__label {
  font-size: var(--es-text-sm);
  color: var(--es-text-regular);
}

.example-dialog-drawer__tip {
  font-size: var(--es-text-xs);
  color: var(--es-text-secondary);
}

.drawer-detail {
  padding: 0 var(--es-space-1);
}

.drawer-detail__row {
  display: flex;
  align-items: center;
  margin-bottom: var(--es-space-3);
}

.drawer-detail__label {
  width: 64px;
  flex: none;
  font-size: var(--es-text-sm);
}

.drawer-detail__input {
  flex: 1;
  height: 32px;
  padding: 0 var(--es-space-3);
  border: 1px solid var(--es-border);
  border-radius: 4px;
  font-size: var(--es-text-sm);
}
</style>
