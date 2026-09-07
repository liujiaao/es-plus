<template>
  <div>
    <el-button @click="openCustomStyle">自定义样式</el-button>
  </div>
</template>

<script>
import { useDialog } from '@es-plus/vue2'

export default {
  methods: {
    openCustomStyle() {
      const { close } = useDialog()({
        title: '自定义样式',
        customClass: 'custom-dialog',
        render: () => '这个弹窗有自定义样式'
      })
    }
  }
}
</script>

<!--
  注意：useDialog 创建的弹窗会挂载到 document.body，位于本组件 DOM 树之外，
  scoped 样式（编译为 .custom-dialog[data-v-xxx]）无法命中弹窗元素。
  customClass 指定的样式类必须写成「全局样式」（不加 scoped）才能生效。
-->
<style>
.custom-dialog {
  border-radius: 10px;
}
.custom-dialog .el-dialog__header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}
</style>
