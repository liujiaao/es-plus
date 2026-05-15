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
      { title: '弹窗基础与变体', description: '基础调用 + 内容弹窗 + 抽屉变体 + 滚动内容。', component: null, code: code('dialog/01-basic') },
      { title: '表单弹窗', description: '弹窗中使用 EsForm，支持表单验证与提交闭环。', component: null, code: code('dialog/02-form') },
      { title: '确认与消息弹窗', description: '图标化确认弹窗，覆盖 success/warning/error 消息提示。', component: null, code: code('dialog/03-confirm') },
      { title: '嵌套弹窗', description: '独立 useDialog 实例，支持父子弹窗通信与层级管理。', component: null, code: code('dialog/04-nested-modal') },
      { title: '高级弹窗', description: '可拖拽 + 自定义头尾 + 全屏 + 限高，覆盖高级定制场景。', component: null, code: code('dialog/05-advanced') },
      { title: '异步组件弹窗', description: 'defineAsyncComponent 实现弹窗内容延迟加载。', component: null, code: code('dialog/06-async') },
      { title: '详情预览弹窗', description: 'ElDescriptions 配置化详情展示，isHiddenFooter 无按钮模式，动态渲染不同业务对象。', component: null, code: code('dialog/07-detail-preview') },
      { title: '弹窗内嵌表格', description: '弹窗中放置 EsTable + multiSelect 多选 + registerRef 获取表格实例读取选中行。', component: null, code: code('dialog/08-table-dialog') },
      { title: '分步向导弹窗', description: 'ElSteps + 多步骤 EsForm 切换，每步独立校验，configBtn 动态按钮控制上一步/下一步/提交。', component: null, code: code('dialog/09-step-dialog') },
      { title: '动态按钮状态弹窗', description: '审批场景：Radio 切换操作类型，按钮 disabled 函数式动态禁用，条件校验。', component: null, code: code('dialog/10-dynamic-btn') },
      { title: '多实例独立弹窗', description: 'onlyInstance: false 模式，同时打开多个独立弹窗，各自拖拽互不影响。', component: null, code: code('dialog/11-multi-instance') },
      { title: '表单+表格+弹窗闭环', description: '弹窗内 EsTable 展示数据 + btns 行操作触发编辑弹窗 + configBtn 新增弹窗，三级弹窗嵌套 CRUD。', component: null, code: code('dialog/12-form-table-dialog') }
    ],
    api: {
      Options: [
        { name: 'title', type: 'string', desc: '弹窗标题' },
        { name: 'width', type: 'string/number', desc: '弹窗宽度' },
        { name: 'render', type: 'Function', desc: '渲染函数，返回VNode' },
        { name: 'configBtn', type: 'Array', desc: '底部按钮配置' },
        { name: 'onSubmit', type: 'Function', desc: '确认回调' },
        { name: 'onClosed', type: 'Function', desc: '关闭回调' },
        { name: 'isDraggable', type: 'boolean', desc: '是否可拖拽' }
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
      { title: '查询表格完整版', description: 'EsForm + EsTable + triggerEvent 实现零事件代码查询。', component: null, code: code('advanced/01-form-table') },
      { title: '零代码查询', description: 'triggerEvent + apiParams.model 自动联动，无需手写查询/重置事件。传统50行→es-plus 10行。', component: null, code: code('advanced/02-zero-code-query') },
      { title: '跨页选择持久化', description: 'rowkey + cachePageSelection 解决 el-table 切换分页选择丢失的痛点。getSelectionRows() 跨页获取全部选中。', component: null, code: code('advanced/03-cross-page-select') },
      { title: '分步表单', description: '分步骤填写的复杂表单，每步独立校验。', component: null, code: code('advanced/04-step-form') },
      { title: '完整CRUD示例', description: 'EsForm + EsTable + useDialog 组合实现完整的增删改查。', component: null, code: code('advanced/05-form-table-dialog') },
      { title: '订单展开明细', description: '展开行内嵌套表格，显示订单商品明细与汇总行。', component: null, code: code('advanced/06-order-expand-table') },
      { title: '极简CRUD弹窗', description: 'useDialog + JSX EsForm — 一个函数完成增/编辑弹窗，registerRef 获取表单实例验证。', component: null, code: code('advanced/07-one-line-crud') },
      { title: '行操作审批流程', description: 'btns条件行操作 + 批量选择 + 弹窗(表格+表单)审批。', component: null, code: code('advanced/08-row-approval') },
      { title: '自适应高度表格', description: 'heightType + tabHeight + ResizeObserver 自动重算，表单展开/收起时表格高度自适应。', component: null, code: code('advanced/09-auto-fit-height') },
      { title: '适配任意后端接口', description: 'configTableOut + brcb/qrcb — 切换3种后端格式仅需改配置，零适配代码。', component: null, code: code('advanced/10-any-backend-api') },
      { title: '条件行操作按钮', description: 'btns 声明式行操作 — 替代 el-table 冗长 v-if slot，按钮行为随行数据动态变化。', component: null, code: code('advanced/11-conditional-btns') },
      { title: '弹窗内表格嵌套表单', description: '两级useDialog嵌套：弹窗表格 → 行btns → 嵌套弹窗表单编辑。', component: null, code: code('advanced/12-dialog-table-form') },
      { title: '动态表单查询', description: 'isHidden 函数式显隐 + 级联选项加载 + apiParams.model 自动同步，零模板代码。', component: null, code: code('advanced/13-dynamic-form-query') },
      { title: '级联表单联动表格', description: '三级级联(isHidden) + httpRequest远程数据 + triggerEvent自动查询。', component: null, code: code('advanced/14-cascade-form-table') },
      { title: '分步导入向导', description: 'useDialog多步骤：配置表单 → 预览表格 → 确认提交，configBtn动态按钮。', component: null, code: code('advanced/15-step-import-wizard') }
    ]
  }
}
