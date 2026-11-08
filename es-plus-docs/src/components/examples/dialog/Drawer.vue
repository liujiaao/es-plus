<template>
  <div class="example-dialog-drawer">
    <div class="example-dialog-drawer__bar">
      <span class="example-dialog-drawer__label">弹出方向</span>
      <el-radio-group v-model="direction" size="small">
        <el-radio-button label="rtl">右侧</el-radio-button>
        <el-radio-button label="ltr">左侧</el-radio-button>
        <el-radio-button label="btt">底部</el-radio-button>
      </el-radio-group>
      <span class="example-dialog-drawer__tip">
        同一次 dialog() 调用，换 direction 只是换一条边；render / configBtn / beforeClose / cacheKey 都不变
      </span>
    </div>

    <el-table :data="orders" size="small" border>
      <el-table-column prop="id" label="单号" width="150" />
      <el-table-column prop="customer" label="客户" width="110" />
      <el-table-column prop="amount" label="金额" width="110">
        <template #default="{ row }">¥{{ row.amount.toLocaleString() }}</template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusMap[row.status].type" size="small">{{ statusMap[row.status].text }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="address" label="收货地址" min-width="200" />
      <el-table-column label="操作" width="130" align="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openDetail(row)">详情</el-button>
          <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="jsx">
/**
 * 抽屉底座 —— 「列表 → 抽屉详情 / 抽屉编辑」
 *
 * 关键点：
 *   1. `type: 'drawer'` 把底座换成 el-drawer，弹窗的那套能力一个不少：
 *      render 内容、configBtn 按钮、beforeClose 关闭闸门、cacheKey 实例缓存、
 *      按钮级权限过滤都走同一条实现。
 *   2. `direction` 决定从哪条边滑出：rtl/ltr 时 `width` 是宽度，ttb/btt 时是高度 ——
 *      所以底部抽屉给的是 '42vh' 而不是像素宽。
 *   3. 抽屉没有全屏态（全屏按钮自动隐藏），也没有拖拽手柄；这两个键在 drawer 下会被忽略。
 *   4. 关闭编辑抽屉前先问一句「放弃修改吗」：X / 遮罩 / ESC 走的是同一道 beforeClose。
 */
import { ref, reactive } from 'vue'
import {
  ElDescriptions,
  ElDescriptionsItem,
  ElMessageBox,
  ElTag
} from 'element-plus'
import { useDialog } from '@es-plus/vue3'

const dialog = useDialog()

const direction = ref('rtl')

const statusMap = {
  paid: { text: '已支付', type: 'success' },
  pending: { text: '待支付', type: 'warning' },
  shipped: { text: '已发货', type: 'primary' }
}

const orders = reactive([
  { id: 'ORD-20240115-0032', customer: '张三', amount: 12999, status: 'shipped', address: '北京市朝阳区望京SOHO T3 2801', phone: '138****6789', remark: '加急配送，工作日白天送达' },
  { id: 'ORD-20240115-0031', customer: '李四', amount: 2680, status: 'paid', address: '上海市浦东新区张江高科技园区', phone: '139****2233', remark: '' },
  { id: 'ORD-20240115-0030', customer: '王五', amount: 458, status: 'pending', address: '广州市天河区体育西路 103 号', phone: '137****8899', remark: '发票随货' },
  { id: 'ORD-20240115-0029', customer: '赵六', amount: 15999, status: 'paid', address: '成都市高新区天府大道 666 号', phone: '135****4455', remark: '' }
])

/** 横向抽屉吃宽度、纵向抽屉吃高度 —— 同一个 width 键，两种量纲 */
const drawerSize = () => (direction.value === 'btt' ? '42vh' : '440px')

const openDetail = (row) => {
  dialog({
    type: 'drawer',
    direction: direction.value,
    width: drawerSize(),
    title: `订单详情 · ${row.id}`,
    render: () => (
      <div class="drawer-detail">
        <ElDescriptions column={1} border size="small">
          <ElDescriptionsItem label="单号">{row.id}</ElDescriptionsItem>
          <ElDescriptionsItem label="客户">{row.customer}</ElDescriptionsItem>
          <ElDescriptionsItem label="金额">¥{row.amount.toLocaleString()}</ElDescriptionsItem>
          <ElDescriptionsItem label="状态">
            <ElTag type={statusMap[row.status].type} size="small">{statusMap[row.status].text}</ElTag>
          </ElDescriptionsItem>
          <ElDescriptionsItem label="电话">{row.phone}</ElDescriptionsItem>
          <ElDescriptionsItem label="收货地址">{row.address}</ElDescriptionsItem>
          <ElDescriptionsItem label="备注">{row.remark || '-'}</ElDescriptionsItem>
        </ElDescriptions>
      </div>
    ),
    configBtn: [{ name: '关闭', click: (_, { close }) => close() }]
  })
}

const openEdit = (row) => {
  // 草稿与列表行分离：保存才回写，取消/关闭都不动原数据
  const draft = reactive({ customer: row.customer, amount: row.amount, address: row.address })
  let dirty = false
  const touch = () => { dirty = true }

  dialog({
    type: 'drawer',
    direction: direction.value,
    width: drawerSize(),
    title: `编辑订单 · ${row.id}`,
    render: () => (
      <div class="drawer-detail drawer-detail--form">
        <div class="drawer-detail__row">
          <span class="drawer-detail__label">客户</span>
          <input
            class="drawer-detail__input"
            value={draft.customer}
            onInput={(e) => { draft.customer = e.target.value; touch() }}
          />
        </div>
        <div class="drawer-detail__row">
          <span class="drawer-detail__label">金额</span>
          <input
            class="drawer-detail__input"
            value={String(draft.amount)}
            onInput={(e) => { draft.amount = Number(e.target.value) || 0; touch() }}
          />
        </div>
        <div class="drawer-detail__row">
          <span class="drawer-detail__label">地址</span>
          <input
            class="drawer-detail__input"
            value={draft.address}
            onInput={(e) => { draft.address = e.target.value; touch() }}
          />
        </div>
      </div>
    ),
    beforeClose: (done) => {
      // X / 遮罩 / ESC 都经这道闸门；「取消」按钮是明确放弃，自己把 dirty 清掉再关
      if (!dirty) return done()
      ElMessageBox.confirm('改动还没保存，确定关闭吗？', '放弃修改', {
        type: 'warning',
        confirmButtonText: '放弃',
        cancelButtonText: '继续编辑'
      }).then(() => done()).catch(() => {})
    },
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
  color: var(--es-text-regular);
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
