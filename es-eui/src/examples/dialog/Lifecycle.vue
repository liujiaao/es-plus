<template>
  <div>
    <el-button @click="openLifecycle">生命周期</el-button>
    <p class="lifecycle-tip">
      打开 {{ openCount }} 次 / 关闭 {{ closeCount }} 次<span v-if="lastEvent">，最近：{{ lastEvent }}</span>
    </p>
  </div>
</template>

<script>
import { useDialog } from '@es-plus/vue2'

export default {
  data() {
    return { openCount: 0, closeCount: 0, lastEvent: '' }
  },
  methods: {
    openLifecycle() {
      useDialog()({
        title: '生命周期示例',
        // 回调把次数与时刻写到页面上，不用开控制台也能看到
        render: () => `这是第 ${this.openCount + 1} 次打开；关闭后页面上的计数会更新`,
        onOpen: () => {
          this.openCount++
          this.lastEvent = `onOpen @ ${new Date().toLocaleTimeString()}`
        },
        onClosed: () => {
          this.closeCount++
          this.lastEvent = `onClosed @ ${new Date().toLocaleTimeString()}`
        }
      })
    }
  }
}
</script>

<style scoped>
.lifecycle-tip {
  margin-top: 10px;
  color: #606266;
  font-size: 13px;
}
</style>
