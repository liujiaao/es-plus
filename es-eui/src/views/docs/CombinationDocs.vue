<template>
  <div class="docs-container">
    <!-- Hero Section -->
    <section class="modern-hero">
      <div class="hero-badge">
        <i class="el-icon-link" />
        <span>进阶用法</span>
      </div>
      <h1 class="hero-title">组件组合联动</h1>
      <p class="hero-desc">
        本页展示 es-eui 组件之间的组合使用方式，
        包括 EsTable、EsForm、useDialog 的多种组合场景，帮助你构建复杂的业务界面
      </p>
    </section>

    <!-- Combination Examples -->
    <section class="modern-section">
      <div class="section-header">
        <div class="section-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
          <i class="el-icon-s-cooperation" />
        </div>
        <h2 class="section-title">组合示例</h2>
      </div>

      <CodePlayground
        v-for="ex in combinationExamples"
        :key="ex.key"
        :title="ex.title"
        :description="ex.description"
        :code="getRawCode('combination', ex.key)"
      >
        <template #preview>
          <component :is="getComponent('combination', ex.key)" v-if="getComponent('combination', ex.key)" />
        </template>
      </CodePlayground>
    </section>

    <!-- Best Practices Section -->
    <section class="modern-section">
      <div class="section-header">
        <div class="section-icon cyan">
          <i class="el-icon-s-management" />
        </div>
        <h2 class="section-title">组合使用最佳实践</h2>
      </div>
      <div class="modern-table-wrapper">
        <table class="modern-table">
      <thead>
        <tr>
          <th>场景</th>
          <th>推荐方案</th>
          <th>注意事项</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>查询列表页</td>
          <td>EsForm + EsTable</td>
          <td>使用 options.apiParams 配置接口，手动查询时调用 httpRquestInstace()</td>
        </tr>
        <tr>
          <td>新增/编辑弹窗</td>
          <td>useDialog + EsForm (JSX)</td>
          <td>使用 ref 获取表单引用，validate 验证后提交</td>
        </tr>
        <tr>
          <td>数据选择弹窗</td>
          <td>useDialog + EsTable</td>
          <td>使用 selection-change 获取选中项，getRefs 获取表格引用</td>
        </tr>
        <tr>
          <td>复杂编辑弹窗</td>
          <td>useDialog + EsTable + EsForm</td>
          <td>使用 Tabs 分隔不同区域，分别管理各自的数据状态</td>
        </tr>
        <tr>
          <td>行内编辑</td>
          <td>EsTable 自定义列渲染</td>
          <td>使用 render 函数返回 EsFormItem 或原生输入组件</td>
        </tr>
      </tbody>
    </table>
    </div>
    </section>

    <!-- API Quick Reference Section -->
    <section class="modern-section">
      <div class="section-header">
        <div class="section-icon orange">
          <i class="el-icon-document" />
        </div>
        <h2 class="section-title">关键 API 速查</h2>
      </div>
      <div class="modern-table-wrapper">
        <table class="modern-table">
      <thead>
        <tr>
          <th>组件</th>
          <th>方法/属性</th>
          <th>说明</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>EsTable</td>
          <td>httpRquestInstace()</td>
          <td>手动触发表格数据刷新</td>
        </tr>
        <tr>
          <td>EsTable</td>
          <td>getSelectedRow()</td>
          <td>获取当前选中行</td>
        </tr>
        <tr>
          <td>EsForm</td>
          <td>validate(callback)</td>
          <td>表单验证</td>
        </tr>
        <tr>
          <td>EsForm</td>
          <td>resetFields()</td>
          <td>重置表单</td>
        </tr>
        <tr>
          <td>EsForm</td>
          <td>setFormData(data)</td>
          <td>设置表单数据</td>
        </tr>
        <tr>
          <td>useDialog</td>
          <td>getRefs(refName)</td>
          <td>获取弹窗内组件引用</td>
        </tr>
        <tr>
          <td>useDialog</td>
          <td>close()</td>
          <td>关闭弹窗</td>
        </tr>
        <tr>
          <td>useDialog</td>
          <td>instance</td>
          <td>弹窗实例，可访问内部数据</td>
        </tr>
      </tbody>
    </table>
    </div>
    </section>

    <!-- Next Steps Section -->
    <section class="modern-section">
      <div class="section-header">
        <div class="section-icon green">
          <i class="el-icon-right" />
        </div>
        <h2 class="section-title">下一步</h2>
      </div>
      <p class="section-desc">已经掌握了组件组合用法？回顾各个组件的详细文档：</p>

      <div class="next-links">
        <router-link to="/component/estable" class="next-card">
          <div class="next-icon blue">
            <i class="el-icon-s-data" />
          </div>
          <div class="next-info">
            <h3>EsTable 表格组件</h3>
            <p>了解表格的详细用法和高级功能</p>
          </div>
          <i class="el-icon-arrow-right" />
        </router-link>

        <router-link to="/component/esform" class="next-card">
          <div class="next-icon purple">
            <i class="el-icon-s-order" />
          </div>
          <div class="next-info">
            <h3>EsForm 表单组件</h3>
            <p>学习更多表单控件类型和验证</p>
          </div>
          <i class="el-icon-arrow-right" />
        </router-link>

        <router-link to="/component/esdialog" class="next-card">
          <div class="next-icon orange">
            <i class="el-icon-s-claim" />
          </div>
          <div class="next-info">
            <h3>useDialog 弹窗</h3>
            <p>掌握弹窗的更多高级用法</p>
          </div>
          <i class="el-icon-arrow-right" />
        </router-link>
      </div>
    </section>
  </div>
</template>

<script>
import CodePlayground from '@/components/CodePlayground.vue'
import { combinationExamples, getComponent, getRawCode } from '@/examples'

export default {
  name: 'CombinationDocs',
  components: {
    CodePlayground
  },
  data() {
    return {
      combinationExamples
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
  max-width: 1200px;
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

  h2 {
    font-size: 24px;
    margin: 40px 0 15px;
    padding-bottom: 10px;
    border-bottom: 2px solid #409eff;
    color: #303133;
  }

  p {
    color: #28292d;
    line-height: 1.6;
    margin-bottom: 15px;
  }

  .demo-block {
    border: 1px solid #ebeef5;
    border-radius: 4px;
    margin-bottom: 30px;
    overflow: hidden;

    &__body {
      padding: 20px;
      border-bottom: 1px solid #ebeef5;
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
          padding: 2px 8px;
          font-size: 12px;
          color: #409EFF;
          cursor: pointer;
          border: 1px solid #409EFF;
          border-radius: 3px;
          transition: all 0.3s;

          &:hover {
            background: #409EFF;
            color: #fff;
          }
        }
      }

      pre {
        margin: 0;
        padding: 15px 20px;
        font-family: 'Courier New', monospace;
        font-size: 13px;
        line-height: 1.5;
        color: #606266;
      }

      code {
        white-space: pre-wrap;
        word-wrap: break-word;
      }
    }
  }

  .query-form-section {
    display: flex;
    align-items: flex-start;

    border-radius: 4px;

    ::v-deep .es-form {
      flex: 1;
    }

    .query-actions {
      margin-left: 10px;
      padding-top: 4px;
    }
  }

  .form-actions {

    text-align: center;
  }

  .selected-info {
    margin-top: 15px;
    padding: 10px;
    background: #f0f9ff;
    border-radius: 4px;
    color: #606266;
  }

  .table-props {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 30px;

    th, td {
      padding: 12px;
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
      font-family: 'Courier New', monospace;
      color: #c0392b;
    }
  }

  // ===== 场景9: 表格内嵌表单样式 =====
  .query-form-wrapper {
    padding: 15px;
    background: #f5f7fa;
    border-radius: 4px;
    margin-bottom: 10px;
  }
}
</style>
