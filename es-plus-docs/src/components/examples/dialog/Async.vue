<template>
  <div class="example-dialog-async">
    <el-button type="primary" @click="openAsync">异步加载弹窗</el-button>
  </div>
</template>

<script setup>
import { h, defineAsyncComponent } from 'vue'
import { ElLoading } from 'element-plus'
import { useDialog } from 'es-plus'

const dialog = useDialog()

// 模拟异步组件
const AsyncContent = defineAsyncComponent({
  loader: () => new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        render() {
          return h('div', { style: 'padding: 20px' }, [
            h('h3', '异步加载的内容'),
            h('p', '这是一个通过异步方式加载的组件内容')
          ])
        }
      })
    }, 1000)
  }),
  loadingComponent: {
    render() {
      return h('div', { style: 'padding: 40px; text-align: center' }, '加载中...')
    }
  },
  errorComponent: {
    render() {
      return h('div', { style: 'padding: 40px; text-align: center; color: #f56c6c' }, '加载失败，请重试')
    }
  }
})

const openAsync = () => {
  dialog({
    title: '异步加载弹窗',
    width: '500px',
    render: () => h(AsyncContent),
    configBtn: [
      { name: '关闭', click: (currentRef, { close }) => close() }
    ]
  })
}
</script>

<style scoped>
.example-dialog-async {
  padding: 20px;
}
</style>
