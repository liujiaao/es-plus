<template>
  <div>
    <el-button @click="openFullscreen">全屏弹窗</el-button>
  </div>
</template>

<script>
import { useDialog } from '@es-plus/vue2'

export default {
  methods: {
    openFullscreen() {
      const { close } = useDialog()({
        title: '全屏弹窗',
        fullscreen: true,
        render: () => '这是一个全屏弹窗'
      })
    }
  }
}
</script>
