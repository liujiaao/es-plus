<template>
  <div class="example-dialog-detail">
    <el-button type="primary" @click="openDetail(mockOrder)">查看订单详情</el-button>
    <el-button @click="openDetail(mockUser)">查看用户详情</el-button>
  </div>
</template>

<script setup lang="jsx">
import { ElDescriptions, ElDescriptionsItem, ElTag, ElDivider } from 'element-plus'
import { useDialog } from 'es-plus'

const dialog = useDialog()

const statusMap = {
  paid: { text: '已支付', type: 'success' },
  pending: { text: '待支付', type: 'warning' },
  shipped: { text: '已发货', type: '' },
  cancelled: { text: '已取消', type: 'danger' }
}

const mockOrder = {
  type: 'order',
  id: 'ORD-20240115-0032',
  customer: '张三',
  phone: '138****6789',
  address: '北京市朝阳区望京SOHO T3 2801',
  status: 'shipped',
  amount: 12999,
  items: [
    { product: 'MacBook Pro 14"', price: 12999, qty: 1 },
    { product: 'USB-C 转接头', price: 99, qty: 2 }
  ],
  createTime: '2024-01-15 14:32:00',
  payTime: '2024-01-15 14:35:22',
  remark: '加急配送，工作日白天送达'
}

const mockUser = {
  type: 'user',
  id: 'USR-10086',
  name: '李四',
  email: 'lisi@example.com',
  role: 'admin',
  department: '技术部',
  status: 'active',
  lastLogin: '2024-01-15 09:12:00',
  createTime: '2023-06-20 10:00:00'
}

const openDetail = (data) => {
  const isOrder = data.type === 'order'

  dialog({
    title: isOrder ? '订单详情' : '用户详情',
    width: '700px',
    render: () => isOrder ? (
      <div style="padding: 10px 20px">
        <ElDescriptions column={2} border>
          <ElDescriptionsItem label="订单号">{data.id}</ElDescriptionsItem>
          <ElDescriptionsItem label="客户">{data.customer}</ElDescriptionsItem>
          <ElDescriptionsItem label="手机">{data.phone}</ElDescriptionsItem>
          <ElDescriptionsItem label="状态">
            <ElTag type={statusMap[data.status]?.type} size="small">{statusMap[data.status]?.text}</ElTag>
          </ElDescriptionsItem>
          <ElDescriptionsItem label="金额" span={2}>¥{data.amount.toLocaleString()}</ElDescriptionsItem>
          <ElDescriptionsItem label="地址" span={2}>{data.address}</ElDescriptionsItem>
          <ElDescriptionsItem label="下单时间">{data.createTime}</ElDescriptionsItem>
          <ElDescriptionsItem label="支付时间">{data.payTime}</ElDescriptionsItem>
          <ElDescriptionsItem label="备注" span={2}>{data.remark || '-'}</ElDescriptionsItem>
        </ElDescriptions>
        <ElDivider contentPosition="left">商品明细</ElDivider>
        <ElDescriptions column={3} border>
          {data.items.map((item, i) => <>
            <ElDescriptionsItem label={`商品${i + 1}`}>{item.product}</ElDescriptionsItem>
            <ElDescriptionsItem label="单价">¥{item.price}</ElDescriptionsItem>
            <ElDescriptionsItem label="数量">×{item.qty}</ElDescriptionsItem>
          </>)}
        </ElDescriptions>
      </div>
    ) : (
      <div style="padding: 10px 20px">
        <ElDescriptions column={2} border>
          <ElDescriptionsItem label="用户ID">{data.id}</ElDescriptionsItem>
          <ElDescriptionsItem label="姓名">{data.name}</ElDescriptionsItem>
          <ElDescriptionsItem label="邮箱" span={2}>{data.email}</ElDescriptionsItem>
          <ElDescriptionsItem label="角色">
            <ElTag type={data.role === 'admin' ? 'danger' : ''} size="small">{data.role === 'admin' ? '管理员' : '普通用户'}</ElTag>
          </ElDescriptionsItem>
          <ElDescriptionsItem label="部门">{data.department}</ElDescriptionsItem>
          <ElDescriptionsItem label="状态">
            <ElTag type={data.status === 'active' ? 'success' : 'info'} size="small">{data.status === 'active' ? '在职' : '离职'}</ElTag>
          </ElDescriptionsItem>
          <ElDescriptionsItem label="最后登录">{data.lastLogin}</ElDescriptionsItem>
          <ElDescriptionsItem label="创建时间" span={2}>{data.createTime}</ElDescriptionsItem>
        </ElDescriptions>
      </div>
    ),
    isHiddenFooter: true
  })
}
</script>

<style scoped>
.example-dialog-detail {
  padding: 20px;
  display: flex;
  gap: 12px;
}
</style>
