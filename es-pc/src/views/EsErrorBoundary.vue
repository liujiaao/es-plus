<template>
  <div class="es-error-boundary-page">
    <h1>EsErrorBoundary 错误边界</h1>
    <p class="subtitle">
      组件级错误围栏：子树在渲染 / 生命周期 / 侦听器里抛错时只降级这一块，通过 <code>error</code> 事件上报、
      <code>reset()</code> 原地恢复 —— 一个坏组件不会拖垮整页。三端 API 一致（Vue 2 用
      <code>errorCaptured</code> 选项钩子，Vue 3 / Ant Design Vue 用 <code>onErrorCaptured</code>）。
    </p>

    <a-divider />

    <section id="basic">
      <h2>故障注入台：一处坏掉，整页还在</h2>
      <p>
        两个会抛错的子组件分别走「自定义 <code>fallback</code> + <code>reset</code>」与「只给
        <code>fallback-text</code> + <code>ref.reset()</code>」两条恢复路径；<code>error</code> 事件实时落到日志，
        边界外的按钮全程可点 —— 隔离是能被操作验证的，不只是说法。
      </p>
      <CodeDemo :source="rawSFCs['./es-error-boundary/Basic.vue']">
        <EsErrorBoundaryBasic />
      </CodeDemo>
    </section>

    <a-divider />

    <h2>Props</h2>
    <a-table :dataSource="boundaryProps" :columns="propColumns" :pagination="false" size="small" bordered />

    <h2>Slots</h2>
    <a-table :dataSource="boundarySlots" :columns="slotColumns" :pagination="false" size="small" bordered />

    <h2>事件</h2>
    <a-table :dataSource="boundaryEvents" :columns="eventColumns" :pagination="false" size="small" bordered />

    <h2>方法</h2>
    <a-table :dataSource="boundaryMethods" :columns="methodColumns" :pagination="false" size="small" bordered />

    <p class="subtitle" style="margin-top: 16px">
      注意：边界只兜<strong>子树</strong>的错误，自身渲染出错需要再往外包一层；<code>reset()</code> 只清错误态，
      必须先修好导致错误的数据，否则重新渲染会立刻再次降级。
    </p>
  </div>
</template>

<script setup>
import CodeDemo from '@/components/CodeDemo.vue'
import EsErrorBoundaryBasic from './es-error-boundary/Basic.vue'

const rawSFCs = import.meta.glob('./es-error-boundary/*.vue', { query: '?raw', import: 'default', eager: true })

const propColumns = [
  { title: '属性', dataIndex: 'prop', key: 'prop', width: 140 },
  { title: '类型', dataIndex: 'type', key: 'type', width: 120 },
  { title: '默认值', dataIndex: 'default', key: 'default', width: 100 },
  { title: '说明', dataIndex: 'desc', key: 'desc' },
]

const slotColumns = [
  { title: '插槽', dataIndex: 'slot', key: 'slot', width: 120 },
  { title: '作用域参数', dataIndex: 'params', key: 'params', width: 180 },
  { title: '说明', dataIndex: 'desc', key: 'desc' },
]

const eventColumns = [
  { title: '事件', dataIndex: 'event', key: 'event', width: 160 },
  { title: '回调参数', dataIndex: 'params', key: 'params', width: 200 },
  { title: '说明', dataIndex: 'desc', key: 'desc' },
]

const methodColumns = [
  { title: '方法', dataIndex: 'prop', key: 'prop', width: 200 },
  { title: '说明', dataIndex: 'desc', key: 'desc' },
]

const boundaryProps = [
  { key: '1', prop: 'fallbackText', type: 'string', default: "''", desc: '默认降级文案；未提供 fallback 插槽时显示' },
]

const boundarySlots = [
  { key: '1', slot: 'default', params: '-', desc: '正常渲染的子树：其渲染 / 生命周期 / 侦听器错误会被本边界捕获' },
  { key: '2', slot: 'fallback', params: '{ error, reset }', desc: '捕获错误后替代渲染；reset() 清除错误态（须先修好数据）' },
]

const boundaryEvents = [
  {
    key: '1',
    event: 'error',
    params: '(err, info)',
    desc: '捕获到子树错误时触发；info 是出错钩子名（如 render function）。边界返回 false，错误不再冒泡到 app.config.errorHandler',
  },
]

const boundaryMethods = [
  { key: '1', prop: 'reset', desc: '清除错误态并重新挂载子树；若导致错误的数据没修好，会立刻再次降级' },
]
</script>

<style scoped>
h1 { font-size: var(--es-text-3xl); font-weight: 700; color: #1a1a2e; margin-bottom: 8px; }
.subtitle { color: #666; font-size: 15px; line-height: 1.8; }
h2 { font-size: var(--es-text-2xl); font-weight: 600; margin: 24px 0 16px; color: #1a1a2e; }
section { scroll-margin-top: 100px; }
section p { color: #555; line-height: 1.8; margin-bottom: 16px; }
code { background: #f5f5f5; padding: 2px 6px; border-radius: 4px; font-family: 'Fira Code', monospace; font-size: 13px; color: #d63384; }
</style>
