<template>
  <div class="es-crud-page">
    <h1>EsCrudPage CRUD 编排</h1>
    <p class="subtitle">
      EsCrudPage 是 EsForm + EsTable + EsDialog 的集合编排组件，用一份 JSON Schema
      即可完成整个 CRUD 页面的配置。支持多弹窗、权限控制、行级操作、编程式打开弹窗等。
      使用 <code>@es-plus/adapter-antdv</code> 适配 Ant Design Vue 4.x。
    </p>

    <a-divider />

    <!-- 基础 CRUD -->
    <section id="basic">
      <h2>基础 CRUD</h2>
      <p>配置查询表单 + 数据表格 + 增删改弹窗，一份 Schema 搞定。</p>
            <CodeDemo :source="rawSFCs['./es-crud/Basic.vue']">
        <EsCrudBasic />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 多弹窗 -->
    <section id="multi-dialog">
      <h2>多弹窗绑定</h2>
      <p><code>dialogs</code> 一个键对应一个弹窗实例，按钮的 <code>dialogKey</code> 决定打开哪一个（新增 / 编辑 / 详情）。</p>
            <CodeDemo :source="rawSFCs['./es-crud/MultiDialog.vue']">
        <EsCrudMultiDialog />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 权限控制 -->
    <section id="permission">
      <h2>权限控制</h2>
      <p>通过 <code>permissionValue</code> 控制按钮显隐，结合全局 <code>permission</code> 校验。</p>
            <CodeDemo :source="rawSFCs['./es-crud/Permission.vue']">
        <EsCrudPermission />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 编程式打开弹窗 -->
    <section id="program-open">
      <h2>编程式打开弹窗</h2>
      <p>通过 <code>ref</code> 调用 <code>openDialog(key, data?)</code> 编程式打开弹窗。</p>
            <CodeDemo :source="rawSFCs['./es-crud/ProgramOpen.vue']">
        <EsCrudProgramOpen />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 自定义弹窗内容 -->
    <section id="custom-render">
      <h2>自定义弹窗内容</h2>
      <p><code>dialogs</code> 使用 <code>render</code> 函数渲染自定义组件。</p>
            <CodeDemo :source="rawSFCs['./es-crud/CustomRender.vue']">
        <EsCrudCustomRender />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 动态标题 -->
    <section id="dynamic-title">
      <h2>动态标题与回填</h2>
      <p>edit 弹窗 title 为函数 + 表单自动回填行数据。</p>
            <CodeDemo :source="rawSFCs['./es-crud/DynamicTitle.vue']">
        <EsCrudDynamicTitle />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 行确认 -->
    <section id="row-confirm">
      <h2>行确认与删除</h2>
      <p>操作列 <code>confirm</code> 确认提示 + <code>btn-click</code> 事件处理删除/发布。</p>
            <CodeDemo :source="rawSFCs['./es-crud/RowConfirm.vue']">
        <EsCrudRowConfirm />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 完整业务 -->
    <section id="full-business">
      <h2>完整业务场景</h2>
      <p>用户管理全功能：多弹窗 + 动态标题 + render 详情 + 导出。</p>
            <CodeDemo :source="rawSFCs['./es-crud/FullBusiness.vue']">
        <EsCrudFullBusiness />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 自定义弹窗底部 -->
    <section id="custom-footer">
      <h2>自定义弹窗底部</h2>
      <p><code>configBtn</code> 自定义三按钮（取消/拒绝/通过）实现审批场景。</p>
            <CodeDemo :source="rawSFCs['./es-crud/CustomFooter.vue']">
        <EsCrudCustomFooter />
      </CodeDemo>
    </section>

    <a-divider />

    <!-- 隐藏操作列 -->
    <section id="hidden-column">
      <h2>隐藏操作列</h2>
      <p><code>operationColumn: false</code> + 纯工具栏操作，只读列表场景。</p>
            <CodeDemo :source="rawSFCs['./es-crud/HiddenColumn.vue']">
        <EsCrudHiddenColumn />
      </CodeDemo>
    </section>

    <a-divider />

    <h2>API / 属性</h2>
    <a-table
      :dataSource="crudProps"
      :columns="propColumns"
      :pagination="false"
      size="small"
      bordered
    />

    <h2>Schema 结构</h2>
    <p>
      schema 的每个顶层键分别交给一个子组件：<code>formItems</code> 交给 EsForm，
      <code>columns</code> / <code>tableOptions</code> / <code>pagination</code> 交给 EsTable，
      <code>dialogs</code> 交给弹窗层。三端字段名与语义一致。
    </p>
    <a-table
      :dataSource="crudSchema"
      :columns="propColumns"
      :pagination="false"
      size="small"
      bordered
    />

    <h2>CrudBtnConfig 按钮配置</h2>
    <p>
      <code>toolbarBtns</code> 的每一项；<code>tableBtns</code>（TableBtnConfig）键相同，
      另有 <code>position</code> / <code>code</code> 决定渲染在表格上方的左侧还是右侧。
    </p>
    <a-table
      :dataSource="crudBtnConfigs"
      :columns="propColumns"
      :pagination="false"
      size="small"
      bordered
    />

    <h2>OperationColumnConfig 操作列配置</h2>
    <a-table
      :dataSource="crudOperationColumns"
      :columns="propColumns"
      :pagination="false"
      size="small"
      bordered
    />

    <h2>RowBtnConfig 行按钮配置</h2>
    <p>
      <code>operationColumn.btns</code> 的每一项，渲染成操作列里的按钮。
    </p>
    <a-table
      :dataSource="crudRowBtns"
      :columns="propColumns"
      :pagination="false"
      size="small"
      bordered
    />

    <h2>Dialogs 配置</h2>
    <p>
      <code>dialogs</code> 的每个键对应一个弹窗实例，按钮上的 <code>dialogKey</code> 决定打开哪一个。
    </p>
    <a-table
      :dataSource="crudDialogs"
      :columns="propColumns"
      :pagination="false"
      size="small"
      bordered
    />

    <h2>事件</h2>
    <a-table
      :dataSource="crudEvents"
      :columns="eventColumns"
      :pagination="false"
      size="small"
      bordered
    />

    <h2>方法</h2>
    <p>通过 <code>ref</code> 调用，三端同名同义。</p>
    <a-table
      :dataSource="crudMethods"
      :columns="methodColumns"
      :pagination="false"
      size="small"
      bordered
    />
  </div>
</template>

<script setup>
import CodeDemo from '@/components/CodeDemo.vue'
import EsCrudBasic from './es-crud/Basic.vue'
import EsCrudMultiDialog from './es-crud/MultiDialog.vue'
import EsCrudPermission from './es-crud/Permission.vue'
import EsCrudProgramOpen from './es-crud/ProgramOpen.vue'
import EsCrudCustomRender from './es-crud/CustomRender.vue'
import EsCrudDynamicTitle from './es-crud/DynamicTitle.vue'
import EsCrudRowConfirm from './es-crud/RowConfirm.vue'
import EsCrudFullBusiness from './es-crud/FullBusiness.vue'
import EsCrudCustomFooter from './es-crud/CustomFooter.vue'
import EsCrudHiddenColumn from './es-crud/HiddenColumn.vue'

const rawSFCs = import.meta.glob('./es-crud/*.vue', { query: '?raw', import: 'default', eager: true })

const propColumns = [
  { title: '属性', dataIndex: 'prop', key: 'prop', width: 140 },
  { title: '类型', dataIndex: 'type', key: 'type', width: 100 },
  { title: '默认值', dataIndex: 'default', key: 'default', width: 100 },
  { title: '说明', dataIndex: 'desc', key: 'desc' },
]

const eventColumns = [
  { title: '事件', dataIndex: 'event', key: 'event', width: 220 },
  { title: '回调参数', dataIndex: 'params', key: 'params', width: 220 },
  { title: '说明', dataIndex: 'desc', key: 'desc' },
]

const methodColumns = [
  { title: '方法 / 属性', dataIndex: 'prop', key: 'prop', width: 200 },
  { title: '说明', dataIndex: 'desc', key: 'desc' },
]

const crudProps = [
  { key: '1', prop: 'schema', type: 'CrudPageSchema', default: '{}', desc: 'CRUD 页面完整配置（见下方 Schema 结构）' },
  { key: '2', prop: 'httpRequest', type: 'Function', default: '-', desc: '请求函数 (params) => Promise，也可写在 schema.tableOptions 里' },
  { key: '3', prop: 'autoLoad', type: 'boolean', default: 'true', desc: '挂载后是否自动加载首屏数据' },
]

const crudSchema = [
  { key: '1', prop: 'formItems', type: 'FormItemOption[]', default: '[]', desc: '查询表单字段配置（透传给 EsForm 的 formItemList）；为空则不渲染查询表单' },
  { key: '2', prop: 'formLayout', type: 'object', default: '-', desc: '查询表单布局：labelWidth、minFoldRows' },
  { key: '3', prop: 'toolbarBtns', type: 'CrudBtnConfig[]', default: '-', desc: '工具栏按钮（渲染在 EsForm 的按钮区）；不声明时按推导出的 actions 自动生成' },
  { key: '4', prop: 'tableBtns', type: 'TableBtnConfig[]', default: '-', desc: '表格工具栏按钮，渲染在 EsTable 上方的 configBtn 区，可用 position 指定左右' },
  { key: '5', prop: 'columns', type: 'TableColumn[]', default: '-', desc: '表格列配置（必填，同 EsTable columns）' },
  { key: '6', prop: 'tableOptions', type: 'TableOptions', default: '{}', desc: '表格选项配置，与 EsTable 的 options 同源' },
  { key: '7', prop: 'pagination', type: 'PaginationConfig', default: '-', desc: '分页配置 { current, pageSize, total, pageSizes }（pageIndex 只是请求参数名）' },
  { key: '8', prop: 'operationColumn', type: 'OperationColumnConfig | false', default: '-', desc: '操作列配置；false 隐藏操作列，对象则按给的定义渲染' },
  { key: '9', prop: 'dialogs', type: 'Record<string, CrudDialogConfig>', default: '-', desc: '多弹窗配置，键名即按钮 dialogKey 取的值（见下方 Dialogs 配置）' },
  { key: '10', prop: 'actions', type: 'CrudAction[]', default: '-', desc: '已废弃：用 toolbarBtns + operationColumn 替代' },
  { key: '11', prop: 'dialogFormItems / dialogOptions / queryBtns', type: '-', default: '-', desc: '已废弃：用 dialogs / toolbarBtns 替代' },
]

const crudBtnConfigs = [
  { key: '1', prop: 'name', type: 'string', default: '必填', desc: '按钮文本' },
  { key: '2', prop: 'key', type: 'string', default: '-', desc: '按钮标识；query / add / export 有内建语义，其余经 btn-click 派发' },
  { key: '3', prop: 'type', type: 'string', default: '-', desc: '按钮风格：primary / default / dashed / text / link / danger（映射到 a-button）；success / warning 在 ant-design-vue 无对应色板，降级为 default' },
  { key: '4', prop: 'size', type: 'string', default: '-', desc: '按钮尺寸；tableBtns 缺省 small' },
  { key: '5', prop: 'icon', type: 'string', default: '-', desc: '图标名称' },
  { key: '6', prop: 'position', type: 'string', default: 'left', desc: '左右位置：left / right（tableBtns 用它分组；toolbarBtns 由 EsForm 按钮区布局决定）' },
  { key: '7', prop: 'code', type: '1 | 2', default: '-', desc: '位置旧写法：2 视为 right，其余视为 left（position 优先）' },
  { key: '8', prop: 'direction', type: 'string', default: '-', desc: '表单按钮的左右方向：left / right（取值链 direction → position → code → right，direction 优先级最高）；表格 / 弹窗按钮不读它，按 position / code 分组' },
  { key: '9', prop: 'loading', type: 'boolean', default: 'false', desc: '加载态（禁用点击并显示 loading）' },
  { key: '10', prop: 'disabled', type: 'boolean | Function', default: 'false', desc: '禁用状态，支持函数动态判断' },
  { key: '11', prop: 'permissionValue', type: 'string', default: '-', desc: '按钮级权限编码，无权限时不渲染' },
  { key: '12', prop: 'triggerEvent', type: 'boolean', default: 'false', desc: '仅 toolbarBtns：key 为 query / rest 时点击触发一次表格刷新' },
  { key: '13', prop: 'click', type: 'Function', default: '-', desc: '(model, formRef?) => void；tableBtns 中的 click 会被 CRUD 页接管（改走 dialogKey / actionType）' },
  { key: '14', prop: 'dialogKey', type: 'string', default: '-', desc: '点击时打开 dialogs 里对应的弹窗' },
  { key: '15', prop: 'actionType', type: 'string', default: '-', desc: '语义动作（如 export / import），无 key 时兜底作语义键' },
  { key: '16', prop: 'confirm', type: 'string | boolean', default: '-', desc: '点击前的二次确认（true 用默认文案）' },
]

const crudOperationColumns = [
  { key: '1', prop: 'label', type: 'string', default: '操作', desc: '列标题' },
  { key: '2', prop: 'width', type: 'number | string', default: '-', desc: '列宽，缺省按按钮数自动计算（btns.length * 80 + 20）' },
  { key: '3', prop: 'fixed', type: 'boolean | string', default: 'right', desc: '固定方向' },
  { key: '4', prop: 'btns', type: 'RowBtnConfig[]', default: '必填', desc: '行操作按钮列表' },
]

const crudRowBtns = [
  { key: '1', prop: 'name', type: 'string', default: '必填', desc: '按钮文字' },
  { key: '2', prop: 'key', type: 'string', default: '-', desc: '按钮标识（用于 btn-click 事件与内建 edit / view / delete 语义）' },
  { key: '3', prop: 'type', type: 'string', default: '-', desc: '按钮类型' },
  { key: '4', prop: 'icon', type: 'string', default: '-', desc: '图标' },
  { key: '5', prop: 'permissionValue', type: 'string', default: '-', desc: '权限标识' },
  { key: '6', prop: 'dialogKey', type: 'string', default: '-', desc: '点击时打开的弹窗 key，自动将当前行数据传入' },
  { key: '7', prop: 'confirm', type: 'string | boolean', default: '-', desc: '点击前确认提示（如删除确认）' },
  { key: '8', prop: 'hidden', type: 'boolean | Function', default: '-', desc: '是否隐藏，支持 (row) => boolean 动态判断' },
  { key: '9', prop: 'click', type: 'Function', default: '-', desc: '自定义点击处理 (row, { refresh, getSelectedRows, openDialog }) => void；提供后不再走 dialogKey' },
]

const crudDialogs = [
  { key: '1', prop: 'title', type: 'string | Function', default: '-', desc: '弹窗标题，可传 (row) => string 按行生成' },
  { key: '2', prop: 'width', type: 'string | number', default: '-', desc: '弹窗宽度' },
  { key: '3', prop: 'formItems / formLayout', type: 'FormItemOption[] / object', default: '-', desc: '弹窗内表单的字段与布局，与 EsForm 的配置同源' },
  { key: '4', prop: 'render', type: 'Function', default: '-', desc: '完全自定义内容：(h, { row, model, registerRef, close, refresh }) => VNode（registerRef 注册的引用可被 footer 按钮经 getRefs 取到）' },
  { key: '5', prop: 'configBtn', type: 'DialogBtnConfig[]', default: '-', desc: '底部按钮配置，action 可取 confirm / cancel / custom' },
  { key: '6', prop: 'isHiddenFooter', type: 'boolean', default: 'false', desc: '隐藏默认底部按钮（自绘导航时用）' },
  { key: '7', prop: 'maxHeight / fullscreen / isDraggable', type: 'string | number / boolean', default: '-', desc: '弹窗样式与交互' },
  { key: '8', prop: 'showClose / destroyOnClose / modal / closeOnClickModal / closeOnPressEscape / hiddenFullBtn / appendTo / cacheKey', type: '-', default: '-', desc: '弹窗底座属性，逐键透传给弹窗层；cacheKey 复用时保留内部状态' },
  { key: '9', prop: 'hasCustomRender', type: 'boolean', default: '-', desc: 'AI 生成器注解键：生成器据此转成 TODO 占位；运行时白名单刻意不转发，不是弹窗 prop' },
  { key: '10', prop: 'onOpen / onConfirm / onClose', type: 'Function', default: '-', desc: '生命周期回调；onConfirm(data, { close, refresh, getRefs, row })' },
]

const crudEvents = [
  { key: '1', event: 'query', params: '(model)', desc: '查询条件变化' },
  { key: '2', event: 'add', params: '-', desc: '点击新增' },
  { key: '3', event: 'edit', params: '(row)', desc: '点击编辑' },
  { key: '4', event: 'delete', params: '(row)', desc: '点击删除' },
  { key: '5', event: 'view', params: '(row)', desc: '点击查看' },
  { key: '6', event: 'export', params: '(model)', desc: '点击导出' },
  { key: '7', event: 'row-click', params: '(row)', desc: '行点击' },
  { key: '8', event: 'btn-click', params: '(key, payload?)', desc: '工具栏按钮点击（携带按钮 key）' },
  { key: '9', event: 'dialog-confirm', params: '(dialogKey, data)', desc: '弹窗确认' },
  { key: '10', event: 'dialog-cancel', params: '(dialogKey)', desc: '弹窗取消' },
  { key: '11', event: 'dialog-open', params: '(dialogKey, row?)', desc: '弹窗打开' },
  { key: '12', event: 'cell-edit', params: '({ row, prop, value, oldValue })', desc: 'vxe 行内编辑提交（透传 es-table）：每改一格发一条，未改值不发' },
]

const crudMethods = [
  { key: '1', prop: 'refresh', params: '()', desc: '刷新表格（保留当前查询条件）' },
  { key: '2', prop: 'getSelectedRows', params: '()', desc: '取表格当前勾选行' },
  { key: '3', prop: 'tableRef', params: '-', desc: '底层 EsTable 实例' },
  { key: '4', prop: 'formRef', params: '-', desc: '底层 EsForm 实例' },
  { key: '5', prop: 'queryModel', params: '-', desc: '查询表单的 model 对象' },
  { key: '6', prop: 'openDialog', params: '(dialogKey, row?)', desc: '打开指定弹窗' },
  { key: '7', prop: 'closeDialog', params: '(dialogKey)', desc: '关闭指定弹窗（必传 key，没有「关当前」的省略写法）' },
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
