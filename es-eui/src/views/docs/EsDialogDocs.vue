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
        <div class="section-icon" style="background: linear-gradient(135deg, var(--es-brand-primary) 0%, var(--es-brand-accent) 100%);">
          <i class="el-icon-s-operation" />
        </div>
        <h2 class="section-title">使用示例</h2>
      </div>
      <CodePlayground
        v-for="ex in dialogExamples"
        :key="ex.key"
        :id="'demo-' + ex.key"
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
      <el-alert
        type="info"
        :closable="false"
        style="margin-bottom: 12px"
        title="三端属性以各自渲染端为准"
        description="appendToBody / modalAppendToBody / components 只在 Vue 2 + Element UI 端存在（Element UI 的 el-dialog 没有「选择器挂载点」，appendTo 会退化为打开 append-to-body）。Vue 3 + Ant Design 端的 modal / alignCenter / top / modalClass，在本端对应 el-dialog 原生属性 modal / center / top / custom-class，经 attrs 透传。"
      />
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
            <td>cacheKey</td>
            <td>实例缓存键（useDialog 调用参数，不是 EsDialog 的 prop）：同 cacheKey 复用同一实例；不传则不缓存，关闭即销毁</td>
            <td>String</td>
            <td>—</td>
            <td>—</td>
          </tr>
          <tr>
            <td>title</td>
            <td>弹窗标题</td>
            <td>String</td>
            <td>—</td>
            <td>''</td>
          </tr>
          <tr>
            <td>visible</td>
            <td>是否显示</td>
            <td>Boolean</td>
            <td>—</td>
            <td>false</td>
          </tr>
          <tr>
            <td>width</td>
            <td>弹窗宽度</td>
            <td>String / Number</td>
            <td>—</td>
            <td>'50%'</td>
          </tr>
          <tr>
            <td>maxHeight</td>
            <td>内容区最大高度（Element UI 没有 height，只有这个）</td>
            <td>String / Number</td>
            <td>—</td>
            <td>undefined</td>
          </tr>
          <tr>
            <td>appendTo</td>
            <td>挂载点。Element UI 只支持布尔 append-to-body，传非 body 元素会显式告警</td>
            <td>Object / String</td>
            <td>body / DOM 元素</td>
            <td>undefined</td>
          </tr>
          <tr>
            <td>appendToBody</td>
            <td>弹窗是否插入 body</td>
            <td>Boolean</td>
            <td>—</td>
            <td>false</td>
          </tr>
          <tr>
            <td>modalAppendToBody</td>
            <td>遮罩是否插入 body</td>
            <td>Boolean</td>
            <td>—</td>
            <td>true</td>
          </tr>
          <tr>
            <td>closeOnClickModal</td>
            <td>点击遮罩是否关闭</td>
            <td>Boolean</td>
            <td>—</td>
            <td>true</td>
          </tr>
          <tr>
            <td>closeOnPressEscape</td>
            <td>按 ESC 是否关闭</td>
            <td>Boolean</td>
            <td>—</td>
            <td>true</td>
          </tr>
          <tr>
            <td>beforeClose</td>
            <td>关闭闸门：存在时 X / 遮罩 / ESC 关闭前先交给 done() 决定</td>
            <td>Function</td>
            <td>—</td>
            <td>—</td>
          </tr>
          <tr>
            <td>destroyOnClose</td>
            <td>关闭后是否销毁内容</td>
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
            <td>loading</td>
            <td>内容加载态（el-loading 遮罩）</td>
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
          <tr>
            <td>isHiddenFooter</td>
            <td>是否隐藏底部按钮区</td>
            <td>Boolean</td>
            <td>—</td>
            <td>false</td>
          </tr>
          <tr>
            <td>configBtn</td>
            <td>底部按钮配置数组（见下表「ConfigBtn 配置」）</td>
            <td>Array</td>
            <td>—</td>
            <td>[]</td>
          </tr>
          <tr>
            <td>render</td>
            <td>内容渲染函数（支持 JSX）</td>
            <td>Function</td>
            <td>—</td>
            <td>—</td>
          </tr>
          <tr>
            <td>renderHeader</td>
            <td>自定义头部渲染函数</td>
            <td>Function</td>
            <td>—</td>
            <td>—</td>
          </tr>
          <tr>
            <td>renderFooter</td>
            <td>自定义底部渲染函数</td>
            <td>Function</td>
            <td>—</td>
            <td>—</td>
          </tr>
          <tr>
            <td>components</td>
            <td>render 里可用的组件映射（EsTable / EsForm）</td>
            <td>Object</td>
            <td>—</td>
            <td>{}</td>
          </tr>
        </tbody>
      </table>

      <el-alert
        type="info"
        :closable="false"
        style="margin-bottom: 16px"
        title="center / customClass / top / lockScroll 等 el-dialog 原生属性未在组件内声明，会经 $attrs 透传到 el-dialog；组件没有 height（用 maxHeight）、appendToSelector、appendToClose、showDefaultButtons。"
      />

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
            <td>update:visible</td>
            <td>显示态变化（配合 .sync）</td>
            <td>visible: Boolean</td>
          </tr>
          <tr>
            <td>open</td>
            <td>弹窗打开后触发</td>
            <td>—</td>
          </tr>
          <tr>
            <td>closed</td>
            <td>关闭动画结束后触发</td>
            <td>—</td>
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
            <td>click</td>
            <td>点击事件，签名 <code>(currentRef, { close, getRefs, dialogInstance })</code>（见下表）</td>
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
          <tr>
            <td>destroy</td>
            <td>立即销毁实例（不经关闭动画，也不保留缓存）</td>
            <td>Function</td>
          </tr>
        </tbody>
      </table>

      <h2>按钮回调参数</h2>
      <p>只有 <code>click</code>（组件没有 <code>onClick</code>）：第一个参数是弹窗内容区的 ref，第二个参数是下面这个对象。</p>
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
            <td>Function</td>
          </tr>
          <tr>
            <td>dialogInstance</td>
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
          color: var(--es-brand-primary);
          background: #fff;
          border: 1px solid var(--es-brand-primary);
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 4px;

          &:hover {
            background: var(--es-brand-primary);
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
    background: linear-gradient(135deg, var(--es-brand-primary) 0%, var(--es-brand-accent) 100%);
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
