<template>
  <div class="example-dialog-basic">
    <el-button type="primary" @click="openDialog">打开基础弹窗</el-button>
    <el-button @click="openWithContent">带内容弹窗</el-button>
  </div>
</template>

<script setup>
import { h } from 'vue'
import { ElMessage, ElButton } from 'element-plus'
import { useDialog } from 'es-plus'

const dialog = useDialog()

const openDialog = () => {
  dialog({
    title: '基础弹窗',
    width: '400px',
    render: () => h('div', { style: 'padding: 20px; text-align: center' }, '这是一个基础弹窗内容'),
    onSubmit: (close) => {
      ElMessage.success('点击了确认')
      close()
    }
  })
}

const openWithContent = () => {
  dialog({
    title: '信息提示',
    width: '450px',
    render: () => h('div', { style: 'padding: 10px' }, [
      h('p', '这是一条重要的信息提示。'),
      h('p', { style: 'color: #909399; font-size: 14px; marginTop: 10px' }, '您可以在弹窗中放置任何内容。')
    ]),
    onSubmit: (close) => {
      ElMessage.info('点击了确认')
      close()
    }
  })
}
</script>

<style scoped>
.example-dialog-basic {
  padding: 20px;
  display: flex;
  gap: 12px;
}
</style>
