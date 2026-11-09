<template>
  <div class="example-locale-hot-switch">
    <div class="locale-bar">
      <span class="locale-label">内置文案语言</span>
      <el-radio-group v-model="locale" size="small" @change="applyLocale">
        <el-radio-button value="zh-CN">
          简体中文
        </el-radio-button>
        <el-radio-button value="en-US">
          English
        </el-radio-button>
      </el-radio-group>
    </div>

    <p class="locale-hint">
      下表只看空态文案 —— 它由库内置字典提供（不是 <code>options.emptyText</code>）。
      切换语言后<strong>已挂载</strong>的表格直接换文案，没有重新挂载、没有刷新页面。
    </p>

    <es-table
      :data-source="[]"
      :columns="columns"
      :options="{ border: true }"
    />

    <p class="locale-hint">
      业务文案不在这里：字段/列上的 <code>label</code> 是配置值，<code>labelKey</code> 才走宿主的
      <code>t()</code>；本示例演示的是「库自己产生的文案」（空态、加载中、自动派生的按钮名、
      操作列标题、删除确认等）。
    </p>
  </div>
</template>

<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { configureEsPlus } from '@es-plus/vue3'

const locale = ref('zh-CN')

// 列名是业务配置，不随库语言变化；本示例刻意只留一列，让空态成为主角。
const columns = [{ prop: 'orderNo', label: '订单号', minWidth: 160 }]

/**
 * 热切换：`configureEsPlus` 就是安装时用的同一个入口，因此
 * `app.use(ESPlus, { locale })` 与运行期再调一次**等价**。
 * 组件从包内 locale 桥读文案，会在这里之后重算。
 */
const applyLocale = (value) => configureEsPlus({ locale: value })

// 示例是全局共享的应用配置：离开时恢复库默认，避免影响别的示例。
onBeforeUnmount(() => configureEsPlus({ locale: 'zh-CN' }))
</script>

<style scoped>
.example-locale-hot-switch {
  padding: 0;
}

.locale-bar {
  display: flex;
  align-items: center;
  gap: var(--es-space-3);
  margin-bottom: var(--es-space-3);
}

.locale-label {
  font-size: var(--es-text-sm);
  font-weight: 600;
  color: var(--es-text-secondary);
}

.locale-hint {
  margin: 0 0 var(--es-space-3);
  font-size: var(--es-text-xs);
  line-height: 1.6;
  color: var(--es-text-secondary);
}

.locale-hint + :deep(.es-table) {
  margin-bottom: var(--es-space-3);
}
</style>
