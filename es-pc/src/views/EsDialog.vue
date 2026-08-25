<template>
  <div class="es-dialog-page">
    <h1>EsDialog 动态弹窗</h1>
    <p class="subtitle">
      EsDialog 提供声明式组件和命令式 <code>useDialog()</code> API 两种使用方式。
      支持自定义渲染、按钮配置、可拖拽、全屏等功能。使用 <code>@es-plus/adapter-antdv</code> 适配 Ant Design Vue 的 <code>a-modal</code>。
    </p>

    <a-divider />

    <!-- 基础弹窗 -->
    <section id="basic">
      <h2>基础弹窗</h2>
      <p>使用 <code>useDialog()</code> 命令式 API 打开弹窗。</p>
      <EsDialogBasic />
    </section>

    <a-divider />

    <!-- 表单弹窗 -->
    <section id="form">
      <h2>表单弹窗</h2>
      <p>结合 EsForm 在弹窗中展示表单。</p>
      <EsDialogForm />
    </section>

    <a-divider />

    <!-- 表格弹窗 -->
    <section id="table">
      <h2>表格弹窗</h2>
      <p>结合 EsTable 在弹窗中展示表格数据。</p>
      <EsDialogTable />
    </section>

    <a-divider />

    <!-- 确认弹窗 -->
    <section id="confirm">
      <h2>确认弹窗</h2>
      <p>使用 Confirm 模式快速创建确认对话框。</p>
      <EsDialogConfirm />
    </section>

    <a-divider />

    <!-- 高级弹窗 -->
    <section id="advanced">
      <h2>高级弹窗</h2>
      <p>可拖拽 + 自定义头尾 + 全屏 + 限高。</p>
      <EsDialogAdvanced />
    </section>

    <a-divider />

    <!-- 嵌套弹窗 -->
    <section id="nested">
      <h2>嵌套弹窗</h2>
      <p>独立 useDialog 实例，支持父子弹窗通信。</p>
      <EsDialogNestedModal />
    </section>

    <a-divider />

    <!-- 分步弹窗 -->
    <section id="step">
      <h2>分步弹窗</h2>
      <p>多步骤 EsForm 切换，每步独立校验。</p>
      <EsDialogStepDialog />
    </section>

    <a-divider />

    <!-- 表单+表格+弹窗闭环 -->
    <section id="form-table-dialog">
      <h2>表单+表格+弹窗闭环</h2>
      <p>弹窗内 EsTable 展示数据 + btns 行操作触发编辑弹窗 + configBtn 新增弹窗，三级弹窗嵌套 CRUD。</p>
      <EsDialogFormTableDialog />
    </section>

    <a-divider />

    <!-- 异步组件弹窗 -->
    <section id="async">
      <h2>异步组件弹窗</h2>
      <p><code>defineAsyncComponent</code> 实现弹窗内容延迟加载。</p>
      <EsDialogAsync />
    </section>

    <a-divider />

    <!-- 详情预览弹窗 -->
    <section id="detail-preview">
      <h2>详情预览弹窗</h2>
      <p>配置化详情展示，<code>isHiddenFooter</code> 无按钮模式，动态渲染不同业务对象。</p>
      <EsDialogDetailPreview />
    </section>

    <a-divider />

    <!-- 动态按钮状态弹窗 -->
    <section id="dynamic-btn">
      <h2>动态按钮状态弹窗</h2>
      <p>审批场景：Radio 切换操作类型，按钮 disabled 函数式动态禁用，条件校验。</p>
      <EsDialogDynamicBtn />
    </section>

    <a-divider />

    <!-- 多实例独立弹窗 -->
    <section id="multi-instance">
      <h2>多实例独立弹窗</h2>
      <p><code>onlyInstance: false</code> 模式，同时打开多个独立弹窗，各自拖拽互不影响。</p>
      <EsDialogMultiInstance />
    </section>

    <a-divider />

    <h2>API / 属性</h2>
    <a-table
      :dataSource="dialogProps"
      :columns="propColumns"
      :pagination="false"
      size="small"
      bordered
    />
  </div>
</template>

<script setup>
import EsDialogBasic from './es-dialog/Basic.vue'
import EsDialogForm from './es-dialog/Form.vue'
import EsDialogTable from './es-dialog/TableDialog.vue'
import EsDialogConfirm from './es-dialog/Confirm.vue'
import EsDialogAdvanced from './es-dialog/Advanced.vue'
import EsDialogNestedModal from './es-dialog/NestedModal.vue'
import EsDialogStepDialog from './es-dialog/StepDialog.vue'
import EsDialogFormTableDialog from './es-dialog/FormTableDialog.vue'
import EsDialogAsync from './es-dialog/Async.vue'
import EsDialogDetailPreview from './es-dialog/DetailPreview.vue'
import EsDialogDynamicBtn from './es-dialog/DynamicBtn.vue'
import EsDialogMultiInstance from './es-dialog/MultiInstance.vue'

const propColumns = [
  { title: '属性', dataIndex: 'prop', key: 'prop', width: 140 },
  { title: '类型', dataIndex: 'type', key: 'type', width: 100 },
  { title: '默认值', dataIndex: 'default', key: 'default', width: 100 },
  { title: '说明', dataIndex: 'desc', key: 'desc' },
]

const dialogProps = [
  { key: '1', prop: 'title', type: 'string | function', default: '""', desc: '弹窗标题，支持函数动态标题' },
  { key: '2', prop: 'width', type: 'string | number', default: '520', desc: '弹窗宽度' },
  { key: '3', prop: 'render', type: 'function', default: '-', desc: '自定义渲染内容' },
  { key: '4', prop: 'configBtn', type: 'BtnConfig[]', default: '[]', desc: '底部按钮配置' },
  { key: '5', prop: 'onSubmit', type: 'function', default: '-', desc: '确认回调，接收 close 函数' },
  { key: '6', prop: 'onClosed', type: 'function', default: '-', desc: '关闭后回调' },
  { key: '7', prop: 'isDraggable', type: 'boolean', default: 'false', desc: '是否可拖拽' },
  { key: '8', prop: 'fullscreen', type: 'boolean', default: 'false', desc: '是否全屏' },
]
</script>

<style scoped>
h1 { font-size: 30px; font-weight: 700; color: #1a1a2e; margin-bottom: 8px; }
.subtitle { color: #666; font-size: 15px; line-height: 1.8; }
h2 { font-size: 22px; font-weight: 600; margin: 0 0 16px; color: #1a1a2e; }
section { scroll-margin-top: 100px; }
section p { color: #555; line-height: 1.8; margin-bottom: 16px; }
code { background: #f5f5f5; padding: 2px 6px; border-radius: 4px; font-family: 'Fira Code', monospace; font-size: 13px; color: #d63384; }
</style>
