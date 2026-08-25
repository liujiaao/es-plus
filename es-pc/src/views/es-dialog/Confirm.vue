<template>
  <div class="example-dialog-confirm">
    <a-button type="primary" danger @click="confirmDelete">删除确认</a-button>
    <a-button type="primary" @click="confirmPublish">发布确认</a-button>
    <a-button @click="confirmLogout">退出登录</a-button>
  </div>
</template>

<script setup>
import { h } from 'vue'
import { message } from 'ant-design-vue'
import { WarningFilled, CheckCircleFilled, QuestionCircleFilled } from '@ant-design/icons-vue'
import { useDialog } from '@es-plus/adapter-antdv'

const dialog = useDialog()

const confirmDelete = () => {
  dialog({
    title: '确认删除',
    width: '400px',
    render: () => h('div', { style: 'display: flex; align-items: center; padding: 20px' }, [
      h(WarningFilled, { style: { fontSize: '40px', color: '#f56c6c', marginRight: '16px' } }),
      h('div', [
        h('p', { style: 'font-size: 16px; margin-bottom: 8px' }, '确定要删除这条数据吗？'),
        h('p', { style: 'color: #909399; font-size: 14px' }, '删除后数据将无法恢复，请谨慎操作。')
      ])
    ]),
    configBtn: [
      { name: '取消', click: (currentRef, { close }) => close() },
      { name: '确定删除', type: 'danger', click: (currentRef, { close }) => {
        message.success('删除成功')
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
      h(CheckCircleFilled, { style: { fontSize: '40px', color: '#e6a23c', marginRight: '16px' } }),
      h('div', [
        h('p', { style: 'font-size: 16px; margin-bottom: 8px' }, '确定要发布这篇文章吗？'),
        h('p', { style: 'color: #909399; font-size: 14px' }, '发布后将对所有用户可见。')
      ])
    ]),
    configBtn: [
      { name: '取消', click: (currentRef, { close }) => close() },
      { name: '立即发布', type: 'primary', click: (currentRef, { close }) => {
        message.success('发布成功')
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
      h(QuestionCircleFilled, { style: { fontSize: '40px', color: '#909399', marginRight: '16px' } }),
      h('div', [
        h('p', { style: 'font-size: 16px' }, '确定要退出登录吗？')
      ])
    ]),
    configBtn: [
      { name: '取消', click: (currentRef, { close }) => close() },
      { name: '确定退出', type: 'primary', click: (currentRef, { close }) => {
        message.success('已退出登录')
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
