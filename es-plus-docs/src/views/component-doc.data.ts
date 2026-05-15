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
      { title: '基础配置表单', description: '通过 formItemList JSON 配置生成完整表单，涵盖所有原生表单类型。', component: null, code: code('form/01-basic') },
      { title: '布局与折叠', description: '24 栅格布局 + 自动折叠展开，支持响应式自适应。', component: null, code: code('form/02-layout') },
      { title: '条件联动表单', description: '模型驱动字段显隐，isHiden + on.change 实现字段间联动。', component: null, code: code('form/03-conditional') },
      { title: '动态增减表单', description: '运行时动态增删表单项，支持数组类型表单与动态验证。', component: null, code: code('form/04-dynamic') },
      { title: '表单验证', description: '集成 Element Plus 验证体系，支持 rules、pattern、自定义 validator。', component: null, code: code('form/05-validation') },
      { title: '异步数据表单', description: 'apiParams 自动加载下拉选项 + on.change 驱动级联联动。', component: null, code: code('form/06-async-options') },
      { title: '自定义渲染表单', description: 'render 函数扩展能力，支持 Upload、Transfer、Slider、ColorPicker 等复杂组件。', component: null, code: code('form/07-custom-render') },
      { title: '弹窗表单', description: '在弹窗中使用 EsForm，展示表单与弹窗的无缝集成。', component: null, code: code('form/08-dialog') },
      { title: '日期时间范围', description: '完整覆盖日期、时间、日期时间范围选择场景。', component: null, code: code('form/09-datetime-range') },
      { title: '级联选择器', description: '使用 Cascader 组件实现多级联动选择。', component: null, code: code('form/10-cascader') },
      { title: '高级按钮区', description: 'btnColSpanRow + direction 实现左右分栏按钮区，支持 renderBtn 完全自定义。', component: null, code: code('form/11-advanced-buttons') },
      { title: '图片上传', description: '支持 picture-card 多图上传、自定义 httpRequest、预览删除等完整上传功能。', component: null, code: code('form/12-upload') },
      { title: '文件上传', description: '支持图片、PDF、TXT、Word、Excel、PPT 预览下载及 ZIP 下载，自定义文件列表与操作按钮。', component: null, code: code('form/13-file-upload') },
      { title: '偏好设置', description: 'Radio、Checkbox、Switch、Slider、ColorPicker、Rate 六种组件配置化示例，覆盖全部基础表单类型。', component: null, code: code('form/14-preferences') },
      { title: '联动计算', description: 'on.change + on.input 实现商品选择→自动填充单价→数量折扣→实时计算总价。', component: null, code: code('form/15-computed-fields') },
      { title: '自定义按钮区', description: 'renderBtn 完全自定义按钮区域，支持异步提交、保存草稿、确认弹窗等交互。', component: null, code: code('form/16-custom-button') },
      { title: '详情模式', description: '编辑/详情双模式切换：详情模式禁用所有字段并隐藏按钮，编辑模式恢复可交互。', component: null, code: code('form/17-detail-mode') },
      { title: '组合搜索', description: 'isHidden 条件显隐 + apiParams 异步选项 + 更多/收起，完整搜索表单模式。', component: null, code: code('form/18-search-form') }
    ],
    api: {
      props: [
        { name: 'model', type: 'Object', default: '{}', desc: '表单数据模型' },
        { name: 'formItemList', type: 'Array', default: '[]', desc: '表单字段配置列表' },
        { name: 'layoutFormProps', type: 'Object', default: '{}', desc: '表单布局配置' },
        { name: 'configBtn', type: 'Array', default: '[]', desc: '按钮配置' },
        { name: 'rules', type: 'Object', default: '{}', desc: '表单验证规则' },
        { name: 'renderBtn', type: 'Function', default: 'false', desc: '自定义按钮渲染' }
      ],
      events: [
        { name: 'confirm', params: '(formRef, model)', desc: '点击查询按钮时触发' },
        { name: 'reset', params: '(formRef, model)', desc: '点击重置按钮时触发' }
      ],
      methods: [
        { name: 'validate', params: '-', desc: '验证表单' },
        { name: 'resetFields', params: '-', desc: '重置表单' },
        { name: 'clearValidate', params: '-', desc: '清除验证状态' }
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
      { title: '基础表格', description: '通过 columns JSON 配置生成完整表格。', component: null, code: code('table/01-basic') },
      { title: '表格工具栏', description: '表格顶部操作区，支持 configBtn、leftText 配置和 default slot 自定义内容。', component: null, code: code('table/02-toolbar') },
      { title: '自定义列渲染', description: 'render 函数、scopedSlots、formatter 多种自定义列渲染方式。', component: null, code: code('table/03-custom') },
      { title: '多选与跨页记忆', description: 'multiSelect + cachePageSelection + rowKey，分页后切换页码仍能保持跨页勾选状态。', component: null, code: code('table/04-selection') },
      { title: '行内编辑', description: '表格即编辑器，点击单元格进入编辑模式，支持批量保存/取消。', component: null, code: code('table/05-edit') },
      { title: '排序表格', description: '前端排序与后端排序两种模式。', component: null, code: code('table/06-sort') },
      { title: '分组表头', description: 'groups 嵌套列配置实现多级分组表头。', component: null, code: code('table/07-group') },
      { title: '固定列与高度', description: 'fixed 固定列 + 自适应高度，适合宽表展示。', component: null, code: code('table/08-fixed') },
      { title: '分页表格', description: '配置 httpRequest + configTableOut 对接免费接口，v-model 双向绑定自动分页。', component: null, code: code('table/09-pagination') },
      { title: '远程数据表格', description: 'actionUrl + httpRequest + configTableOut 完整远程数据请求与分页。', component: null, code: code('table/10-remote-data') },
      { title: '展开行与树形', description: 'type:expand 展开行 + children 树形数据两种层级展示模式。', component: null, code: code('table/11-expand') },
      { title: '单元格合并与行样式', description: 'spanMethod 合并单元格 + rowClassName 条件行样式。', component: null, code: code('table/12-cell-merge') },
      { title: '配置化查询表格', description: 'entryQuery 自动合并搜索参数 + httpRequestInstance 手动刷新，零手动联动代码。', component: null, code: code('table/13-query-table') },
      { title: '行操作按钮与动态显隐', description: 'btns 配置化行操作按钮 + configBtn 的 isHide/disabled 函数式控制。', component: null, code: code('table/14-row-actions') },
      { title: '动态列与汇总行', description: 'hidCol 动态列显隐 + show-summary/summary-method 配置化汇总行。', component: null, code: code('table/15-dynamic-columns') },
      { title: '请求回调管线', description: 'listenToCallBack brcb/qrcb 请求响应拦截 + configTableOut 字段映射 + entryQuery 默认参数。', component: null, code: code('table/16-callback-pipeline') },
      { title: '当前行与主从联动', description: 'highlightCurrentRow 行高亮 + @current-change 事件驱动从表 + 汇总统计。', component: null, code: code('table/17-current-row') },
      { title: '自适应容器高度', description: 'heightType: height 继承父容器高度 + ResizeObserver 自动计算，容器变表格自适应。', component: null, code: code('table/18-table-height') }
    ],
    api: {
      props: [
        { name: 'dataSource', type: 'Array', default: '[]', desc: '表格数据源' },
        { name: 'columns', type: 'Array', default: '[]', desc: '列配置' },
        { name: 'options', type: 'Object', default: '{}', desc: '表格选项配置' },
        { name: 'pagination', type: 'Object', default: '{}', desc: '分页配置' }
      ],
      events: [
        { name: 'selection-change', params: '(selection)', desc: '选择项变化时触发' },
        { name: 'pagination-current-change', params: '(pagination)', desc: '页码变化时触发' },
        { name: 'size-change', params: '(pagination, size)', desc: '每页条数变化时触发' },
        { name: 'change-table-sort', params: '(column)', desc: '排序变化时触发' }
      ],
      methods: [
        { name: 'httpRequestInstance', params: '(model)', desc: '手动触发数据查询' },
        { name: 'clearSelection', params: '-', desc: '清空选择' },
        { name: 'toggleRowSelection', params: '(row, selected)', desc: '切换行选择状态' }
      ]
    }
  }
}
