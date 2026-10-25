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
      <div class="dialog-advanced__body">
        <p>关闭后再点一次「缓存实例」，下面输入的内容还在——实例被 cacheKey 缓存住了（10 分钟未再打开才回收）。</p>
        <input
          class="dialog-advanced__input"
          placeholder="随便输入点什么，关闭再打开看看"
          value={text.value}
          onInput={(e) => { text.value = e.target.value }}
        />
        <p class="dialog-advanced__tip">当前输入：{text.value || '（空）'}</p>
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
      <div class="dialog-advanced__body">
        <p>拖拽标题栏可以移动弹窗位置</p>
        <p class="dialog-advanced__tip">释放后会记住当前位置</p>
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
      <div class="dialog-advanced__body">
        <p>弹窗内容区域，支持自定义头部和底部</p>
      </div>
    ),
    renderHeader: () => (
      <div class="dialog-advanced__header">
        <span class="dialog-advanced__header-title">自定义头部</span>
        <span class="dialog-advanced__badge">NEW</span>
      </div>
    ),
    renderFooter: () => (
      <div class="dialog-advanced__footer">
        <span class="dialog-advanced__footer-info">自定义底部信息</span>
        <div class="dialog-advanced__footer-actions">
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
      <div class="dialog-advanced__body">
        <h3>全屏模式</h3>
        <p class="dialog-advanced__muted">点击右上角按钮可切换全屏/窗口模式</p>
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
      <div class="dialog-advanced__body">
        <p>当内容超过 maxHeight 时会自动出现滚动条</p>
        {Array.from({ length: 10 }, (_, i) => (
          <p class="dialog-advanced__line">{`内容行 ${i + 1}`}</p>
        ))}
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

<!--
  为什么这里是**全局** `<style>` 而不是 `<style scoped>`：
  `render` / `renderHeader` / `renderFooter` 传的是**裸函数**，不是编译后的模板插槽
  （模板插槽会被 `withCtx` 包一层，渲染时仍带着所属组件的 scope id）。
  这些函数在弹窗宿主组件里被调用，再 Teleport 到 body —— vnode 上根本没有本文件的
  `data-v-xxx`，于是 `.dialog-advanced__body[data-v-xxx]` 这条规则永远匹配不上
  （实测：类名在 DOM 上，`padding` 却是 0）。
  代价是类名必须自己保证唯一，所以统一加 `dialog-advanced__` 前缀。
-->
<style>
.dialog-advanced__body {
  padding: 20px;
}

.dialog-advanced__input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  box-sizing: border-box;
}

.dialog-advanced__tip {
  margin-top: 10px;
  color: #909399;
}

.dialog-advanced__muted {
  color: #909399;
}

.dialog-advanced__line {
  margin-top: 10px;
}

.dialog-advanced__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 20px;
}

.dialog-advanced__header-title {
  font-size: 18px;
  font-weight: bold;
  color: #409eff;
}

.dialog-advanced__badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: #67c23a;
  background: #f0f9eb;
}

.dialog-advanced__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0 20px;
}

.dialog-advanced__footer-info {
  font-size: 12px;
  color: #909399;
}

.dialog-advanced__footer-actions {
  display: flex;
  gap: 12px;
}
</style>
