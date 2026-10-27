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
            <CodeDemo :source="rawSFCs['./es-dialog/Basic.vue']">
        <EsDialogBasic />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 表单弹窗 -->
    <section id="form">
      <h2>表单弹窗</h2>
      <p>结合 EsForm 在弹窗中展示表单。</p>
            <CodeDemo :source="rawSFCs['./es-dialog/Form.vue']">
        <EsDialogForm />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 表格弹窗 -->
    <section id="table">
      <h2>表格弹窗</h2>
      <p>结合 EsTable 在弹窗中展示表格数据。</p>
            <CodeDemo :source="rawSFCs['./es-dialog/TableDialog.vue']">
        <EsDialogTable />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 确认弹窗 -->
    <section id="confirm">
      <h2>确认弹窗：三档语气 + 关闭拦截</h2>
      <p>danger / warning / neutral 三档语气，<code>configBtn</code> 自定义按钮；<code>beforeClose(done)</code> 拦住 X / 遮罩 / ESC。</p>
            <CodeDemo :source="rawSFCs['./es-dialog/Confirm.vue']">
        <EsDialogConfirm />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 高级弹窗 -->
    <section id="advanced">
      <h2>定制与实例缓存</h2>
      <p>可拖拽、自定义头尾、全屏、限高；<code>cacheKey</code> 缓存实例，关掉再开输入内容还在。</p>
            <CodeDemo :source="rawSFCs['./es-dialog/Advanced.vue']">
        <EsDialogAdvanced />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 嵌套弹窗 -->
    <section id="nested">
      <h2>嵌套弹窗</h2>
      <p>独立 useDialog 实例，支持父子弹窗通信。</p>
            <CodeDemo :source="rawSFCs['./es-dialog/NestedModal.vue']">
        <EsDialogNestedModal />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 分步弹窗 -->
    <section id="step">
      <h2>分步弹窗</h2>
      <p>多步骤 EsForm 切换，每步独立校验。</p>
            <CodeDemo :source="rawSFCs['./es-dialog/StepDialog.vue']">
        <EsDialogStepDialog />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 表单+表格+弹窗闭环 -->
    <section id="form-table-dialog">
      <h2>表单+表格+弹窗闭环</h2>
      <p>弹窗内 EsTable 展示数据 + btns 行操作触发编辑弹窗 + configBtn 新增弹窗，三级弹窗嵌套 CRUD。</p>
            <CodeDemo :source="rawSFCs['./es-dialog/FormTableDialog.vue']">
        <EsDialogFormTableDialog />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 异步组件弹窗 -->
    <section id="async">
      <h2>异步组件弹窗</h2>
      <p><code>defineAsyncComponent</code> 实现弹窗内容延迟加载。</p>
            <CodeDemo :source="rawSFCs['./es-dialog/Async.vue']">
        <EsDialogAsync />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 详情预览弹窗 -->
    <section id="detail-preview">
      <h2>详情预览弹窗</h2>
      <p>配置化详情展示，<code>isHiddenFooter</code> 无按钮模式，动态渲染不同业务对象。</p>
            <CodeDemo :source="rawSFCs['./es-dialog/DetailPreview.vue']">
        <EsDialogDetailPreview />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 动态按钮状态弹窗 -->
    <section id="dynamic-btn">
      <h2>动态按钮状态弹窗</h2>
      <p>审批场景：Radio 切换操作类型，按钮 disabled 函数式动态禁用，条件校验。</p>
            <CodeDemo :source="rawSFCs['./es-dialog/DynamicBtn.vue']">
        <EsDialogDynamicBtn />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 多实例独立弹窗 -->
    <section id="multi-instance">
      <h2>多实例独立弹窗</h2>
      <p><code>onlyInstance: false</code> 模式，同时打开多个独立弹窗，各自拖拽互不影响。</p>
            <CodeDemo :source="rawSFCs['./es-dialog/MultiInstance.vue']">
        <EsDialogMultiInstance />
      </CodeDemo>
    </section>

    <a-divider />

    <h2>API / 属性</h2>
    <p>
      属性以本渲染端（Vue 3 + Ant Design Vue）为准。与 Element Plus 端的差异：
      <code>appendTo</code> 在这里是挂载容器（等价于 Element Plus 的同名属性）；
      Element Plus 及其 Vue 2 端独有的 <code>appendToBody</code> / <code>modalAppendToBody</code> / <code>components</code>
      在本端不存在，请改用 <code>appendTo</code>。本端独有的 <code>top</code> / <code>modalClass</code>，
      在 Element Plus 端对应 <code>top</code> / <code>modal-class</code>。
    </p>
    <a-table
      :dataSource="dialogProps"
      :columns="propColumns"
      :pagination="false"
      size="small"
      bordered
    />

    <h2>事件</h2>
    <a-table
      :dataSource="dialogEvents"
      :columns="eventColumns"
      :pagination="false"
      size="small"
      bordered
    />

    <h2>ConfigBtn 配置</h2>
    <p>
      <code>configBtn</code> 的每一项。<code>click</code> 的签名是
      <code>(bodyRef, { close, getRefs, dialogInstance })</code>——只有 <code>click</code>，
      没有 <code>onClick</code>；其余未列出的键会透传给底层按钮。
    </p>
    <a-table
      :dataSource="dialogBtns"
      :columns="propColumns"
      :pagination="false"
      size="small"
      bordered
    />

    <h2>方法</h2>
    <a-table
      :dataSource="dialogMethods"
      :columns="methodColumns"
      :pagination="false"
      size="small"
      bordered
    />
  </div>
</template>

<script setup>
import CodeDemo from '@/components/CodeDemo.vue'
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

const rawSFCs = import.meta.glob('./es-dialog/*.vue', { query: '?raw', import: 'default', eager: true })

const propColumns = [
  { title: '属性', dataIndex: 'prop', key: 'prop', width: 140 },
  { title: '类型', dataIndex: 'type', key: 'type', width: 100 },
  { title: '默认值', dataIndex: 'default', key: 'default', width: 100 },
  { title: '说明', dataIndex: 'desc', key: 'desc' },
]

const eventColumns = [
  { title: '事件', dataIndex: 'event', key: 'event', width: 220 },
  { title: '回调参数', dataIndex: 'params', key: 'params', width: 200 },
  { title: '说明', dataIndex: 'desc', key: 'desc' },
]

const methodColumns = [
  { title: '方法', dataIndex: 'prop', key: 'prop', width: 200 },
  { title: '说明', dataIndex: 'desc', key: 'desc' },
]

const dialogProps = [
  { key: '1', prop: 'title', type: 'string | function', default: "'弹窗'", desc: '弹窗标题，支持函数动态标题' },
  { key: '2', prop: 'width', type: 'string | number', default: "'600px'", desc: '弹窗宽度' },
  { key: '3', prop: 'visible', type: 'boolean', default: 'false', desc: '是否显示（配合 v-model:visible）' },
  { key: '4', prop: 'render', type: 'function', default: '-', desc: '自定义渲染内容 (h, instance, components) => VNode' },
  { key: '5', prop: 'renderHeader', type: 'function', default: '-', desc: '自定义头部渲染 (h, instance) => VNode' },
  { key: '6', prop: 'renderFooter', type: 'function', default: '-', desc: '自定义底部渲染 (h, instance) => VNode' },
  { key: '7', prop: 'configBtn', type: 'BtnConfig[]', default: '[]', desc: '底部按钮配置' },
  { key: '8', prop: 'isDraggable', type: 'boolean', default: 'false', desc: '是否可拖拽' },
  { key: '9', prop: 'fullscreen', type: 'boolean', default: 'false', desc: '是否全屏' },
  { key: '10', prop: 'hiddenFullBtn', type: 'boolean', default: 'false', desc: '是否隐藏全屏按钮' },
  { key: '11', prop: 'isHiddenFooter', type: 'boolean', default: 'false', desc: '是否隐藏底部按钮区' },
  { key: '12', prop: 'maxHeight', type: 'string | number', default: '-', desc: '内容区最大高度' },
  { key: '13', prop: 'appendTo', type: 'string | HTMLElement', default: '-', desc: '挂载点' },
  { key: '14', prop: 'showClose', type: 'boolean', default: 'true', desc: '是否显示右上角关闭按钮' },
  { key: '15', prop: 'loading', type: 'boolean', default: 'false', desc: '是否显示加载状态' },
  { key: '16', prop: 'destroyOnClose', type: 'boolean', default: 'false', desc: '关闭时销毁内容 DOM' },
  { key: '17', prop: 'modal', type: 'boolean', default: 'true', desc: '是否显示遮罩' },
  { key: '18', prop: 'closeOnClickModal', type: 'boolean', default: 'true', desc: '点击遮罩是否关闭' },
  { key: '19', prop: 'closeOnPressEscape', type: 'boolean', default: 'true', desc: '按 ESC 是否关闭' },
  { key: '20', prop: 'beforeClose', type: 'function', default: '-', desc: '关闭闸门：存在时先交给 done() 决定' },
  { key: '21', prop: 'alignCenter', type: 'boolean', default: 'true', desc: '是否垂直居中' },
  { key: '22', prop: 'top', type: 'string', default: '-', desc: '距顶部距离' },
  { key: '23', prop: 'modalClass', type: 'string', default: '-', desc: '遮罩层样式类' },
]

const dialogEvents = [
  { key: '1', event: 'update:visible', params: '(visible)', desc: '显隐变化（配合 v-model:visible）' },
  { key: '2', event: 'closed', params: '(visible)', desc: '关闭后回调（useDialog 里也可写成 onClosed 选项）' },
  { key: '3', event: 'open', params: '-', desc: '弹窗显示时派发（声明式与 useDialog 两条路径都发）' },
]

const dialogMethods = [
  { key: '1', prop: 'close', params: '()', desc: '关闭弹窗' },
  { key: '2', prop: 'closed', params: '()', desc: '关闭弹窗（close 的别名）' },
  { key: '3', prop: 'toggleFullscreen', params: '()', desc: '切换全屏' },
  { key: '4', prop: 'doClose', params: '()', desc: '执行关闭流程（受 beforeClose 约束）' },
]

const dialogBtns = [
  { key: '1', prop: 'name', type: 'string', default: '-', desc: '按钮文本' },
  { key: '2', prop: 'key', type: 'string', default: '-', desc: '按钮唯一标识' },
  { key: '3', prop: 'type', type: 'string', default: 'default', desc: '按钮类型：primary / default / dashed / text / link / danger' },
  { key: '4', prop: 'size', type: 'string', default: '-', desc: '按钮尺寸：large / middle / small' },
  { key: '5', prop: 'icon', type: 'string', default: '-', desc: '图标名称' },
  { key: '6', prop: 'loading', type: 'boolean', default: 'false', desc: '加载态' },
  { key: '7', prop: 'disabled', type: 'boolean | Function', default: 'false', desc: '禁用状态，支持函数动态判断' },
  { key: '8', prop: 'permissionValue', type: 'string', default: '-', desc: '按钮级权限编码' },
  { key: '9', prop: 'direction', type: 'string', default: '-', desc: '按钮区方向：left / right' },
  { key: '10', prop: 'click', type: 'Function', default: '-', desc: '(bodyRef, { close, getRefs, dialogInstance }) => void' },
]
</script>

<style scoped>
h1 { font-size: var(--es-text-3xl); font-weight: 700; color: #1a1a2e; margin-bottom: 8px; }
.subtitle { color: #666; font-size: 15px; line-height: 1.8; }
h2 { font-size: var(--es-text-2xl); font-weight: 600; margin: 0 0 16px; color: #1a1a2e; }
section { scroll-margin-top: 100px; }
section p { color: #555; line-height: 1.8; margin-bottom: 16px; }
code { background: #f5f5f5; padding: 2px 6px; border-radius: 4px; font-family: 'Fira Code', monospace; font-size: 13px; color: #d63384; }
</style>
