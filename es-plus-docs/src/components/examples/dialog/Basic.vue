<template>
  <div class="example-dialog-basic">
    <el-button type="primary" @click="openDialog">打开基础弹窗</el-button>
    <el-button @click="openWithContent">带内容弹窗</el-button>
    <el-button @click="openScrollable">限高滚动弹窗</el-button>
  </div>
</template>

<script setup>
import { h } from 'vue'
import { ElMessage, ElButton } from 'element-plus'
import { useDialog } from '@es-plus/vue3'

const dialog = useDialog()

const openDialog = () => {
  dialog({
    title: '基础弹窗',
    width: '400px',
    render: () => h('div', { style: 'padding: 20px; text-align: center' }, '这是一个基础弹窗内容'),
    // 确认逻辑挂在按钮自己的 click 上：底部按钮只在 configBtn 非空时渲染，没有单独的提交钩子。
    configBtn: [
      { name: '取消', click: (_, { close }) => close() },
      {
        name: '确定',
        type: 'primary',
        click: (_, { close }) => {
          ElMessage.success('点击了确认')
          close()
        }
      }
    ]
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
    configBtn: [
      { name: '取消', click: (_, { close }) => close() },
      {
        name: '确定',
        type: 'primary',
        click: (_, { close }) => {
          ElMessage.info('点击了确认')
          close()
        }
      }
    ]
  })
}

const openScrollable = () => {
  dialog({
    title: '限高滚动',
    width: '480px',
    // maxHeight：内容超过该高度时弹窗体内部滚动，而不是把页面撑长
    maxHeight: '240px',
    render: () =>
      h(
        'div',
        { style: 'padding: 10px' },
        Array.from({ length: 30 }, (_, i) =>
          h('p', { style: 'margin: 6px 0' }, `第 ${i + 1} 行：内容超出 maxHeight 时弹窗内部滚动`)
        )
      ),
    configBtn: [{ name: '知道了', type: 'primary', click: (_, { close }) => close() }]
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
