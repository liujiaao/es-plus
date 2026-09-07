<template>
  <div>
    <el-button @click="openDraggable">可拖拽弹窗</el-button>
  </div>
</template>

<script>
import { useDialog } from '@es-plus/vue2'

export default {
  methods: {
    openDraggable() {
      const { close } = useDialog()({
        title: '可拖拽弹窗',
        isDraggable: true,
        render: () => '这个弹窗可以拖拽移动'
      })
    }
  }
}
</script>
