<template>
  <div class="example-dialog-confirm">
    <el-button type="danger" @click="confirmDelete">删除确认</el-button>
    <el-button type="warning" @click="confirmPublish">发布确认</el-button>
    <el-button @click="confirmLogout">退出登录</el-button>
  </div>
</template>

<script setup>
import { h } from 'vue'
import { ElMessage, ElIcon } from 'element-plus'
import { WarningFilled, CircleCheck, QuestionFilled } from '@element-plus/icons-vue'
import { useDialog } from 'es-plus'

const dialog = useDialog()

const confirmDelete = () => {
  dialog({
    title: '确认删除',
    width: '400px',
    render: () => h('div', { style: 'display: flex; align-items: center; padding: 20px' }, [
      h(ElIcon, { size: 40, color: '#f56c6c', style: 'margin-right: 16px' }, () => h(WarningFilled)),
      h('div', [
        h('p', { style: 'font-size: 16px; margin-bottom: 8px' }, '确定要删除这条数据吗？'),
        h('p', { style: 'color: #909399; font-size: 14px' }, '删除后数据将无法恢复，请谨慎操作。')
      ])
    ]),
    configBtn: [
      { name: '取消', click: (currentRef, { close }) => close() },
      { name: '确定删除', type: 'danger', click: (currentRef, { close }) => {
        ElMessage.success('删除成功')
        close()
      }}
    ],
  })
}

const confirmPublish = () => {
  dialog({
    title: '确认发布',
    width: '400px',
    render: () => h('div', { style: 'display: flex; align-items: center; padding: 20px' }, [
      h(ElIcon, { size: 40, color: '#e6a23c', style: 'margin-right: 16px' }, () => h(CircleCheck)),
      h('div', [
        h('p', { style: 'font-size: 16px; margin-bottom: 8px' }, '确定要发布这篇文章吗？'),
        h('p', { style: 'color: #909399; font-size: 14px' }, '发布后将对所有用户可见。')
      ])
    ]),
    configBtn: [
      { name: '取消', click: (currentRef, { close }) => close() },
      { name: '立即发布', type: 'warning', click: (currentRef, { close }) => {
        ElMessage.success('发布成功')
        close()
      }}
    ],
  })
}

const confirmLogout = () => {
  dialog({
    title: '退出确认',
    width: '400px',
    render: () => h('div', { style: 'display: flex; align-items: center; padding: 20px' }, [
      h(ElIcon, { size: 40, color: '#909399', style: 'margin-right: 16px' }, () => h(QuestionFilled)),
      h('div', [
        h('p', { style: 'font-size: 16px' }, '确定要退出登录吗？')
      ])
    ]),
    configBtn: [
      { name: '取消', click: (currentRef, { close }) => close() },
      { name: '确定退出', type: 'primary', click: (currentRef, { close }) => {
        ElMessage.success('已退出登录')
        close()
      }}
    ],
  })
}
</script>

<style scoped>
.example-dialog-confirm {
  padding: 20px;
  display: flex;
  gap: 12px;
}
</style>
