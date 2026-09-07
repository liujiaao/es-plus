<template>
  <div>
    <el-button @click="openLifecycle">生命周期</el-button>
  </div>
</template>

<script>
import { useDialog } from '@es-plus/vue2'

export default {
  methods: {
    openLifecycle() {
      const { close } = useDialog()({
        title: '生命周期示例',
        render: () => '查看控制台输出',
        onOpen: () => {
          console.log('弹窗打开了')
        },
        onClosed: () => {
          console.log('弹窗关闭了')
        }
      })
    }
  }
}
</script>
