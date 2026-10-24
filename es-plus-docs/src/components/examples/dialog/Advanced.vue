<template>
  <div class="example-dialog-advanced">
    <el-button type="primary" @click="openDraggable">可拖拽弹窗</el-button>
    <el-button type="success" @click="openCustomHeaderFooter">自定义头尾</el-button>
    <el-button @click="openFullscreen">全屏弹窗</el-button>
    <el-button type="warning" @click="openMaxHeight">限高弹窗</el-button>
    <el-button type="info" @click="openCached">缓存实例（cacheKey）</el-button>
  </div>
</template>

<script setup lang="jsx">
import { defineComponent, ref } from 'vue'
import { ElMessage, ElButton } from 'element-plus'
import { useDialog } from '@es-plus/vue3'

const dialog = useDialog()

// 缓存实例的内联组件：text 是它自己的本地状态。
// 关掉弹窗不卸载实例，所以再打开时这里输入过的内容还在。
const DraftBox = defineComponent({
  setup() {
    const text = ref('')
    return () => (
      <div style="padding: 20px">
        <p>关闭后再点一次「缓存实例」，下面输入的内容还在——实例被 cacheKey 缓存住了（10 分钟未再打开才回收）。</p>
        <input
          style="width: 100%; padding: 6px 10px; border: 1px solid #dcdfe6; border-radius: 4px; box-sizing: border-box"
          placeholder="随便输入点什么，关闭再打开看看"
          value={text.value}
          onInput={(e) => { text.value = e.target.value }}
        />
        <p style="margin-top: 10px; color: #909399">当前输入：{text.value || '（空）'}</p>
      </div>
    )
  }
})

const openCached = () => {
  dialog({
    title: '缓存实例（cacheKey）',
    width: '480px',
    cacheKey: 'advanced-cache-demo',
    render: () => <DraftBox />,
    configBtn: [
      { name: '关闭', click: (_, { close }) => close() }
    ]
  })
}

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
  // renderFooter 的第二参只有 getRefs、拿不到 close，
  // 用 dialog() 的返回值捕获关闭句柄（回调执行时 instance 已赋值）
  let instance
  instance = dialog({
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
        <span style="font-size: 12px; color: #67c23a; background: #f0f9eb; padding: 2px 8px; border-radius: 4px">NEW</span>
      </div>
    ),
    renderFooter: () => (
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 0 20px; width: 100%">
        <span style="font-size: 12px; color: #909399">自定义底部信息</span>
        <div style="display: flex; gap: 12px">
          <ElButton onClick={() => instance?.close()}>取消</ElButton>
          <ElButton type="primary" onClick={() => { ElMessage.success('已确认'); instance?.close() }}>确认</ElButton>
        </div>
      </div>
    )
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
