<template>
  <!-- 分组列处理 -->
  <el-table-column v-if="cols.groups && Array.isArray(cols.groups)" v-bind="columnbindAttr(cols)">
    <column-items v-for="(item, index) in cols.groups" :key="item.prop || item.key || index" :cols="{ ...item }">
      <!-- 作用域插槽传递 -->
      <template v-if="item.scopedSlots && item.scopedSlots.customRender" #[item.scopedSlots.customRender]="scopeData">
        <slot
          v-if="scopeData && scopeData.row"
          v-bind="{ ...item, row: scopeData.row, column: scopeData.column, scope: scopeData }"
          :name="item.scopedSlots.customRender"
        />
        <span v-else>-</span>
      </template>
    </column-items>
  </el-table-column>

  <!-- 自定义渲染函数列 -->
  <el-table-column v-else-if="cols.render && typeof cols.render === 'function'" v-bind="columnbindAttr(cols)">
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
  <el-table-column v-else-if="cols.scopedSlots && cols.scopedSlots.customRender" v-bind="columnbindAttr(cols)">
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
  <el-table-column v-else-if="cols.ellipsis && typeof cols.ellipsis === 'boolean'" show-overflow-tooltip v-bind="columnbindAttr(cols)" />

  <!-- 普通列 -->
  <el-table-column v-else v-bind="columnbindAttr(cols)" />
</template>

<script>
import { defineComponent, h } from 'vue'
import {ElTableColumn} from 'element-plus'

// 函数式组件定义
const RenderDomTb = (props, { slots, attrs, emit }) => {
  const { row, index, dataKey, render } = props
  
  // 安全检查：确保 row 存在
  if (!row) {
    console.warn('RenderDomTb: row is undefined')
    return h('span', '-')
  }
  
  const value = dataKey ? row[dataKey] : null

  // 调用 render 函数并传递 h 函数
  try {
  
    const renderResult = render(h, { value, row, index })

    // 处理字符串渲染
    if (typeof renderResult === 'string') {
      return h('span', renderResult)
    }

    return renderResult
  } catch (error) {
    console.error('RenderDomTb: Error in render function', error)
    return h('span', '-')
  }
}

RenderDomTb.props = {
  row: { type: Object, default: () => ({}) },
  index: { type: Number, default: 0 },
  dataKey: String,
  render: { type: Function, required: true }
}

export default defineComponent({
  name: 'ColumnItems',
  components: {
    RenderDomTb,
    ElTableColumn
  },
  props: {
    cols: {
      type: Object,
      default: () => ({})
    }
  },
  setup() {
    // 首字母大写转换
    const firstWordUpperCase = (str) => {
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
    }

    // 列属性绑定处理
    const columnbindAttr = (cols) => {
      const options = {}

      for (const t in cols) {
        // 跳过不需要处理的属性
        if (t === 'groups' || t === 'scopedSlots' || t === 'render') continue

        // 处理 kebab-case 属性名
        if (t.includes('-')) {
          const parts = t.split('-')
          let camelKey = parts[0]
          for (let i = 1; i < parts.length; i++) {
            camelKey += firstWordUpperCase(parts[i])
          }
          options[camelKey] = cols[t]
        }
        // 特殊处理 key 属性
        else if (t === 'key') {
          options.prop = cols[t]
          options[t] = cols[t]
        }
        // 普通属性直接赋值
        else {
          options[t] = cols[t]
        }
      }

      // 设置默认对齐方式
      if (!options.align) {
        options.align = 'center'
      }

      return options
    }

    return {
      columnbindAttr
    }
  }
})
</script>

<style scoped>
/* 添加一些基本样式 */
:deep(.el-table) {
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

:deep(.el-table__header) {
  /* background-color: #f5f7fa; */
  font-weight: 600;
}

:deep(.el-table__row) {
  transition: background-color 0.3s ease;
}

/* :deep(.el-table__row:hover) {
  background-color: #f5f7fa;
} */

/* 响应式调整 */
@media (max-width: 768px) {
  :deep(.el-table) {
    font-size: 14px;
  }

  :deep(.el-table__header th) {
    padding: 8px 0;
  }
}
</style>
