<template>
  <div class="es-svg-icon-page">
    <h1>SvgIcon 图标</h1>
    <p class="subtitle">
      统一的图标出口：雪碧图符号按 <code>currentColor</code> 着色、尺寸随字号，也能直接吃
      <code>http(s)</code> 外部图片 —— 业务里不必再各写一套 <code>&lt;svg&gt;&lt;use&gt;</code>。
      Vue 2 / Vue 3 两端用 mask 把外部图染成 <code>currentColor</code>，本端渲染为 <code>&lt;img&gt;</code>（保留原图配色）。
    </p>

    <a-divider />

    <section id="basic">
      <h2>一个图标出口：尺寸 / 着色 / 类名 / 外部图片</h2>
      <p>
        内联一份雪碧图即可跑：字号控制尺寸、<code>color</code> 控制颜色、<code>className</code> 追加装饰样式，
        最后的协议地址切到外部图片模式。组件只输出那一个 <code>1em</code> 的图标，其余全部交给宿主。
      </p>
      <CodeDemo :source="rawSFCs['./svg-icon/Basic.vue']">
        <SvgIconBasic />
      </CodeDemo>
    </section>

    <a-divider />

    <h2>Props</h2>
    <a-table :dataSource="iconProps" :columns="propColumns" :pagination="false" size="small" bordered />

    <p class="subtitle" style="margin-top: 16px">
      本端口径与 Vue 3 版的差异：额外接受 <code>iconName</code>（旧写法，等价于
      <code>iconClass</code>）；<code>iconClass</code> 写成 <code>icon-xxx</code> 时不会再重复补前缀。
      雪碧图本身由宿主的构建插件注入，组件不负责加载。
    </p>
  </div>
</template>

<script setup>
import CodeDemo from '@/components/CodeDemo.vue'
import SvgIconBasic from './svg-icon/Basic.vue'

const rawSFCs = import.meta.glob('./svg-icon/*.vue', { query: '?raw', import: 'default', eager: true })

const propColumns = [
  { title: '属性', dataIndex: 'prop', key: 'prop', width: 140 },
  { title: '类型', dataIndex: 'type', key: 'type', width: 120 },
  { title: '默认值', dataIndex: 'default', key: 'default', width: 100 },
  { title: '说明', dataIndex: 'desc', key: 'desc' },
]

const iconProps = [
  {
    key: '1',
    prop: 'iconClass',
    type: 'string',
    default: "''",
    desc: '图标名。非协议开头 → <svg><use href="#icon-{iconClass}">；以 http(s)/mailto/tel/open 开头 → 外部图片模式',
  },
  { key: '2', prop: 'iconName', type: 'string', default: "''", desc: '旧写法，等价于 iconClass（两者都为空时渲染空占位）' },
  { key: '3', prop: 'className', type: 'string', default: "''", desc: '追加到根节点的类名，装饰性样式不必改组件' },
]
</script>

<style scoped>
h1 { font-size: 30px; font-weight: 700; color: #1a1a2e; margin-bottom: 8px; }
.subtitle { color: #666; font-size: 15px; line-height: 1.8; }
h2 { font-size: 22px; font-weight: 600; margin: 24px 0 16px; color: #1a1a2e; }
section { scroll-margin-top: 100px; }
section p { color: #555; line-height: 1.8; margin-bottom: 16px; }
code { background: #f5f5f5; padding: 2px 6px; border-radius: 4px; font-family: 'Fira Code', monospace; font-size: 13px; color: #d63384; }
</style>
