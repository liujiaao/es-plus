// --- Raw SFC imports from actual example components (auto-sync) ---

import { defineAsyncComponent } from 'vue'

const rawSFCs = import.meta.glob('@/components/examples/**/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>

// 惰性加载器：仅当示例真正渲染时才编译/加载对应 SFC。
// 之前用 { eager: true } 会在首次进入任意 /advanced/* 或 /components/* 文档页时
// 一次性编译全部 96 个示例（含重型 vxe/JSX），造成路由切换特别慢。
const componentLoaders = import.meta.glob(
  '@/components/examples/**/*.vue'
) as Record<string, () => Promise<{ default: any }>>

function parseSFC(raw: string): { template: string; script: string; style: string } {
  const t = raw.match(/<template>([\s\S]*)<\/template>/)
  const s = raw.match(/<script[^>]*>([\s\S]*?)<\/script>/)
  const st = raw.match(/<style[^>]*>([\s\S]*?)<\/style>/)
  return {
    template: t ? t[1].trim() : '',
    script: s ? s[1].trim() : '',
    style: st ? st[1].trim() : ''
  }
}

/** Convert kebab-case to PascalCase */
function toPascalCase(str: string): string {
  return str.replace(/(^|-)([a-z])/g, (_, __, letter) => letter.toUpperCase())
}

/** Map example path like "dialog/01-basic" to actual component file path */
function resolveComponentPath(examplePath: string): string {
  const [category, fileName] = examplePath.split('/')
  const nameWithoutPrefix = fileName.replace(/^\d+-/, '')
  const pascalName = toPascalCase(nameWithoutPrefix)
  return `/src/components/examples/${category}/${pascalName}.vue`
}

function code(path: string) {
  const componentPath = resolveComponentPath(path)
  return parseSFC(rawSFCs[componentPath] || '')
}

function getComponent(examplePath: string): any {
  const componentPath = resolveComponentPath(examplePath)
  const loader = componentLoaders[componentPath]
  return loader ? defineAsyncComponent(loader) : null
}

// --- Documentation data ---

export const docsData: Record<string, any> = {
  'use-dialog': {
    title: 'useDialog 高级弹窗',
    description: '基于 Vue 3 的编程式弹窗 Hook，支持 JSX 渲染、表单集成、嵌套弹窗等高级功能。',
    features: [
      { name: '编程式调用', desc: '通过函数调用打开弹窗，无需模板声明', icon: 'MagicStick' },
      { name: 'JSX 渲染', desc: '支持使用 render 函数自定义弹窗内容', icon: 'SetUp' },
      { name: '表单集成', desc: '与 EsForm 无缝集成', icon: 'Collection' },
      { name: '嵌套支持', desc: '支持弹窗嵌套，自动管理层级', icon: 'Connection' }
    ],
    examples: [
      { key: 'basic', title: '弹窗基础与变体', description: '基础调用 + 内容弹窗 + 抽屉变体 + 滚动内容。', component: getComponent('dialog/01-basic'), code: code('dialog/01-basic') },
      { key: 'form', title: '表单弹窗', description: '弹窗中使用 EsForm，支持表单验证与提交闭环。', component: getComponent('dialog/02-form'), code: code('dialog/02-form') },
      { key: 'confirm', title: '确认与消息弹窗', description: '图标化确认弹窗，覆盖 success/warning/error 消息提示。', component: getComponent('dialog/03-confirm'), code: code('dialog/03-confirm') },
      { key: 'nested-modal', title: '嵌套弹窗', description: '独立 useDialog 实例，支持父子弹窗通信与层级管理。', component: getComponent('dialog/04-nested-modal'), code: code('dialog/04-nested-modal') },
      { key: 'advanced', title: '高级弹窗', description: '可拖拽 + 自定义头尾 + 全屏 + 限高，覆盖高级定制场景。', component: getComponent('dialog/05-advanced'), code: code('dialog/05-advanced') },
      { key: 'async', title: '异步组件弹窗', description: 'defineAsyncComponent 实现弹窗内容延迟加载。', component: getComponent('dialog/06-async'), code: code('dialog/06-async') },
      { key: 'detail-preview', title: '详情预览弹窗', description: 'ElDescriptions 配置化详情展示，isHiddenFooter 无按钮模式，动态渲染不同业务对象。', component: getComponent('dialog/07-detail-preview'), code: code('dialog/07-detail-preview') },
      { key: 'table-dialog', title: '弹窗内嵌表格', description: '弹窗中放置 EsTable + multiSelect 多选 + registerRef 获取表格实例读取选中行。', component: getComponent('dialog/08-table-dialog'), code: code('dialog/08-table-dialog') },
      { key: 'step-dialog', title: '分步向导弹窗', description: 'ElSteps + 多步骤 EsForm 切换，每步独立校验，configBtn 动态按钮控制上一步/下一步/提交。', component: getComponent('dialog/09-step-dialog'), code: code('dialog/09-step-dialog') },
      { key: 'dynamic-btn', title: '动态按钮状态弹窗', description: '审批场景：Radio 切换操作类型，按钮 disabled 函数式动态禁用，条件校验。', component: getComponent('dialog/10-dynamic-btn'), code: code('dialog/10-dynamic-btn') },
      { key: 'multi-instance', title: '多实例独立弹窗', description: 'onlyInstance: false 模式，同时打开多个独立弹窗，各自拖拽互不影响。', component: getComponent('dialog/11-multi-instance'), code: code('dialog/11-multi-instance') },
      { key: 'form-table-dialog', title: '表单+表格+弹窗闭环', description: '弹窗内 EsTable 展示数据 + btns 行操作触发编辑弹窗 + configBtn 新增弹窗，三级弹窗嵌套 CRUD。', component: getComponent('dialog/12-form-table-dialog'), code: code('dialog/12-form-table-dialog') }
    ],
    api: {
      'DialogOptions': [
        { name: 'title', type: 'string', desc: '弹窗标题' },
        { name: 'width', type: 'string | number', desc: '弹窗宽度，默认 "50%"' },
        { name: 'render', type: '(h, instance, components) => VNode', desc: '内容渲染函数；h 为 Vue createVNode，instance 为弹窗实例，components 包含所有注册的 el-icon 图标' },
        { name: 'renderHeader', type: '(h, instance) => VNode', desc: '头部渲染函数（覆盖默认标题区）' },
        { name: 'renderFooter', type: '(h, instance) => VNode', desc: '底部渲染函数（覆盖默认按钮区）' },
        { name: 'configBtn', type: 'BtnConfig[]', desc: '底部按钮配置（同 EsForm BtnConfig，click 回调见下表）' },
        { name: 'isDraggable', type: 'boolean', desc: '是否可拖拽，默认 false' },
        { name: 'fullscreen', type: 'boolean', desc: '是否全屏，默认 false' },
        { name: 'hiddenFullBtn', type: 'boolean', desc: '隐藏右上角全屏切换按钮' },
        { name: 'isHiddenFooter', type: 'boolean', desc: '隐藏底部按钮区，默认 false' },
        { name: 'maxHeight', type: 'string | number', desc: '内容区最大高度（超出滚动）' },
        { name: 'appendTo', type: 'string | HTMLElement', desc: '弹窗挂载的目标容器，默认 document.body；可传 CSS 选择器或 DOM 元素' },
        { name: 'closeOnClickModal', type: 'boolean', desc: '点击遮罩是否关闭，默认 true（继承 el-dialog 默认值）' },
        { name: 'closeOnPressEscape', type: 'boolean', desc: '按 ESC 是否关闭，默认 true（继承 el-dialog 默认值）' },
        { name: 'beforeClose', type: '(done: () => void) => void', desc: '关闭前拦截回调，必须调用 done() 才真正关闭；可用于二次确认' },
        { name: 'destroyOnClose', type: 'boolean', desc: '关闭时销毁内容区，下次打开重新渲染，默认 true（useDialog 已注入）' },
        { name: 'modal', type: 'boolean', desc: '是否显示遮罩层，默认 true' },
        { name: 'alignCenter', type: 'boolean', desc: '是否垂直居中，默认 false' },
        { name: 'showClose', type: 'boolean', desc: '是否显示右上角关闭按钮，默认 true' },
        { name: 'onSubmit', type: '(close: () => void) => void', desc: '确认提交回调；close 为关闭函数，不调用则弹窗保持打开（常用于异步提交后关闭）' },
        { name: 'onClosed', type: '() => void', desc: '弹窗完全关闭后的回调（过渡动画结束时触发）' },
      ],
      'configBtn click 回调': [
        { name: 'click(instance, ctx)', type: '(instance, { close, getRefs, dialogVm }) => void', desc: 'BtnConfig 的 click 回调，instance 为弹窗 Vue 实例' },
        { name: 'ctx.close()', type: 'Function', desc: '关闭当前弹窗' },
        { name: 'ctx.getRefs(name)', type: '(name: string) => any', desc: '获取 registerRef 注册的引用（如内嵌 EsForm 实例）' },
        { name: 'ctx.dialogVm', type: 'ComponentInstance', desc: '弹窗组件实例' },
      ],
      'useDialog 参数': [
        { name: 'Component', type: 'Component (可选)', desc: '自定义弹窗内容组件，不传则使用内置 EsDialog；传入 DialogOptions.render 可替代' },
        { name: 'opt.onlyInstance', type: 'boolean', desc: 'true：单实例模式，同一 useDialog 返回的函数每次调用复用同一个弹窗实例（更新 props）；false（默认）：每次调用创建新实例' },
      ],
    },
  },
  'linkage': {
    title: '高级联动组合',
    description: 'EsForm、EsTable、useDialog 组合使用，实现复杂的业务场景。',
    features: [
      { name: '零代码查询', desc: 'triggerEvent + apiParams.model 无事件代码', icon: 'MagicStick' },
      { name: '配置驱动', desc: '声明式配置替代命令式编码', icon: 'SetUp' },
      { name: '极简开发', desc: '10行配置替代50行传统写法', icon: 'Collection' }
    ],
    examples: [
      { key: 'form-table', title: '查询表格完整版', description: 'EsForm + EsTable + triggerEvent 实现零事件代码查询。', component: getComponent('advanced/01-form-table'), code: code('advanced/01-form-table') },
      { key: 'zero-code-query', title: '零代码查询', description: 'triggerEvent + apiParams.model 自动联动，无需手写查询/重置事件。传统50行→es-plus 10行。', component: getComponent('advanced/02-zero-code-query'), code: code('advanced/02-zero-code-query') },
      { key: 'cross-page-select', title: '跨页选择持久化', description: 'rowkey + cachePageSelection 解决 el-table 切换分页选择丢失的痛点。getSelectionRows() 跨页获取全部选中。', component: getComponent('advanced/03-cross-page-select'), code: code('advanced/03-cross-page-select') },
      { key: 'step-form', title: '分步表单', description: '分步骤填写的复杂表单，每步独立校验。', component: getComponent('advanced/04-step-form'), code: code('advanced/04-step-form') },
      { key: 'form-table-dialog', title: '完整CRUD示例', description: 'EsForm + EsTable + useDialog 组合实现完整的增删改查。', component: getComponent('advanced/05-form-table-dialog'), code: code('advanced/05-form-table-dialog') },
      { key: 'order-expand-table', title: '订单展开明细', description: '展开行内嵌套表格，显示订单商品明细与汇总行。', component: getComponent('advanced/06-order-expand-table'), code: code('advanced/06-order-expand-table') },
      { key: 'one-line-crud', title: '极简CRUD弹窗', description: 'useDialog + JSX EsForm — 一个函数完成增/编辑弹窗，registerRef 获取表单实例验证。', component: getComponent('advanced/07-one-line-crud'), code: code('advanced/07-one-line-crud') },
      { key: 'row-approval', title: '行操作审批流程', description: 'btns条件行操作 + 批量选择 + 弹窗(表格+表单)审批。', component: getComponent('advanced/08-row-approval'), code: code('advanced/08-row-approval') },
      { key: 'auto-fit-height', title: '自适应高度表格', description: 'heightType + tabHeight + ResizeObserver 自动重算，表单展开/收起时表格高度自适应。', component: getComponent('advanced/09-auto-fit-height'), code: code('advanced/09-auto-fit-height') },
      { key: 'any-backend-api', title: '适配任意后端接口', description: 'configTableOut + brcb/qrcb — 切换3种后端格式仅需改配置，零适配代码。', component: getComponent('advanced/10-any-backend-api'), code: code('advanced/10-any-backend-api') },
      { key: 'conditional-btns', title: '条件行操作按钮', description: 'btns 声明式行操作 — 替代 el-table 冗长 v-if slot，按钮行为随行数据动态变化。', component: getComponent('advanced/11-conditional-btns'), code: code('advanced/11-conditional-btns') },
      { key: 'dialog-table-form', title: '弹窗内表格嵌套表单', description: '两级useDialog嵌套：弹窗表格 → 行btns → 嵌套弹窗表单编辑。', component: getComponent('advanced/12-dialog-table-form'), code: code('advanced/12-dialog-table-form') },
      { key: 'dynamic-form-query', title: '动态表单查询', description: 'isHidden 函数式显隐 + 级联选项加载 + apiParams.model 自动同步，零模板代码。', component: getComponent('advanced/13-dynamic-form-query'), code: code('advanced/13-dynamic-form-query') },
      { key: 'cascade-form-table', title: '级联表单联动表格', description: '三级级联(isHidden) + httpRequest远程数据 + triggerEvent自动查询。', component: getComponent('advanced/14-cascade-form-table'), code: code('advanced/14-cascade-form-table') },
      { key: 'step-import-wizard', title: '分步导入向导', description: 'useDialog多步骤：配置表单 → 预览表格 → 确认提交，configBtn动态按钮。', component: getComponent('advanced/15-step-import-wizard'), code: code('advanced/15-step-import-wizard') },
      { key: 'admin-page', title: '完整后台管理页', description: '搜索表单 + 分页表格 + CRUD弹窗 + 删除确认 — 一个文件完整后台页面，覆盖 90% 中后台场景。', component: getComponent('advanced/16-admin-page'), code: code('advanced/16-admin-page') },
      { key: 'crud-page', title: 'EsCrudPage 一键 CRUD', description: 'EsCrudPage 组件：一个 schema 对象即可渲染完整的查询+表格+弹窗 CRUD 页面，支持 Server-Driven UI。', component: getComponent('advanced/17-crud-page'), code: code('advanced/17-crud-page') },
      { key: 'virtual-table', title: '虚拟滚动基础', description: 'options.virtual: true 开启虚拟滚动，10 万行数据流畅渲染，支持多选、序号列。', component: getComponent('advanced/18-virtual-table'), code: code('advanced/18-virtual-table') },
      { key: 'virtual-table-sort', title: '虚拟表格排序+固定列', description: '虚拟模式下排序、固定列、序号列、斑马纹完整兼容，5 万行数据即时排序。', component: getComponent('advanced/19-virtual-table-sort'), code: code('advanced/19-virtual-table-sort') },
      { key: 'virtual-table-select', title: '虚拟表格多选+操作', description: '虚拟模式多选 + 行高亮 + 操作按钮(render/btns) + getSelectionRows 获取选中。', component: getComponent('advanced/20-virtual-table-select'), code: code('advanced/20-virtual-table-select') },
      { key: 'virtual-table-custom-render', title: '虚拟表格自定义渲染', description: '虚拟模式 render/scopedSlots/ellipsis/formatter 四种自定义渲染方式完整兼容。', component: getComponent('advanced/21-virtual-table-custom-render'), code: code('advanced/21-virtual-table-custom-render') },
      { key: 'virtual-table-row-style', title: '虚拟表格行样式+事件', description: '虚拟模式 rowClassName + highlightCurrentRow + 行点击/双击事件完整兼容。', component: getComponent('advanced/22-virtual-table-row-style'), code: code('advanced/22-virtual-table-row-style') },
      { key: 'virtual-table-crud', title: '虚拟表格完整CRUD', description: '虚拟模式 EsForm+EsTable+useDialog 完整 CRUD 场景：查询筛选+新增编辑删除+批量操作。', component: getComponent('advanced/23-virtual-table-crud'), code: code('advanced/23-virtual-table-crud') }
    ]
  },
  'vxe-table': {
    title: '高性能 vxe-table 表格',
    description: '通过 options.engine: "vxe" 一行切换至 vxe-table 高性能引擎，获得行内编辑、树形数据、导出、工具栏、服务端分页等企业级能力，同时保持 es-plus 配置化与联动范式不变。',
    features: [
      { name: '一行切换引擎', desc: 'options.engine: "vxe" 即可切换，列配置/联动/render 零改动', icon: 'Switch' },
      { name: '行内编辑', desc: 'cell/row 两种模式，editRender 配置 $input/$select，内置校验', icon: 'Edit' },
      { name: '工具栏与导出', desc: 'toolbarConfig 内置缩放/全屏，exportConfig 一键导出 CSV', icon: 'Download' },
      { name: 'proxyConfig 服务端分页', desc: '完全托管分页状态，与 EsForm 搜索联动零代码', icon: 'Connection' },
      { name: '树形数据', desc: 'treeConfig.transform 自动将扁平数组构造为树形', icon: 'Grid' },
      { name: '逃生舱', desc: 'vxeConfig 深度合并原生配置，vxeOn 注入任意 vxe 事件', icon: 'Tools' },
    ],
    examples: [
      { key: 'basic-switch', title: '引擎切换', description: '一行配置在 el-table（默认）与 vxe-table（高性能）之间切换，列配置/数据/联动完全兼容。', component: getComponent('vxe-table/01-basic-switch'), code: code('vxe-table/01-basic-switch') },
      { key: 'selection-index', title: '多选与序号列', description: 'type:"selection" 复选框列 + type:"index" 序号列；getSelectionRows / clearSelection 获取/清空选中。', component: getComponent('vxe-table/02-selection-index'), code: code('vxe-table/02-selection-index') },
      { key: 'expand-row', title: '展开行', description: 'type:"expand" 展开行，通过 #expand 具名插槽自定义展开内容，支持 ElDescriptions 详情卡。', component: getComponent('vxe-table/03-expand-row'), code: code('vxe-table/03-expand-row') },
      { key: 'sort-formatter', title: '排序与格式化', description: 'sortable 列排序 + formatter 函数格式化 + vxeColumn.formatter 原生格式化，三种写法对比。', component: getComponent('vxe-table/04-sort-formatter'), code: code('vxe-table/04-sort-formatter') },
      { key: 'custom-render', title: '自定义 render 渲染', description: 'render(h, {value, row, index}) 与 el-table 相同 API，vxe 引擎通过 RenderDomTb 桥接透传，无缝兼容。', component: getComponent('vxe-table/05-custom-render'), code: code('vxe-table/05-custom-render') },
      { key: 'cell-edit', title: '单元格编辑', description: 'editConfig.mode:"cell" 单元格编辑，editRender $input/$select，getUpdateRecords 获取修改记录。', component: getComponent('vxe-table/06-cell-edit'), code: code('vxe-table/06-cell-edit') },
      { key: 'row-edit', title: '行编辑与校验', description: 'editConfig.mode:"row" 整行编辑，vxeColumn.rules 校验规则，getInsertRecords/getRemoveRecords 获取变更。', component: getComponent('vxe-table/07-row-edit'), code: code('vxe-table/07-row-edit') },
      { key: 'toolbar-export', title: '工具栏与导出', description: 'toolbarConfig 内置缩放/全屏/自定义列；exportConfig 导出 CSV；print 打印。', component: getComponent('vxe-table/08-toolbar-export'), code: code('vxe-table/08-toolbar-export') },
      { key: 'column-resize', title: '列宽调整与键盘鼠标', description: 'columnConfig.resizable 拖拽调列宽；keyboardConfig 方向键导航；mouseConfig.selected 框选（类 Excel）。', component: getComponent('vxe-table/09-column-resize'), code: code('vxe-table/09-column-resize') },
      { key: 'tree-data', title: '树形数据', description: 'treeConfig.transform 自动将 {id, parentId} 扁平数组构造树形，expandAll/collapseAll 展开折叠。', component: getComponent('vxe-table/10-tree-data'), code: code('vxe-table/10-tree-data') },
      { key: 'proxy-config', title: 'proxyConfig 服务端分页', description: 'proxyConfig.ajax.query 接管请求，vxe 自管分页，EsForm 搜索触发 commitProxy("reload") 重载。', component: getComponent('vxe-table/11-proxy-config'), code: code('vxe-table/11-proxy-config') },
      { key: 'footer-summary', title: '汇总行 footerMethod', description: 'showFooter + footerMethod 动态计算合计行，随数据变化实时更新。', component: getComponent('vxe-table/12-footer-summary'), code: code('vxe-table/12-footer-summary') },
      { key: 'escape-hatch', title: '逃生舱 vxeConfig + vxeOn', description: 'vxeConfig 深度合并任意 vxe-grid 原生配置；vxeOn 注入 cell-click / sort-change 等原生事件。', component: getComponent('vxe-table/13-escape-hatch'), code: code('vxe-table/13-escape-hatch') },
      { key: 'crud-with-dialog', title: '完整 CRUD + useDialog', description: '搜索（EsForm）+ 多选分页表格（engine:vxe）+ useDialog 新增/编辑弹窗 + 删除确认 — 完整业务闭环。', component: getComponent('vxe-table/14-crud-with-dialog'), code: code('vxe-table/14-crud-with-dialog') },
      { key: 'merge-cells', title: '复杂合并单元格：静态 + 动态 + 表单联动', description: '三级表头 groups + spanMethod 行列动态合并 + vxeConfig.mergeCells 静态合并 + mergeFooterItems 多行表尾；表单控合并开关。', component: getComponent('vxe-table/15-merge-cells'), code: code('vxe-table/15-merge-cells') },
    ],
    api: {
      'TableOptions（vxe 引擎新增项）': [
        { name: 'engine', type: '"vxe"', desc: '切换至 vxe-table 高性能引擎，列配置 / 联动 / render 函数零改动' },
        { name: 'spanMethod', type: '({ row, rowIndex, column, columnIndex }) => { rowspan, colspan }', desc: '行列动态合并，与 el-table 同签名；{rowspan:0} 表示该格被上方格覆盖。注意：不可与 vxeConfig.mergeCells 同时使用；动态合并打印需配合 patchHtmlRowSpans' },
        { name: 'showFooter', type: 'boolean', desc: '是否显示合计行（tfoot），需配合 footerMethod 或 footerData 使用，缺少此项合计行不显示' },
        { name: 'footerMethod', type: '({ columns, data }) => any[][]', desc: '合计行动态计算函数，返回二维数组，每个子数组对应一行合计，下标与列一一对应；与 footerData 二选一' },
        { name: 'footerData', type: 'any[][]', desc: '合计行静态数据（格式与 footerMethod 返回值相同），适合固定合计行内容的场景' },
        { name: 'editConfig', type: '{ mode, trigger, showStatus?, autoClear? }', desc: 'mode:"cell" 单元格编辑 | "row" 整行编辑；trigger:"click"|"dblclick"|"manual"；设置后 keepSource 自动为 true，可追踪增删改' },
        { name: 'printConfig', type: 'boolean | VxeGridPrintConfig', desc: 'true 使用默认打印配置，或传 { columns, style, sheetName } 自定义。启用后 toolbarConfig.print 按钮才能生效' },
        { name: 'toolbarConfig', type: '{ zoom?, custom?, export?, print?, refresh?, slots? }', desc: '工具栏：zoom 全屏，custom 自定义列，export 导出，print 打印，refresh 刷新。toolbarConfig:true 展开为 { export:true, refresh:true, custom:true }' },
        { name: 'exportConfig', type: 'boolean | { filename?, type?, sheetName?, useStyle? }', desc: 'type:"csv"（默认）| "xlsx"（需安装 @vxe-table/plugin-export-xlsx）；exportConfig:true 使用默认配置' },
        { name: 'columnConfig', type: '{ resizable?, minResizableWidth?, maxResizableWidth? }', desc: '全局列配置，resizable:true 允许用户拖拽调整列宽' },
        { name: 'keyboardConfig', type: '{ isArrow?, isEnter?, isTab?, isEdit? }', desc: 'isArrow 方向键移动单元格，isEnter 回车确认并向下，isTab Tab 切列，isEdit 字符键直接触发编辑' },
        { name: 'mouseConfig', type: '{ selected? }', desc: 'selected:true 开启单元格点击高亮，配合 clipboardConfig 实现类 Excel 框选复制粘贴' },
        { name: 'clipboardConfig', type: '{ isCopy?, isPaste? }', desc: 'Ctrl+C 复制 / Ctrl+V 粘贴单元格内容，需先开启 mouseConfig.selected:true' },
        { name: 'validConfig', type: '{ autoPos?, message? }', desc: 'autoPos:true 校验后自动定位首个错误格；message:"tooltip"|"modal" 错误提示方式' },
        { name: 'treeConfig', type: '{ transform?, rowField?, parentField?, expandAll? }', desc: 'transform:true 自动将扁平 [{id,parentId}] 构造树形；某列需设置 vxeColumn.treeNode:true 作为展开节点列' },
        { name: 'proxyConfig', type: '{ autoLoad?, ajax: { query, queryAll? }, props? }', desc: 'vxe 接管分页：ajax.query({ page, form }) 返回后端数据；props.list/total 映射响应字段；autoLoad:true 挂载自动请求' },
        { name: 'expandConfig', type: '{ trigger?, accordion?, lazy?, loadMethod? }', desc: 'trigger:"row"|"manual"；accordion:true 手风琴模式；lazy+loadMethod 懒加载展开内容' },
        { name: 'seqConfig', type: '{ startIndex?, seqMethod? }', desc: '序号列配置：startIndex 指定起始序号（默认 1），seqMethod 自定义生成函数；配合 snIndex:true 使用' },
        { name: 'vxeConfig', type: 'VxeGridProps', desc: '逃生舱：深度合并至 vxe-grid 原生配置，优先级高于所有一等公民字段，可设置 mergeHeaderItems / mergeCells / mergeFooterItems 等静态合并' },
        { name: 'vxeOn', type: 'Record<string, Function>', desc: '逃生舱：注入 vxe 原生事件，键名为 vxe 事件名（kebab-case），如 "cell-click"、"edit-closed"、"zoom"、"scroll"' },
      ],
      'TableOptions（通用字段 · vxe 注意事项）': [
        { name: 'rowkey', type: 'string', desc: '【vxe 引擎必须设置】默认映射为 "id"；缺少 rowkey 时跨页多选（reserve）无法保留选中行，会收到控制台警告' },
        { name: 'multiSelect', type: 'boolean', desc: 'vxe 引擎映射为 checkboxConfig.reserve:true，自动支持跨页保留选中；须配合 rowkey 使用' },
        { name: 'snIndex', type: 'boolean', desc: 'vxe 引擎映射为 type:seq 列；起始序号可通过 seqConfig.startIndex 调整' },
        { name: 'headerCellStyle', type: 'object | Function | false', desc: 'vxe 引擎映射为 headerCellConfig.style，默认为 { background:"#f5f7fa" }（与 el-table 保持一致）；显式设置 false 可关闭默认背景' },
        { name: 'cellStyle / cellClassName', type: 'object | string | Function', desc: 'vxe 引擎映射为 cellConfig.style / cellConfig.className，函数参数为 { row, rowIndex, column, columnIndex }' },
        { name: 'rowClassName / rowStyle', type: 'string | Function', desc: 'vxe 引擎映射为 rowConfig.className / rowConfig.style，函数参数为 { row, rowIndex }' },
        { name: 'defaultSort', type: '{ prop, order }', desc: 'vxe 引擎将 order 映射：ascending→asc，descending→desc，注入 sortConfig.defaultSort' },
        { name: 'heightType', type: '"auto" | "height" | "maxHeight"', desc: '"auto" 自适应，"height" 固定高度（超出滚动），"maxHeight" 最大高度，vxe 引擎完整兼容' },
      ],
      'TableColumn（vxe 引擎新增项）': [
        { name: 'groups', type: 'TableColumn[]', desc: '多级表头：子列数组，支持任意嵌套层级。父列只设 label（不设 prop），子列设 prop+label；vxe 引擎渲染为 children 多列分组' },
        { name: 'editRender', type: '{ name, props?, options?, events? }', desc: '列编辑器：name 支持内置 $input/$select/$switch/$textarea，或自定义已注册组件名；props 传给编辑组件的属性；options 下拉选项' },
        { name: 'vxeColumn', type: 'VxeColumnProps', desc: '逃生舱：原生 vxe-column 任意配置，如 rules（单元格校验规则）、formatter（vxe 原生格式化）、treeNode:true（树形节点展开列）' },
        { name: 'footerFormatter', type: '({ items, column }) => string', desc: '合计行单元格格式化，仅在 options.showFooter:true 时生效；items 为该列所有行的数据值数组，可用于求和/平均等计算' },
      ],
      '暴露方法（TableEngineExposed）': [
        { name: 'vxeInstance()', type: '() => VxeGridInstance', desc: '获取原始 vxe-grid 实例，可调用全部 vxe API（60+ 方法 / 45+ 事件）。常用于 getPrintHtml、commitProxy 等未封装方法' },
        { name: 'getTableRef()', type: '() => VxeGridInstance', desc: '等价于 vxeInstance()，获取 vxe-grid DOM 引用' },
        { name: 'doLayout()', type: '() => void', desc: '重新计算列宽和表格布局（内部调用 recalculate(true)），容器尺寸变化后或动态列变更后调用' },
        { name: 'toggleRowSelection(row, selected?)', type: '(row, selected?: boolean) => void', desc: '勾选 / 取消指定行：selected=true 勾选，false 取消，不传则切换当前状态' },
        { name: 'clearSelection()', type: '() => void', desc: '清除所有复选框选中状态（含跨页缓存 reserves）' },
        { name: 'getSelectedRows()', type: '() => any[]', desc: '获取当前所有选中行（含跨页缓存），返回行数据数组' },
        { name: 'scrollToRow(rowIndex)', type: '(rowIndex: number) => void', desc: '滚动到指定行（数据下标，从 0 开始）' },
        { name: 'clearActived()', type: '() => Promise<void>', desc: '退出当前激活的编辑单元格，行编辑模式下同时取消整行编辑状态' },
        { name: 'clearValidate()', type: '() => Promise<void>', desc: '清除所有单元格的校验错误提示（不影响数据，只清 UI 错误态）' },
        { name: 'validate(rows?)', type: '(rows?: any[]) => Promise<any>', desc: '触发行内编辑校验；不传参校验全部行；返回 Promise，校验失败时 reject 携带错误信息' },
        { name: 'getInsertRecords()', type: '() => any[]', desc: '获取未保存的新增行列表（由 keepSource 追踪，设置 editConfig 后自动开启）' },
        { name: 'getUpdateRecords()', type: '() => any[]', desc: '获取已修改行列表（与 keepSource 记录的原始数据比对差异）' },
        { name: 'getRemoveRecords()', type: '() => any[]', desc: '获取已标记删除的行列表' },
        { name: 'revertData(rows?)', type: '(rows?: any | any[]) => Promise<void>', desc: '还原到编辑前状态：不传参还原所有行，传入指定行对象仅还原对应行' },
        { name: 'exportData(opts?)', type: '(opts?: VxeExportConfig) => Promise<void>', desc: '触发数据导出，参数覆盖 options.exportConfig；可指定 filename/type/columns 等' },
        { name: 'print()', type: '() => Promise<void>', desc: '触发 vxe 内置打印窗口，需先在 options 中设置 printConfig:true；动态 spanMethod 合并场景请改用 vxeInstance().print({ html: patchHtmlRowSpans(...) })' },
      ],
      '打印工具函数': [
        { name: 'patchHtmlRowSpans(html, spanFn)', type: '(html: string, spanFn: (ri, ci) => { rowspan, colspan }) => string', desc: '修正 vxe getPrintHtml 输出的 tbody rowspan/colspan，解决 spanMethod 动态合并在打印中失效的问题。从 es-plus 按需导入：import { patchHtmlRowSpans } from "es-plus"' },
      ],
    },
  },
}
