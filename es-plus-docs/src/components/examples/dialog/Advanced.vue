<template>
  <div class="example-dialog-advanced">
    <el-button type="primary" @click="openDraggable">可拖拽弹窗</el-button>
    <el-button type="success" @click="openCustomHeaderFooter">自定义头尾</el-button>
    <el-button @click="openFullscreen">全屏弹窗</el-button>
    <el-button type="warning" @click="openMaxHeight">限高弹窗</el-button>
  </div>
</template>

<script setup lang="jsx">
import { ElMessage, ElButton } from 'element-plus'
import { useDialog } from 'es-plus'

const dialog = useDialog()

const openDraggable = () => {
  dialog({
    title: '可拖拽弹窗',
    width: '600px',
    isDraggable: true,
    render: () => (
      <div style="padding: 20px">
        <p>拖拽标题栏可以移动弹窗位置</p>
        <p style="color: #909399; margin-top: 10px">释放后会记住当前位置</p>
      </div>
    ),
    configBtn: [
      { name: '关闭', click: (_, { close }) => close() }
    ]
  })
}

const openCustomHeaderFooter = () => {
  dialog({
    title: '自定义头尾',
    width: '700px',
    render: () => (
      <div style="padding: 20px">
        <p>弹窗内容区域，支持自定义头部和底部</p>
      </div>
    ),
    renderHeader: () => (
      <div style="display: flex; align-items: center; gap: 8px; padding: 0 20px">
        <span style="font-size: 18px; font-weight: bold; color: #409EFF">自定义头部</span>
        <span style="font-size: 12px; color: #909399; background: #f0f9eb; padding: 2px 8px; border-radius: 4px">NEW</span>
      </div>
    ),
    renderFooter: () => (
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 0 20px; width: 100%">
        <span style="font-size: 12px; color: #909399">自定义底部信息</span>
        <div style="display: flex; gap: 12px">
          <ElButton onClick={() => ElMessage.info('点击了取消')}>取消</ElButton>
          <ElButton type="primary" onClick={() => ElMessage.success('点击了确认')}>确认</ElButton>
        </div>
      </div>
    ),
    isHiddenFooter: true
  })
}

const openFullscreen = () => {
  dialog({
    title: '全屏弹窗',
    fullscreen: true,
    hiddenFullBtn: false,
    render: () => (
      <div style="padding: 20px">
        <h3>全屏模式</h3>
        <p style="color: #909399">点击右上角按钮可切换全屏/窗口模式</p>
      </div>
    ),
    configBtn: [
      { name: '关闭', click: (_, { close }) => close() }
    ]
  })
}

const openMaxHeight = () => {
  dialog({
    title: '限高弹窗',
    width: '600px',
    maxHeight: '300px',
    render: () => (
      <div style="padding: 20px">
        <p>当内容超过 maxHeight 时会自动出现滚动条</p>
        <p style="margin-top: 10px">内容行 1</p>
        <p style="margin-top: 10px">内容行 2</p>
        <p style="margin-top: 10px">内容行 3</p>
        <p style="margin-top: 10px">内容行 4</p>
        <p style="margin-top: 10px">内容行 5</p>
        <p style="margin-top: 10px">内容行 6</p>
        <p style="margin-top: 10px">内容行 7</p>
        <p style="margin-top: 10px">内容行 8</p>
        <p style="margin-top: 10px">内容行 9</p>
        <p style="margin-top: 10px">内容行 10</p>
      </div>
    ),
    configBtn: [
      { name: '关闭', click: (_, { close }) => close() }
    ]
  })
}
</script>

<style scoped>
.example-dialog-advanced {
  padding: 20px;
  display: flex;
  gap: 12px;
}
</style>
