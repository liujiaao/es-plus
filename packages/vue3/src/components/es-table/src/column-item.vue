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
          :name="item.scopedSlots!.customRender"
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
        :data-key="cols.prop || cols.key"
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

  <!-- 行展开列（AI-09 子项②）：展开内容来自列上的声明式 expandConfig 字段明细 -->
  <el-table-column v-else-if="cols.type === 'expand'" v-bind="columnBindAttr(cols)">
    <template v-if="cols.expandConfig" #default="scope">
      <div class="es-expand-content">
        <div v-if="cols.expandConfig.title" class="es-expand-title">{{ cols.expandConfig.title }}</div>
        <div v-for="f in cols.expandConfig.fields" :key="f.prop" class="es-expand-field">
          <span class="es-expand-label">{{ fieldLabel(f) }}</span>
          <span class="es-expand-value">{{ cellValue(scope && scope.row, f.prop) }}</span>
        </div>
      </div>
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

const esPlus = inject<Record<string, unknown> | null>('$EsPlus', null) as Record<string, unknown> ?? getGlobalConfig() ?? {}

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
    if (t === 'groups' || t === 'scopedSlots' || t === 'render' || t === 'expandConfig') continue

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

  // AN-10：契约键 `ellipsis` → el-table 原生 `show-overflow-tooltip`。
  // 放在这里而不是只放在下面的 ellipsis 分支：`render`/`scopedSlots`/`groups` 分支各自
  // 直接 `v-bind="columnBindAttr(...)"`，只有这一处能把省略号带给**所有**渲染分支。
  // 同时保留 `showOverflowTooltip` 原样透传（存量配置/显式列仍可能写它）。
  if (cols.ellipsis === true && !options.showOverflowTooltip) {
    options.showOverflowTooltip = true
  }

  return options
}

/**
 * 行展开字段明细（AI-09 子项②）—— 展开行内的只读「标签: 值」。
 * 标签走 `labelKey` + 全局 t()（缺省回退 label，再回退 prop）；值取 `row[prop]`，
 * 空值统一显示 '-'（与单元格 formatter 的 emptyPlaceholder 语义一致）。
 */
const fieldLabel = (f: { prop: string; label?: string; labelKey?: string }): string => {
  if (f.labelKey && typeof esPlus.t === 'function') return (esPlus.t as (k: string) => string)(f.labelKey)
  return f.label || f.prop
}

const cellValue = (row: Record<string, unknown> | undefined, prop: string): unknown => {
  const v = row ? row[prop] : undefined
  return v == null || v === '' ? '-' : v
}
</script>
