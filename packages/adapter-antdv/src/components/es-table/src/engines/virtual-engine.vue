<!--
  ADV 适配器：虚拟滚动引擎（降级为内置 virtual 模式）

  ADV 4.x 的 a-table 原生支持 virtual 滚动（:virtual="true"），
  不需要像 Element Plus 那样使用独立的 el-table-v2 组件。

  此文件保留用作兼容占位 — 实际的 virtual 滚动通过 component.vue 中的
  a-table 的 scroll.y + virtual 属性实现。
-->
<template>
  <a-table
    ref="virtualTableRef"
    :columns="adaptedColumns"
    :dataSource="dataSource"
    :pagination="false"
    :scroll="{ y: tableHeight, x: 'max-content' }"
    :virtual="true"
    :rowKey="(options.rowkey as string) || 'id'"
    :rowHeight="options.rowHeight || 50"
    v-bind="$attrs"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Table as ATable } from 'ant-design-vue'
import { adaptColumn } from '../column-item.vue'
import type { TableColumn, TableOptions } from '../../../../types'

const props = defineProps<{
  columns: TableColumn[]
  dataSource: Record<string, unknown>[]
  tableHeight: number
  options: TableOptions
  parentSlots?: Record<string, Function>
}>()

const adaptedColumns = computed(() =>
  props.columns.map((col) => adaptColumn(col))
)
</script>
