// --- Raw SFC imports from actual example components (auto-sync) ---

const rawSFCs = import.meta.glob('@/components/examples/**/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>

function parseSFC(raw: string): { template: string; script: string; style: string } {
  // Greedy match for template to handle nested <template> tags (Vue scoped slots)
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

/** Map example path like "form/01-basic" to actual component file path */
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
  'es-form': {
    title: 'EsForm 高级表单',
    description: '基于 Element Plus 的增强型表单组件，支持配置化、联动化、抽象化设计，让表单开发更高效。',
    features: [
      { name: '配置化', desc: '通过 JSON 配置生成表单，无需编写模板', icon: 'Edit' },
      { name: '联动化', desc: '支持字段间联动，自动响应数据变化', icon: 'Connection' },
      { name: '抽象化', desc: '封装常用表单逻辑，简化开发流程', icon: 'Grid' },
      { name: '自适应', desc: '支持响应式布局，自动折叠展开', icon: 'Monitor' }
    ],
    examples: [
      { key: 'basic', title: '基础配置表单', description: '通过 formItemList JSON 配置生成完整表单，涵盖所有原生表单类型。', component: null, code: code('form/01-basic') },
      { key: 'layout', title: '布局与折叠', description: '24 栅格布局 + 自动折叠展开，支持响应式自适应。', component: null, code: code('form/02-layout') },
      { key: 'conditional', title: '条件联动表单', description: '模型驱动字段显隐，isHiden + on.change 实现字段间联动。', component: null, code: code('form/03-conditional') },
      { key: 'dynamic', title: '动态增减表单', description: '运行时动态增删表单项，支持数组类型表单与动态验证。', component: null, code: code('form/04-dynamic') },
      { key: 'validation', title: '表单验证', description: '集成 Element Plus 验证体系，支持 rules、pattern、自定义 validator。', component: null, code: code('form/05-validation') },
      { key: 'async-options', title: '异步数据表单', description: 'apiParams 自动加载下拉选项 + on.change 驱动级联联动。', component: null, code: code('form/06-async-options') },
      { key: 'custom-render', title: '自定义渲染表单', description: 'render 函数扩展能力，支持 Upload、Transfer、Slider、ColorPicker 等复杂组件。', component: null, code: code('form/07-custom-render') },
      { key: 'dialog', title: '弹窗表单', description: '在弹窗中使用 EsForm，展示表单与弹窗的无缝集成。', component: null, code: code('form/08-dialog') },
      { key: 'datetime-range', title: '日期时间范围', description: '完整覆盖日期、时间、日期时间范围选择场景。', component: null, code: code('form/09-datetime-range') },
      { key: 'cascader', title: '级联选择器', description: '使用 Cascader 组件实现多级联动选择。', component: null, code: code('form/10-cascader') },
      { key: 'advanced-buttons', title: '高级按钮区', description: 'btnColSpanRow + direction 实现左右分栏按钮区，支持 renderBtn 完全自定义。', component: null, code: code('form/11-advanced-buttons') },
      { key: 'upload', title: '图片上传', description: '支持 picture-card 多图上传、自定义 httpRequest、预览删除等完整上传功能。', component: null, code: code('form/12-upload') },
      { key: 'file-upload', title: '文件上传', description: '支持图片、PDF、TXT、Word、Excel、PPT 预览下载及 ZIP 下载，自定义文件列表与操作按钮。', component: null, code: code('form/13-file-upload') },
      { key: 'preferences', title: '偏好设置', description: 'Radio、Checkbox、Switch、Slider、ColorPicker、Rate 六种组件配置化示例，覆盖全部基础表单类型。', component: null, code: code('form/14-preferences') },
      { key: 'computed-fields', title: '联动计算', description: 'on.change + on.input 实现商品选择→自动填充单价→数量折扣→实时计算总价。', component: null, code: code('form/15-computed-fields') },
      { key: 'custom-button', title: '自定义按钮区', description: 'renderBtn 完全自定义按钮区域，支持异步提交、保存草稿、确认弹窗等交互。', component: null, code: code('form/16-custom-button') },
      { key: 'detail-mode', title: '详情模式', description: '编辑/详情双模式切换：详情模式禁用所有字段并隐藏按钮，编辑模式恢复可交互。', component: null, code: code('form/17-detail-mode') },
      { key: 'search-form', title: '组合搜索', description: 'isHidden 条件显隐 + apiParams 异步选项 + 更多/收起，完整搜索表单模式。', component: null, code: code('form/18-search-form') }
    ],
    api: {
      props: [
        { name: 'model', type: 'Object', default: '{}', desc: '表单数据对象（必填，v-model 绑定）' },
        { name: 'formItemList', type: 'FormItemOption[]', default: '[]', desc: '表单项配置数组（必填，见 FormItemOption 表）' },
        { name: 'layoutFormProps', type: 'LayoutFormProps', default: '{}', desc: '布局配置（见 LayoutFormProps 表）' },
        { name: 'configBtn', type: 'BtnConfig[]', default: '[]', desc: '按钮配置（见 BtnConfig 表）' },
        { name: 'renderBtn', type: 'Function | boolean', default: 'false', desc: '自定义按钮渲染函数，返回 VNode' },
        { name: 'btnColSpanRow', type: 'boolean', default: 'true', desc: '按钮区域是否独占一行（左右分栏布局）' },
        { name: 'rules', type: 'Object', default: '{}', desc: '验证规则（Element Plus 格式）' },
        { name: 'fieldFieldOutput', type: 'Function', default: '-', desc: 'API 响应字段映射函数，(defaults) => FieldMap' }
      ],
      'FormItemOption': [
        { name: 'prop', type: 'string', default: '-', desc: '字段名（必填）' },
        { name: 'label', type: 'string', default: '-', desc: '标签文本（必填）' },
        { name: 'formtype', type: 'string', default: '-', desc: '输入类型：Input/Select/datePicker/timePicker/Slider/ColorPicker/Transfer/Cascader/Radio/Checkbox/Switch/Rate/Upload' },
        { name: 'span', type: 'number', default: '6', desc: '栅格占位（24 列布局）' },
        { name: 'attrs', type: 'Object', default: '-', desc: '透传给 Element Plus 组件的属性（placeholder、clearable 等）' },
        { name: 'on', type: 'Object', default: '-', desc: '事件监听，如 { change: (val) => {} }' },
        { name: 'dataOptions', type: 'Array<{label, value}>', default: '-', desc: '选项数据（Select/Radio/Checkbox/Cascader）' },
        { name: 'isHidden', type: 'Function', default: '-', desc: '条件隐藏，(model, item, formProps) => boolean' },
        { name: 'render', type: 'Function', default: '-', desc: '自定义渲染，(h, model, ctx) => VNode' },
        { name: 'apiParams', type: 'ApiParams', default: '-', desc: '远程选项数据配置 { url, method, model, headers }' },
        { name: 'httpRequest', type: 'Function', default: '-', desc: '自定义请求方法（覆盖全局配置）' },
        { name: 'isInitRun', type: 'boolean', default: 'true', desc: '是否在初始化时自动加载接口数据' },
        { name: 'callOptionListFormat', type: 'Function', default: '-', desc: '(data) => [{ label, value }]，转换 API 响应' },
        { name: 'listenToCallBack', type: 'Object', default: '-', desc: '回调映射，crtn 用于选项格式转换' },
        { name: 'formItemOptions', type: 'Object', default: '-', desc: 'el-form-item 附加属性（rules、labelWidth 等）' },
        { name: 'width', type: 'number | string', default: '-', desc: '字段宽度' }
      ],
      'LayoutFormProps': [
        { name: 'fromLayProps', type: 'Object', default: '-', desc: '表单级别属性' },
        { name: 'fromLayProps.labelWidth', type: 'string', default: '-', desc: '标签宽度，如 "100px"' },
        { name: 'fromLayProps.minFoldRows', type: 'number', default: '-', desc: '折叠时显示的行数，0 不折叠' },
        { name: 'fromLayProps.isBtnHidden', type: 'boolean', default: '-', desc: '是否隐藏按钮区域' },
        { name: 'fromLayProps.btnColSpan', type: 'number', default: '-', desc: '按钮列占位宽度' },
        { name: 'rowLayProps', type: 'Object', default: '-', desc: '行级别属性' },
        { name: 'rowLayProps.gutter', type: 'number', default: '-', desc: '栅格间距' },
        { name: 'setOptions', type: 'boolean', default: '-', desc: '是否启用设置下拉' }
      ],
      'BtnConfig': [
        { name: 'name', type: 'string', default: '-', desc: '按钮文本' },
        { name: 'key', type: 'string', default: '-', desc: '按钮唯一标识（query/reset 触发联动）' },
        { name: 'type', type: 'string', default: '-', desc: '按钮类型：primary/success/warning/danger/info' },
        { name: 'icon', type: 'string', default: '-', desc: '图标名称（Element Plus Icons）' },
        { name: 'direction', type: 'string', default: '-', desc: '位置：left / right' },
        { name: 'disabled', type: 'boolean | Function', default: '-', desc: '禁用状态，支持函数形式' },
        { name: 'click', type: 'Function', default: '-', desc: '(model, formRef, httpRequestInstance) => void' },
        { name: 'triggerEvent', type: 'boolean', default: '-', desc: 'true 时自动触发表格查询/表单重置' }
      ],
      events: [
        { name: 'confirm', params: '(formRef, model)', desc: '点击确认按钮时触发' },
        { name: 'reset', params: '(formRef, model)', desc: '点击重置按钮时触发' }
      ],
      methods: [
        { name: 'validate', params: '-', desc: '校验整个表单，返回 Promise<boolean>' },
        { name: 'resetFields', params: '-', desc: '重置所有字段' },
        { name: 'clearValidate', params: '(props?)', desc: '清除校验状态' },
        { name: 'validateField', params: '(props)', desc: '校验指定字段' },
        { name: 'scrollToField', params: '(prop)', desc: '滚动到指定字段位置' },
        { name: 'formItmeRequestInstance', params: '(propsList)', desc: '手动触发指定字段的 API 数据加载' },
        { name: 'getFormRef', params: '-', desc: '获取底层 ElForm 实例' }
      ]
    }
  },
  'es-table': {
    title: 'EsTable 高级表格',
    description: '基于 Element Plus 的增强型表格组件，支持配置化列定义、自动分页、数据联动等高级功能。',
    features: [
      { name: '配置化', desc: '通过 columns 配置定义表格列', icon: 'Document' },
      { name: '自适应', desc: '自动计算表格高度，支持 Resize', icon: 'DataLine' },
      { name: '分页', desc: '内置分页逻辑，支持多种分页配置', icon: 'Menu' },
      { name: '联动', desc: '与 EsForm 无缝联动', icon: 'Connection' }
    ],
    examples: [
      { key: 'basic', title: '基础表格', description: '通过 columns JSON 配置生成完整表格。', component: null, code: code('table/01-basic') },
      { key: 'toolbar', title: '表格工具栏', description: '表格顶部操作区，支持 configBtn、leftText 配置和 default slot 自定义内容。', component: null, code: code('table/02-toolbar') },
      { key: 'custom', title: '自定义列渲染', description: 'render 函数、scopedSlots、formatter 多种自定义列渲染方式。', component: null, code: code('table/03-custom') },
      { key: 'selection', title: '多选与跨页记忆', description: 'multiSelect + cachePageSelection + rowKey，分页后切换页码仍能保持跨页勾选状态。', component: null, code: code('table/04-selection') },
      { key: 'edit', title: '行内编辑', description: '表格即编辑器，点击单元格进入编辑模式，支持批量保存/取消。', component: null, code: code('table/05-edit') },
      { key: 'sort', title: '排序表格', description: '前端排序与后端排序两种模式。', component: null, code: code('table/06-sort') },
      { key: 'group', title: '分组表头', description: 'groups 嵌套列配置实现多级分组表头。', component: null, code: code('table/07-group') },
      { key: 'fixed', title: '固定列与高度', description: 'fixed 固定列 + 自适应高度，适合宽表展示。', component: null, code: code('table/08-fixed') },
      { key: 'pagination', title: '分页表格', description: '配置 httpRequest + configTableOut 对接免费接口，v-model 双向绑定自动分页。', component: null, code: code('table/09-pagination') },
      { key: 'remote-data', title: '远程数据表格', description: 'actionUrl + httpRequest + configTableOut 完整远程数据请求与分页。', component: null, code: code('table/10-remote-data') },
      { key: 'expand', title: '展开行与树形', description: 'type:expand 展开行 + children 树形数据两种层级展示模式。', component: null, code: code('table/11-expand') },
      { key: 'cell-merge', title: '单元格合并与行样式', description: 'spanMethod 合并单元格 + rowClassName 条件行样式。', component: null, code: code('table/12-cell-merge') },
      { key: 'query-table', title: '配置化查询表格', description: 'entryQuery 自动合并搜索参数 + httpRequestInstance 手动刷新，零手动联动代码。', component: null, code: code('table/13-query-table') },
      { key: 'row-actions', title: '行操作按钮与动态显隐', description: 'btns 配置化行操作按钮 + configBtn 的 isHide/disabled 函数式控制。', component: null, code: code('table/14-row-actions') },
      { key: 'dynamic-columns', title: '动态列与汇总行', description: 'hidCol 动态列显隐 + show-summary/summary-method 配置化汇总行。', component: null, code: code('table/15-dynamic-columns') },
      { key: 'callback-pipeline', title: '请求回调管线', description: 'listenToCallBack brcb/qrcb 请求响应拦截 + configTableOut 字段映射 + entryQuery 默认参数。', component: null, code: code('table/16-callback-pipeline') },
      { key: 'current-row', title: '当前行与主从联动', description: 'highlightCurrentRow 行高亮 + @current-change 事件驱动从表 + 汇总统计。', component: null, code: code('table/17-current-row') },
      { key: 'table-height', title: '自适应容器高度', description: 'heightType: height 继承父容器高度 + ResizeObserver 自动计算，容器变表格自适应。', component: null, code: code('table/18-table-height') }
    ],
    api: {
      props: [
        { name: 'dataSource', type: 'Array', default: '[]', desc: '表格数据（必填，支持 v-model）' },
        { name: 'columns', type: 'TableColumn[]', default: '[]', desc: '列配置数组（必填，见 TableColumn 表）' },
        { name: 'options', type: 'TableOptions', default: '{}', desc: '表格选项配置（见 TableOptions 表）' },
        { name: 'pagination', type: 'PaginationConfig', default: '{}', desc: '分页配置（支持 v-model）' },
        { name: 'initTabHeight', type: 'number', default: '400', desc: '初始表格高度' },
        { name: 'showHeaderBar', type: 'boolean', default: 'true', desc: '是否显示头部栏区域' },
        { name: 'headBarClass', type: 'string | Object', default: '-', desc: '头部栏样式类' }
      ],
      'TableColumn': [
        { name: 'prop', type: 'string', default: '-', desc: '数据字段名' },
        { name: 'key', type: 'string', default: '-', desc: '列唯一标识' },
        { name: 'label', type: 'string', default: '-', desc: '列标题' },
        { name: 'labelKey', type: 'string', default: '-', desc: '国际化 key（配合全局 t 函数）' },
        { name: 'width', type: 'number | string', default: '-', desc: '列宽度（虚拟模式必须为数值，默认 150）' },
        { name: 'minWidth', type: 'number | string', default: '-', desc: '最小列宽度' },
        { name: 'align', type: 'string', default: 'center', desc: '对齐方式：left/center/right' },
        { name: 'fixed', type: 'boolean | string', default: '-', desc: '固定列（left/right/true=left）' },
        { name: 'sortable', type: 'boolean', default: '-', desc: '是否可排序（虚拟模式兼容）' },
        { name: 'ellipsis', type: 'boolean', default: '-', desc: '文本溢出省略 + Tooltip 提示（虚拟模式兼容）' },
        { name: 'formatter', type: 'Function', default: '-', desc: '(row) => string，格式化函数' },
        { name: 'render', type: 'Function', default: '-', desc: '(h, { row, value, index }) => VNode' },
        { name: 'scopedSlots', type: 'Object', default: '-', desc: '{ customRender: string } 插槽配置（虚拟模式兼容）' },
        { name: 'groups', type: 'TableColumn[]', default: '-', desc: '多级表头子列（虚拟模式扁平化渲染）' },
        { name: 'hidCol', type: 'boolean', default: '-', desc: '是否隐藏该列' },
        { name: 'btns', type: 'Array', default: '-', desc: '行操作按钮 [{ name, type?, clickEvent? }]' },
        { name: 'type', type: 'string', default: '-', desc: '特殊列类型：selection/expand/index' },
        { name: 'emptyPlaceholder', type: 'string', default: '-', desc: '空值占位文本，默认 "-"' }
      ],
      'TableOptions': [
        { name: 'border', type: 'boolean', default: 'false', desc: '是否显示边框' },
        { name: 'stripe', type: 'boolean', default: 'false', desc: '是否显示斑马纹' },
        { name: 'size', type: 'string', default: 'small', desc: '表格尺寸：large/default/small' },
        { name: 'multiSelect', type: 'boolean', default: 'false', desc: '启用多选列' },
        { name: 'expand', type: 'boolean', default: 'false', desc: '启用展开行' },
        { name: 'snIndex', type: 'boolean', default: 'false', desc: '显示序号列' },
        { name: 'loading', type: 'boolean', default: 'false', desc: '加载状态' },
        { name: 'highlightCurrentRow', type: 'boolean', default: 'true', desc: '是否高亮当前行' },
        { name: 'heightType', type: 'string', default: '-', desc: '高度类型：height（推荐）/ auto / maxHeight' },
        { name: 'tabHeight', type: 'number | string', default: '-', desc: '表格容器高度（推荐，虚拟/普通模式统一使用）' },
        { name: 'height', type: 'number | string', default: '-', desc: '固定高度（tabHeight 的别名，heightType="height" 时生效）' },
        { name: 'rowkey', type: 'string', default: '-', desc: '行唯一标识字段名（跨页选择/虚拟模式必填）' },
        { name: 'cachePageSelection', type: 'boolean', default: 'true', desc: '启用跨页选择缓存' },
        { name: 'rowClassName', type: 'string | Function', default: '-', desc: '行类名，支持 (row, rowIndex) => string 动态设置' },
        { name: 'virtual', type: 'boolean', default: 'false', desc: '启用虚拟滚动（基于 el-table-v2，支持 10 万+ 行数据）' },
        { name: 'engine', type: 'string', default: 'default', desc: '渲染引擎：default（el-table）/ virtual（el-table-v2）' },
        { name: 'rowHeight', type: 'number', default: '50', desc: '虚拟滚动行高（仅 virtual 模式）' },
        { name: 'estimatedRowHeight', type: 'number', default: '-', desc: '动态行高预估值（仅 virtual 模式）' },
        { name: 'overscanCount', type: 'number', default: '2', desc: '可视区域外预渲染行数（仅 virtual 模式）' },
        { name: 'httpRequest', type: 'Function', default: '-', desc: '自定义请求方法（覆盖全局配置）' },
        { name: 'apiParams', type: 'ApiParams', default: '-', desc: 'API 请求配置 { url, method, model, headers }' },
        { name: 'configTableOut', type: 'Object', default: '-', desc: '响应字段映射 { total, tableData, pageSize, current }' },
        { name: 'listenToCallBack', type: 'Object', default: '-', desc: '请求/响应回调管线 { brcb, qrcb }' },
        { name: 'entryQuery', type: 'Object', default: '-', desc: '默认查询参数' },
        { name: 'actionUrl', type: 'string', default: '-', desc: '请求地址（简写）' },
        { name: 'isInitRun', type: 'boolean', default: '-', desc: '初始化时是否自动请求数据' },
        { name: 'configBtn', type: 'Array', default: '-', desc: '顶部操作按钮配置' },
        { name: 'leftText', type: 'string', default: '-', desc: '顶部左侧文本' }
      ],
      events: [
        { name: 'update:dataSource', params: '(data)', desc: '数据更新（v-model 自动触发）' },
        { name: 'update:pagination', params: '(pagination)', desc: '分页更新（v-model:pagination 自动触发）' },
        { name: 'pagination-current-change', params: '(pagination)', desc: '页码变化时触发' },
        { name: 'size-change', params: '(pagination, size)', desc: '每页条数变化时触发' },
        { name: 'change-table-sort', params: '(column)', desc: '排序变化时触发' }
      ],
      methods: [
        { name: 'httpRequestInstance', params: '(model?)', desc: '手动触发表格数据请求' },
        { name: 'getSelectionRows', params: '-', desc: '获取选中行（含跨页缓存）。注：跨页选择不通过事件暴露，需通过此方法或 ref 主动读取' },
        { name: 'clearSelection', params: '-', desc: '清除当前页选择' },
        { name: 'clearAllSelection', params: '-', desc: '清除所有页面选择（含跨页缓存）' },
        { name: 'refresh', params: '-', desc: '强制重新计算表格布局' },
        { name: 'scrollToRow', params: '(rowIndex)', desc: '滚动到指定行（仅 virtual 模式）' }
      ]
    }
  },
  'es-crud-page': {
    title: 'EsCrudPage 高级CRUD',
    description: 'Schema 驱动的一站式 CRUD 页面组件，支持多弹窗架构、按钮-弹窗声明绑定、自定义渲染、权限控制。',
    features: [
      { name: '多弹窗架构', desc: 'dialogs 声明多个弹窗，toolbarBtns/operationColumn 通过 dialogKey 绑定', icon: 'CopyDocument' },
      { name: '权限控制', desc: 'permissionValue 配合全局 permission 函数控制按钮显隐', icon: 'Lock' },
      { name: '自定义渲染', desc: '弹窗支持 render 函数、configBtn 自定义底部、动态标题', icon: 'Edit' },
      { name: '程序化控制', desc: 'openDialog/closeDialog 方法支持外部程序化控制弹窗', icon: 'Setting' }
    ],
    examples: [
      { key: 'basic', title: '基础 CRUD', description: '最简 actions 模式：查询+表格+新增编辑删除，展示旧版 schema 驱动。', component: null, code: code('crud-page/01-basic') },
      { key: 'multi-dialog', title: '多弹窗绑定', description: 'toolbarBtns + operationColumn + dialogs 完整展示按钮-弹窗绑定。', component: null, code: code('crud-page/02-multi-dialog') },
      { key: 'custom-render', title: '自定义弹窗内容', description: 'dialogs 使用 render 函数渲染自定义组件（文件上传、统计面板）。', component: null, code: code('crud-page/03-custom-render') },
      { key: 'dynamic-title', title: '动态标题与回填', description: 'edit 弹窗 title 为函数 + 表单自动回填行数据。', component: null, code: code('crud-page/04-dynamic-title') },
      { key: 'row-confirm', title: '行确认与删除', description: '操作列 confirm 确认提示 + btn-click 事件处理删除/发布。', component: null, code: code('crud-page/05-row-confirm') },
      { key: 'permission', title: '权限控制按钮', description: 'permissionValue 配合 configureEsPlus permission 函数控制按钮显隐。', component: null, code: code('crud-page/06-permission') },
      { key: 'custom-footer', title: '自定义弹窗底部', description: 'configBtn 自定义三按钮（取消/拒绝/通过）实现审批场景。', component: null, code: code('crud-page/07-custom-footer') },
      { key: 'program-open', title: '程序化控制弹窗', description: '通过 ref.openDialog / closeDialog 程序化控制弹窗打开。', component: null, code: code('crud-page/08-program-open') },
      { key: 'hidden-column', title: '隐藏操作列', description: 'operationColumn: false + 纯工具栏操作，只读列表场景。', component: null, code: code('crud-page/09-hidden-column') },
      { key: 'full-business', title: '完整业务场景', description: '用户管理全功能：多弹窗+动态标题+render详情+确认+导出。', component: null, code: code('crud-page/10-full-business') }
    ],
    api: {
      props: [
        { name: 'schema', type: 'CrudPageSchema', default: '-', desc: 'CRUD 页面完整配置对象（必填，见 CrudPageSchema 表）' },
        { name: 'httpRequest', type: 'Function', default: '-', desc: '自定义 HTTP 请求方法，覆盖 schema.tableOptions.httpRequest' },
        { name: 'autoLoad', type: 'boolean', default: 'true', desc: '是否在挂载时自动请求数据' }
      ],
      'CrudPageSchema': [
        { name: 'formItems', type: 'FormItemOption[]', default: '[]', desc: '查询表单字段配置（同 EsForm formItemList）' },
        { name: 'formLayout', type: '{ span, labelWidth }', default: '-', desc: '表单布局配置' },
        { name: 'columns', type: 'TableColumn[]', default: '-', desc: '表格列配置（必填，同 EsTable columns）' },
        { name: 'tableOptions', type: 'TableOptions', default: '{}', desc: '表格选项配置（同 EsTable options）' },
        { name: 'pagination', type: 'PaginationConfig', default: '-', desc: '分页配置' },
        { name: 'toolbarBtns', type: 'CrudBtnConfig[]', default: '-', desc: '工具栏按钮（见 CrudBtnConfig 表）' },
        { name: 'operationColumn', type: 'OperationColumnConfig | false', default: '-', desc: '操作列配置，false 隐藏操作列（见 OperationColumnConfig 表）' },
        { name: 'dialogs', type: 'Record<string, CrudDialogConfig>', default: '-', desc: '多弹窗配置，key 为弹窗标识（见 CrudDialogConfig 表）' },
        { name: 'actions (deprecated)', type: 'CrudAction[]', default: '-', desc: '旧版快捷动作，建议改用 toolbarBtns + operationColumn' }
      ],
      'CrudBtnConfig': [
        { name: 'name', type: 'string', default: '-', desc: '按钮文本' },
        { name: 'type', type: 'string', default: '-', desc: '按钮类型：primary/success/warning/danger' },
        { name: 'icon', type: 'string', default: '-', desc: '图标名称（Element Plus Icons）' },
        { name: 'key', type: 'string', default: '-', desc: '按钮唯一标识' },
        { name: 'dialogKey', type: 'string', default: '-', desc: '点击时打开的弹窗 key（自动绑定 dialogs 中的配置）' },
        { name: 'actionType', type: 'string', default: '-', desc: '语义动作类型（用于 btn-click 事件 emit）' },
        { name: 'confirm', type: 'string | boolean', default: '-', desc: '点击前确认提示文字' },
        { name: 'permissionValue', type: 'string', default: '-', desc: '权限标识，配合全局 permission 函数控制显隐' }
      ],
      'OperationColumnConfig': [
        { name: 'label', type: 'string', default: '操作', desc: '列标题' },
        { name: 'width', type: 'number | string', default: '-', desc: '列宽度' },
        { name: 'fixed', type: 'boolean | string', default: 'right', desc: '固定方向' },
        { name: 'btns', type: 'RowBtnConfig[]', default: '-', desc: '行操作按钮列表（见 RowBtnConfig 表）' }
      ],
      'RowBtnConfig': [
        { name: 'name', type: 'string', default: '-', desc: '按钮文字' },
        { name: 'key', type: 'string', default: '-', desc: '按钮标识（用于 btn-click 事件）' },
        { name: 'type', type: 'string', default: '-', desc: '按钮类型' },
        { name: 'icon', type: 'string', default: '-', desc: '图标' },
        { name: 'dialogKey', type: 'string', default: '-', desc: '点击时打开的弹窗 key，自动将当前行数据传入' },
        { name: 'confirm', type: 'string | boolean', default: '-', desc: '点击前确认提示（如删除确认）' },
        { name: 'permissionValue', type: 'string', default: '-', desc: '权限标识' },
        { name: 'hidden', type: 'boolean | Function', default: '-', desc: '是否隐藏，支持 (row) => boolean 动态判断' },
        { name: 'click', type: 'Function', default: '-', desc: '自定义点击处理 (row, { refresh, getSelectedRows, openDialog }) => void' }
      ],
      'CrudDialogConfig': [
        { name: 'title', type: 'string | Function', default: '-', desc: '弹窗标题，支持 (row) => string 动态标题' },
        { name: 'width', type: 'string | number', default: '600px', desc: '弹窗宽度' },
        { name: 'formItems', type: 'FormItemOption[]', default: '-', desc: '表单字段（简单场景）' },
        { name: 'formLayout', type: '{ span, labelWidth }', default: '-', desc: '表单布局' },
        { name: 'render', type: 'Function', default: '-', desc: '自定义渲染 (h, { row, model, close, refresh }) => VNode' },
        { name: 'configBtn', type: 'DialogBtnConfig[]', default: '-', desc: '底部按钮配置，action: confirm/cancel/custom' },
        { name: 'isHiddenFooter', type: 'boolean', default: 'false', desc: '隐藏底部按钮区域' },
        { name: 'isDraggable', type: 'boolean', default: 'false', desc: '可拖拽' },
        { name: 'fullscreen', type: 'boolean', default: 'false', desc: '全屏' },
        { name: 'maxHeight', type: 'string | number', default: '-', desc: '最大高度' },
        { name: 'onOpen', type: 'Function', default: '-', desc: '弹窗打开时回调 (row?) => void' },
        { name: 'onConfirm', type: 'Function', default: '-', desc: '确认回调 (data, { close, refresh, getRefs, row }) => void' },
        { name: 'onClose', type: 'Function', default: '-', desc: '弹窗关闭时回调' }
      ],
      events: [
        { name: 'dialog-confirm', params: '(dialogKey, data)', desc: '弹窗确认时触发' },
        { name: 'dialog-cancel', params: '(dialogKey)', desc: '弹窗取消时触发' },
        { name: 'dialog-open', params: '(dialogKey, row?)', desc: '弹窗打开时触发' },
        { name: 'btn-click', params: '(key, payload?)', desc: '按钮点击时触发（非弹窗类按钮或行操作）' },
        { name: 'query', params: '(model)', desc: '查询事件' },
        { name: 'export', params: '(model)', desc: '导出事件' },
        { name: 'add', params: '-', desc: '新增按钮点击（向后兼容）' },
        { name: 'edit', params: '(row)', desc: '编辑按钮点击（向后兼容）' },
        { name: 'view', params: '(row)', desc: '查看按钮点击（向后兼容）' },
        { name: 'delete', params: '(row)', desc: '删除按钮点击（向后兼容）' },
        { name: 'row-click', params: '(row)', desc: '表格行点击事件透传' }
      ],
      methods: [
        { name: 'refresh', params: '-', desc: '刷新表格数据' },
        { name: 'getSelectedRows', params: '-', desc: '获取选中行' },
        { name: 'openDialog', params: '(key, row?)', desc: '程序化打开弹窗' },
        { name: 'closeDialog', params: '(key)', desc: '程序化关闭弹窗' },
        { name: 'queryModel', params: '-', desc: '当前查询表单模型（响应式）' },
        { name: 'tableRef', params: '-', desc: '内部 EsTable 组件实例' },
        { name: 'formRef', params: '-', desc: '内部 EsForm 组件实例' }
      ]
    }
  }
}
