// --- Raw SFC imports from actual example components (auto-sync) ---

const rawSFCs = import.meta.glob('@/components/examples/**/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>

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
      { key: 'basic', title: '弹窗基础与变体', description: '基础调用 + 内容弹窗 + 抽屉变体 + 滚动内容。', component: null, code: code('dialog/01-basic') },
      { key: 'form', title: '表单弹窗', description: '弹窗中使用 EsForm，支持表单验证与提交闭环。', component: null, code: code('dialog/02-form') },
      { key: 'confirm', title: '确认与消息弹窗', description: '图标化确认弹窗，覆盖 success/warning/error 消息提示。', component: null, code: code('dialog/03-confirm') },
      { key: 'nested-modal', title: '嵌套弹窗', description: '独立 useDialog 实例，支持父子弹窗通信与层级管理。', component: null, code: code('dialog/04-nested-modal') },
      { key: 'advanced', title: '高级弹窗', description: '可拖拽 + 自定义头尾 + 全屏 + 限高，覆盖高级定制场景。', component: null, code: code('dialog/05-advanced') },
      { key: 'async', title: '异步组件弹窗', description: 'defineAsyncComponent 实现弹窗内容延迟加载。', component: null, code: code('dialog/06-async') },
      { key: 'detail-preview', title: '详情预览弹窗', description: 'ElDescriptions 配置化详情展示，isHiddenFooter 无按钮模式，动态渲染不同业务对象。', component: null, code: code('dialog/07-detail-preview') },
      { key: 'table-dialog', title: '弹窗内嵌表格', description: '弹窗中放置 EsTable + multiSelect 多选 + registerRef 获取表格实例读取选中行。', component: null, code: code('dialog/08-table-dialog') },
      { key: 'step-dialog', title: '分步向导弹窗', description: 'ElSteps + 多步骤 EsForm 切换，每步独立校验，configBtn 动态按钮控制上一步/下一步/提交。', component: null, code: code('dialog/09-step-dialog') },
      { key: 'dynamic-btn', title: '动态按钮状态弹窗', description: '审批场景：Radio 切换操作类型，按钮 disabled 函数式动态禁用，条件校验。', component: null, code: code('dialog/10-dynamic-btn') },
      { key: 'multi-instance', title: '多实例独立弹窗', description: 'onlyInstance: false 模式，同时打开多个独立弹窗，各自拖拽互不影响。', component: null, code: code('dialog/11-multi-instance') },
      { key: 'form-table-dialog', title: '表单+表格+弹窗闭环', description: '弹窗内 EsTable 展示数据 + btns 行操作触发编辑弹窗 + configBtn 新增弹窗，三级弹窗嵌套 CRUD。', component: null, code: code('dialog/12-form-table-dialog') }
    ],
    api: {
      'DialogOptions': [
        { name: 'title', type: 'string', desc: '弹窗标题' },
        { name: 'width', type: 'string | number', desc: '弹窗宽度，默认 "50%"' },
        { name: 'key', type: 'string', desc: '唯一标识（相同 key 复用实例）' },
        { name: 'render', type: '(h, instance, components) => VNode', desc: '内容渲染函数' },
        { name: 'renderHeader', type: '(h, instance) => VNode', desc: '头部渲染函数' },
        { name: 'renderFooter', type: '(h, instance) => VNode', desc: '底部渲染函数' },
        { name: 'configBtn', type: 'BtnConfig[]', desc: '底部按钮配置（同 EsForm BtnConfig）' },
        { name: 'isDraggable', type: 'boolean', desc: '是否可拖拽，默认 false' },
        { name: 'fullscreen', type: 'boolean', desc: '是否全屏，默认 false' },
        { name: 'hiddenFullBtn', type: 'boolean', desc: '隐藏全屏切换按钮' },
        { name: 'isHiddenFooter', type: 'boolean', desc: '隐藏底部按钮区' },
        { name: 'maxHeight', type: 'string | number', desc: '内容区最大高度' },
        { name: 'closeOnClickModal', type: 'boolean', desc: '点击遮罩关闭，默认 false' },
        { name: 'closeOnPressEscape', type: 'boolean', desc: '按 ESC 关闭，默认 false' },
        { name: 'destroyOnClose', type: 'boolean', desc: '关闭时销毁' },
        { name: 'showDefaultButtons', type: 'boolean', desc: '显示默认确定/取消按钮' },
        { name: 'loading', type: 'boolean', desc: '加载状态' },
        { name: 'onlyInstance', type: 'boolean', desc: '单实例模式（复用同一弹窗）' },
        { name: 'onSubmit', type: '(close) => void', desc: '提交回调' },
        { name: 'onClosed', type: '() => void', desc: '关闭回调' },
        { name: 'onOpen', type: '() => void', desc: '打开回调' }
      ],
      'configBtn click': [
        { name: 'click', type: '(instance, { close, getRefs, dialogVm }) => void', desc: '按钮点击回调' },
        { name: 'close()', type: 'Function', desc: '关闭弹窗' },
        { name: 'getRefs(name)', type: 'Function', desc: '获取 registerRef 注册的引用' },
        { name: 'dialogVm', type: 'Object', desc: '弹窗组件实例' }
      ]
    }
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
      { key: 'form-table', title: '查询表格完整版', description: 'EsForm + EsTable + triggerEvent 实现零事件代码查询。', component: null, code: code('advanced/01-form-table') },
      { key: 'zero-code-query', title: '零代码查询', description: 'triggerEvent + apiParams.model 自动联动，无需手写查询/重置事件。传统50行→es-plus 10行。', component: null, code: code('advanced/02-zero-code-query') },
      { key: 'cross-page-select', title: '跨页选择持久化', description: 'rowkey + cachePageSelection 解决 el-table 切换分页选择丢失的痛点。getSelectionRows() 跨页获取全部选中。', component: null, code: code('advanced/03-cross-page-select') },
      { key: 'step-form', title: '分步表单', description: '分步骤填写的复杂表单，每步独立校验。', component: null, code: code('advanced/04-step-form') },
      { key: 'form-table-dialog', title: '完整CRUD示例', description: 'EsForm + EsTable + useDialog 组合实现完整的增删改查。', component: null, code: code('advanced/05-form-table-dialog') },
      { key: 'order-expand-table', title: '订单展开明细', description: '展开行内嵌套表格，显示订单商品明细与汇总行。', component: null, code: code('advanced/06-order-expand-table') },
      { key: 'one-line-crud', title: '极简CRUD弹窗', description: 'useDialog + JSX EsForm — 一个函数完成增/编辑弹窗，registerRef 获取表单实例验证。', component: null, code: code('advanced/07-one-line-crud') },
      { key: 'row-approval', title: '行操作审批流程', description: 'btns条件行操作 + 批量选择 + 弹窗(表格+表单)审批。', component: null, code: code('advanced/08-row-approval') },
      { key: 'auto-fit-height', title: '自适应高度表格', description: 'heightType + tabHeight + ResizeObserver 自动重算，表单展开/收起时表格高度自适应。', component: null, code: code('advanced/09-auto-fit-height') },
      { key: 'any-backend-api', title: '适配任意后端接口', description: 'configTableOut + brcb/qrcb — 切换3种后端格式仅需改配置，零适配代码。', component: null, code: code('advanced/10-any-backend-api') },
      { key: 'conditional-btns', title: '条件行操作按钮', description: 'btns 声明式行操作 — 替代 el-table 冗长 v-if slot，按钮行为随行数据动态变化。', component: null, code: code('advanced/11-conditional-btns') },
      { key: 'dialog-table-form', title: '弹窗内表格嵌套表单', description: '两级useDialog嵌套：弹窗表格 → 行btns → 嵌套弹窗表单编辑。', component: null, code: code('advanced/12-dialog-table-form') },
      { key: 'dynamic-form-query', title: '动态表单查询', description: 'isHidden 函数式显隐 + 级联选项加载 + apiParams.model 自动同步，零模板代码。', component: null, code: code('advanced/13-dynamic-form-query') },
      { key: 'cascade-form-table', title: '级联表单联动表格', description: '三级级联(isHidden) + httpRequest远程数据 + triggerEvent自动查询。', component: null, code: code('advanced/14-cascade-form-table') },
      { key: 'step-import-wizard', title: '分步导入向导', description: 'useDialog多步骤：配置表单 → 预览表格 → 确认提交，configBtn动态按钮。', component: null, code: code('advanced/15-step-import-wizard') },
      { key: 'admin-page', title: '完整后台管理页', description: '搜索表单 + 分页表格 + CRUD弹窗 + 删除确认 — 一个文件完整后台页面，覆盖 90% 中后台场景。', component: null, code: code('advanced/16-admin-page') },
      { key: 'crud-page', title: 'EsCrudPage 一键 CRUD', description: 'EsCrudPage 组件：一个 schema 对象即可渲染完整的查询+表格+弹窗 CRUD 页面，支持 Server-Driven UI。', component: null, code: code('advanced/17-crud-page') },
      { key: 'virtual-table', title: '虚拟滚动基础', description: 'options.virtual: true 开启虚拟滚动，10 万行数据流畅渲染，支持多选、序号列。', component: null, code: code('advanced/18-virtual-table') },
      { key: 'virtual-table-sort', title: '虚拟表格排序+固定列', description: '虚拟模式下排序、固定列、序号列、斑马纹完整兼容，5 万行数据即时排序。', component: null, code: code('advanced/19-virtual-table-sort') },
      { key: 'virtual-table-select', title: '虚拟表格多选+操作', description: '虚拟模式多选 + 行高亮 + 操作按钮(render/btns) + getSelectionRows 获取选中。', component: null, code: code('advanced/20-virtual-table-select') },
      { key: 'virtual-table-custom-render', title: '虚拟表格自定义渲染', description: '虚拟模式 render/scopedSlots/ellipsis/formatter 四种自定义渲染方式完整兼容。', component: null, code: code('advanced/21-virtual-table-custom-render') },
      { key: 'virtual-table-row-style', title: '虚拟表格行样式+事件', description: '虚拟模式 rowClassName + highlightCurrentRow + 行点击/双击事件完整兼容。', component: null, code: code('advanced/22-virtual-table-row-style') },
      { key: 'virtual-table-crud', title: '虚拟表格完整CRUD', description: '虚拟模式 EsForm+EsTable+useDialog 完整 CRUD 场景：查询筛选+新增编辑删除+批量操作。', component: null, code: code('advanced/23-virtual-table-crud') }
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
      { key: 'basic-switch', title: '引擎切换', description: '一行配置在 el-table（默认）与 vxe-table（高性能）之间切换，列配置/数据/联动完全兼容。', component: null, code: code('vxe-table/01-basic-switch') },
      { key: 'selection-index', title: '多选与序号列', description: 'multiSelect 复选框列 + snIndex 序号列；getSelectionRows / clearSelection 获取/清空选中。', component: null, code: code('vxe-table/02-selection-index') },
      { key: 'expand-row', title: '展开行', description: 'type:"expand" 展开行，通过 #expand 具名插槽自定义展开内容，支持 ElDescriptions 详情卡。', component: null, code: code('vxe-table/03-expand-row') },
      { key: 'sort-formatter', title: '排序与格式化', description: 'sortable 列排序 + formatter 函数格式化 + vxeColumn.formatter 原生格式化，三种写法对比。', component: null, code: code('vxe-table/04-sort-formatter') },
      { key: 'custom-render', title: '自定义 render 渲染', description: 'render(h, {value, row, index}) 与 el-table 相同 API，vxe 引擎通过 RenderDomTb 桥接透传，无缝兼容。', component: null, code: code('vxe-table/05-custom-render') },
      { key: 'cell-edit', title: '单元格编辑', description: 'editConfig.mode:"cell" 单元格编辑，editRender $input/$select，getUpdateRecords 获取修改记录。', component: null, code: code('vxe-table/06-cell-edit') },
      { key: 'row-edit', title: '行编辑与校验', description: 'editConfig.mode:"row" 整行编辑，vxeColumn.rules 校验规则，getInsertRecords/getRemoveRecords 获取变更。', component: null, code: code('vxe-table/07-row-edit') },
      { key: 'toolbar-export', title: '工具栏与导出', description: 'toolbarConfig 内置缩放/全屏/自定义列；exportConfig 导出 CSV；print 打印。', component: null, code: code('vxe-table/08-toolbar-export') },
      { key: 'column-resize', title: '列宽调整与键盘鼠标', description: 'columnConfig.resizable 拖拽调列宽；keyboardConfig 方向键导航；mouseConfig.selected 框选（类 Excel）。', component: null, code: code('vxe-table/09-column-resize') },
      { key: 'tree-data', title: '树形数据', description: 'treeConfig.transform 自动将 {id, parentId} 扁平数组构造树形，expandAll/collapseAll 展开折叠。', component: null, code: code('vxe-table/10-tree-data') },
      { key: 'proxy-config', title: 'proxyConfig 服务端分页', description: 'proxyConfig.ajax.query 接管请求，vxe 自管分页，EsForm 搜索触发 commitProxy("reload") 重载。', component: null, code: code('vxe-table/11-proxy-config') },
      { key: 'footer-summary', title: '汇总行 footerMethod', description: 'showFooter + footerMethod 动态计算合计行，随数据变化实时更新。', component: null, code: code('vxe-table/12-footer-summary') },
      { key: 'escape-hatch', title: '逃生舱 vxeConfig + vxeOn', description: 'vxeConfig 深度合并任意 vxe-grid 原生配置；vxeOn 注入 cell-click / sort-change 等原生事件。', component: null, code: code('vxe-table/13-escape-hatch') },
      { key: 'crud-with-dialog', title: '完整 CRUD + useDialog', description: '搜索（EsForm）+ 多选分页表格（engine:vxe）+ useDialog 新增/编辑弹窗 + 删除确认 — 完整业务闭环。', component: null, code: code('vxe-table/14-crud-with-dialog') },
      { key: 'merge-cells', title: '复杂合并单元格：静态 + 动态 + 表单联动', description: '三级表头 groups + spanMethod 行列动态合并 + vxeConfig.mergeCells 静态合并 + mergeFooterItems 多行表尾；表单控合并开关。', component: null, code: code('vxe-table/15-merge-cells') },
    ],
    api: {
      'TableOptions（vxe 引擎专属）': [
        { name: 'engine', type: '"vxe"', desc: '切换至 vxe-table 引擎' },
        { name: 'editConfig', type: '{ mode, trigger, showStatus }', desc: '行内编辑配置，mode: "cell" | "row"' },
        { name: 'toolbarConfig', type: '{ zoom, custom, export, print, refresh }', desc: '工具栏配置' },
        { name: 'exportConfig', type: '{ type, filename }', desc: '导出配置，type: "csv" | "xlsx"' },
        { name: 'columnConfig', type: '{ resizable, minWidth }', desc: '全局列配置，resizable 启用拖拽调宽' },
        { name: 'keyboardConfig', type: '{ isArrow, isEnter, isTab, isEdit }', desc: '键盘交互配置' },
        { name: 'mouseConfig', type: '{ selected }', desc: '鼠标框选配置' },
        { name: 'treeConfig', type: '{ rowField, parentField, transform, expandAll }', desc: '树形数据配置' },
        { name: 'proxyConfig', type: '{ ajax, props, autoLoad }', desc: '服务端代理配置' },
        { name: 'footerMethod', type: '({ columns, data }) => any[][]', desc: '汇总行数据生成函数' },
        { name: 'expandConfig', type: '{ trigger }', desc: '展开行配置' },
        { name: 'validConfig', type: '{ autoPos }', desc: '校验配置' },
        { name: 'vxeConfig', type: 'VxeGridProps', desc: '逃生舱：深度合并至 vxe-grid，覆盖任意原生属性' },
        { name: 'vxeOn', type: 'Record<string, Function>', desc: '逃生舱：注入 vxe 原生事件，如 "cell-click"' },
      ],
      'TableColumn（vxe 引擎专属）': [
        { name: 'editRender', type: '{ name, props?, options? }', desc: '列编辑器，name: "$input" | "$select"' },
        { name: 'vxeColumn', type: 'VxeColumnProps', desc: '逃生舱：覆盖该列原生 vxe-column 配置，如 rules/formatter' },
        { name: 'footerFormatter', type: 'Function', desc: '汇总行格式化函数' },
      ],
      '暴露方法（TableEngineExposed）': [
        { name: 'vxeInstance', type: 'VxeGridInstance', desc: '原生 vxe-grid 实例，可调用全部 vxe API' },
        { name: 'getTableRef()', type: '() => Ref', desc: '获取 vxe-grid 实例引用' },
        { name: 'validate()', type: '() => Promise<any>', desc: '触发行内编辑校验' },
        { name: 'getInsertRecords()', type: '() => any[]', desc: '获取新增记录' },
        { name: 'getUpdateRecords()', type: '() => any[]', desc: '获取修改记录' },
        { name: 'getRemoveRecords()', type: '() => any[]', desc: '获取删除记录' },
        { name: 'revertData()', type: '() => void', desc: '撤销所有行内编辑变更' },
        { name: 'exportData()', type: '(options?) => void', desc: '导出数据' },
        { name: 'clearActived()', type: '() => void', desc: '退出编辑状态' },
      ],
    },
  },
}
