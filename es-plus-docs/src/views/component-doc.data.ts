// --- Raw SFC imports from actual example components (auto-sync) ---

import { defineAsyncComponent } from 'vue'

const rawSFCs = import.meta.glob('@/components/examples/**/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>

// 惰性加载器：仅当示例真正渲染时才编译/加载对应 SFC。
// 之前用 { eager: true } 会在首次进入任意 /advanced/* 或 /components/* 文档页时
// 一次性编译全部示例（含重型 vxe/JSX），造成路由切换特别慢。
const componentLoaders = import.meta.glob(
  '@/components/examples/**/*.vue'
) as Record<string, () => Promise<{ default: any }>>

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

function getComponent(examplePath: string): any {
  const componentPath = resolveComponentPath(examplePath)
  const loader = componentLoaders[componentPath]
  return loader ? defineAsyncComponent(loader) : null
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
      { key: 'basic', title: '最简表单', description: '三个字段、零事件代码：formItemList 声明字段即得完整表单。', component: getComponent('form/01-basic'), code: code('form/01-basic') },
      { key: 'all-formtypes', title: '14 种表单控件一览', description: 'Input / InputNumber / Select / DatePicker / TimePicker / Slider / ColorPicker / Transfer / Cascader / Radio / Checkbox / Switch / Rate / Upload —— 全部来自 formItemList，没有一行手写控件。', component: getComponent('form/19-all-formtypes'), code: code('form/19-all-formtypes') },
      { key: 'layout', title: '布局与折叠', description: '24 栅格布局 + 自动折叠展开，支持响应式自适应。', component: getComponent('form/02-layout'), code: code('form/02-layout') },
      { key: 'conditional', title: '条件联动表单', description: '模型驱动字段显隐。这里是「回调」对照写法：声明式解法（reactions + JSON 表达式，0 个函数）见下方『报销单：零回调联动』。', component: getComponent('form/03-conditional'), code: code('form/03-conditional') },
      { key: 'declarative-linkage', title: '报销单：零回调联动', description: '省 → 市 → 门店三级下拉；选了城市才要求发票号；大区自动等于省份且锁定；金额 > 5000 才要求说明；非部分退款时隐藏退款原因 —— 全部来自一份纯 JSON（reactions + JSON 表达式），示例里 0 个函数。', component: getComponent('form/20-declarative-linkage'), code: code('form/20-declarative-linkage') },
      { key: 'dynamic', title: '运行期增删表单项', description: '运行时动态增删表单项，支持数组类型表单与动态验证。', component: getComponent('form/04-dynamic'), code: code('form/04-dynamic') },
      { key: 'validation', title: '校验：rules + 自定义 validator', description: '集成 Element Plus 验证体系，支持 rules、pattern、自定义 validator。', component: getComponent('form/05-validation'), code: code('form/05-validation') },
      { key: 'async-options', title: '异步数据表单', description: 'apiParams 自动加载下拉选项 + on.change 驱动级联联动；不依赖请求的级联可用纯声明式写（见『报销单：零回调联动』）。', component: getComponent('form/06-async-options'), code: code('form/06-async-options') },
      { key: 'custom-render', title: '自定义渲染表单', description: 'render 函数扩展能力，支持 Upload、Transfer、Slider、ColorPicker 等复杂组件。', component: getComponent('form/07-custom-render'), code: code('form/07-custom-render') },
      { key: 'dialog', title: '弹窗内嵌表单', description: '在弹窗中使用 EsForm，展示表单与弹窗的无缝集成。', component: getComponent('form/08-dialog'), code: code('form/08-dialog') },
      { key: 'datetime-range', title: '日期时间范围', description: '完整覆盖日期、时间、日期时间范围选择场景。', component: getComponent('form/09-datetime-range'), code: code('form/09-datetime-range') },
      { key: 'cascader', title: '级联选择器', description: '使用 Cascader 组件实现多级联动选择。', component: getComponent('form/10-cascader'), code: code('form/10-cascader') },
      { key: 'advanced-buttons', title: '高级按钮区', description: 'direction: left/right 把按钮分到两端：导出居左，查询/重置居右，无需手写布局；查询真的过滤下方结果集，导出是真的 CSV 文件。', component: getComponent('form/11-advanced-buttons'), code: code('form/11-advanced-buttons') },
      { key: 'upload', title: '图片上传', description: '支持 picture-card 多图上传、自定义 httpRequest、预览删除等完整上传功能。', component: getComponent('form/12-upload'), code: code('form/12-upload') },
      { key: 'file-upload', title: '文件上传', description: '图片 / PDF / TXT 在线预览，Office 文档与压缩包下载，自定义文件列表渲染与操作按钮。', component: getComponent('form/13-file-upload'), code: code('form/13-file-upload') },
      { key: 'preferences', title: '偏好设置', description: 'Radio、Checkbox、Switch、Slider、ColorPicker、Rate 六种选择类控件的纯配置化写法。', component: getComponent('form/14-preferences'), code: code('form/14-preferences') },
      { key: 'computed-fields', title: '联动计算', description: 'on.change + on.input 实现商品选择→自动填充单价→数量折扣→实时计算总价；其中「回写」这一步可改用 reactions.fulfill.value 纯声明式完成（见『报销单：零回调联动』）。', component: getComponent('form/15-computed-fields'), code: code('form/15-computed-fields') },
      { key: 'custom-button', title: '自定义按钮区', description: 'renderBtn 完全自定义按钮区域，支持异步提交、保存草稿、确认弹窗等交互。', component: getComponent('form/16-custom-button'), code: code('form/16-custom-button') },
      { key: 'detail-mode', title: '详情模式', description: '编辑/详情双模式切换：详情模式禁用所有字段并隐藏按钮，编辑模式恢复可交互。', component: getComponent('form/17-detail-mode'), code: code('form/17-detail-mode') },
      { key: 'search-form', title: '组合搜索', description: 'isHidden 条件显隐 + apiParams 异步选项 + 更多/收起，完整搜索表单模式。', component: getComponent('form/18-search-form'), code: code('form/18-search-form') }
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
        { name: 'formtype', type: 'string', default: '-', desc: '控件类型（14 种）：Input / InputNumber / Select / DatePicker / TimePicker / Slider / ColorPicker / Transfer / Cascader / Radio / Checkbox / Switch / Rate / Upload。旧写法 datePicker / timePicker 仍兼容' },
        { name: 'span', type: 'number', default: '6', desc: '栅格占位（24 列布局）' },
        { name: 'attrs', type: 'Object', default: '-', desc: '透传给 Element Plus 组件的属性（placeholder、clearable 等）' },
        { name: 'on', type: 'Object', default: '-', desc: '事件监听，如 { change: (val) => {} }' },
        { name: 'dataOptions', type: 'Array<{label, value}>', default: '-', desc: '选项数据（Select/Radio/Checkbox/Cascader）' },
        { name: 'isHidden', type: 'Function | 声明式条件', default: '-', desc: '条件隐藏：函数 (model, item, formProps) => boolean；也可写 JSON 表达式（如 { "!=": [{ var: "type" }, "a"] }）或 { field, op, value } 条件数组' },
        { name: 'reactions', type: 'FieldReaction[]', default: '-', desc: '声明式字段联动（纯 JSON，无需回调）：fulfill 可给 dataOptions / required / disabled / value；value 必须配 dependencies' },
        { name: 'required', type: 'boolean', default: '-', desc: '必填快捷字段（可被 reactions.fulfill.required 动态覆盖）' },
        { name: 'disabled', type: 'boolean', default: '-', desc: '禁用快捷字段，自动注入 attrs（可被 reactions.fulfill.disabled 动态覆盖）' },
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
        { name: 'rowLayProps', type: 'Object', default: '-', desc: '行级别属性（透传给 el-row）' },
        { name: 'rowLayProps.gutter', type: 'number', default: '20', desc: '栅格间距' },
        { name: 'formLayProps', type: 'Object', default: '-', desc: '表单本体配置（推荐写法）' },
        { name: 'formLayProps.labelWidth', type: 'string | number', default: '-', desc: '标签宽度，如 "100px"' },
        { name: 'formLayProps.size', type: 'string', default: '-', desc: '控件尺寸：large / default / small' },
        { name: 'formLayProps.minFoldRows', type: 'number', default: '0', desc: '折叠时显示的行数，0 不折叠' },
        { name: 'formLayProps.isBtnHidden', type: 'boolean', default: 'false', desc: '是否隐藏内置按钮区域' },
        { name: 'formLayProps.btnColSpan', type: 'number', default: '-', desc: '按钮所在列的 span' },
        { name: 'formLayProps.labelBtnWidth', type: 'string | number', default: '-', desc: '按钮区标签宽度' },
        { name: 'fromLayProps', type: 'Object', default: '-', desc: '旧拼写（键同 formLayProps），仅为兼容保留，新代码请改用 formLayProps' },
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
      // EsForm 不向外派发 confirm / reset：查询与重置由按钮的 triggerEvent 在组件内部完成
      // （见 es-form.vue 顶部注释）。此前这里列了两条不存在的事件，宿主照着写只会得到静默 no-op。
      events: [],
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
      { key: 'basic', title: '配置化基础表格', description: '一份 columns JSON 渲染整张表格，不写模板、不写插槽。', component: getComponent('table/01-basic'), code: code('table/01-basic') },
      { key: 'toolbar', title: '表格工具栏', description: '表格顶部操作区，支持 configBtn、leftText 配置和 default slot 自定义内容。', component: getComponent('table/02-toolbar'), code: code('table/02-toolbar') },
      { key: 'custom', title: '自定义列渲染', description: 'render 函数、scopedSlots、formatter 多种自定义列渲染方式。', component: getComponent('table/03-custom'), code: code('table/03-custom') },
      { key: 'selection', title: '多选与跨页记忆', description: 'multiSelect + cachePageSelection + rowKey，分页后切换页码仍能保持跨页勾选状态。', component: getComponent('table/04-selection'), code: code('table/04-selection') },
      { key: 'edit', title: '点击单元格即编辑', description: '表格即编辑器，点击单元格进入编辑模式，支持批量保存/取消。', component: getComponent('table/05-edit'), code: code('table/05-edit') },
      { key: 'sort', title: '前端 / 后端排序', description: '前端排序与后端排序两种模式。', component: getComponent('table/06-sort'), code: code('table/06-sort') },
      { key: 'group', title: '分组表头', description: 'groups 嵌套列配置实现多级分组表头。', component: getComponent('table/07-group'), code: code('table/07-group') },
      { key: 'fixed', title: '固定列与固定高度', description: 'fixed 固定列 + heightType: height 固定高度，宽表横向滚动时关键列始终可见。', component: getComponent('table/08-fixed'), code: code('table/08-fixed') },
      { key: 'pagination', title: '分页表格：v-model 自动翻页', description: '配置 httpRequest + configTableOut 对接免费接口，v-model 双向绑定自动分页。', component: getComponent('table/09-pagination'), code: code('table/09-pagination') },
      { key: 'remote-data', title: '远程数据表格', description: 'actionUrl + httpRequest + configTableOut 完整远程数据请求与分页。', component: getComponent('table/10-remote-data'), code: code('table/10-remote-data') },
      { key: 'expand', title: '展开行与树形', description: 'type:expand 展开行 + children 树形数据两种层级展示模式。', component: getComponent('table/11-expand'), code: code('table/11-expand') },
      { key: 'cell-merge', title: '声明式行合并与行样式', description: 'mergeConfig.rowsBy 声明式合并单元格（同一份 JSON 三端通用，无需手写 span 函数）+ rowClassName 条件行样式。', component: getComponent('table/12-cell-merge'), code: code('table/12-cell-merge') },
      { key: 'query-table', title: '配置化查询：零 handleSearch', description: '查询区也是配置：es-form 嵌套进 es-table，按钮 key=query/rest + triggerEvent 自动联动，整页没有 handleSearch / handleReset。', component: getComponent('table/13-query-table'), code: code('table/13-query-table') },
      { key: 'row-actions', title: '行操作按钮与动态显隐', description: 'btns 的 hidden 同时按行状态与角色求值：草稿/已驳回才出现「提交审核」，已通过不可删；工具栏新增、批量审核（按勾选行）、导出都真实落到数据源。', component: getComponent('table/14-row-actions'), code: code('table/14-row-actions') },
      { key: 'dynamic-columns', title: '动态列与汇总行', description: 'hidCol 动态列显隐 + show-summary/summary-method 配置化汇总行。', component: getComponent('table/15-dynamic-columns'), code: code('table/15-dynamic-columns') },
      { key: 'callback-pipeline', title: '请求回调管线', description: 'listenToCallBack brcb/qrcb 请求响应拦截 + configTableOut 字段映射 + entryQuery 默认参数。', component: getComponent('table/16-callback-pipeline'), code: code('table/16-callback-pipeline') },
      { key: 'current-row', title: '当前行与主从联动', description: 'highlightCurrentRow 行高亮 + @current-change 事件驱动从表 + 汇总统计。', component: getComponent('table/17-current-row'), code: code('table/17-current-row') },
      { key: 'table-height', title: '自适应容器高度', description: 'heightType: height 继承父容器高度 + ResizeObserver 自动计算，容器变表格自适应。', component: getComponent('table/18-table-height'), code: code('table/18-table-height') }
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
        { name: 'expandConfig', type: 'Object', default: '-', desc: '展开行内容 { title?, fields }，仅 type: "expand" 列消费' },
        { name: 'hidCol', type: 'boolean', default: '-', desc: '是否隐藏该列' },
        { name: 'permissionValue', type: 'string', default: '-', desc: '列级权限编码：无权限时该列不渲染（未配置全局 permission 时放行）' },
        { name: 'btns', type: 'Array', default: '-', desc: '行操作按钮 [{ name, type?, clickEvent? }]' },
        { name: 'type', type: 'string', default: '-', desc: '特殊列类型：selection/expand/index' },
        { name: 'emptyPlaceholder', type: 'string', default: '-', desc: '空值占位文本，默认 "-"' },
        { name: 'editRender', type: 'Object', default: '-', desc: 'vxe：行内编辑渲染器，需配合 options.editConfig' },
        { name: 'footerFormatter', type: 'Function', default: '-', desc: 'vxe：表尾单元格格式化，配合 options.showFooter' }
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
        { name: 'entryQuery', type: 'Object', default: '-', desc: '固定并入每次请求体的默认参数（与分页参数、apiParams.model 合并）' },
        { name: 'actionUrl', type: 'string', default: '-', desc: '请求地址（简写）' },
        { name: 'isInitRun', type: 'boolean', default: '-', desc: '初始化时是否自动请求数据' },
        { name: 'configBtn', type: 'Array', default: '-', desc: '顶部操作按钮配置（TableOptions 的键，不是组件 prop）' },
        { name: 'leftText', type: 'string', default: '-', desc: '顶部左侧文本' },
        { name: 'headerCellStyle', type: 'Object', default: '-', desc: '表头单元格样式' },
        { name: 'headerCellClassName', type: 'string | Function', default: '-', desc: '表头单元格类名' },
        { name: 'showHeader', type: 'boolean', default: 'true', desc: '是否显示表头' },
        { name: 'emptyText', type: 'string', default: '-', desc: '空数据时的占位文本' },
        { name: 'rowStyle', type: 'Object | Function', default: '-', desc: '行内样式，支持 ({ row, rowIndex }) => object' },
        { name: 'defaultSort', type: 'Object', default: '-', desc: '默认排序 { prop, order: "ascending" | "descending" }' },
        { name: 'spanMethod', type: 'Function', default: '-', desc: '合并单元格 ({ row, column, rowIndex, columnIndex }) => [rowspan, colspan]' },
        { name: 'cellClassName', type: 'string | Function', default: '-', desc: '单元格类名' },
        { name: 'cellStyle', type: 'Object | Function', default: '-', desc: '单元格样式' },
        { name: 'refetchKeepPage', type: 'boolean', default: 'false', desc: '请求式刷新时保留当前页码' },
        { name: 'localPagination', type: 'boolean', default: 'false', desc: '本地分页（对已加载数据切片，不发请求）' },
        { name: 'vxeConfig', type: 'Object', default: '-', desc: 'vxe 引擎：整体透传给 vxe-grid 的配置' },
        { name: 'vxeOn', type: 'Object', default: '-', desc: 'vxe 引擎：透传给 vxe-grid 的事件监听' },
        { name: 'showFooter', type: 'boolean', default: 'false', desc: 'vxe：显示表尾' },
        { name: 'footerMethod', type: 'Function', default: '-', desc: 'vxe：表尾计算 ({ columns, data }) => 二维数组' },
        { name: 'footerData', type: 'Array', default: '-', desc: 'vxe：静态表尾数据（二维数组）' },
        { name: 'editConfig', type: 'Object', default: '-', desc: 'vxe：行内编辑配置' },
        { name: 'keepSource', type: 'boolean', default: '-', desc: 'vxe：保留原始行数据（配合 revertData）' },
        { name: 'treeConfig', type: 'Object', default: '-', desc: 'vxe：树形表格配置' },
        { name: 'proxyConfig', type: 'Object', default: '-', desc: 'vxe：数据代理配置' },
        { name: 'expandConfig', type: 'Object', default: '-', desc: 'vxe：展开行为配置（与列上的 expandConfig「展开内容」不是同一概念）' },
        { name: 'seqConfig', type: 'Object', default: '-', desc: 'vxe：序号列配置' },
        { name: 'printConfig', type: 'Object | boolean', default: '-', desc: 'vxe：打印配置' },
        { name: 'exportConfig', type: 'Object | boolean', default: '-', desc: 'vxe：导出配置' },
        { name: 'toolbarConfig', type: 'Object | boolean', default: '-', desc: 'vxe：工具栏配置' },
        { name: 'columnConfig', type: 'Object', default: '-', desc: 'vxe：列配置面板' },
        { name: 'keyboardConfig', type: 'Object', default: '-', desc: 'vxe：键盘导航配置' },
        { name: 'mouseConfig', type: 'Object', default: '-', desc: 'vxe：鼠标行为配置' },
        { name: 'clipboardConfig', type: 'Object', default: '-', desc: 'vxe：剪贴板配置' },
        { name: 'validConfig', type: 'Object', default: '-', desc: 'vxe：校验提示配置' }
      ],
      events: [
        { name: 'update:dataSource', params: '(data)', desc: '数据更新（v-model:data-source 自动触发）' },
        { name: 'update:pagination', params: '(pagination)', desc: '分页更新（v-model:pagination 自动触发）' },
        { name: 'pagination-current-change', params: '(pagination)', desc: '页码变化时触发' },
        { name: 'size-change', params: '(pagination, size)', desc: '每页条数变化时触发' },
        { name: 'change-table-sort', params: '(column)', desc: '排序变化时触发' },
        { name: 'selection-change', params: '(rows)', desc: '勾选变化：当前页选中行数组；开启 cachePageSelection 时跨页全集用 getSelectionRows() 取' },
        { name: 'request-error', params: '(error)', desc: '自动取数失败时触发；错误同时挂在 requestError 上，成功后复位为 null' }
      ],
      methods: [
        { name: 'httpRequestInstance', params: '(model?, { keepPage }?)', desc: '手动取数。默认回到第 1 页（搜索语义），keepPage: true 保留当前页' },
        { name: 'refresh', params: '(model?)', desc: '刷新当前页：保留页码重新取数并重排；本地/静态数据只重排' },
        { name: 'reload', params: '(model?)', desc: '回到第 1 页重新取数（等价于一次新查询）' },
        { name: 'doLayout', params: '-', desc: '仅重排列宽/布局，不重新取数（旧 refresh 行为的逃生舱）' },
        { name: 'requestError', params: 'Ref<unknown>', desc: '最近一次自动加载的错误；成功后复位为 null' },
        { name: 'getSelectionRows', params: '-', desc: '获取选中行（含跨页缓存）。注：跨页选择不通过事件暴露，需通过此方法或 ref 主动读取' },
        { name: 'clearSelection', params: '-', desc: '清除当前页选择' },
        { name: 'clearAllSelection', params: '-', desc: '清除所有页面选择（含跨页缓存）' },
        { name: 'toggleRowSelection', params: '(row, selected?)', desc: '命令式勾选单行；省略 selected 时切换。el-table / virtual / vxe 三引擎同签名' },
        { name: 'scrollToRow', params: '(rowIndex)', desc: '滚动到指定行（virtual 模式 / vxe 引擎均支持；el-table 引擎无此接口）' },
        { name: 'getUpdateRecords', params: '-', desc: 'vxe 行内编辑：已修改的行（engine: "vxe" 时有效）' },
        { name: 'getInsertRecords', params: '-', desc: 'vxe 行内编辑：新增的行' },
        { name: 'getRemoveRecords', params: '-', desc: 'vxe 行内编辑：已删除的行' },
        { name: 'revertData', params: '(rows?)', desc: 'vxe 行内编辑：还原未保存的改动' },
        { name: 'clearActived', params: '-', desc: 'vxe 行内编辑：清除当前激活（编辑中）单元格' },
        { name: 'clearValidate', params: '-', desc: 'vxe 行内编辑：清除校验状态' },
        { name: 'validate', params: '(rows?)', desc: 'vxe 行内编辑：校验表格（可指定行），返回 Promise' },
        { name: 'exportData', params: '(opts?)', desc: 'vxe 导出：导出当前数据（xlsx/csv/xml/html，opts 即 vxe exportData 配置）' },
        { name: 'print', params: '(opts?)', desc: 'vxe 打印：调用 vxe 打印；可传 { html } 打印 getPrintHtml 修正过的 HTML' },
        { name: 'getPrintHtml', params: '(opts?)', desc: 'vxe 打印：取表格 HTML 字符串（vxe 打印不执行 spanMethod，合并区需配合 patchHtmlRowSpans 修正）' },
        { name: 'vxeInstance', params: '-', desc: 'vxe 原始实例，访问 vxe-table 全部方法/事件（engine: "vxe" 时有效）' }
      ],
      slots: [
        { name: 'default', params: '-', desc: '表格上方自定义区域（headerBar）。最常用的是把 <es-form> 嵌进来做查询区——配合按钮 triggerEvent 即可自动联动' },
        { name: '<你的插槽名>', params: '{ row, column, $index }', desc: '列作用域插槽：列配置写 scopedSlots: { customRender: "你的插槽名" } 即可接到它；也可改用列上的 render 函数' }
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
      { key: 'basic', title: '基础 CRUD：一行 actions 派生', description: '只写一行 actions：工具栏、操作列、弹窗全部自动派生；增删改真正落到数据源。', component: getComponent('crud-page/01-basic'), code: code('crud-page/01-basic') },
      { key: 'multi-dialog', title: '多弹窗绑定', description: '一个页面挂新增/编辑/批量分配三个弹窗，按钮到弹窗全靠 dialogKey 绑定。', component: getComponent('crud-page/02-multi-dialog'), code: code('crud-page/02-multi-dialog') },
      { key: 'custom-render', title: '自定义弹窗内容', description: 'dialogs.render 接管弹窗：拖拽上传真的入库，统计面板读的是实时数据。', component: getComponent('crud-page/03-custom-render'), code: code('crud-page/03-custom-render') },
      { key: 'dynamic-title', title: '动态标题与回填', description: 'title 写成函数跟着行数据变，编辑弹窗按 prop 路径自动回填选中行。', component: getComponent('crud-page/04-dynamic-title'), code: code('crud-page/04-dynamic-title') },
      { key: 'row-confirm', title: '行确认与删除', description: '危险操作先走 confirm 二次确认，确认后才真正删除/发布/批量归档。', component: getComponent('crud-page/05-row-confirm'), code: code('crud-page/05-row-confirm') },
      { key: 'permission', title: '权限控制按钮', description: 'permissionValue + configureEsPlus(permission)：切角色即时隐藏无权按钮。', component: getComponent('crud-page/06-permission'), code: code('crud-page/06-permission') },
      { key: 'custom-footer', title: '自定义弹窗底部', description: 'configBtn 按 action 语义装配：custom 自己接线，confirm 走校验后提交。', component: getComponent('crud-page/07-custom-footer'), code: code('crud-page/07-custom-footer') },
      { key: 'program-open', title: '程序化控制弹窗', description: 'ref.openDialog / closeDialog 程序化开关弹窗，保存结果回写列表。', component: getComponent('crud-page/08-program-open'), code: code('crud-page/08-program-open') },
      { key: 'hidden-column', title: '隐藏操作列', description: 'operationColumn: false + 纯工具栏：CSV 导出与清空日志都在 btn-click 里真实执行。', component: getComponent('crud-page/09-hidden-column'), code: code('crud-page/09-hidden-column') },
      { key: 'full-business', title: '完整业务：多弹窗 + 导出', description: '用户管理全功能：多弹窗 + 动态标题 + render 详情 + 批量启用 + CSV 导出。', component: getComponent('crud-page/10-full-business'), code: code('crud-page/10-full-business') }
    ],
    api: {
      props: [
        { name: 'schema', type: 'CrudPageSchema', default: '-', desc: 'CRUD 页面完整配置对象（必填，见 CrudPageSchema 表）' },
        { name: 'httpRequest', type: 'Function', default: '-', desc: '自定义 HTTP 请求方法，覆盖 schema.tableOptions.httpRequest' },
        { name: 'autoLoad', type: 'boolean', default: 'true', desc: '是否在挂载时自动请求数据' }
      ],
      'CrudPageSchema': [
        { name: 'formItems', type: 'FormItemOption[]', default: '[]', desc: '查询表单字段配置（同 EsForm formItemList）' },
        { name: 'formLayout', type: '{ labelWidth, minFoldRows }', default: '-', desc: '表单布局（列宽由字段级 querySpan/formSpan 决定）' },
        { name: 'columns', type: 'TableColumn[]', default: '-', desc: '表格列配置（必填，同 EsTable columns）' },
        { name: 'tableOptions', type: 'TableOptions', default: '{}', desc: '表格选项配置（同 EsTable options）' },
        { name: 'pagination', type: 'PaginationConfig', default: '-', desc: '分页配置' },
        { name: 'toolbarBtns', type: 'CrudBtnConfig[]', default: '-', desc: '工具栏按钮（见 CrudBtnConfig 表）' },
        { name: 'tableBtns', type: 'TableBtnConfig[]', default: '-', desc: '表格工具栏按钮（渲染在 EsTable 上方；position: left/right）。键与 CrudBtnConfig 相同（另含已废弃的 code），只有 EsCrudPage 消费该字段，写进 EsTable 的 options 不会生效' },
        { name: 'operationColumn', type: 'OperationColumnConfig | false', default: '-', desc: '操作列配置，false 隐藏操作列（见 OperationColumnConfig 表）' },
        { name: 'dialogs', type: 'Record<string, CrudDialogConfig>', default: '-', desc: '多弹窗配置，key 为弹窗标识（见 CrudDialogConfig 表）' },
        { name: 'actions (deprecated)', type: 'CrudAction[]', default: '-', desc: '旧版快捷动作，建议改用 toolbarBtns + operationColumn' },
        { name: 'dialogFormItems (deprecated)', type: 'FormItemOption[]', default: '-', desc: '旧版单弹窗表单，建议改用 dialogs' },
        { name: 'dialogOptions (deprecated)', type: 'DialogOptions', default: '-', desc: '旧版单弹窗配置，建议改用 dialogs' },
        { name: 'queryBtns (deprecated)', type: 'BtnConfig[]', default: '-', desc: '旧版查询按钮，建议改用 toolbarBtns' }
      ],
      'CrudBtnConfig': [
        { name: 'name', type: 'string', default: '必填', desc: '按钮文本' },
        { name: 'key', type: 'string', default: '-', desc: '按钮唯一标识；query / add / export 有内建语义，其余经 btn-click 派发' },
        { name: 'type', type: 'string', default: '-', desc: '按钮类型：primary/success/warning/danger' },
        { name: 'size', type: 'string', default: '-', desc: '按钮尺寸；tableBtns 缺省为 small' },
        { name: 'icon', type: 'string', default: '-', desc: '图标名称（Element Plus Icons）' },
        { name: 'position', type: 'string', default: 'left', desc: '左右位置：left / right（tableBtns 用它分组；toolbarBtns 由 EsForm 按钮区布局决定）' },
        { name: 'code', type: '1 | 2', default: '-', desc: '位置旧写法：2 视为 right，其余视为 left（position 优先）' },
        { name: 'direction', type: 'string', default: '-', desc: '按钮排列方向：left / right（弹窗与表格的按钮底座读取；toolbarBtns 不读取）' },
        { name: 'loading', type: 'boolean', default: 'false', desc: '加载态（禁用点击并显示 loading）' },
        { name: 'disabled', type: 'boolean | Function', default: 'false', desc: '禁用状态，支持函数动态判断' },
        { name: 'permissionValue', type: 'string', default: '-', desc: '权限标识，配合全局 permission 函数控制显隐' },
        { name: 'triggerEvent', type: 'boolean', default: 'false', desc: '仅 toolbarBtns：key 为 query / rest 时点击触发一次表格刷新' },
        { name: 'click', type: 'Function', default: '-', desc: '(model, formRef?) => void；tableBtns 中的 click 会被 CRUD 页接管（改走 dialogKey / actionType）' },
        { name: 'dialogKey', type: 'string', default: '-', desc: '点击时打开的弹窗 key（自动绑定 dialogs 中的配置）' },
        { name: 'actionType', type: 'string', default: '-', desc: '语义动作类型（用于 btn-click 事件 emit）' },
        { name: 'confirm', type: 'string | boolean', default: '-', desc: '点击前确认提示文字' }
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
        { name: 'formLayout', type: '{ labelWidth }', default: '-', desc: '弹窗表单布局（只认 labelWidth；列宽由字段级 span 决定）' },
        { name: 'render', type: 'Function', default: '-', desc: '自定义渲染 (h, { row, model, close, refresh }) => VNode' },
        { name: 'configBtn', type: 'DialogBtnConfig[]', default: '-', desc: '底部按钮配置，action: confirm/cancel/custom' },
        { name: 'isHiddenFooter', type: 'boolean', default: 'false', desc: '隐藏底部按钮区域' },
        { name: 'isDraggable', type: 'boolean', default: 'false', desc: '可拖拽' },
        { name: 'fullscreen', type: 'boolean', default: 'false', desc: '全屏' },
        { name: 'maxHeight', type: 'string | number', default: '-', desc: '最大高度' },
        { name: 'showClose', type: 'boolean', default: 'true', desc: '显示关闭入口（自绘的与原生的一起隐藏）' },
        { name: 'destroyOnClose', type: 'boolean', default: '-', desc: '关闭时销毁内容（每次打开重置内部状态）' },
        { name: 'modal', type: 'boolean', default: 'true', desc: '是否需要遮罩层' },
        { name: 'closeOnClickModal', type: 'boolean', default: 'true', desc: '点击遮罩层是否关闭' },
        { name: 'closeOnPressEscape', type: 'boolean', default: 'true', desc: '按下 ESC 是否关闭' },
        { name: 'hiddenFullBtn', type: 'boolean', default: 'false', desc: '隐藏全屏按钮' },
        { name: 'appendTo', type: 'string', default: '-', desc: '挂载点（CSS 选择器；DOM 元素无法经 JSON 传递）' },
        { name: 'cacheKey', type: 'string', default: '-', desc: '实例缓存键：同键跨多次调用复用同一弹窗实例（保留内部状态）' },
        { name: 'hasCustomRender', type: 'boolean', default: '-', desc: 'AI 生成器注解键：生成器据此转成 TODO 占位。运行时白名单刻意不转发，不是弹窗 prop' },
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
  },
  'es-error-boundary': {
    title: 'EsErrorBoundary 错误边界',
    description:
      '组件级错误围栏：子树在渲染 / 生命周期 / 侦听器里出错时只降级这一块，通过 error 事件上报、reset() 原地恢复 —— 一个坏组件不会拖垮整页。',
    features: [
      { name: '故障隔离', desc: '只降级出错的子树，边界外照常交互', icon: 'WarningFilled' },
      { name: '降级 UI 可定制', desc: 'fallback 插槽拿到 error / reset；零配置时用 fallbackText', icon: 'Edit' },
      { name: '错误上报', desc: 'error 事件带 (err, info)，可直接接埋点与日志', icon: 'Bell' },
      { name: '原地恢复', desc: 'reset() 清除错误态，修好数据即重新挂载子树', icon: 'RefreshRight' }
    ],
    examples: [
      {
        key: 'basic',
        title: '故障注入台：一处坏掉，整页还在',
        description:
          '两个会抛错的子组件分别走「自定义 fallback + reset」与「只给 fallback-text + ref.reset()」两条恢复路径；error 事件实时落到日志，边界外的按钮全程可点 —— 隔离是能被操作验证的。',
        component: getComponent('error-boundary/basic'),
        code: code('error-boundary/basic')
      }
    ],
    api: {
      props: [
        { name: 'fallbackText', type: 'string', default: "''", desc: '默认降级文案；未提供 fallback 插槽时显示' }
      ],
      slots: [
        { name: 'default', params: '-', desc: '正常渲染的子树：其渲染 / 生命周期 / 侦听器错误会被本边界捕获' },
        { name: 'fallback', params: '{ error, reset }', desc: '捕获错误后替代渲染；error 为原始错误，reset() 清除错误态（须先修好数据）' }
      ],
      events: [
        {
          name: 'error',
          params: '(err, info)',
          desc: '捕获到子树错误时触发；info 是出错钩子名（如 render function）。边界返回 false，错误不再冒泡到 app.config.errorHandler'
        }
      ],
      methods: [
        { name: 'reset', params: '-', desc: '清除错误态并重新挂载子树；若导致错误的数据没修好，会立刻再次降级' }
      ]
    }
  },
  'svg-icon': {
    title: 'SvgIcon 图标',
    description:
      '统一的图标出口：雪碧图符号按 currentColor 着色、尺寸随字号，也能直接吃 http(s) 外部图片 —— 业务里不必再各写一套 <svg><use>。',
    features: [
      { name: '雪碧图符号', desc: 'iconClass 自动拼成 #icon-xxx，引用页面注入的 <symbol>', icon: 'Picture' },
      { name: '随主题着色', desc: 'fill: currentColor，放进按钮/标签自动跟随颜色与禁用态', icon: 'Brush' },
      { name: '尺寸即字号', desc: '宽高都是 1em，字号多大图标就多大，无需尺寸 prop', icon: 'FullScreen' },
      { name: '外部图片', desc: '协议开头（http(s)/mailto/tel/open）自动切到外部图片模式', icon: 'Link' }
    ],
    examples: [
      {
        key: 'basic',
        title: '一个图标出口：尺寸 / 着色 / 类名 / 外部图片',
        description:
          '内联一份雪碧图即可跑：字号控制尺寸、color 控制颜色、className 追加装饰样式，最后的协议地址切到外部图片模式。组件只输出那一个 1em 的图标，其余全部交给宿主。',
        component: getComponent('svg-icon/basic'),
        code: code('svg-icon/basic')
      }
    ],
    api: {
      props: [
        {
          name: 'iconClass',
          type: 'string',
          default: '必填',
          desc: '图标名。非协议开头 → 渲染 <svg><use href="#icon-{iconClass}">；以 http(s)/mailto/tel/open 开头 → 外部图片模式'
        },
        { name: 'className', type: 'string', default: "''", desc: '追加到根节点的类名，装饰性样式不必改组件' }
      ]
    }
  }
}
