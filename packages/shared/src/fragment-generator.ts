import {
  buildFormItem,
  buildTableColumnSFC,
  expandConfigEngineWarning,
  getDefaultValue,
  inferTsType,
  inlineEditWarnings,
  pushSfcColumn,
  resolveTreeOptions,
  sanitizeExplicitColumns,
  strippedColumnKeys,
} from './structured-generator.js'
import type {
  FieldConfig,
  StructuredCrudConfig,
  StructuredCrudConfigInput,
} from './structured-config.schema.js'
import type { SurfaceField } from './compose-crud-config.js'
import { getEsPlusPackageName, type TargetFramework, DEFAULT_TARGET } from './target.js'
import { q, qBt, qKey, qMember, inlineJson, qAttr } from './codegen-escape.js'
import { SPECIAL_BTN_KEYS, OPERATION_COLUMN_PROP_SFC } from './contract.js'
import { DIALOG_TITLES } from './scene/registry.js'

/**
 * 片段发射层(独立组件)——产出**自包含、可独立编译、可嵌入任意宿主**的单组件 SFC。
 *
 * 为什么单独一层而不是复用 `generateFromConfig`:后者只会产出 es-crud-page 或
 * `<es-table><es-form/></es-table>` 的「完整页」形态(fields/actions 均 min(1)),发射不出
 * 一个光秃秃的 `<es-form>` / `<es-table>` / useDialog 片段。含表格的子集走 `composeCrudConfig`
 * → `generateFromConfig`(编译保证现成);不含表格的子集(独立表单/表格/弹窗、与原生/第三方
 * 组件混排)走这里。
 *
 * 关键不变量:**字段级产物复用 `generateFromConfig` 同一套原子构造器**
 * (`buildFormItem`/`getDefaultValue`/`inferTsType` 等),所以 formItem/默认值/类型推断
 * 与完整页逐字节一致——不是另写一份、不会分叉。
 *
 * `emit:'component'`(本层产物)按组件边界隔离:它不碰宿主的 `<script setup>` 作用域,
 * 因此与 `<a-chart>`、`<el-tabs>`、任意第三方组件并排放都不冲突——"组合"退化成"摆组件"。
 */

export interface FragmentResult {
  code: string
  summary: string
  warnings: string[]
  /**
   * 产物围栏（AI-28）：`'tsx'` = composable 模块（整块按 tsx/jsx 解析），
   * `'vue'` = SFC（按 `<script>` 块切块解析）。缺省 = 该场景只有一种形态
   * （form/table 恒 `'vue'`，dialog 在 AI-28 前恒 `'tsx'`），调用方传的兜底值生效。
   */
  fence?: 'vue' | 'tsx'
}

export interface FormBlockInput {
  /** 表单字段(复用 FieldConfig 词汇,无需 inQuery/inTable/inForm)。 */
  fields: SurfaceField[]
  target?: TargetFramework
  typescript?: boolean
  i18n?: boolean
  /** span 兜底口径:'query' 偏窄(6/8),'form' 整行(24)。默认 'form'。 */
  context?: 'query' | 'form'
  /** 底部按钮:'none'(默认,隐藏按钮区)/ 'query'(查询+重置)/ 'submit'(保存+重置)。 */
  buttons?: 'none' | 'query' | 'submit'
  /** 表单布局（Wave 4）：与权威 schema 顶层的 `formLayout` 同一形状、同一消费面。 */
  formLayout?: EsFormLayout
}

/**
 * 独立表单的布局键（Wave 4）—— 权威 schema 顶层 `formLayout` 的数据子集，
 * 映射到 `es-form` 的 `layoutFormProps.formLayProps`（`labelWidth` / `minFoldRows`
 * 都是 es-form 的真实 prop；此前独立表单这两项写死/不可达）。
 */
export interface EsFormLayout {
  /** 表单 label 宽度（映射 `formLayProps.labelWidth`）。 */
  labelWidth?: string | number
  /** 超过 N 行折叠（映射 `formLayProps.minFoldRows`；需要按钮区，`buttons:'none'` 时会告警）。 */
  minFoldRows?: number
}

/** `formLayout` 的发射枚举（与 {@link EsFormLayout} 键集相等，守卫钉住）。 */
export const FORM_LAYOUT_KEYS = ['labelWidth', 'minFoldRows'] as const

/**
 * 独立表单的完整配置（= `generate_form` 的入参；Wave 4 起容器级词汇复用
 * 权威 `formLayout` 数据子集，见 {@link EsFormLayout}）。
 */
export type EsFormConfig = FormBlockInput

function resolveTarget(t?: TargetFramework): TargetFramework {
  return t === 'vue2' || t === 'antdv' ? t : DEFAULT_TARGET
}

/**
 * 独立 `<es-form>` 组件。自包含:自带 model(reactive)、formItemList、可选按钮。
 * es-plus 组件经插件全局注册,模板里用 `<es-form>` 全局标签,无需 import 组件本身
 * (与 `generateFromConfig` 的 SFC 模式一致)。
 */
export function generateFormBlock(input: FormBlockInput): FragmentResult {
  const target = resolveTarget(input.target)
  const isVue2 = target === 'vue2'
  const ts = input.typescript ?? true
  const i18n = input.i18n ?? false
  const context = input.context ?? 'form'
  const buttons = input.buttons ?? 'none'
  const fields = input.fields
  const warnings: string[] = []
  const layout = input.formLayout ?? {}
  const hasLayout = input.formLayout !== undefined

  if (layout.minFoldRows !== undefined && buttons === 'none') {
    warnings.push(
      "formLayout.minFoldRows 需要按钮区承载折叠开关，但 buttons:'none' 会隐藏整个按钮区（isBtnHidden）—— 该配置在运行时不可见。要折叠请同时传 buttons:'query' 或 'submit'。",
    )
  }

  // AN-11⑤：片段表单的 `render` / `formatter` 此前**静默**丢（`buildFormItem` 两个都不发射）。
  // 与完整页同一套源码论证：表单项是 JSON 数据，载不动函数；且 `es-form` 只在**无 formtype**
  // 时才读 `item.render`，而 `buildFormItem` 恒写 formtype —— 硬塞进去也是永不可达的死代码。
  // 故标记而非假装支持。`formatter` 本就是**表格单元格**的扩展点，对表单项无意义。
  const renderFields = fields.filter((f) => (f as unknown as FieldConfig).render)
  if (renderFields.length > 0) {
    warnings.push(
      `片段表单不消费字段级 render —— ${renderFields.map((f) => `"${f.prop}"`).join(', ')} 已按 formtype 发射默认控件。` +
        '（表单项是 JSON 数据、载不动函数；es-form 只在无 formtype 时才读 item.render。）需要自定义控件请手写 item.render 并去掉该项 formtype。',
    )
  }
  const formatterFields = fields.filter((f) => (f as unknown as FieldConfig).formatter)
  if (formatterFields.length > 0) {
    warnings.push(
      `片段表单不消费字段级 formatter —— ${formatterFields.map((f) => `"${f.prop}"`).join(', ')} 的 formatter 是**表格单元格**扩展点，对表单项无意义（表单里的取值/回显由控件自身负责）。`,
    )
  }

  const lines: string[] = []

  // Template
  lines.push('<template>')
  const btnAttr = buttons === 'none' ? '' : ' :config-btn="configBtn"'
  // 无 formLayout 时保持既有逐字节产物（按钮区隐藏仍走内联字面量）；
  // 给了 formLayout 才引入 layoutFormProps 常量（labelWidth/minFoldRows 有处可落地）。
  const hideBtn = hasLayout
    ? ' :layout-form-props="layoutFormProps"'
    : buttons === 'none'
      ? ' :layout-form-props="{ formLayProps: { isBtnHidden: true } }"'
      : ''
  // `ref` 是运行时契约的一部分：宿主经片段 ref 调用 validate/resetFields（P4）。
  lines.push(`  <es-form ref="formRef" :model="model" :form-item-list="formItems"${btnAttr}${hideBtn} />`)
  lines.push('</template>')
  lines.push('')

  // Script 头:vue3/antdv 用 <script setup>,vue2 用 defineComponent + setup()
  const scriptLang = ts ? 'ts' : ''
  if (isVue2) {
    lines.push(scriptLang ? `<script lang="${scriptLang}">` : '<script>')
  } else {
    lines.push(scriptLang ? `<script setup lang="${scriptLang}">` : '<script setup>')
  }

  const vueImports = isVue2 ? ['defineComponent', 'reactive', 'ref'] : ['reactive', 'ref']
  lines.push(`import { ${vueImports.join(', ')} } from 'vue'`)
  lines.push('')

  if (isVue2) {
    lines.push('export default defineComponent({')
    // 片段自派发的三个语义事件。底层 es-form 不会替我们发 —— 查询/重置的
    // `triggerEvent` 只在表单嵌在 es-table 内时联动表格；独立残片由包装层负责。
    lines.push("  emits: ['submit', 'query', 'reset'],")
    lines.push('  setup(props, ctx) {')
    lines.push('    const emit = ctx.emit')
  } else {
    lines.push("const emit = defineEmits(['submit', 'query', 'reset'])")
  }

  // TS 接口(复用 inferTsType,与完整页一致)
  if (ts && fields.length > 0) {
    lines.push('interface FormModel {')
    for (const f of fields) {
      lines.push(`  ${qKey(f.prop)}: ${inferTsType(f as unknown as FieldConfig)}`)
    }
    lines.push('}')
    lines.push('')
  }

  // 响应式 model(复用 getDefaultValue)
  const modelInit = fields.map((f) => `${qKey(f.prop)}: ${getDefaultValue(f as unknown as FieldConfig)}`).join(', ')
  lines.push(ts ? `const model = reactive<FormModel>({ ${modelInit} })` : `const model = reactive({ ${modelInit} })`)

  // 内部 es-form 的模板 ref —— validate / resetFields 的委托对象（P4）。
  lines.push(
    ts
      ? 'const formRef = ref<{ validate: () => Promise<unknown>; resetFields: () => void } | null>(null)'
      : 'const formRef = ref(null)',
  )

  // formItems(复用 buildFormItem，内联 JSON)
  const formItemsJson = inlineJson(fields.map((f) => buildFormItem(f as unknown as FieldConfig, context, i18n)), 2)
  lines.push(`const formItems = ${formItemsJson}`)

  // 布局（Wave 4）：只有给了 formLayout 才引入常量 —— 未给时保持既有产物逐字节不变。
  // 遍历 FORM_LAYOUT_KEYS（而非逐键手写），接口加键却不发射在结构上不可能。
  if (hasLayout) {
    const formLayProps: Record<string, unknown> = {}
    if (buttons === 'none') formLayProps.isBtnHidden = true
    for (const k of FORM_LAYOUT_KEYS) {
      if (layout[k] !== undefined) formLayProps[k] = layout[k]
    }
    lines.push(`const layoutFormProps = { formLayProps: ${inlineJson(formLayProps)} }`)
  }

  // 可选按钮
  //
  // P4 之前这里发的是 `triggerEvent: true`：只有表单**嵌在 es-table 里**时才有消费者
  // （内部 queryTableRequest 联动父表格）。独立片段没有父表格 ⟹ 保存/查询/重置全是死按钮。
  // 现在改成显式 click 闭包：保存先 validate、通过后才派发 submit；查询/重置派发同名事件。
  if (buttons !== 'none') {
    lines.push('')
    lines.push('const configBtn = [')
    if (buttons === 'query') {
      lines.push(`  { name: '查询', type: 'primary', key: '${SPECIAL_BTN_KEYS.QUERY}', click: (model) => emit('query', { ...model }) },`)
      lines.push(`  { name: '重置', key: '${SPECIAL_BTN_KEYS.RESET}', click: () => emit('reset') },`)
    } else {
      lines.push(
        `  { name: '保存', type: 'primary', key: 'save', click: async (model) => { try { await formRef.value?.validate() } catch { return } emit('submit', { ...model }) } },`,
      )
      lines.push(`  { name: '重置', key: '${SPECIAL_BTN_KEYS.RESET}', click: () => emit('reset') },`)
    }
    lines.push(']')
  }

  // 运行时契约：宿主经片段 ref 调用 validate / resetFields（P4）。三端同名。
  lines.push('')
  lines.push('const validate = () => formRef.value?.validate()')
  lines.push('const resetFields = () => formRef.value?.resetFields()')

  // vue2:闭合 setup() 并 return
  if (isVue2) {
    const exposed = ['model', 'formItems', 'formRef', 'validate', 'resetFields']
    if (buttons !== 'none') exposed.push('configBtn')
    if (hasLayout) exposed.push('layoutFormProps')
    lines.push('')
    lines.push(`    return { ${exposed.join(', ')} }`)
    lines.push('  }')
    lines.push('})')
  } else {
    lines.push('')
    lines.push('defineExpose({ model, validate, resetFields })')
  }

  lines.push('</script>')

  const code = lines.join('\n')
  const summary = [
    `Generated standalone <es-form> block (target=${target}):`,
    `- ${fields.length} field(s), span context=${context}, buttons=${buttons}`,
    hasLayout
      ? `- Form layout: ${FORM_LAYOUT_KEYS.filter((k) => layout[k] !== undefined).map((k) => `${k}=${String(layout[k])}`).join(', ') || '(isBtnHidden only)'}`
      : '',
    ts ? '- TypeScript enabled' : '',
    '- Runtime: emits submit/query/reset; exposes validate/resetFields/model.',
    isVue2
      ? '- Target: Vue 2 + Element UI (@es-plus/vue2)'
      : target === 'antdv'
        ? '- Target: Vue 3 + Ant Design Vue (@es-plus/adapter-antdv)'
        : '- Target: Vue 3 + Element Plus (@es-plus/vue3)',
    '- Self-contained component — drop next to native/third-party components.',
  ].filter(Boolean).join('\n')

  return { code, summary, warnings }
}

export interface TableRowButton {
  name: string
  type?: string
  key?: string
}

/**
 * 独立 `<es-table>` 的**容器级**选项（Wave 4）。
 *
 * 与权威 AI 侧 `tableOptions`（`structured-config.schema.ts` 的
 * `StructuredCrudConfigSchema` 里那一块）**逐键相同** —— 它本身已经是 core
 * `TableOptions` 里「可声明式、JSON 可承载」的子集。此前片段路径只收 5 个布尔，
 * 文档站 demo 能配的 `size`/`emptyText`/`height`/`defaultSort`/`localPagination` 等
 * 在独立表格里 AI 生成不出来（独立场景的表达力 ≪ 组合页）。
 *
 * 守卫（单一真源，勿另写清单）：
 *   - `scripts/check-entry-contract.mjs`：本接口键集 === 权威 `tableOptions` 键集；
 *   - `scripts/check-fragment-contract.mjs`：本接口 === mcp 侧的镜像
 *     `tableBlockOptionsSchema`，且每个键都出现在发射枚举
 *     （{@link TABLE_BLOCK_ALWAYS} ∪ {@link TABLE_BLOCK_OPTION_ORDER}）里 ——
 *     「声明了、生成器却读不到」就是静默丢弃。
 */
export interface TableBlockOptions {
  border?: boolean
  stripe?: boolean
  rowkey?: string
  heightType?: 'auto' | 'height' | 'maxHeight'
  tabHeight?: number | string
  height?: number | string
  multiSelect?: boolean
  highlightCurrentRow?: boolean
  headerCellStyle?: Record<string, string>
  virtual?: boolean
  engine?: 'default' | 'virtual' | 'vxe'
  rowHeight?: number
  estimatedRowHeight?: number
  overscanCount?: number
  rowClassName?: string
  size?: 'large' | 'default' | 'small'
  showHeader?: boolean
  emptyText?: string
  snIndex?: boolean
  leftText?: string
  cachePageSelection?: boolean
  refetchKeepPage?: boolean
  localPagination?: boolean
  defaultSort?: { prop: string; order: 'ascending' | 'descending' }
  /** 服务端排序契约（与权威 `tableOptions.sortParam` 同义，纯 JSON）。 */
  sortParam?: boolean | { field?: string; order?: string }
  editConfig?: {
    trigger?: 'click' | 'dblclick' | 'manual'
    mode?: 'cell' | 'row'
    showStatus?: boolean
    showUpdateStatus?: boolean
    showInsertStatus?: boolean
    autoClear?: boolean
    enabled?: boolean
  }
  configTableOut?: { total?: string; tableData?: string; pageSize?: string; current?: string }
  /** AN-08：vxe 树表（JSON 子集；函数型 loadMethod 不进 AI 契约）。 */
  treeConfig?: {
    transform?: boolean
    rowField?: string
    parentField?: string
    childrenField?: string
    /** @deprecated vxe v4 别名，运行时归一为 childrenField。 */
    children?: string
    mapChildren?: string
    expandAll?: boolean
    lazy?: boolean
  }
  /** AN-08：vxe 行展开开关（JSON 子集）。 */
  expandConfig?: {
    expandAll?: boolean
    accordion?: boolean
    lazy?: boolean
  }
  // ── vxe 一等公民（JSON 安全子集；仅 engine:'vxe' 生效）──────────────
  showFooter?: boolean
  footerData?: unknown[][]
  exportConfig?: boolean | Record<string, unknown>
  toolbarConfig?: boolean | Record<string, unknown>
  columnConfig?: Record<string, unknown>
  keepSource?: boolean
  keyboardConfig?: {
    isArrow?: boolean
    isTab?: boolean
    isEnter?: boolean
    isEdit?: boolean
    isDel?: boolean
    enterToTab?: boolean
  }
  mouseConfig?: { selected?: boolean }
  validConfig?: {
    autoPos?: boolean
    message?: 'default' | 'tooltip' | 'modal' | 'none'
    msgMode?: 'single' | 'full'
  }
  /** 只收 JSON 可承载的 `startIndex`；`seqMethod` 是函数，走运行时逃生舱。 */
  seqConfig?: { startIndex?: number }
  printConfig?: boolean | Record<string, unknown>
}

/**
 * `tableOptions` 里**无条件发射**的键（有历史默认值，省略时回落）。与
 * {@link TABLE_BLOCK_OPTION_ORDER} 合起来必须恰等于 {@link TableBlockOptions} 的键集
 * —— `check-fragment-contract.mjs` 断这一条。
 */
export const TABLE_BLOCK_ALWAYS = [
  'border',
  'stripe',
  'highlightCurrentRow',
  'rowkey',
] as const

/**
 * `tableOptions` 里**只在给了值时才发射**的键，顺序冻结（产物对入参插入顺序不敏感）。
 * 发射循环直接遍历本数组 —— 因此不存在「接口声明了、循环没枚举」的死键。
 */
export const TABLE_BLOCK_OPTION_ORDER = [
  'heightType',
  'tabHeight',
  'height',
  // 表头底色：给了才发（此前是 ALWAYS 里的写死默认值 —— 内联样式压过宿主主题，
  // 暗色下表头成为唯一亮块）。缺省交给主题 CSS。
  'headerCellStyle',
  'virtual',
  'rowHeight',
  'estimatedRowHeight',
  'overscanCount',
  'rowClassName',
  'engine',
  'multiSelect',
  'configTableOut',
  'editConfig',
  'size',
  'showHeader',
  'emptyText',
  'snIndex',
  'leftText',
  'cachePageSelection',
  'defaultSort',
  // 服务端排序契约：纯 JSON（boolean 或 { field, order }）→ optionLiteral 走 inlineJson。
  'sortParam',
  'refetchKeepPage',
  'localPagination',
  // AN-08：vxe 树表 / 行展开（纯 JSON → optionLiteral 走 inlineJson）。
  'treeConfig',
  'expandConfig',
  // vxe 一等公民（JSON 安全子集）：追加在尾部，冻结既有键的顺序。
  'showFooter',
  'footerData',
  'exportConfig',
  'toolbarConfig',
  'columnConfig',
  'keepSource',
  // vxe 一等公民 · 配置型（AI-31 Batch 2B）：继续追加在尾部。
  'keyboardConfig',
  'mouseConfig',
  'validConfig',
  'seqConfig',
  'printConfig',
] as const

/**
 * 独立表格的 `pagination` 播种键（权威 schema 顶层 `pagination` 的数据子集）。
 * 独立表格此前把 `{ current:1, pageSize:10, total:0 }` 写死 —— `localPagination`
 * 与自定义 pageSize 因此无处可传。
 */
export interface EsTablePagination {
  pageSize?: number
  pageSizes?: number[]
}

/** `pagination` 的发射枚举（与 {@link EsTablePagination} 键集相等，守卫钉住）。 */
export const PAGINATION_KEYS = ['pageSize', 'pageSizes'] as const

export interface TableBlockInput {
  /** 列字段(复用 FieldConfig 词汇)。 */
  fields: SurfaceField[]
  /** 列表数据接口;给了则发 `apiParams.url`(es-table 经全局 httpRequest 自动取数),否则需手动接数据。 */
  apiUrl?: string
  target?: TargetFramework
  typescript?: boolean
  i18n?: boolean
  tableOptions?: TableBlockOptions
  /** 分页播种（pageSize/pageSizes）；`total`/`current` 由组件自管。 */
  pagination?: EsTablePagination
  /**
   * 可选操作列按钮。刻意只发 `triggerEvent: true`(事件上抛)而不内联 click 处理体——
   * 独立表格没有 openForm/handleDelete 的上下文,内联会产生悬空引用导致编译失败。
   * 宿主监听 es-table 的事件自行处理。
   */
  rowButtons?: TableRowButton[]
  /**
   * P10 —— 与 CRUD 同一套表格词汇（此前这些键只存在于 `generate_scene(scene='crud')`，
   * 宿主为了多级表头/树表/展开/合并必须整套换入口）。
   *
   * - `columns`：显式列（override 非 merge，`groups` 多级表头自指）；风险键经
   *   `sanitizeExplicitColumns` 剥除，与整页 schema 路径同一实现。
   * - `treeConfig` / `expandConfig`：**顶层窄子集**（跨端），与 `tableOptions.*`
   *   的 vxe 富子集是不同层；树表按 `resolveTreeOptions` 合并（顶层覆盖）。
   * - `mergeConfig`：相邻行合并（`rowsBy`）。
   * - `rowkey`：顶层主键（与 `tableOptions.rowkey` 冲突时取顶层并告警，同 CRUD）。
   */
  columns?: StructuredCrudConfigInput['columns']
  treeConfig?: StructuredCrudConfigInput['treeConfig']
  expandConfig?: StructuredCrudConfigInput['expandConfig']
  mergeConfig?: StructuredCrudConfigInput['mergeConfig']
  rowkey?: string
}

/**
 * 独立表格的完整配置（= `generate_table` 的入参；Wave 4 起容器级词汇复用
 * `TableOptions` 的 JSON 数据子集，见 {@link TableBlockOptions}）。
 * 命名与 `EsFormConfig` / `EsDialogConfig` 同族，便于宿主一次性理解三个独立场景。
 */
export type EsTableConfig = TableBlockInput

/**
 * 表格选项值 → 源码字面量。
 * 字符串走 `q()`（转义 `'`/换行/`</`）、数字/布尔直出、对象/数组走 `inlineJson`
 * （`configTableOut`/`editConfig`/`defaultSort` 都是纯 JSON 数据）。
 */
function optionLiteral(v: unknown): string {
  if (typeof v === 'string') return q(v)
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return inlineJson(v)
}

/**
 * 独立 `<es-table>` 组件。自包含:columns(复用 buildTableColumnSFC)、options、
 * data-source / pagination 的 ref。给 `apiUrl` 时经 es-table 的 `apiParams` 自动取数。
 */
export function generateTableBlock(input: TableBlockInput): FragmentResult {
  const target = resolveTarget(input.target)
  const isVue2 = target === 'vue2'
  const ts = input.typescript ?? true
  const i18n = input.i18n ?? false
  const fields = input.fields
  const t: TableBlockOptions = input.tableOptions ?? {}
  const warnings: string[] = []

  // P10：与 CRUD 同一套显式列 / 树表 / 展开 / 合并词汇。
  const explicitColumns = Array.isArray(input.columns)
    ? sanitizeExplicitColumns(input.columns as Array<Record<string, unknown>>)
    : []
  // 片段入口没有 `generateFromConfig` 那份 `collectUnknownKeys`（Zod 形状在 mcp 包），
  // 但列契约来自 shared 的同一份 schema —— 拼错的列键必须同样可见，不能静默剥掉。
  const stripped = Array.isArray(input.columns)
    ? strippedColumnKeys(input.columns as Array<Record<string, unknown>>)
    : []
  if (stripped.length) {
    warnings.push(
      `以下显式列键不在列契约里，生成时会被忽略（产物中不存在这些键）：${stripped.join('、')}。拼写错误请改正；确属自定义元数据请使用 \`x-\` 前缀。`,
    )
  }
  const hasExplicitExpandColumn = explicitColumns.some((c) => c.type === 'expand')
  if (input.rowkey !== undefined && t.rowkey !== undefined && input.rowkey !== t.rowkey) {
    warnings.push(
      `rowkey 冲突：tableOptions.rowkey="${t.rowkey}" vs 顶层 rowkey="${input.rowkey}" —— 取顶层（与 CRUD 页同一口径）。`,
    )
  }
  const rowkey = input.rowkey ?? t.rowkey ?? 'id'

  if (!input.apiUrl) {
    warnings.push('未提供 apiUrl —— 生成的表格不会自动取数,请为 tableData 手动接入数据源(或改用 compose/CRUD 页)。')
  }

  // 与 schema / SFC 两条整页路径同一条核对（AI-09 子项④ / AN-11④）：editConfig 只在
  // vxe 引擎生效，且 vxe 只让带 `editRender` 的列可编辑。片段路径此前只复制了前半句，
  // 「vxe 引擎 + 没有 editRender 列」在片段里仍是静默死路。文案由单源 helper 提供。
  warnings.push(
    ...inlineEditWarnings({
      tableOptions: t,
      columns: input.columns,
    } as unknown as StructuredCrudConfig),
  )
  // 声明式展开内容在 vxe / 虚拟引擎上不会渲染（与整页 `applyExpandConfig` 同一判据）。
  if (input.expandConfig) {
    const expandWarning = expandConfigEngineWarning(t.engine, t.virtual, target)
    if (expandWarning) warnings.push(expandWarning)
  }

  const lines: string[] = []

  lines.push('<template>')
  lines.push('  <es-table')
  lines.push('    ref="tableRef"')
  lines.push('    :columns="columns"')
  lines.push('    :options="options"')
  if (isVue2) {
    // F7：vue2 es-table **从不 `emit('update:dataSource')`**（组件注释自述已移除），
    // 故这里只能发**单向** `:data-source` —— `.sync` 会承诺一个永不触发的子→父方向。
    // pagination 是例外：vue2 仍 emit `update:pagination`，`.sync` 成立。
    lines.push('    :data-source="tableData"')
    lines.push('    :pagination.sync="pagination"')
  } else {
    lines.push('    v-model:data-source="tableData"')
    lines.push('    v-model:pagination="pagination"')
  }
  lines.push('  />')
  lines.push('</template>')
  lines.push('')

  const scriptLang = ts ? 'ts' : ''
  if (isVue2) {
    lines.push(scriptLang ? `<script lang="${scriptLang}">` : '<script>')
  } else {
    lines.push(scriptLang ? `<script setup lang="${scriptLang}">` : '<script setup>')
  }
  lines.push(`import { ${isVue2 ? 'defineComponent, ref' : 'ref'} } from 'vue'`)
  lines.push('')

  const hasRowButtons = !!(input.rowButtons && input.rowButtons.length)

  if (isVue2) {
    lines.push('export default defineComponent({')
    if (hasRowButtons) {
      // 行操作按钮的语义事件由包装层派发（底层 es-table 只认 clickEvent(row)）。
      lines.push("  emits: ['row-action'],")
      lines.push('  setup(props, ctx) {')
      lines.push('    const emit = ctx.emit')
    } else {
      lines.push('  setup() {')
    }
  } else if (hasRowButtons) {
    lines.push("const emit = defineEmits(['row-action'])")
  }

  // columns —— 复用 buildTableColumnSFC（只读 config.i18n 与 tableOptions.defaultSort）
  // AN-10：片段路径同样要把 defaultSort 传进去，否则「默认按 X 倒序」的片段里目标列
  // 没有 sortable，el-table / a-table 都不会显示默认排序状态（只有 vxe 会静默按 field 排）。
  const cfgLike = {
    i18n,
    tableOptions: { defaultSort: t.defaultSort },
  } as unknown as StructuredCrudConfig
  lines.push('const columns = [')
  // AI-09 子项②（P10 对齐）：顶层 `expandConfig` 落到展开列。显式列里已有
  // `type:'expand'` 时不重复前置（与整页 SFC 路径同一判据）。
  if (input.expandConfig && !hasExplicitExpandColumn) {
    pushSfcColumn({ type: 'expand', expandConfig: input.expandConfig }, lines, '  ', warnings)
  }
  if (explicitColumns.length > 0) {
    // 显式列 override 非 merge：数据列的顺序/构成完全由 columns 决定（与 schema 路径一致）。
    for (const c of explicitColumns) {
      const col = input.expandConfig && c.type === 'expand' ? { ...c, expandConfig: input.expandConfig } : c
      pushSfcColumn(col, lines, '  ', warnings)
    }
  } else {
    for (const f of fields) {
      lines.push(`  ${buildTableColumnSFC(f as unknown as FieldConfig, cfgLike, warnings)},`)
    }
  }
  if (input.rowButtons && input.rowButtons.length) {
    const w = input.rowButtons.length * 80 + 20
    lines.push('  {')
    lines.push(`    prop: '${OPERATION_COLUMN_PROP_SFC}',`)
    lines.push(`    label: '操作',`)
    lines.push(`    width: ${w},`)
    lines.push(`    fixed: 'right',`)
    lines.push('    btns: [')
    for (const b of input.rowButtons) {
      const parts = [`name: ${q(b.name)}`]
      if (b.type) parts.push(`type: ${q(b.type)}`)
      if (b.key) parts.push(`key: ${q(b.key)}`)
      // P4：`triggerEvent` 在 es-table 里没有任何消费者（行按钮走 `clickEvent(row)`），
      // 旧产物因此是死按钮。这里直接内联 clickEvent，把动作翻译成语义事件。
      const actionKey = b.key ?? b.name
      parts.push(`clickEvent: (row) => emit('row-action', { key: ${q(actionKey)}, row })`)
      lines.push(`      { ${parts.join(', ')} },`)
    }
    lines.push('    ]')
    lines.push('  },')
  }
  lines.push(']')
  lines.push('')

  // options —— 与 schema 模式同一套键（Wave 4）：`TABLE_BLOCK_ALWAYS` 有默认值、
  // `TABLE_BLOCK_OPTION_ORDER` 逐键「给了才发」。循环直接遍历冻结数组，
  // 因此接口里不可能存在「声明了却永不发射」的键（守卫在 check-fragment-contract）。
  lines.push('const options = {')
  lines.push(`  border: ${t.border !== false},`)
  lines.push(`  stripe: ${t.stripe !== false},`)
  lines.push(`  highlightCurrentRow: ${t.highlightCurrentRow !== false},`)
  // F3 补证：此前这里写死 `#f5f7fa`，用户值无处可传 —— 片段与 SFC 同病、系统性静默丢弃。
  // 现在只在用户给了时才发（见 TABLE_BLOCK_OPTION_ORDER）；缺省底色交给主题 CSS，
  // 不再往产物里塞一个会压过宿主主题的内联值。
  if (input.apiUrl) lines.push(`  apiParams: { url: ${q(input.apiUrl)} },`)
  lines.push(`  rowkey: ${q(rowkey)},`)
  // P10：顶层 treeConfig（跨端窄子集）与 tableOptions.treeConfig（vxe 富子集）
  // 合并到同一个家 —— 直接复用整页的 `resolveTreeOptions`，顶层覆盖同名字键。
  const treeOptions = input.treeConfig ? resolveTreeOptions(t, { treeConfig: input.treeConfig }) : t.treeConfig
  for (const k of TABLE_BLOCK_OPTION_ORDER) {
    const v = k === 'treeConfig' ? treeOptions : t[k]
    // `false` 是这些键的有效取值（showHeader:false / cachePageSelection:false …），
    // 故判据是 `!== undefined` 而不是真值 —— 与 schema 模式的 AI-22 注释同口径。
    if (v === undefined) continue
    lines.push(`  ${k}: ${optionLiteral(v)},`)
  }
  // 顶层 mergeConfig（AI-23）→ 运行时唯一家 options.mergeConfig（与整页 schema 路径同形）。
  if (input.mergeConfig && Array.isArray(input.mergeConfig.rowsBy) && input.mergeConfig.rowsBy.length > 0) {
    lines.push(`  mergeConfig: ${inlineJson({ rowsBy: [...input.mergeConfig.rowsBy] })},`)
  }
  lines.push('}')
  lines.push('')

  lines.push('const tableData = ref([])')
  // 包装层把 es-table 的命令式刷新面透出（P4 运行时契约：expose refresh/reload）。
  lines.push(`const tableRef = ref${ts ? '<any>' : ''}(null)`)
  const pag = input.pagination ?? {}
  const pagParts: string[] = ['current: 1']
  // 权威 schema 的 `pagination.pageSize` 缺省 10 —— 片段此前把 `pageSize: 10` 写死，
  // 现在仍以它为缺省（未给 pagination 时产物逐字节不变），只让调用方有机会覆盖。
  const pagDefaults: Record<string, unknown> = { pageSize: 10 }
  for (const k of PAGINATION_KEYS) {
    const v = pag[k] !== undefined ? pag[k] : pagDefaults[k]
    if (v !== undefined) pagParts.push(`${k}: ${optionLiteral(v)}`)
  }
  pagParts.push('total: 0')
  lines.push(`const pagination = ref({ ${pagParts.join(', ')} })`)

  lines.push('')
  lines.push('const refresh = (model) => tableRef.value?.refresh?.(model)')
  lines.push('const reload = (model) => tableRef.value?.reload?.(model)')

  if (isVue2) {
    lines.push('')
    lines.push('    return { columns, options, tableData, tableRef, pagination, refresh, reload }')
    lines.push('  }')
    lines.push('})')
  } else {
    lines.push('')
    lines.push('defineExpose({ refresh, reload })')
  }

  lines.push('</script>')

  const code = lines.join('\n')
  const summary = [
    `Generated standalone <es-table> block (target=${target}):`,
    `- ${fields.length} column(s)${input.rowButtons?.length ? `, ${input.rowButtons.length} row button(s)` : ''}`,
    input.apiUrl ? `- Auto-fetch via apiParams: ${input.apiUrl}` : '- No apiUrl — wire tableData manually',
    ts ? '- TypeScript enabled' : '',
    '- Runtime: exposes refresh/reload; row buttons emit row-action.',
    isVue2
      ? '- Target: Vue 2 + Element UI (@es-plus/vue2)'
      : target === 'antdv'
        ? '- Target: Vue 3 + Ant Design Vue (@es-plus/adapter-antdv)'
        : '- Target: Vue 3 + Element Plus (@es-plus/vue3)',
    '- Self-contained component — drop next to native/third-party components.',
  ].filter(Boolean).join('\n')

  return { code, summary, warnings }
}

/** 独立弹窗的产物形态（AI-28）：编程式 composable ｜ 声明式 SFC。 */
export type DialogBlockMode = 'composable' | 'component'

/**
 * 弹窗底座选项（AI-28）—— core `DialogOptions` 里**可声明式表达**的那一子集。
 *
 * 为什么是这一组、而不是 `DialogOptions` 全量：这个结构是**入参**，它同时被两个
 * 消费者读 —— 声明式那一支（SFC 的 `<es-dialog>` 属性）与编程式那一支
 * （`dialog({...})` 的键）。所以只收**两支都真消费**的键：
 *   - 刻意**不含** `title`：它是 `open(title, …)` 的入参，收进来就有两个真源；
 *   - 刻意**不含**函数值键（`render`/`renderHeader`/`renderFooter`/`configBtn`/
 *     `onClosed`/`beforeClose`）：骨架自己装配这些，且函数不能走 JSON；
 *   - 刻意**不含**端特化键（`alignCenter`/`top`/`modalClass`/`loading`）：
 *     `scripts/check-type-exports.mjs` 已把 `DialogOptions` 的跨端成员差登记在案
 *     （vue2 的 Element UI 无 `alignCenter`、antdv 无 `loading`），
 *     收进来 = 承诺一个三端不等价的能力。
 *
 * `appendTo` 只收选择器**字符串**：DOM 元素不可能出现在 JSON 里（与 AI-27 的
 * `.dialogs[k].appendTo` 同口径，运行时用 querySelector 解析）。
 * - `mode:'composable'`：三端 `useDialog()` 都用它决定容器挂载点；
 * - `mode:'component'`：vue3 转发给 el-dialog 的 `appendTo`（Element Plus 2.14+）、
 *   antdv 转发给 a-modal 的 `getContainer`；**vue2 的 Element UI 2.x 只有布尔
 *   `append-to-body`**，故非 `'body'` 的选择器在那里退化为挂到 body 并**显式告警**
 *   （不静默假装支持）。
 *
 * `cacheKey` 只在 `mode:'composable'` 下有效 —— 它是 `useDialog()` hook 的
 * **实例缓存**键（三端均在各自 hook 里实装），声明式
 * `<es-dialog>` 不经那条通道。component 模式下传入会**显式告警并忽略**，不静默发出去。
 */
export interface DialogBlockOptions {
  width?: string | number
  maxHeight?: string | number
  isDraggable?: boolean
  fullscreen?: boolean
  isHiddenFooter?: boolean
  showClose?: boolean
  destroyOnClose?: boolean
  modal?: boolean
  closeOnClickModal?: boolean
  closeOnPressEscape?: boolean
  hiddenFullBtn?: boolean
  appendTo?: string
  cacheKey?: string
}

/**
 * 选项发射顺序（**冻结**）：产物对调用方传参的插入顺序不敏感，同选项必得同产物。
 * `width` 不在此列 —— 它有一个历史默认值 `'560px'`，单独发射（见两支的实现）。
 */
const DIALOG_OPTION_ORDER = [
  'maxHeight',
  'isDraggable',
  'fullscreen',
  'isHiddenFooter',
  'showClose',
  'destroyOnClose',
  'modal',
  'closeOnClickModal',
  'closeOnPressEscape',
  'hiddenFullBtn',
  'appendTo',
  'cacheKey',
] as const

/** 选项值 → 源码字面量。字符串走 `q()`（转义 `'`/换行/`</`），布尔与数字原样。 */
function optLiteral(v: unknown): string {
  return typeof v === 'string' ? q(v) : String(v)
}

/** camelCase 选项名 → SFC 模板里的 kebab-case 属性名（house 风格，同 `:form-item-list`）。 */
function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())
}

/**
 * 选项 → `<es-dialog>` 的属性行。
 *
 * 为什么字符串走**静态属性**、布尔/数字走**绑定**：`width="720"` 是字符串 "720"，
 * 对 el-dialog 的 `width` 来说不是合法 CSS 长度（数字必须绑成表达式才是 720px
 * 那条分支）；反过来 `max-height="70vh"` 静态属性最省事也最可读。
 */
function dialogAttr(name: string, value: unknown): string {
  return typeof value === 'string'
    ? `    ${name}="${qAttr(value)}"`
    : `    :${name}="${String(value)}"`
}

export interface DialogBlockInput {
  /** 弹窗内表单字段。 */
  fields: SurfaceField[]
  /** 提交接口;给了则「确定」按钮按标题 POST(新增)/ PUT(其它)提交,否则仅校验+回调。 */
  apiUrl?: string
  /** 编辑态 PUT 的主键(拼 `${apiUrl}/${formData[rowkey]}`),默认 'id'。 */
  rowkey?: string
  target?: TargetFramework
  typescript?: boolean
  i18n?: boolean
  /** 导出的 composable 名,默认 'useFormDialog'。 */
  composableName?: string
  /**
   * 产物形态（AI-28）。缺省 `'composable'` —— 与 AI-28 之前**逐字节一致**（零回归）。
   *  - `'composable'`：`useXxxDialog()` composable（`.tsx`/`.jsx` 模块），弹窗体是 JSX render；
   *  - `'component'`：自包含 `<es-dialog>` SFC（模板 + `<script setup>`，vue2 走
   *    `defineComponent` + `setup()`），**不需要 JSX 插件**，`open(title, row?, onSuccess?)`
   *    经 `defineExpose`（vue2：setup 的 return）暴露给宿主。
   */
  mode?: DialogBlockMode
  /** 弹窗底座选项（core `DialogOptions` 的声明式子集，见 {@link DialogBlockOptions}）。 */
  options?: DialogBlockOptions
  /**
   * `open()` 的缺省标题（AI-36）。**不改变集成契约**：`open(title, ...)` 的首参仍是唯一真源，
   * 调用方传了就以传入值为准；这里只给「不传 title」的场景一个确定性默认值。
   *
   * 存在的理由：前门的 `surfaces.dialog[].title` 是**声明式**标题，而 composable/SFC 支的
   * `open(title)` 是**命令式**入参 —— 没有这条通道时，前门拿到的 title 只能写进说明文字，
   * 产物里无处落地（静默丢弃）。table-bearing 支的 `CrudDialogConfig.title` 也是这个语义。
   */
  defaultTitle?: string
}

/**
 * 独立弹窗的完整配置（= `generate_dialog` 的入参；容器级词汇复用
 * `DialogBlockOptions` —— core `DialogOptions` 的声明式数据子集，AI-28 已落地）。
 */
export type EsDialogConfig = DialogBlockInput

/**
 * 独立弹窗。两种产物形态（AI-28，`input.mode`）：
 *  - `'composable'`（默认）：一个 `useXxxDialog()` composable（**.tsx/.jsx 模块**，非 SFC）。
 *    弹窗体是一个 EsForm（JSX render），复用 buildFormItem/getDefaultValue。
 *  - `'component'`：一个自包含 `<es-dialog>` **SFC**（见 {@link generateDialogComponent}），
 *    不需要 JSX 插件。
 *
 * 两支的集成契约**同形**：`open(title, row?, onSuccess?)` —— 提交成功后回调 `onSuccess`，
 * 独立弹窗没有自己的表格可刷新，由宿主在 onSuccess 里刷新它自己的 es-table。
 * 这正是"弹窗 + 独立表格/原生组件"混排时的确定性接法，不靠 LLM 临场发挥。
 */
export function generateDialogBlock(input: DialogBlockInput): FragmentResult {
  const target = resolveTarget(input.target)
  const isVue2 = target === 'vue2'
  const ts = input.typescript ?? true
  const i18n = input.i18n ?? false
  const fields = input.fields
  const rowkey = input.rowkey || 'id'
  const name = input.composableName || 'useFormDialog'
  const esPlusPkg = getEsPlusPackageName(target)
  const warnings: string[] = []
  const opts = input.options ?? {}

  // 两端共用的一条核对提醒（内联 render 的 Tag 语义按 Element 产出）。
  if (target === 'antdv' && fields.some((f) => f.render)) {
    warnings.push('target=antdv: 内联 render() 按 Element 语义(Tag type=)产出,Ant Design Vue 的 Tag 用 color —— 请核对。')
  }

  // ── 声明式形态（AI-28）：自包含 <es-dialog> SFC ──────────────────────────
  if (input.mode === 'component') {
    return generateDialogComponent({ target, isVue2, ts, i18n, fields, rowkey, esPlusPkg, opts, apiUrl: input.apiUrl, defaultTitle: input.defaultTitle, warnings })
  }

  // ── 编程式形态：useXxxDialog() composable ─────────────────────────────────
  // JSX render 的编译前提(与 generateFromConfig 的 SFC 弹窗同口径)
  if (isVue2) {
    warnings.push('target=vue2: 弹窗用 JSX render —— 需项目启用 @vue/babel-preset-jsx(或 @vitejs/plugin-vue2-jsx)。')
  } else {
    warnings.push(`target=${target}: 弹窗用 JSX render —— 模块以 ${ts ? '.tsx' : '.jsx'} 产出,需安装并注册 @vitejs/plugin-vue-jsx。`)
  }

  const lines: string[] = []

  // Imports
  lines.push(`import { reactive } from 'vue'`)
  const esPlusNamed = ['useDialog', 'EsForm']
  if (input.apiUrl) esPlusNamed.push('httpRequest')
  lines.push(`import { ${esPlusNamed.join(', ')} } from '${esPlusPkg}'`)
  lines.push('')

  // Composable
  lines.push(`export function ${name}() {`)
  lines.push('  const dialog = useDialog()')
  lines.push('')
  // defaultTitle 只改首参的缺省值，不改签名形状（AI-36）。
  const titleDefault = input.defaultTitle !== undefined ? ` = ${q(input.defaultTitle)}` : ''
  const openSig = ts
    ? `  function open(title: string${titleDefault}, row: any = {}, onSuccess?: (data: any) => void) {`
    : `  function open(title${titleDefault}, row = {}, onSuccess) {`
  lines.push(openSig)

  const defaults = fields.map((f) => `${qKey(f.prop)}: ${getDefaultValue(f as unknown as FieldConfig)}`).join(', ')
  const formInit = [defaults, '...row'].filter(Boolean).join(', ')
  lines.push(`    const formData = reactive({ ${formInit} })`)
  lines.push(`    const isView = title === ${q(DIALOG_TITLES.view)}`)
  lines.push('')

  const formItemsJson = inlineJson(fields.map((f) => buildFormItem(f as unknown as FieldConfig, 'form', i18n)), 4)
  lines.push(`    const formItems = ${formItemsJson}`)
  lines.push('')

  lines.push('    dialog({')
  lines.push('      title,')
  // width 有历史默认值 '560px'（未给 options 时逐字节不变）；其余键只在给了才发。
  lines.push(`      width: ${opts.width === undefined ? `'560px'` : optLiteral(opts.width)},`)
  for (const k of DIALOG_OPTION_ORDER) {
    const v = opts[k as keyof DialogBlockOptions]
    if (v !== undefined) lines.push(`      ${k}: ${optLiteral(v)},`)
  }
  lines.push('      render: (h, { registerRef }) => (')
  lines.push('        <EsForm')
  lines.push(`          ref={el => el && registerRef('form', el)}`)
  lines.push('          model={formData}')
  lines.push('          formItemList={formItems}')
  lines.push(`          layoutFormProps={{ formLayProps: { labelWidth: '100px', isBtnHidden: true } }}`)
  lines.push('        />')
  lines.push('      ),')
  lines.push('      configBtn: isView ? [')
  lines.push(`        { name: '关闭', click: (_, { close }) => close() }`)
  lines.push('      ] : [')
  lines.push(`        { name: '取消', click: (_, { close }) => close() },`)
  lines.push(`        { name: '确定', type: 'primary', click: async (_, { close, getRefs }) => {`)
  lines.push(`          try {`)
  lines.push(`            await getRefs('form')?.validate()`)
  lines.push(`          } catch {`)
  lines.push(`            return // 校验未通过:静默中止,等用户修正`)
  lines.push(`          }`)
  if (input.apiUrl) {
    lines.push(`          const method = title === ${q(DIALOG_TITLES.add)} ? 'POST' : 'PUT'`)
    lines.push(`          const url = title === ${q(DIALOG_TITLES.add)} ? ${q(input.apiUrl)} : \`${qBt(input.apiUrl)}/\${formData${qMember(rowkey)}}\``)
    lines.push(`          await httpRequest({ url, method, data: formData })`)
  }
  lines.push(`          close()`)
  lines.push(`          onSuccess?.(formData)`)
  lines.push(`        } }`)
  lines.push('      ]')
  lines.push('    })')
  lines.push('  }')
  lines.push('')
  lines.push('  return { open }')
  lines.push('}')

  const code = lines.join('\n')
  const summary = [
    `Generated standalone dialog composable ${name}() (target=${target}):`,
    `- ${fields.length} form field(s)`,
    input.defaultTitle !== undefined ? `- Default title: ${input.defaultTitle} (used when open() is called without one)` : null,
    input.apiUrl ? `- Submit via httpRequest: ${input.apiUrl} (POST on 新增, PUT otherwise)` : '- No apiUrl — validate + onSuccess(formData) only',
    `- Integration: open(title, row?, onSuccess?) — host refreshes its own table in onSuccess`,
    ts ? `- Emit as .tsx (JSX render)` : '- Emit as .jsx (JSX render)',
    isVue2
      ? '- Target: Vue 2 + Element UI (@es-plus/vue2)'
      : target === 'antdv'
        ? '- Target: Vue 3 + Ant Design Vue (@es-plus/adapter-antdv)'
        : '- Target: Vue 3 + Element Plus (@es-plus/vue3)',
  ].filter(Boolean).join('\n')

  return { code, summary, warnings, fence: 'tsx' }
}

/**
 * 声明式形态（AI-28）—— 自包含 `<es-dialog>` **SFC**。
 *
 * 为什么要有这一支：`generate_dialog` 此前只发 composable，而 composable 的弹窗体是
 * **JSX render**（模块必须是 `.tsx`/`.jsx`，宿主得装 `@vitejs/plugin-vue-jsx` 或
 * `@vue/babel-preset-jsx`）。对「只想在模板里摆一个弹窗」的宿主，这道编译前提是纯成本，
 * 且与它既有的 Options API / 模板写法不搭。声明式形态把同一份骨架换成模板 + `<es-dialog>`，
 * **零 JSX 依赖**，集成契约仍是 `open(title, row?, onSuccess?)`。
 *
 * 与 composable 支的**逐条对齐**（避免两种形态行为漂移）：
 *  - 弹窗体同样是 EsForm（`buildFormItem` 同一套原子构造器）；
 *  - 每次 `open` 都把表单重置回默认值再叠 `row`（composable 支靠 `reactive({...defaults, ...row})`
 *    重建，这里靠 `Object.assign(formData, DEFAULTS, row)` 等价达成）；
 *  - 「查看」标题 ⇒ 只出一个「关闭」按钮（沿用 `title === '查看'` 的既有启发式）；
 *  - 校验失败静默中止、成功后 `close()` + `onSuccess(formData)`；
 *  - `apiUrl` 给了才发 `httpRequest`（新增 POST / 否则 PUT）。
 *
 * 边界（house doctrine，与字段级 render 占位同族）：**不生成业务编排**。
 * 提交之外的业务逻辑是宿主的事，骨架里以 `TODO(es-plus)` 槽显式标出；要「按 actionType
 * 外抛事件」的正确路径是 CRUD 页的 `dialogs[k]` + `toolbarBtns`（7749620 先例），
 * 不是往这个片段里塞逻辑。
 */
function generateDialogComponent(p: {
  target: TargetFramework
  isVue2: boolean
  ts: boolean
  i18n: boolean
  fields: SurfaceField[]
  rowkey: string
  esPlusPkg: string
  opts: DialogBlockOptions
  apiUrl?: string
  defaultTitle?: string
  warnings: string[]
}): FragmentResult {
  const { target, isVue2, ts, i18n, fields, rowkey, esPlusPkg, opts, apiUrl, defaultTitle, warnings } = p

  // ── 选项落地：模板属性 ────────────────────────────────────────────────
  // cacheKey 是 useDialog() hook 的实例缓存键，声明式 <es-dialog> 不经那条通道
  // （三端的实现在各自 hook 里）→ 显式告警 + 不发射，
  // 绝不静默写成一个 el-dialog 认不得的脏属性。
  if (opts.cacheKey !== undefined) {
    warnings.push(
      "options.cacheKey 在 mode='component' 下没有消费者 —— 它是 useDialog() hook 的实例缓存键" +
        '（三端均在 hook 内实现），声明式 <es-dialog> 走不到那条通道，故已忽略。' +
        "需要状态跨次打开保留时用 mode='composable'。"
    )
  }
  // vue2 的 Element UI 2.x el-dialog 只有布尔 append-to-body，没有选择器级挂载点。
  // 组件端会退化为挂到 body 并发运行时告警；这里在**生成时**再点一次名，
  // 让能力缺口在产物落盘前就可见（同 cacheKey 的口径：降级可以，静默不行）。
  if (target === 'vue2' && opts.appendTo !== undefined && opts.appendTo !== 'body') {
    warnings.push(
      `options.appendTo='${opts.appendTo}' 在 vue2（Element UI 2.x）的声明式 <es-dialog> 上不可精确落地 —— ` +
        'el-dialog 只支持布尔 append-to-body，产物会退化为挂到 body。' +
        "需要精确挂载容器请用 mode='composable'（useDialog 的 appendTo 三端都支持），或改用 vue3 / antdv。"
    )
  }
  warnings.push(
    'mode=component：产物是自包含 <es-dialog> SFC（无需 JSX 插件）。前提是宿主已全局装配 es-plus' +
      '（app.use(EsPlus)），否则模板里的 <es-dialog>/<es-form> 标签解析不到。'
  )

  const lines: string[] = []

  // ── template ──
  lines.push('<template>')
  lines.push('  <es-dialog')
  lines.push(isVue2 ? '    :visible.sync="visible"' : '    v-model:visible="visible"')
  lines.push('    :title="title"')
  lines.push(dialogAttr('width', opts.width === undefined ? '560px' : opts.width))
  for (const k of DIALOG_OPTION_ORDER) {
    if (k === 'cacheKey') continue // 已告警并忽略，见上
    const v = opts[k as keyof DialogBlockOptions]
    if (v !== undefined) lines.push(dialogAttr(kebab(k), v))
  }
  lines.push('    :config-btn="configBtn"')
  lines.push('  >')
  lines.push('    <es-form')
  lines.push('      ref="formRef"')
  lines.push('      :model="formData"')
  lines.push('      :form-item-list="formItems"')
  lines.push(`      :layout-form-props="{ formLayProps: { labelWidth: '100px', isBtnHidden: true } }"`)
  lines.push('    />')
  lines.push('  </es-dialog>')
  lines.push('</template>')
  lines.push('')

  // ── script 头：vue3/antdv 用 <script setup>，vue2 用 defineComponent + setup() ──
  const scriptLang = ts ? 'ts' : ''
  if (isVue2) {
    lines.push(scriptLang ? `<script lang="${scriptLang}">` : '<script>')
  } else {
    lines.push(scriptLang ? `<script setup lang="${scriptLang}">` : '<script setup>')
  }

  const vueImports = isVue2 ? ['defineComponent', 'computed', 'reactive', 'ref'] : ['computed', 'reactive', 'ref']
  lines.push(`import { ${vueImports.join(', ')} } from 'vue'`)
  const esPlusNamed: string[] = []
  if (apiUrl) esPlusNamed.push('httpRequest')
  if (esPlusNamed.length) lines.push(`import { ${esPlusNamed.join(', ')} } from '${esPlusPkg}'`)
  lines.push('')

  if (isVue2) {
    lines.push('export default defineComponent({')
    lines.push('  setup() {')
  }

  // TS 接口（复用 inferTsType，与 generateFormBlock 同一口径）+ 默认值对象
  if (ts && fields.length > 0) {
    lines.push('interface DialogModel {')
    for (const f of fields) {
      lines.push(`  ${qKey(f.prop)}: ${inferTsType(f as unknown as FieldConfig)}`)
    }
    lines.push('}')
    lines.push('')
  }
  const defaults = fields.map((f) => `${qKey(f.prop)}: ${getDefaultValue(f as unknown as FieldConfig)}`).join(', ')
  lines.push(`const DEFAULTS${ts ? ': DialogModel' : ''} = { ${defaults} }`)
  lines.push(`const formData = reactive${ts ? '<DialogModel>' : ''}({ ...DEFAULTS })`)
  lines.push('const visible = ref(false)')
  lines.push(`const title = ref('')`)
  lines.push(`const formRef = ref${ts ? '<{ validate: () => Promise<unknown> } | null>' : ''}(null)`)
  lines.push(ts ? `let successHandler: ((data: DialogModel) => void) | undefined` : 'let successHandler')
  lines.push('')

  const formItemsJson = inlineJson(fields.map((f) => buildFormItem(f as unknown as FieldConfig, 'form', i18n)), 2)
  lines.push(`const formItems = ${formItemsJson}`)
  lines.push('')

  // 集成契约 —— 与 composable 支同形（含「每次 open 重置为默认值再叠 row」）
  const titleDefault = defaultTitle !== undefined ? ` = ${q(defaultTitle)}` : ''
  const openSig = ts
    ? `function open(t: string${titleDefault}, row: Partial<DialogModel> = {}, onSuccess?: (data: DialogModel) => void) {`
    : `function open(t${titleDefault}, row = {}, onSuccess) {`
  lines.push(openSig)
  lines.push('  title.value = t')
  lines.push('  Object.assign(formData, DEFAULTS, row)')
  lines.push('  successHandler = onSuccess')
  lines.push('  visible.value = true')
  lines.push('}')
  lines.push('')
  lines.push('function close() {')
  lines.push('  visible.value = false')
  lines.push('}')
  lines.push('')
  lines.push('async function handleConfirm() {')
  lines.push('  try {')
  lines.push('    await formRef.value?.validate()')
  lines.push('  } catch {')
  lines.push('    return // 校验未通过:静默中止,等用户修正')
  lines.push('  }')
  lines.push('  // TODO(es-plus): 宿主编排槽 —— 提交前后的额外业务逻辑写在这里')
  if (apiUrl) {
    lines.push(`  const method = title.value === ${q(DIALOG_TITLES.add)} ? 'POST' : 'PUT'`)
    lines.push(`  const url = title.value === ${q(DIALOG_TITLES.add)} ? ${q(apiUrl)} : \`${qBt(apiUrl)}/\${formData${qMember(rowkey)}}\``)
    lines.push(`  await httpRequest({ url, method, data: formData })`)
  }
  lines.push('  close()')
  lines.push('  successHandler?.(formData)')
  lines.push('}')
  lines.push('')
  lines.push(`const isView = computed(() => title.value === ${q(DIALOG_TITLES.view)})`)
  lines.push('const configBtn = computed(() => isView.value')
  lines.push('  ? [')
  lines.push(`    { name: '关闭', click: () => close() }`)
  lines.push('  ]')
  lines.push('  : [')
  lines.push(`    { name: '取消', click: () => close() },`)
  lines.push(`    { name: '确定', type: 'primary', click: () => handleConfirm() }`)
  lines.push('  ])')

  if (isVue2) {
    lines.push('')
    lines.push('    return { visible, title, formData, formRef, formItems, configBtn, open, close }')
    lines.push('  }')
    lines.push('})')
  } else {
    lines.push('')
    lines.push('defineExpose({ open, close })')
  }

  lines.push('</script>')

  const code = lines.join('\n')
  const summary = [
    `Generated standalone <es-dialog> SFC (target=${target}):`,
    `- ${fields.length} form field(s)`,
    defaultTitle !== undefined ? `- Default title: ${defaultTitle} (used when open() is called without one)` : null,
    apiUrl ? `- Submit via httpRequest: ${apiUrl} (POST on 新增, PUT otherwise)` : '- No apiUrl — validate + onSuccess(formData) only',
    `- Integration: open(title, row?, onSuccess?)${isVue2 ? ' (exposed from setup())' : ' (via defineExpose)'} — host refreshes its own table in onSuccess`,
    '- No JSX plugin required (template + <es-dialog>)',
    ts ? '- TypeScript enabled' : '- Plain JavaScript',
    isVue2
      ? '- Target: Vue 2 + Element UI (@es-plus/vue2)'
      : target === 'antdv'
        ? '- Target: Vue 3 + Ant Design Vue (@es-plus/adapter-antdv)'
        : '- Target: Vue 3 + Element Plus (@es-plus/vue3)',
  ].filter(Boolean).join('\n')

  return { code, summary, warnings, fence: 'vue' }
}

