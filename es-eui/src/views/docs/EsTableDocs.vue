<template>
  <div class="docs-container">
    <!-- Hero Section -->
    <section class="modern-hero">
      <div class="hero-badge">
        <i class="el-icon-s-data" />
        <span>核心组件</span>
      </div>
      <h1 class="hero-title">EsTable 表格组件</h1>
      <p class="hero-desc">
        企业级高性能表格组件，支持自动数据请求、分页管理、列渲染、条件查询联动等特性，
        让数据展示开发效率提升 80%
      </p>
    </section>

    <!-- 使用示例 -->
    <section class="modern-section">
      <div class="section-header">
        <div class="section-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
          <i class="el-icon-s-grid" />
        </div>
        <h2 class="section-title">使用示例</h2>
      </div>
      <CodePlayground
        v-for="ex in tableExamples"
        :key="ex.key"
        :title="ex.title"
        :description="ex.description"
        :code="getRawCode('table', ex.key)"
      >
        <template #preview>
          <component :is="getComponent('table', ex.key)" v-if="getComponent('table', ex.key)" />
          <div v-else class="placeholder-preview">
            <el-alert :title="'示例: ' + ex.title" type="info" :closable="false" />
          </div>
        </template>
      </CodePlayground>
    </section>

    <!-- API Documentation Section -->
    <section class="modern-section">
      <div class="section-header">
        <div class="section-icon orange">
          <i class="el-icon-document" />
        </div>
        <h2 class="section-title">API 文档</h2>
      </div>

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
          <td>dataSource</td>
          <td>表格数据源（接口请求场景下表格内部自管 tableData，外部仅需单向传入即可）</td>
          <td>Array</td>
          <td>[]</td>
        </tr>
        <tr>
          <td>columns</td>
          <td>列配置数组</td>
          <td>Array</td>
          <td>[]</td>
        </tr>
        <tr>
          <td>pagination</td>
          <td>分页配置 { pageIndex, pageSize, total }</td>
          <td>Object</td>
          <td>{}</td>
        </tr>
        <tr>
          <td>options</td>
          <td>表格选项配置（详见下方 Options 配置）</td>
          <td>Object</td>
          <td>{}</td>
        </tr>
      </tbody>
    </table>

    <h3>Options 配置</h3>
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
          <td>apiParams</td>
          <td>自动请求配置 { url, method, model, headers, options }</td>
          <td>Object</td>
          <td>-</td>
        </tr>
        <tr>
          <td>configTableOut</td>
          <td>响应字段映射 { total, pageSize, current, tableData }</td>
          <td>Object</td>
          <td>-</td>
        </tr>
        <tr>
          <td>httpRequest</td>
          <td>自定义请求函数 (params) => Promise</td>
          <td>Function</td>
          <td>-</td>
        </tr>
        <tr>
          <td>listenToCallBack</td>
          <td>请求生命周期 { brcb: (params)=>{}, qrcb: (res)=>{} }</td>
          <td>Object</td>
          <td>-</td>
        </tr>
        <tr>
          <td>isInitRun</td>
          <td>初始化时是否自动请求</td>
          <td>Boolean</td>
          <td>false</td>
        </tr>
        <tr>
          <td>border</td>
          <td>是否显示边框</td>
          <td>Boolean</td>
          <td>false</td>
        </tr>
        <tr>
          <td>size</td>
          <td>表格尺寸</td>
          <td>String</td>
          <td>'small'</td>
        </tr>
        <tr>
          <td>tabHeight</td>
          <td>表格高度(px)，配合 heightType 使用</td>
          <td>Number</td>
          <td>-</td>
        </tr>
        <tr>
          <td>heightType</td>
          <td>高度类型：'height' | 'max-height' | 'auto'</td>
          <td>String</td>
          <td>'auto'</td>
        </tr>
        <tr>
          <td>multiSelect</td>
          <td>是否支持多选</td>
          <td>Boolean</td>
          <td>false</td>
        </tr>
        <tr>
          <td>cachePageSelection</td>
          <td>跨页记忆选中项</td>
          <td>Boolean</td>
          <td>true</td>
        </tr>
      </tbody>
    </table>

    <h3>Column 配置</h3>
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
          <td>key / prop</td>
          <td>字段名</td>
          <td>String</td>
        </tr>
        <tr>
          <td>label</td>
          <td>列标题</td>
          <td>String</td>
        </tr>
        <tr>
          <td>width</td>
          <td>列宽度</td>
          <td>String/Number</td>
        </tr>
        <tr>
          <td>fixed</td>
          <td>固定列：'left' | 'right'</td>
          <td>String</td>
        </tr>
        <tr>
          <td>render</td>
          <td>自定义渲染函数 (h, { row, index, instance }) => VNode</td>
          <td>Function</td>
        </tr>
        <tr>
          <td>hidCol</td>
          <td>是否隐藏列</td>
          <td>Boolean</td>
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
          <td>httpRquestInstace</td>
          <td>手动触发数据请求（用于刷新）</td>
          <td>-</td>
        </tr>
        <tr>
          <td>clearAllSelection</td>
          <td>清空所有选中项</td>
          <td>-</td>
        </tr>
        <tr>
          <td>toggleSelection</td>
          <td>切换行选中状态</td>
          <td>rows</td>
        </tr>
      </tbody>
    </table>

    </section>

    <!-- Development Guidelines Section -->
    <section class="modern-section">
      <div class="section-header">
        <div class="section-icon cyan">
          <i class="el-icon-s-management" />
        </div>
        <h2 class="section-title">开发规范与建议</h2>
      </div>

      <div class="tips-box tips-box--info">
      <h4>📋 开发规范</h4>
      <ol>
        <li><strong>字段命名</strong>：后端返回字段与前端不一致时，使用 configTableOut 映射，不修改后端接口</li>
        <li><strong>请求封装</strong>：统一配置 httpRequest，集中处理 Token、错误提示、Loading</li>
        <li><strong>按钮操作</strong>：操作列通过 instance.httpRquestInstace() 刷新表格，不直接修改数据源</li>
        <li><strong>日期范围</strong>：使用 brcb 回调将日期范围拆分为 start/end 两个字段传给后端</li>
        <li><strong>性能优化</strong>：大数据量时设置 tabHeight 固定表格高度，启用虚拟滚动</li>
      </ol>
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
      <p class="section-desc">继续学习其他组件，掌握更多功能：</p>

      <div class="next-links">
        <router-link to="/component/esform" class="next-card">
          <div class="next-icon purple">
            <i class="el-icon-s-order" />
          </div>
          <div class="next-info">
            <h3>EsForm 表单组件</h3>
            <p>学习配置化表单的各种控件类型</p>
          </div>
          <i class="el-icon-arrow-right" />
        </router-link>

        <router-link to="/component/esdialog" class="next-card">
          <div class="next-icon orange">
            <i class="el-icon-s-claim" />
          </div>
          <div class="next-info">
            <h3>useDialog 弹窗</h3>
            <p>掌握函数式弹窗的使用方法</p>
          </div>
          <i class="el-icon-arrow-right" />
        </router-link>

        <router-link to="/component/combination" class="next-card">
          <div class="next-icon cyan">
            <i class="el-icon-link" />
          </div>
          <div class="next-info">
            <h3>组合联动</h3>
            <p>了解组件间的组合使用方式</p>
          </div>
          <i class="el-icon-arrow-right" />
        </router-link>
      </div>
    </section>
  </div>
</template>

<script>
import CodePlayground from '@/components/CodePlayground.vue'
import { tableExamples, getComponent, getRawCode } from '@/examples'

export default {
  name: 'EsTableDocs',
  components: { CodePlayground },
  data() {
    return {
      tableExamples
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
