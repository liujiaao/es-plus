<template>
  <div class="docs-container">
    <!-- Hero 区域 -->
    <section class="modern-hero">
      <div class="hero-badge">
        <i class="el-icon-s-order" />
        <span>核心组件</span>
      </div>
      <h1 class="hero-title">EsForm 表单组件</h1>
      <p class="hero-desc">
        企业级表单解决方案，通过 JSON 配置即可生成复杂表单，支持 14 种表单控件，
        让表单开发从小时级降至分钟级
      </p>
    </section>

    <!-- 使用示例 -->
    <section class="modern-section">
      <div class="section-header">
        <div class="section-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
          <i class="el-icon-s-order" />
        </div>
        <h2 class="section-title">使用示例</h2>
      </div>

      <CodePlayground
        v-for="ex in formExamples"
        :key="ex.key"
        :title="ex.title"
        :description="ex.description"
        :code="getRawCode('form', ex.key)"
      >
        <template #preview>
          <component :is="getComponent('form', ex.key)" v-if="getComponent('form', ex.key)" />
          <div v-else class="placeholder-preview">
            <el-alert :title="'示例: ' + ex.title" type="info" :closable="false" />
          </div>
        </template>
      </CodePlayground>
    </section>

    <!-- API 文档 -->
    <section class="modern-section">
      <div class="section-header">
        <div class="section-icon" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);">
          <i class="el-icon-document" />
        </div>
        <h2 class="section-title">API 文档</h2>
      </div>
      <p class="section-desc">完整的接口参考和配置说明</p>

      <h3>Props</h3>
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
            <td>formItemList</td>
            <td>表单项配置数组</td>
            <td>Array</td>
            <td>[]</td>
          </tr>
          <tr>
            <td>model</td>
            <td>表单数据对象</td>
            <td>Object</td>
            <td>{}</td>
          </tr>
          <tr>
            <td>layoutFormProps</td>
            <td>布局配置</td>
            <td>Object</td>
            <td>{}</td>
          </tr>
          <tr>
            <td>configBtn</td>
            <td>按钮配置数组</td>
            <td>Array</td>
            <td>[]</td>
          </tr>
        </tbody>
      </table>

      <h3>FormItem 配置</h3>
      <table class="table-props">
        <thead>
          <tr>
            <th>参数</th>
            <th>说明</th>
            <th>类型</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>prop</td>
            <td>字段名（支持函数动态返回）</td>
            <td>String/Function</td>
          </tr>
          <tr>
            <td>label</td>
            <td>标签文本</td>
            <td>String</td>
          </tr>
          <tr>
            <td>formtype</td>
            <td>控件类型：Input/Select/Radio/Checkbox/Switch/DatePicker/TimePicker/Cascader/Rate/Upload</td>
            <td>String</td>
          </tr>
          <tr>
            <td>span</td>
            <td>栅格占据列数（1-24）</td>
            <td>Number</td>
          </tr>
          <tr>
            <td>attrs</td>
            <td>控件属性（支持 disabled 为函数）</td>
            <td>Object</td>
          </tr>
          <tr>
            <td>formItemOptions</td>
            <td>表单项选项：labelWidth、rules、style 等</td>
            <td>Object</td>
          </tr>
          <tr>
            <td>dataOptions</td>
            <td>选项数据（Select/Radio/Checkbox）</td>
            <td>Array</td>
          </tr>
          <tr>
            <td>isHiden</td>
            <td>条件显示函数 (model) => Boolean</td>
            <td>Function</td>
          </tr>
          <tr>
            <td>render</td>
            <td>自定义渲染函数 (h, model, row) => VNode</td>
            <td>Function</td>
          </tr>
          <tr>
            <td>on</td>
            <td>事件监听：change、input、enter 等</td>
            <td>Object</td>
          </tr>
          <tr>
            <td>apiParams</td>
            <td>接口请求配置 { url, method, model, headers, options, httpRequest, listenToCallBack }</td>
            <td>Object</td>
          </tr>
        </tbody>
      </table>

      <h3>LayoutFormProps 配置</h3>
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
            <td>fromLayProps.labelWidth</td>
            <td>标签宽度</td>
            <td>String</td>
            <td>'100px'</td>
          </tr>
          <tr>
            <td>fromLayProps.size</td>
            <td>控件尺寸：large/medium/small/mini</td>
            <td>String</td>
            <td>'mini'</td>
          </tr>
          <tr>
            <td>fromLayProps.minfoldRows</td>
            <td>超过多少行折叠</td>
            <td>Number</td>
            <td>0（不折叠）</td>
          </tr>
          <tr>
            <td>fromLayProps.isBtnHiden</td>
            <td>是否隐藏按钮</td>
            <td>Boolean</td>
            <td>false</td>
          </tr>
          <tr>
            <td>fromLayProps.rules</td>
            <td>表单验证规则</td>
            <td>Object</td>
            <td>{}</td>
          </tr>
          <tr>
            <td>rowLayProps.gutter</td>
            <td>栅格间距</td>
            <td>Number</td>
            <td>10</td>
          </tr>
        </tbody>
      </table>

      <h3>Methods</h3>
      <table class="table-props">
        <thead>
          <tr>
            <th>方法名</th>
            <th>说明</th>
            <th>参数</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>validate</td>
            <td>表单验证</td>
            <td>(callback) => void</td>
          </tr>
          <tr>
            <td>resetFields</td>
            <td>重置表单</td>
            <td>-</td>
          </tr>
          <tr>
            <td>clearValidate</td>
            <td>清除验证状态</td>
            <td>-</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- 开发规范与技巧 -->
    <section class="modern-section">
      <div class="section-header">
        <div class="section-icon" style="background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);">
          <i class="el-icon-s-check" style="color: #606266;" />
        </div>
        <h2 class="section-title">开发规范与技巧</h2>
      </div>
      <p class="section-desc">提升开发效率和代码质量的最佳实践</p>

      <div class="tips-box tips-box--info">
        <h4>📋 表单开发规范</h4>
        <ol>
          <li><strong>字段命名</strong>：使用驼峰命名，如 <code>policyTitle</code>、<code>effectiveTimeRange</code></li>
          <li><strong>日期范围</strong>：统一使用数组格式，如 <code>effectiveTimeRange: ['', '']</code></li>
          <li><strong>动态禁用</strong>：使用函数形式 <code>disabled: () => this.isDisabled</code></li>
          <li><strong>动态规则</strong>：通过 key 强制刷新表单 <code>:key="ruleKey"</code></li>
          <li><strong>验证规则</strong>：在 <code>formItemOptions.rules</code> 中定义，支持 required/pattern/validator</li>
          <li><strong>性能优化</strong>：复杂表单使用 <code>isHiden</code> 替代 v-if，避免频繁重建组件</li>
        </ol>
      </div>

      <div class="tips-box tips-box--success">
        <h4>🚀 开发效率技巧</h4>
        <ul>
          <li><strong>快速创建表单</strong>：复制已有配置，修改字段名即可</li>
          <li><strong>统一配置</strong>：将常用 attrs（如 clearable、size）提取为常量</li>
          <li><strong>IDE 代码片段</strong>：配置表单字段代码片段，一键生成配置模板</li>
          <li><strong>类型提示</strong>：使用 JSDoc 注释标记字段类型，获得 IDE 提示</li>
        </ul>
      </div>
    </section>

    <!-- 下一步 -->
    <section class="modern-section">
      <div class="section-header">
        <div class="section-icon" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);">
          <i class="el-icon-right" />
        </div>
        <h2 class="section-title">下一步</h2>
      </div>
      <p class="section-desc">继续探索其他组件，构建完整的业务解决方案</p>

      <div class="next-steps">
        <router-link to="/component/estable" class="next-step-card">
          <div class="next-step-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
            <i class="el-icon-s-grid" />
          </div>
          <div class="next-step-content">
            <h4>EsTable 表格组件</h4>
            <p>企业级表格组件，支持搜索、分页、批量操作、列配置等高级功能</p>
          </div>
          <i class="el-icon-arrow-right next-step-arrow" />
        </router-link>

        <router-link to="/component/esdialog" class="next-step-card">
          <div class="next-step-icon" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
            <i class="el-icon-s-promotion" />
          </div>
          <div class="next-step-content">
            <h4>useDialog 弹窗</h4>
            <p>简洁优雅的弹窗 Hook，支持指令式调用，让弹窗控制更轻松</p>
          </div>
          <i class="el-icon-arrow-right next-step-arrow" />
        </router-link>

        <router-link to="/component/combination" class="next-step-card">
          <div class="next-step-icon" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
            <i class="el-icon-s-operation" />
          </div>
          <div class="next-step-content">
            <h4>组合联动</h4>
            <p>表单与表格的完美配合，实现复杂业务场景的数据管理</p>
          </div>
          <i class="el-icon-arrow-right next-step-arrow" />
        </router-link>
      </div>
    </section>
  </div>
</template>

<script>
import CodePlayground from '@/components/CodePlayground.vue'
import { formExamples, getComponent, getRawCode } from '@/examples'

export default {
  name: 'EsFormDocs',
  components: { CodePlayground },
  data() {
    return {
      formExamples
    }
  },
  methods: {
    getComponent,
    getRawCode
  }
}
</script>

<style lang="scss">
.docs-container {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;

  .docs-header {
    margin-bottom: 30px;

    .global-actions {
      margin-top: 15px;
      padding: 10px 0;
      border-bottom: 1px solid #e4e7ed;
    }
  }

  h1 {
    font-size: 32px;
    margin-bottom: 10px;
    color: #303133;
  }

  .component-desc {
    color: #28292d;
    font-size: 16px;
    line-height: 1.6;
    margin-bottom: 30px;
    padding: 15px 20px;
    background: #f5f7fa;
    border-left: 4px solid #409eff;
    border-radius: 4px;
  }

  h2 {
    font-size: 24px;
    margin: 40px 0 15px;
    padding-bottom: 10px;
    border-bottom: 2px solid #409eff;
    color: #303133;
  }

  h3 {
    font-size: 18px;
    color: #303133;
    margin: 30px 0 15px;
    padding-left: 12px;
    border-left: 4px solid #67c23a;
  }

  h4 {
    font-size: 15px;
    color: #303133;
    margin: 20px 0 10px;
  }

  p {
    color: #28292d;
    line-height: 1.8;
    margin-bottom: 15px;

    code {
      background: #f4f4f5;
      padding: 2px 8px;
      border-radius: 4px;
      font-family: 'Consolas', monospace;
      color: #e96900;
      font-size: 13px;
    }
  }

  .demo-block {
    border: 1px solid #ebeef5;
    border-radius: 8px;
    margin-bottom: 30px;
    overflow: hidden;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);

    &--full {
      .demo-block__body {
      //  min-height: 400px;
      }
    }

    &__header {
      padding: 15px 20px;
      background: #fafafa;
      border-bottom: 1px solid #ebeef5;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    &__title {
      font-size: 16px;
      font-weight: 500;
      color: #303133;
    }

    &__badge {
      font-size: 12px;
      padding: 2px 10px;
      border-radius: 12px;
      background: #409eff;
      color: #fff;
    }

    &__body {
      padding: 20px;
      background: #fff;
    }

    &__code {
      background: #f5f7fa;
      overflow-x: auto;

      .code-header {
        display: flex;
        align-items: center;
        padding: 10px 15px;
        background: #e4e7ed;
        cursor: pointer;
        user-select: none;
        transition: background 0.2s;
        border-bottom: 1px solid #dcdfe6;

        &:hover {
          background: #d0d3d9;
        }

        i {
          margin-right: 8px;
          font-size: 14px;
          color: #606266;
        }

        span {
          font-size: 13px;
          color: #606266;
        }

        .copy-btn {
          margin-left: auto;
          padding: 4px 12px;
          font-size: 12px;
          color: #409eff;
          background: #fff;
          border: 1px solid #409eff;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 4px;

          &:hover {
            background: #409eff;
            color: #fff;
          }

          i {
            margin-right: 4px;
            color: inherit;
          }
        }
      }

      pre {
        margin: 0;
        padding: 15px 20px;
        font-family: 'Consolas', monospace;
        font-size: 13px;
        line-height: 1.6;
        color: #606266;
      }

      code {
        white-space: pre-wrap;
        word-wrap: break-word;
        background: transparent;
        color: #606266;
        padding: 0;
      }
    }
  }

  .tips-box {
    padding: 16px 20px;
    border-radius: 8px;
    margin: 20px 0;

    &--success {
      background: #f0f9eb;
      border: 1px solid #e1f3d8;
      h4 { color: #67c23a; }
    }

    &--warning {
      background: #fdf6ec;
      border: 1px solid #faecd8;
      h4 { color: #e6a23c; }
    }

    &--info {
      background: #f4f4f5;
      border: 1px solid #e9e9eb;
      h4 { color: #909399; }
    }

    h4 {
      margin: 0 0 10px 0;
      font-size: 15px;
    }

    ul, ol {
      margin: 0;
      padding-left: 20px;

      li {
        margin: 8px 0;
        color: #606266;
        line-height: 1.6;
      }
    }

    p {
      margin: 0;
      color: #606266;
    }
  }

  .table-props {
    width: 100%;
    border-collapse: collapse;
    margin: 20px 0;
    font-size: 14px;

    th, td {
      padding: 12px 16px;
      text-align: left;
      border: 1px solid #ebeef5;
    }

    th {
      background: #f5f7fa;
      font-weight: 600;
      color: #303133;
    }

    td {
      color: #606266;
    }

    code {
      background: #f4f4f5;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Consolas', monospace;
      color: #e96900;
      font-size: 12px;
    }

    tr:hover {
      background: #f5f7fa;
    }
  }
}
</style>
