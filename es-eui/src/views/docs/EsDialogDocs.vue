<template>
  <div class="docs-container">
    <section class="modern-hero">
      <div class="hero-badge">
        <i class="el-icon-s-claim" />
        <span>核心组件</span>
      </div>
      <h1 class="hero-title">useDialog 弹窗组件</h1>
      <p class="hero-desc">
        强大的函数式弹窗组件，支持 JSX 渲染、自定义内容、按钮配置、生命周期回调等功能，
        让弹窗开发更加灵活高效
      </p>
    </section>

    <section class="modern-section">
      <div class="section-header">
        <div class="section-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
          <i class="el-icon-s-operation" />
        </div>
        <h2 class="section-title">使用示例</h2>
      </div>
      <CodePlayground
        v-for="ex in dialogExamples"
        :key="ex.key"
        :title="ex.title"
        :description="ex.description"
        :code="getRawCode('dialog', ex.key)"
      >
        <template #preview>
          <component :is="getComponent('dialog', ex.key)" v-if="getComponent('dialog', ex.key)" />
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
          <p class="section-desc">完整的参数配置和类型定义</p>
        </div>
      </div>

      <h2>Parameters</h2>
      <table class="table-props">
        <thead>
          <tr>
            <th>参数</th>
            <th>说明</th>
            <th>类型</th>
            <th>可选值</th>
            <th>默认值</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>key</td>
            <td>弹窗唯一标识，用于缓存</td>
            <td>String</td>
            <td>—</td>
            <td>'__default__'</td>
          </tr>
          <tr>
            <td>title</td>
            <td>弹窗标题</td>
            <td>String</td>
            <td>—</td>
            <td>''</td>
          </tr>
          <tr>
            <td>width</td>
            <td>弹窗宽度</td>
            <td>String</td>
            <td>—</td>
            <td>'50%'</td>
          </tr>
          <tr>
            <td>height</td>
            <td>弹窗高度</td>
            <td>String</td>
            <td>—</td>
            <td>''</td>
          </tr>
          <tr>
            <td>maxHeight</td>
            <td>弹窗最大高度</td>
            <td>String</td>
            <td>—</td>
            <td>''</td>
          </tr>
          <tr>
            <td>center</td>
            <td>是否居中</td>
            <td>Boolean</td>
            <td>—</td>
            <td>true</td>
          </tr>
          <tr>
            <td>customClass</td>
            <td>自定义样式类</td>
            <td>String</td>
            <td>—</td>
            <td>''</td>
          </tr>
          <tr>
            <td>closeOnClickModal</td>
            <td>是否允许点击遮罩关闭</td>
            <td>Boolean</td>
            <td>—</td>
            <td>false</td>
          </tr>
          <tr>
            <td>closeOnPressEscape</td>
            <td>是否允许按 ESC 关闭</td>
            <td>Boolean</td>
            <td>—</td>
            <td>false</td>
          </tr>
          <tr>
            <td>showClose</td>
            <td>是否显示关闭按钮</td>
            <td>Boolean</td>
            <td>—</td>
            <td>true</td>
          </tr>
          <tr>
            <td>lockScroll</td>
            <td>是否锁定滚动</td>
            <td>Boolean</td>
            <td>—</td>
            <td>true</td>
          </tr>
          <tr>
            <td>modal</td>
            <td>是否显示遮罩</td>
            <td>Boolean</td>
            <td>—</td>
            <td>true</td>
          </tr>
          <tr>
            <td>modalAppendToBody</td>
            <td>遮罩是否插入 body</td>
            <td>Boolean</td>
            <td>—</td>
            <td>true</td>
          </tr>
          <tr>
            <td>appendToBody</td>
            <td>弹窗是否插入 body</td>
            <td>Boolean</td>
            <td>—</td>
            <td>true</td>
          </tr>
          <tr>
            <td>appendToSelector</td>
            <td>弹窗插入的选择器</td>
            <td>String</td>
            <td>—</td>
            <td>'.app-container'</td>
          </tr>
          <tr>
            <td>destroyOnClose</td>
            <td>关闭时是否销毁</td>
            <td>Boolean</td>
            <td>—</td>
            <td>true</td>
          </tr>
          <tr>
            <td>showDefaultButtons</td>
            <td>是否显示默认按钮</td>
            <td>Boolean</td>
            <td>—</td>
            <td>false</td>
          </tr>
          <tr>
            <td>loading</td>
            <td>是否显示加载状态</td>
            <td>Boolean</td>
            <td>—</td>
            <td>false</td>
          </tr>
          <tr>
            <td>isDraggable</td>
            <td>是否可拖拽</td>
            <td>Boolean</td>
            <td>—</td>
            <td>false</td>
          </tr>
          <tr>
            <td>configBtn</td>
            <td>按钮配置数组</td>
            <td>Array</td>
            <td>—</td>
            <td>[]</td>
          </tr>
          <tr>
            <td>render</td>
            <td>渲染函数 (支持 JSX)</td>
            <td>Function</td>
            <td>—</td>
            <td>—</td>
          </tr>
          <tr>
            <td>onSubmit</td>
            <td>确认回调</td>
            <td>Function</td>
            <td>—</td>
            <td>—</td>
          </tr>
          <tr>
            <td>onClosed</td>
            <td>关闭回调</td>
            <td>Function</td>
            <td>—</td>
            <td>—</td>
          </tr>
          <tr>
            <td>onOpen</td>
            <td>打开回调</td>
            <td>Function</td>
            <td>—</td>
            <td>—</td>
          </tr>
          <tr>
            <td>hiddenFullBtn</td>
            <td>是否隐藏全屏按钮</td>
            <td>Boolean</td>
            <td>—</td>
            <td>false</td>
          </tr>
          <tr>
            <td>fullscreen</td>
            <td>是否全屏</td>
            <td>Boolean</td>
            <td>—</td>
            <td>false</td>
          </tr>
        </tbody>
      </table>

      <h2>ConfigBtn 配置</h2>
      <table class="table-props">
        <thead>
          <tr>
            <th>参数</th>
            <th>说明</th>
            <th>类型</th>
            <th>可选值</th>
            <th>默认值</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>name</td>
            <td>按钮文本</td>
            <td>String</td>
            <td>—</td>
            <td>—</td>
          </tr>
          <tr>
            <td>type</td>
            <td>按钮类型</td>
            <td>String</td>
            <td>primary/success/warning/danger/info/text</td>
            <td>—</td>
          </tr>
          <tr>
            <td>key</td>
            <td>按钮标识</td>
            <td>String</td>
            <td>—</td>
            <td>—</td>
          </tr>
          <tr>
            <td>onClick</td>
            <td>点击事件（回调参数见下表）</td>
            <td>Function</td>
            <td>—</td>
            <td>—</td>
          </tr>
          <tr>
            <td>click</td>
            <td>点击事件（高级用法，instance 作为第一个参数）</td>
            <td>Function</td>
            <td>—</td>
            <td>—</td>
          </tr>
          <tr>
            <td>disabled</td>
            <td>是否禁用</td>
            <td>Boolean</td>
            <td>—</td>
            <td>false</td>
          </tr>
          <tr>
            <td>icon</td>
            <td>图标类名</td>
            <td>String</td>
            <td>—</td>
            <td>—</td>
          </tr>
          <tr>
            <td>size</td>
            <td>按钮大小</td>
            <td>String</td>
            <td>large/medium/small/mini</td>
            <td>—</td>
          </tr>
        </tbody>
      </table>

      <h2>返回值</h2>
      <p><code>useDialog</code> 返回一个函数，调用该函数传入配置即可打开弹窗，返回值包含以下属性：</p>
      <table class="table-props">
        <thead>
          <tr>
            <th>属性</th>
            <th>说明</th>
            <th>类型</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>close</td>
            <td>关闭弹窗的方法</td>
            <td>Function</td>
          </tr>
          <tr>
            <td>instance</td>
            <td>弹窗实例（可访问弹窗内部数据）</td>
            <td>VueComponent</td>
          </tr>
        </tbody>
      </table>

      <h2>按钮回调参数</h2>
      <p>按钮的 <code>onClick</code> 或 <code>click</code> 回调函数接收以下参数：</p>
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
            <td>close</td>
            <td>关闭弹窗的方法</td>
            <td>Function</td>
          </tr>
          <tr>
            <td>getRefs</td>
            <td>获取弹窗内容中的 ref（支持字符串或对象形式）</td>
            <td>Function/Object</td>
          </tr>
          <tr>
            <td>dialogVm</td>
            <td>弹窗实例</td>
            <td>VueComponent</td>
          </tr>
        </tbody>
      </table>
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
        <router-link to="/component/estable" class="next-step-card">
          <div class="next-step-icon">
            <i class="el-icon-s-grid" />
          </div>
          <div class="next-step-content">
            <h4>EsTable 表格组件</h4>
            <p>功能强大的表格组件，支持搜索、分页、多选、排序等</p>
          </div>
          <i class="el-icon-arrow-right next-step-arrow" />
        </router-link>
        <router-link to="/component/esform" class="next-step-card">
          <div class="next-step-icon">
            <i class="el-icon-s-order" />
          </div>
          <div class="next-step-content">
            <h4>EsForm 表单组件</h4>
            <p>基于配置驱动的表单组件，支持多种表单类型和验证</p>
          </div>
          <i class="el-icon-arrow-right next-step-arrow" />
        </router-link>
        <router-link to="/component/combination" class="next-step-card">
          <div class="next-step-icon">
            <i class="el-icon-connection" />
          </div>
          <div class="next-step-content">
            <h4>组合联动</h4>
            <p>EsTable + EsForm + useDialog 组合使用的最佳实践</p>
          </div>
          <i class="el-icon-arrow-right next-step-arrow" />
        </router-link>
      </div>
    </section>
  </div>
</template>

<script>
import CodePlayground from '@/components/CodePlayground.vue'
import { dialogExamples, getComponent, getRawCode } from '@/examples'

export default {
  name: 'EsDialogDocs',
  components: { CodePlayground },
  data() {
    return {
      dialogExamples
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
    margin: 30px 0 15px;
    padding-bottom: 10px;
    border-bottom: 1px solid #e4e7ed;
    color: #303133;
  }

  p {
    color: #28292d;
    line-height: 1.6;
    margin-bottom: 15px;

    code {
      background: #f4f4f5;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      color: #c0392b;
    }
  }

  ul {
    color: #606266;
    line-height: 1.8;
    margin-bottom: 15px;
    padding-left: 20px;

    li {
      margin-bottom: 5px;
    }

    code {
      background: #f4f4f5;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      color: #c0392b;
    }
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
}

// 自定义弹窗样式
.custom-dialog {
  border-radius: 10px;

  .el-dialog__header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 15px 20px;

    .el-dialog__title {
      color: white;
    }

    .el-dialog__headerbtn .el-dialog__close {
      color: white;
    }
  }
}
</style>
