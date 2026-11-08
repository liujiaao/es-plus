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
        同一次 dialog() 调用，换 direction 只是换一条边；render / configBtn / beforeClose 都不变
      </span>
    </div>

    <el-table :data="orders" size="small" border>
      <el-table-column prop="id" label="单号" width="150" />
      <el-table-column prop="customer" label="客户" width="110" />
      <el-table-column prop="amount" label="金额" width="110">
        <template slot-scope="{ row }">¥{{ row.amount.toLocaleString() }}</template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template slot-scope="{ row }">
          <el-tag :type="statusMap[row.status].type" size="small">{{ statusMap[row.status].text }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="address" label="收货地址" min-width="200" />
      <el-table-column label="操作" width="130" align="right">
        <template slot-scope="{ row }">
          <el-button type="text" size="small" @click="openDetail(row)">详情</el-button>
          <el-button type="text" size="small" @click="openEdit(row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script lang="jsx">
/**
 * 抽屉底座 —— 「列表 → 抽屉详情 / 抽屉编辑」（Vue 2 + Element UI）
 *
 * 关键点：
 *   1. `type: 'drawer'` 把底座换成 el-drawer（这里是 ElDrawer v2），弹窗的能力一个不少：
 *      render 内容、configBtn 按钮、beforeClose 关闭闸门、cacheKey 实例缓存都走同一套实现。
 *   2. Element UI 的 el-drawer **没有 footer 槽**，组件把 configBtn 生成的按钮放进正文底部
 *      并用 flex 钉住 —— 所以抽屉里照样有「保存 / 取消」，不需要自己再写一段按钮。
 *   3. `direction` 决定从哪条边滑出：rtl/ltr 时 `width` 是宽度，ttb/btt 时是高度 ——
 *      底部抽屉给 '42vh'。
 *   4. 点击遮罩关闭在抽屉上叫 wrapperClosable，组件已经按 closeOnClickModal 映射好。
 */
import { defineComponent, ref, reactive } from '@vue/composition-api'
import MessageBox from 'element-ui/lib/message-box'
import { useDialog } from '@es-plus/vue2'

export default defineComponent({
  name: 'DialogDrawer',
  setup() {
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
            <el-descriptions column={1} border size="small">
              <el-descriptions-item label="单号">{row.id}</el-descriptions-item>
              <el-descriptions-item label="客户">{row.customer}</el-descriptions-item>
              <el-descriptions-item label="金额">¥{row.amount.toLocaleString()}</el-descriptions-item>
              <el-descriptions-item label="状态">
                <el-tag type={statusMap[row.status].type} size="small">{statusMap[row.status].text}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="电话">{row.phone}</el-descriptions-item>
              <el-descriptions-item label="收货地址">{row.address}</el-descriptions-item>
              <el-descriptions-item label="备注">{row.remark || '-'}</el-descriptions-item>
            </el-descriptions>
          </div>
        ),
        configBtn: [{ name: '关闭', key: 'close', click: (_, { close }) => close() }]
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
        beforeClose: (done) => {
          // X / 遮罩 / ESC 都经这道闸门；「取消」按钮是明确放弃，自己把 dirty 清掉再关
          if (!dirty) return done()
          MessageBox.confirm('改动还没保存，确定关闭吗？', '放弃修改', {
            confirmButtonText: '放弃',
            cancelButtonText: '继续编辑',
            type: 'warning'
          })
            .then(() => done())
            .catch(() => { /* 用户选择留在抽屉里 */ })
        },
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
        configBtn: [
          {
            name: '保存',
            key: 'save',
            type: 'primary',
            click: (_, { close }) => {
              row.customer = draft.customer
              row.amount = draft.amount
              row.address = draft.address
              dirty = false
              close()
            }
          },
          { name: '取消', key: 'cancel', click: (_, { close }) => { dirty = false; close() } }
        ]
      })
    }

    return { direction, statusMap, orders, openDetail, openEdit }
  }
})
</script>

<style lang="scss" scoped>
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
