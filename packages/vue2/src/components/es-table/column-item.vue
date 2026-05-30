<template>
  <!-- 分组列处理 -->
  <el-table-column
    v-if="cols.groups && Array.isArray(cols.groups)"
    v-bind="columnBindAttr(cols)"
  >
    <el-table-column
      v-for="(item, index) in cols.groups"
      :key="item.prop || item.key || index"
      v-bind="columnBindAttr(Object.assign({}, item, { columnIndex: index }))"
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
          v-bind="Object.assign({}, item, { row: scope.row, column: scope.column, scope: scope })"
          :name="item.scopedSlots.customRender"
        />
        <span v-else>-</span>
      </template>
    </el-table-column>
  </el-table-column>

  <!-- 自定义渲染函数列 -->
  <el-table-column
    v-else-if="cols.render && typeof cols.render === 'function'"
    v-bind="columnBindAttr(cols)"
  >
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
  <el-table-column
    v-else-if="cols.scopedSlots && cols.scopedSlots.customRender"
    v-bind="columnBindAttr(cols)"
  >
    <template #default="scope">
      <slot
        v-if="scope && scope.row"
        v-bind="Object.assign({}, cols, { row: scope.row, column: scope.column, scope: scope })"
        :name="cols.scopedSlots.customRender"
      />
      <span v-else>-</span>
    </template>
  </el-table-column>

  <!-- 省略号工具提示列 -->
  <el-table-column
    v-else-if="cols.ellipsis && typeof cols.ellipsis === 'boolean'"
    show-overflow-tooltip
    v-bind="columnBindAttr(cols)"
  />

  <!-- 普通列 -->
  <el-table-column v-else v-bind="columnBindAttr(cols)" />
</template>

<script lang="ts">
/**
 * EsTable 列递归渲染组件 —— Vue 2 版本
 *
 * 与 Vue 3 版本的差异：
 *   - 不使用 <script setup>，改为 defineComponent + setup()
 *   - h 来自 './vue-compat'（实际是 Vue 2 的 createElement）
 *   - inject 来自 @vue/composition-api，签名一致
 *   - el-table-column 在 Element UI 与 Element Plus 中 API 基本一致
 *
 * 列配置约定：
 *   - cols.groups: 嵌套表头（多级表头）
 *   - cols.render: 自定义渲染函数 (h, { value, row, index }) => VNode
 *   - cols.scopedSlots.customRender: 作用域插槽名称
 *   - cols.ellipsis: 文字超出时显示 tooltip
 *   - cols.key: 数据字段（自动映射为 prop）
 *   - cols.labelKey: 国际化 label 键
 */

import { h, defineComponent, inject } from '../../vue-compat'
import { getGlobalConfig } from '@es-plus/core'
import type { TableColumn } from '../../types'

// 函数式 render 包装组件 —— 把用户传入的 render(h, ctx) 渲染为 VNode
const RenderDomTb = defineComponent({
  name: 'RenderDomTb',
  props: {
    row: { type: Object, default: () => ({}) },
    index: { type: Number, default: 0 },
    dataKey: String,
    render: { type: Function, required: true },
  },
  setup(props: any) {
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
  },
})

const firstWordUpperCase = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

export default defineComponent({
  name: 'EsTableColumnItem',
  components: { RenderDomTb },
  props: {
    cols: {
      type: Object as () => TableColumn,
      required: true,
    },
  },
  setup() {
    // 注入全局 EsPlus 配置（含 i18n t 函数）
    const esPlus =
      inject<Record<string, unknown>>('$EsPlus', null as unknown as Record<string, unknown>) ??
      (getGlobalConfig() as Record<string, unknown>) ??
      {}

    /**
     * 把用户写的列配置规范化为 el-table-column 的 props
     * - 跳过 groups/scopedSlots/render（它们走单独的渲染路径）
     * - 中划线属性自动转驼峰（如 'show-overflow-tooltip' → 'showOverflowTooltip'）
     * - key → prop 双向映射
     * - labelKey + 全局 t 函数 → 国际化 label
     * - 默认 align: center（与 Vue 3 版本保持一致）
     */
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
          options[camelKey] = (cols as Record<string, unknown>)[t]
        } else if (t === 'key') {
          options.prop = (cols as Record<string, unknown>)[t]
          options[t] = (cols as Record<string, unknown>)[t]
        } else if (t === 'label' && cols.labelKey && typeof esPlus.t === 'function') {
          options.label = (esPlus.t as (k: string) => string)(cols.labelKey as string)
        } else {
          options[t] = (cols as Record<string, unknown>)[t]
        }
      }

      if (!options.align) {
        options.align = 'center'
      }

      return options
    }

    return {
      columnBindAttr,
    }
  },
})
</script>
