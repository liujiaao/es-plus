<template>
  <div class="docs-container">
    <section class="modern-hero">
      <div class="hero-badge">
        <i class="el-icon-picture-outline" />
        <span>基础组件</span>
      </div>
      <h1 class="hero-title">SvgIcon 图标</h1>
      <p class="hero-desc">
        统一的图标出口：雪碧图符号按 currentColor 着色、尺寸随字号，也能直接吃 http(s) 外部图片 ——
        业务里不必再各写一套 &lt;svg&gt;&lt;use&gt;
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
        v-for="ex in svgIconExamples"
        :key="ex.key"
        :title="ex.title"
        :description="ex.description"
        :code="getRawCode('svg-icon', ex.key)"
      >
        <template #preview>
          <component :is="getComponent('svg-icon', ex.key)" v-if="getComponent('svg-icon', ex.key)" />
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
          <p class="section-desc">雪碧图本身由宿主的构建插件注入，组件只负责输出那一个 1em 的图标</p>
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
            <td>iconClass</td>
            <td>图标名。非协议开头 → &lt;svg&gt;&lt;use xlink:href="#icon-{iconClass}"&gt;；以 http(s)/mailto/tel/open 开头 → 外部图片模式（mask 染成 currentColor）</td>
            <td>String</td>
            <td>必填</td>
          </tr>
          <tr>
            <td>className</td>
            <td>追加到根节点的类名，装饰性样式不必改组件</td>
            <td>String</td>
            <td>''</td>
          </tr>
        </tbody>
      </table>

      <el-alert
        type="info"
        :closable="false"
        title="尺寸与颜色由宿主决定"
        description="宽高固定 1em —— 字号多大图标就多大；fill: currentColor —— 放进按钮/标签会自动跟随主题与禁用态。组件没有额外的 size / color prop。"
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
        <router-link to="/component/eserrorboundary" class="next-step-card">
          <div class="next-step-icon">
            <i class="el-icon-warning-outline" />
          </div>
          <div class="next-step-content">
            <h4>EsErrorBoundary 错误边界</h4>
            <p>子树抛错只降级这一块，error 事件上报 + reset() 原地恢复</p>
          </div>
          <i class="el-icon-arrow-right next-step-arrow" />
        </router-link>
        <router-link to="/component/esform" class="next-step-card">
          <div class="next-step-icon">
            <i class="el-icon-s-order" />
          </div>
          <div class="next-step-content">
            <h4>EsForm 表单组件</h4>
            <p>配置驱动的表单组件，支持多种控件与校验</p>
          </div>
          <i class="el-icon-arrow-right next-step-arrow" />
        </router-link>
      </div>
    </section>
  </div>
</template>

<script>
import CodePlayground from '@/components/CodePlayground.vue'
import { svgIconExamples, getComponent, getRawCode } from '@/examples'

export default {
  name: 'SvgIconDocs',
  components: { CodePlayground },
  data() {
    return {
      svgIconExamples
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
