<template>
  <div class="docs-container">
    <section class="modern-hero">
      <div class="hero-badge">
        <i class="el-icon-warning-outline" />
        <span>基础组件</span>
      </div>
      <h1 class="hero-title">EsErrorBoundary 错误边界</h1>
      <p class="hero-desc">
        组件级错误围栏：子树在渲染 / 生命周期 / 侦听器里抛错时只降级这一块，通过 error 事件上报、
        reset() 原地恢复 —— 一个坏组件不会拖垮整页
      </p>
    </section>

    <section class="modern-section">
      <div class="section-header">
        <div class="section-icon" style="background: linear-gradient(135deg, var(--es-brand-primary) 0%, var(--es-brand-accent) 100%);">
          <i class="el-icon-s-operation" />
        </div>
        <h2 class="section-title">使用示例</h2>
      </div>
      <CodePlayground
        v-for="ex in errorBoundaryExamples"
        :key="ex.key"
        :title="ex.title"
        :description="ex.description"
        :code="getRawCode('error-boundary', ex.key)"
      >
        <template #preview>
          <component :is="getComponent('error-boundary', ex.key)" v-if="getComponent('error-boundary', ex.key)" />
          <div v-else class="placeholder-preview">
            <el-alert :title="'示例: ' + ex.title" type="info" :closable="false" />
          </div>
        </template>
      </CodePlayground>
    </section>

    <section class="modern-section">
      <div class="section-header">
        <div class="section-icon orange">
          <i class="el-icon-document" />
        </div>
        <div class="section-info">
          <h2 class="section-title">API 文档</h2>
          <p class="section-desc">三端 API 一致；本端用 errorCaptured 选项钩子实现</p>
        </div>
      </div>

      <h2>Props</h2>
      <table class="table-props">
        <thead>
          <tr>
            <th>参数</th>
            <th>说明</th>
            <th>类型</th>
            <th>默认值</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>fallbackText</td>
            <td>默认降级文案；未提供 fallback 插槽时显示</td>
            <td>String</td>
            <td>''</td>
          </tr>
        </tbody>
      </table>

      <h2>Slots</h2>
      <table class="table-props">
        <thead>
          <tr>
            <th>插槽</th>
            <th>说明</th>
            <th>作用域参数</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>default</td>
            <td>正常渲染的子树：其渲染 / 生命周期 / 侦听器错误会被本边界捕获</td>
            <td>—</td>
          </tr>
          <tr>
            <td>fallback</td>
            <td>捕获错误后替代渲染；reset() 清除错误态（须先修好数据）</td>
            <td>{ error, reset }</td>
          </tr>
        </tbody>
      </table>

      <h2>Events</h2>
      <table class="table-props">
        <thead>
          <tr>
            <th>事件</th>
            <th>说明</th>
            <th>回调参数</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>error</td>
            <td>捕获到子树错误时触发；info 是出错钩子名（本端为 render / created 等）。钩子返回 false，错误不再冒泡到 Vue.config.errorHandler</td>
            <td>(err, info)</td>
          </tr>
        </tbody>
      </table>

      <h2>Methods</h2>
      <table class="table-props">
        <thead>
          <tr>
            <th>方法</th>
            <th>说明</th>
            <th>回调参数</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>reset()</td>
            <td>清除错误态并重新挂载子树；若导致错误的数据没修好，会立刻再次降级</td>
            <td>—</td>
          </tr>
        </tbody>
      </table>

      <el-alert
        type="info"
        :closable="false"
        title="Vue 2 的必要偏离"
        description="Vue 2 要求模板恰好一个根节点而 <slot> 不能作根，因此本端额外包了一层 display:contents 的容器 —— 它不生成盒子，子节点仍按父级布局参与排布，行为上最接近 Vue 3 的 fragment。"
      />
    </section>

    <section class="modern-section">
      <div class="section-header">
        <div class="section-icon green">
          <i class="el-icon-right" />
        </div>
        <div class="section-info">
          <h2 class="section-title">下一步</h2>
          <p class="section-desc">继续探索其他组件</p>
        </div>
      </div>

      <div class="next-steps">
        <router-link to="/component/svgicon" class="next-step-card">
          <div class="next-step-icon">
            <i class="el-icon-picture-outline" />
          </div>
          <div class="next-step-content">
            <h4>SvgIcon 图标</h4>
            <p>雪碧图符号按 currentColor 着色，尺寸随字号，也接受外部图片</p>
          </div>
          <i class="el-icon-arrow-right next-step-arrow" />
        </router-link>
        <router-link to="/component/estable" class="next-step-card">
          <div class="next-step-icon">
            <i class="el-icon-s-grid" />
          </div>
          <div class="next-step-content">
            <h4>EsTable 表格组件</h4>
            <p>配置化列定义 + 分页 + 自定义渲染</p>
          </div>
          <i class="el-icon-arrow-right next-step-arrow" />
        </router-link>
      </div>
    </section>
  </div>
</template>

<script>
import CodePlayground from '@/components/CodePlayground.vue'
import { errorBoundaryExamples, getComponent, getRawCode } from '@/examples'

export default {
  name: 'EsErrorBoundaryDocs',
  components: { CodePlayground },
  data() {
    return {
      errorBoundaryExamples
    }
  },
  methods: {
    getComponent,
    getRawCode
  }
}
</script>

<style scoped>
.placeholder-preview {
  padding: 16px;
}
</style>
