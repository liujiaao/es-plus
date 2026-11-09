<template>
  <div class="example-table-locale-hot-switch">
    <div class="locale-bar">
      <span class="locale-label">内置文案语言</span>
      <a-radio-group v-model:value="locale" size="small" @change="applyLocale">
        <a-radio-button value="zh-CN">
          简体中文
        </a-radio-button>
        <a-radio-button value="en-US">
          English
        </a-radio-button>
      </a-radio-group>
    </div>

    <p class="locale-hint">
      空态文案由库内置字典提供（不是 <code>options.emptyText</code>）。
      切换后<strong>已挂载</strong>的表格直接换文案 —— 没有重新挂载、没有刷新页面。
    </p>

    <es-table
      :data-source="[]"
      :columns="columns"
      :options="{ border: true }"
    />

    <p class="locale-hint">
      <code>label</code> 是业务配置，不随库语言变化；本示例演示的是库自己产生的文案
      （空态、加载中、自动派生的按钮名、操作列标题、删除确认等），由
      <code>configureEsPlus({ locale })</code> 控制。
    </p>
  </div>
</template>

<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { EsTable, configureEsPlus } from '@es-plus/adapter-antdv'

const locale = ref('zh-CN')

// 列名是业务配置；表格留空是为了让「空态」成为唯一可见的内置文案。
const columns = [{ prop: 'orderNo', label: '订单号', minWidth: 160 }]

// 运行期热切换：与 app.use(ESPlus, { locale }) 写的是同一个全局配置。
const applyLocale = (value) => configureEsPlus({ locale: value })

// 示例共享全局配置：离开时恢复默认，避免影响别的示例。
onBeforeUnmount(() => configureEsPlus({ locale: 'zh-CN' }))
</script>

<style scoped>
.example-table-locale-hot-switch {
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
  color: var(--es-text-tertiary);
}
</style>
