<template>
  <div class="example-dialog-multi-instance">
    <el-button type="primary" @click="openUserDetail(1)">查看用户 A</el-button>
    <el-button type="success" @click="openUserDetail(2)">查看用户 B</el-button>
    <el-button type="warning" @click="openUserDetail(3)">查看用户 C</el-button>
  </div>
</template>

<script setup lang="jsx">
import { ElDescriptions, ElDescriptionsItem, ElTag, ElMessage } from 'element-plus'
import { useDialog } from 'es-plus'

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
        <ElDescriptions column={1} border>
          <ElDescriptionsItem label="用户ID">{user.id}</ElDescriptionsItem>
          <ElDescriptionsItem label="姓名">{user.name}</ElDescriptionsItem>
          <ElDescriptionsItem label="角色">
            <ElTag type={user.role === 'admin' ? 'danger' : ''} size="small">{user.role === 'admin' ? '管理员' : '普通用户'}</ElTag>
          </ElDescriptionsItem>
          <ElDescriptionsItem label="部门">{user.dept}</ElDescriptionsItem>
          <ElDescriptionsItem label="状态">
            <ElTag type={user.status === 'active' ? 'success' : 'info'} size="small">{user.status === 'active' ? '在职' : '离职'}</ElTag>
          </ElDescriptionsItem>
          <ElDescriptionsItem label="邮箱">{user.email}</ElDescriptionsItem>
        </ElDescriptions>
      </div>
    ),
    configBtn: [
      { name: '关闭', click: (_, { close }) => close() },
      {
        name: '编辑',
        type: 'primary',
        icon: 'Edit',
        click: (_, { close }) => {
          ElMessage.success(`打开编辑: ${user.name}`)
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
