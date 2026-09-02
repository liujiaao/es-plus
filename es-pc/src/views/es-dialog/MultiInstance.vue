<template>
  <div class="example-dialog-multi-instance">
    <a-button type="primary" @click="openUserDetail(1)">查看用户 A</a-button>
    <a-button type="success" @click="openUserDetail(2)">查看用户 B</a-button>
    <a-button type="warning" @click="openUserDetail(3)">查看用户 C</a-button>
  </div>
</template>

<script setup lang="jsx">
import { message, Descriptions, Tag } from 'ant-design-vue'
import { useDialog } from '@es-plus/adapter-antdv'

const DescriptionsItem = Descriptions.Item

const users = {
  1: { id: 1, name: '张三', role: 'admin', dept: '技术部', status: 'active', email: 'zhangsan@example.com' },
  2: { id: 2, name: '李四', role: 'user', dept: '产品部', status: 'active', email: 'lisi@example.com' },
  3: { id: 3, name: '王五', role: 'user', dept: '设计部', status: 'inactive', email: 'wangwu@example.com' }
}

// onlyInstance: true — 每个调用创建独立弹窗实例，可同时打开多个
const detailDialog = useDialog(null, { onlyInstance: false })

const openUserDetail = (userId) => {
  const user = users[userId]

  detailDialog({
    title: `用户详情 — ${user.name}`,
    width: '500px',
    isDraggable: true,
    render: () => (
      <div style="padding: 10px 20px">
        <Descriptions column={1} border>
          <DescriptionsItem label="用户ID">{user.id}</DescriptionsItem>
          <DescriptionsItem label="姓名">{user.name}</DescriptionsItem>
          <DescriptionsItem label="角色">
            <Tag color={user.role === 'admin' ? 'error' : 'default'}>{user.role === 'admin' ? '管理员' : '普通用户'}</Tag>
          </DescriptionsItem>
          <DescriptionsItem label="部门">{user.dept}</DescriptionsItem>
          <DescriptionsItem label="状态">
            <Tag color={user.status === 'active' ? 'success' : 'default'}>{user.status === 'active' ? '在职' : '离职'}</Tag>
          </DescriptionsItem>
          <DescriptionsItem label="邮箱">{user.email}</DescriptionsItem>
        </Descriptions>
      </div>
    ),
    configBtn: [
      { name: '关闭', click: (_, { close }) => close() },
      {
        name: '编辑',
        type: 'primary',
        icon: 'Edit',
        click: (_, { close }) => {
          message.success(`打开编辑: ${user.name}`)
          close()
        }
      }
    ]
  })
}
</script>

<style scoped>
.example-dialog-multi-instance {
  padding: 20px;
  display: flex;
  gap: 12px;
}
</style>
