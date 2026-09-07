<template>
  <div class="docs-page">
    <!-- 左侧导航 -->
    <aside class="side-nav">
      <div class="nav-group">
        <div class="nav-title">
          主题
        </div>
        <router-link
          to="/theme"
          class="nav-item"
          exact
        >
          定制主题
        </router-link>
        <router-link
          to="/theme/preview"
          class="nav-item"
        >
          主题预览
        </router-link>
      </div>
    </aside>

    <!-- 右侧内容 -->
    <div class="content">
      <h1 class="content-title">
        定制主题
      </h1>
      
      <p>ES-Plus 使用 Element UI 的样式变量系统，你可以通过修改 SCSS 变量来定制主题。</p>

      <h2 class="content-subtitle">
        通过 SCSS 变量定制
      </h2>
      
      <p>新建一个样式文件，例如 <code>element-variables.scss</code>，写入以下内容：</p>

      <pre><code>/* 改变主题色变量 */
$--color-primary: #409eff;
$--color-success: #67c23a;
$--color-warning: #e6a23c;
$--color-danger: #f56c6c;
$--color-info: #909399;

/* 改变 icon 字体路径变量，必需 */
$--font-path: '~element-ui/lib/theme-chalk/fonts';

@import "~element-ui/packages/theme-chalk/src/index";</code></pre>

      <p>然后在项目的入口文件中引入：</p>

      <pre><code>import Vue from 'vue'
import ElementUI from 'element-ui'
import './element-variables.scss'
import EsPlus from '@es-plus/vue2'

Vue.use(ElementUI)
Vue.use(EsPlus)</code></pre>

      <h2 class="content-subtitle">
        常用变量
      </h2>
      
      <table class="table-props">
        <thead>
          <tr>
            <th>变量名</th>
            <th>默认值</th>
            <th>说明</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>$--color-primary</td>
            <td>#409EFF</td>
            <td>主题色</td>
          </tr>
          <tr>
            <td>$--color-success</td>
            <td>#67C23A</td>
            <td>成功色</td>
          </tr>
          <tr>
            <td>$--color-warning</td>
            <td>#E6A23C</td>
            <td>警告色</td>
          </tr>
          <tr>
            <td>$--color-danger</td>
            <td>#F56C6C</td>
            <td>危险色</td>
          </tr>
          <tr>
            <td>$--color-info</td>
            <td>#909399</td>
            <td>信息色</td>
          </tr>
          <tr>
            <td>$--color-text-primary</td>
            <td>#303133</td>
            <td>主要文字颜色</td>
          </tr>
          <tr>
            <td>$--color-text-regular</td>
            <td>#606266</td>
            <td>常规文字颜色</td>
          </tr>
          <tr>
            <td>$--border-color-base</td>
            <td>#DCDFE6</td>
            <td>边框颜色</td>
          </tr>
          <tr>
            <td>$--border-radius-base</td>
            <td>4px</td>
            <td>圆角大小</td>
          </tr>
        </tbody>
      </table>

      <h2 class="content-subtitle">
        组件特定样式
      </h2>
      
      <p>ES-Plus 组件也提供了一些可定制的 CSS 变量：</p>

      <pre><code>/* 表格头部背景色 */
.es-table .el-table__header th {
  background-color: #f5f7fa;
}

/* 表单标签宽度 */
.es-form .el-form-item__label {
  font-weight: 500;
}</code></pre>

      <div class="tip">
        <p>
          <strong>提示</strong>：更多 Element UI 的样式变量请参考 <a
            href="https://element.eleme.io/#/zh-CN/component/custom-theme"
            target="_blank"
          >Element UI 官方文档</a>。
        </p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ThemePage'
}
</script>
