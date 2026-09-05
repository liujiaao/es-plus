<template>
  <div class="example-dialog-detail">
    <a-button type="primary" @click="openDetail(mockOrder)">查看订单详情</a-button>
    <a-button @click="openDetail(mockUser)">查看用户详情</a-button>
  </div>
</template>

<script setup lang="jsx">
import { Descriptions, Tag, Divider } from 'ant-design-vue'
import { useDialog } from '@es-plus/adapter-antdv'

const DescriptionsItem = Descriptions.Item

const dialog = useDialog()

// ADV Tag 使用 color（预设色），非 el 的 type
const statusMap = {
  paid: { text: '已支付', color: 'success' },
  pending: { text: '待支付', color: 'warning' },
  shipped: { text: '已发货', color: 'processing' },
  cancelled: { text: '已取消', color: 'error' }
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
        <Descriptions column={2} border>
          <DescriptionsItem label="订单号">{data.id}</DescriptionsItem>
          <DescriptionsItem label="客户">{data.customer}</DescriptionsItem>
          <DescriptionsItem label="手机">{data.phone}</DescriptionsItem>
          <DescriptionsItem label="状态">
            <Tag color={statusMap[data.status]?.color}>{statusMap[data.status]?.text}</Tag>
          </DescriptionsItem>
          <DescriptionsItem label="金额" span={2}>¥{data.amount.toLocaleString()}</DescriptionsItem>
          <DescriptionsItem label="地址" span={2}>{data.address}</DescriptionsItem>
          <DescriptionsItem label="下单时间">{data.createTime}</DescriptionsItem>
          <DescriptionsItem label="支付时间">{data.payTime}</DescriptionsItem>
          <DescriptionsItem label="备注" span={2}>{data.remark || '-'}</DescriptionsItem>
        </Descriptions>
        <Divider orientation="left">商品明细</Divider>
        <Descriptions column={3} border>
          {data.items.map((item, i) => <>
            <DescriptionsItem label={`商品${i + 1}`}>{item.product}</DescriptionsItem>
            <DescriptionsItem label="单价">¥{item.price}</DescriptionsItem>
            <DescriptionsItem label="数量">×{item.qty}</DescriptionsItem>
          </>)}
        </Descriptions>
      </div>
    ) : (
      <div style="padding: 10px 20px">
        <Descriptions column={2} border>
          <DescriptionsItem label="用户ID">{data.id}</DescriptionsItem>
          <DescriptionsItem label="姓名">{data.name}</DescriptionsItem>
          <DescriptionsItem label="邮箱" span={2}>{data.email}</DescriptionsItem>
          <DescriptionsItem label="角色">
            <Tag color={data.role === 'admin' ? 'error' : 'default'}>{data.role === 'admin' ? '管理员' : '普通用户'}</Tag>
          </DescriptionsItem>
          <DescriptionsItem label="部门">{data.department}</DescriptionsItem>
          <DescriptionsItem label="状态">
            <Tag color={data.status === 'active' ? 'success' : 'default'}>{data.status === 'active' ? '在职' : '离职'}</Tag>
          </DescriptionsItem>
          <DescriptionsItem label="最后登录">{data.lastLogin}</DescriptionsItem>
          <DescriptionsItem label="创建时间" span={2}>{data.createTime}</DescriptionsItem>
        </Descriptions>
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
