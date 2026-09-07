<template>
  <div>
    <el-button @click="openDialog">打开弹窗</el-button>
  </div>
</template>

<script>
import { useDialog } from '@es-plus/vue2'

export default {
  methods: {
    openDialog() {
      const { close } = useDialog()({
        title: '基础弹窗',
        render: () => '这是一个基础弹窗'
      })
    }
  }
}
</script>
