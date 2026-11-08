<template>
  <div class="docs-container">
    <!-- 审计 P0-4：EsTable 示例页此前一个路由塞 24 个完整示例（桌面 20,492px /
         移动 31,764px），滚动条比任何一屏正文都长。按「列配置 / 编辑与交互 /
         业务闭环」拆成三个子页，基础与 API 留在主页面 —— 示例的 anchor
         （#demo-Basic 等）也留在主页，案例目录里的深链因此不受影响。 -->
    <section class="modern-hero">
      <div class="hero-badge">
        <i :class="meta.icon" />
        <span>核心组件 · {{ meta.badge }}</span>
      </div>
      <h1 class="hero-title">
        {{ meta.title }}
      </h1>
      <p class="hero-desc">
        {{ meta.desc }}
      </p>
    </section>

    <section class="modern-section">
      <div class="section-header">
        <div class="section-icon brand">
          <i class="el-icon-s-grid" />
        </div>
        <h2 class="section-title">
          使用示例
        </h2>
      </div>
      <div class="demo-group-links">
        <router-link to="/component/estable">
          基础与数据
        </router-link>
        <router-link to="/component/estable-columns">
          列配置与合并
        </router-link>
        <router-link to="/component/estable-editing">
          编辑与交互
        </router-link>
        <router-link to="/component/estable-business">
          业务闭环
        </router-link>
      </div>
      <CodePlayground
        v-for="(ex, i) in examples"
        :key="ex.key"
        :id="'demo-' + ex.key"
        :title="ex.title"
        :description="ex.description"
        :code="getRawCode('table', ex.key)"
        :default-expanded="i < 2"
      >
        <template #preview>
          <component :is="getComponent('table', ex.key)" />
        </template>
      </CodePlayground>
    </section>

    <section class="modern-section">
      <div class="doc-back">
        <router-link to="/component/estable">
          ← 返回 EsTable 基础与 API 文档
        </router-link>
      </div>
    </section>
  </div>
</template>

<script>
/**
 * EsTable 示例子页（列配置 / 编辑与交互 / 业务闭环）。
 *
 * 三个路由共用这一个组件，靠路由 props 的 `group` 取子集 —— 示例清单仍只有
 * `examples/index.js` 一份（key → 组件 + 源码），拆页不产生第二份清单。
 */
import CodePlayground from '@/components/CodePlayground.vue'
import { tableExamples, getComponent, getRawCode } from '@/examples'

const GROUPS = {
  columns: {
    badge: '列配置',
    icon: 'el-icon-s-grid',
    title: 'EsTable 列配置',
    desc: '多级表头、声明式合并单元格、首尾固定列、列排序与码值标签 —— 列的形态全部由 columns 配置决定，不需要写模板。',
    keys: ['GroupColumn', 'MergeCells', 'ComplexMerge', 'FixedColumns', 'CurrentRow', 'Sort', 'CodeLabel']
  },
  editing: {
    badge: '编辑与交互',
    icon: 'el-icon-edit-outline',
    title: 'EsTable 编辑与交互',
    desc: '行内编辑、展开行详情、树形与懒加载树、工具栏与操作列按钮：交互能力同样由配置驱动，少量 render 只用于自定义内容。',
    keys: ['ActionColumn', 'ConfigBtn', 'ExpandRow', 'EditTable', 'TreeTable', 'LazyLoadTree']
  },
  business: {
    badge: '业务闭环',
    icon: 'el-icon-s-check',
    title: 'EsTable 业务闭环',
    desc: '远程 CRUD、乐观更新与失败回滚、只读详情抽屉、删除边界处理 —— 可直接照搬的生产级范式。',
    keys: ['RealWorld', 'RemoteCrud', 'OptimisticToggle', 'DetailDrawer', 'CrudEdgeCases']
  }
}

export default {
  name: 'EsTableSubDocs',
  components: { CodePlayground },
  props: {
    group: { type: String, required: true }
  },
  computed: {
    meta() {
      return GROUPS[this.group] || GROUPS.columns
    },
    examples() {
      const keys = this.meta.keys
      return tableExamples.filter((ex) => keys.includes(ex.key))
    }
  },
  methods: {
    getComponent,
    getRawCode
  }
}
</script>

<style lang="scss" scoped>
.docs-container {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

// 与主页同一套子页入口（本组件是独立 chunk，样式不能指望主页那份）
.demo-group-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;

  a {
    padding: 5px 14px;
    border: 1px solid var(--es-border-light);
    border-radius: var(--es-radius-full);
    color: var(--es-text-regular);
    font-size: 13px;
    text-decoration: none;
    transition: color var(--es-duration-fast) var(--es-ease),
      border-color var(--es-duration-fast) var(--es-ease),
      background-color var(--es-duration-fast) var(--es-ease);

    &:hover {
      color: var(--es-brand-strong);
      border-color: var(--es-brand-primary);
    }

    &.router-link-exact-active {
      color: var(--es-brand-strong);
      background: var(--es-brand-tint);
      border-color: var(--es-brand-primary);
    }
  }
}

.doc-back {
  padding: 8px 0 24px;
  font-size: 14px;

  a {
    color: var(--es-brand-strong);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}
</style>
