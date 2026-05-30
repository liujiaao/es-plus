<template>
  <!-- 分组列处理 -->
  <el-table-column v-if="cols.groups && Array.isArray(cols.groups)" v-bind="columnBindAttr(cols)">
    <el-table-column
      v-for="(item, index) in cols.groups"
      :key="item.prop || item.key || index"
      v-bind="columnBindAttr({ ...item, columnIndex: index })"
    >
      <template v-if="item.render && typeof item.render === 'function'" #default="scope">
        <render-dom-tb
          v-if="scope && scope.row"
          :row="scope.row"
          :index="scope.$index"
          :data-key="item.key"
          :render="item.render"
        />
        <span v-else>-</span>
      </template>
      <template v-else-if="item.scopedSlots && item.scopedSlots.customRender" #default="scope">
        <slot
          v-if="scope && scope.row"
          v-bind="{ ...item, row: scope.row, column: scope.column, scope: scope }"
          :name="item.scopedSlots.customRender"
        />
        <span v-else>-</span>
      </template>
    </el-table-column>
  </el-table-column>

  <!-- 自定义渲染函数列 -->
  <el-table-column v-else-if="cols.render && typeof cols.render === 'function'" v-bind="columnBindAttr(cols)">
    <template #default="scope">
      <render-dom-tb
        v-if="scope && scope.row"
        :row="scope.row"
        :index="scope.$index"
        :data-key="cols.key"
        :render="cols.render"
      />
      <span v-else>-</span>
    </template>
  </el-table-column>

  <!-- 作用域插槽列 -->
  <el-table-column v-else-if="cols.scopedSlots && cols.scopedSlots.customRender" v-bind="columnBindAttr(cols)">
    <template #default="scope">
      <slot
        v-if="scope && scope.row"
        v-bind="{ ...cols, row: scope.row, column: scope.column, scope: scope }"
        :name="cols.scopedSlots.customRender"
      />
      <span v-else>-</span>
    </template>
  </el-table-column>

  <!-- 省略号工具提示列 -->
  <el-table-column v-else-if="cols.ellipsis && typeof cols.ellipsis === 'boolean'" show-overflow-tooltip v-bind="columnBindAttr(cols)" />

  <!-- 普通列 -->
  <el-table-column v-else v-bind="columnBindAttr(cols)" />
</template>

<script setup lang="ts">
import { h, defineComponent, inject } from 'vue'
import { ElTableColumn } from 'element-plus'
import { getGlobalConfig } from '../../../config'
import type { TableColumn } from '../../../types'

const props = defineProps<{
  cols: TableColumn
}>()

const esPlus = inject<Record<string, unknown>>('$EsPlus', null) ?? getGlobalConfig() ?? {}

// 函数式组件定义
const RenderDomTb = defineComponent({
  props: {
    row: { type: Object, default: () => ({}) },
    index: { type: Number, default: 0 },
    dataKey: String,
    render: { type: Function, required: true }
  },
  setup(props) {
    return () => {
      const { row, index, dataKey, render } = props
      if (!row) return h('span', '-')
      const value = dataKey ? row[dataKey] : null
      try {
        const renderResult = render(h, { value, row, index })
        if (typeof renderResult === 'string') return h('span', renderResult)
        return renderResult
      } catch (error) {
        return h('span', '-')
      }
    }
  }
})

const firstWordUpperCase = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

const columnBindAttr = (cols: TableColumn) => {
  const options: Record<string, unknown> = {}

  for (const t in cols) {
    if (t === 'groups' || t === 'scopedSlots' || t === 'render') continue

    if (t.includes('-')) {
      const parts = t.split('-')
      let camelKey = parts[0]
      for (let i = 1; i < parts.length; i++) {
        camelKey += firstWordUpperCase(parts[i])
      }
      options[camelKey] = cols[t]
    } else if (t === 'key') {
      options.prop = cols[t]
      options[t] = cols[t]
    } else if (t === 'label' && cols.labelKey && typeof esPlus.t === 'function') {
      options.label = (esPlus.t as (k: string) => string)(cols.labelKey)
    } else {
      options[t] = cols[t]
    }
  }

  if (!options.align) {
    options.align = 'center'
  }

  return options
}
</script>
