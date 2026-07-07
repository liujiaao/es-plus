<!--
  ADV 适配器：列渲染占位组件

  ADV 的 a-table 不使用独立的列组件（列通过 columns 配置 + bodyCell 插槽渲染）。
  此文件保留为兼容占位，实际的列配置转换逻辑在 column-adapter.ts 中。
-->
<template>
  <slot />
</template>

<script setup lang="ts">
import type { TableColumn } from '../../../types'

defineProps<{
  cols: TableColumn
}>()
</script>
