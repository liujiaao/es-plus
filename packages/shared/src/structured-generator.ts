import { SPECIAL_BTN_KEYS, OPERATION_COLUMN_PROP_SFC, OPERATION_COLUMN_PROP_CRUD_PAGE, CRUD_PAGE_BTN_CLICK_KEYS } from './contract.js'
import type { StructuredCrudConfig, FieldConfig } from './structured-config.schema.js'
import { StructuredCrudConfigSchema } from './structured-config.schema.js'
import {
  q,
  qBt,
  qAttr,
  qKey,
  qMember,
  numOrStr,
  sanitizeForComment,
  inlineJson,
  BARE_IDENTIFIER,
  assertEmittableExpr,
} from './codegen-escape.js'
import {
  type TargetFramework,
  DEFAULT_TARGET,
  getEsPlusPackageName,
  buildElementImport,
  buildDeleteConfirmBlock,
  buildStatusTagTemplate,
  rewriteElementUsage,
} from './target.js'

export type { StructuredCrudConfig }

/**
 * 从 config 中安全读取 target，兼容旧调用（未传 target 时回落到 'vue3'）
 */
function readTarget(config: StructuredCrudConfig): TargetFramework {
  const t = (config as unknown as { target?: TargetFramework }).target
  return t === 'vue2' || t === 'antdv' ? t : DEFAULT_TARGET
}

interface TableOpts {
  border?: boolean
  stripe?: boolean
  rowkey?: string
  heightType?: string
  tabHeight?: number | string
  height?: number | string
  multiSelect?: boolean
  highlightCurrentRow?: boolean
  headerCellStyle?: Record<string, string>
  virtual?: boolean
  /**
   * 引擎选择（`virtual: true` 的等价写法，也是唯一能选 vxe 的途径）。
   *
   * 此前这个键在 Zod 层就被剥掉了（tableOptions 是普通 z.object，没有 passthrough），
   * 且这里也不在发射白名单里 —— 两道都丢，于是 `engine: 'vxe'` 经 NL→config 走一遍
   * 会静默变成默认引擎。两级一起补上。
   */
  engine?: 'default' | 'virtual' | 'vxe'
  rowHeight?: number
  estimatedRowHeight?: number
  overscanCount?: number
  rowClassName?: string
  /**
   * 后端列表响应的字段映射（默认 total←records / tableData←rows）。
   * 组件读 `options.configTableOut`，仅接受平铺键：total / tableData / pageSize / current。
   */
  configTableOut?: { total?: string; tableData?: string; pageSize?: string; current?: string }
  /**
   * vxe 行内编辑开关（AI-09 子项④）。仅 vxe 引擎生效 —— 需同时 `engine: 'vxe'`。
   * 具体哪些列可编辑由列级 `editRender` 决定（`columns[].editRender`）。原样透传。
   */
  editConfig?: Record<string, unknown>
  // ── AI-22：闭合 strip-hazard。以下键此前仅存在于 core `TableOptions`（三端运行时
  //    早已消费），却既不在 AI Zod（被静默剥）也不在本发射白名单（发射时丢）。两级一起补。
  size?: 'large' | 'default' | 'small'
  showHeader?: boolean
  emptyText?: string
  snIndex?: boolean
  leftText?: string
  cachePageSelection?: boolean
  defaultSort?: { prop: string; order: 'ascending' | 'descending' }
  refetchKeepPage?: boolean
  localPagination?: boolean
}

export interface StructuredGenerateResult {
  code: string
  wrapperCode?: string
  summary: string
  warnings: string[]
}

/**
 * prop 不是裸标识符时的提示（仅提示，不拒绝）。
 *
 * 生成侧已经把这类 prop 安全地引号化（`qKey`），所以产物是可编译的 —— 但对 `a.b` /
 * `a[0].b` 这类嵌套路径，**SFC 模式的默认值不生效**：`reactive({ 'a.b': '' })` 建的是
 * 扁平键 `"a.b"`，而 core 的 `getNestedValue`/`setNestedValue` 按 `/\.|\[|\]/` 分段去
 * 读嵌套结构 `{ a: { b } }`，两者对不上（字段首次编辑后会落到正确路径，但初始默认值被忽略）。
 * schema 模式没有这个问题（默认值由 EsCrudPage 处理）。
 */
function warnNonIdentifierProps(config: StructuredCrudConfig): string[] {
  const props = (config.fields || []).map((f) => f?.prop).filter((p): p is string => typeof p === 'string')
  const odd = props.filter((p) => p && !BARE_IDENTIFIER.test(p))
  if (!odd.length) return []
  const nested = odd.filter((p) => /[.[\]]/.test(p))
  return [
    `prop 不是裸标识符：${odd.join(', ')}。生成侧已按需加引号（产物可编译），` +
      (nested.length
        ? `但嵌套路径（${nested.join(', ')}）在 mode=sfc 下**初始默认值不生效**（reactive 建的是扁平键）——请改用 mode=schema，或自行初始化嵌套结构。`
        : `建议改用标识符以免下游工具（如按 prop 生成的插槽名）难以处理。`),
  ]
}

/**
 * 入口校验。
 *
 * 此前 `generateFromConfig` 直接读 `config.mode` / `config.fields.filter(...)` ——
 * `fields` 缺失就地抛 `TypeError`，而 schema 校验只在**部分**调用方生效
 * （`cli/commands/create.ts`、`cli/ai/nl-to-config.ts`、`mcp-server` 的 `configShape`），
 * 测试与 `score-golden.mjs` 走的是未校验对象。于是「契约违规」在这条路径上是
 * 「某些调用方会炸、某些静默产出垃圾」，而不是一处明确的失败。
 *
 * 这里只做**校验**、不用 parse 结果：`StructuredCrudConfigSchema` 带大量 `.default()`，
 * 改用解析结果会顺带改写既有输入语义（例如把省略的 `inQuery` 落成显式 `true`），
 * 属于另一层行为变更。校验失败则抛出带字段级明细的错误，让问题可见。
 */
function assertValidConfig(config: StructuredCrudConfig): void {
  const parsed = StructuredCrudConfigSchema.safeParse(config)
  if (parsed.success) return
  const details = parsed.error.issues
    .slice(0, 20)
    .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n')
  const more = parsed.error.issues.length > 20 ? `\n  …还有 ${parsed.error.issues.length - 20} 条` : ''
  throw new Error(`generateFromConfig: 配置未通过 StructuredCrudConfigSchema 校验\n${details}${more}`)
}

/**
 * AI-35：**声明了却打不开的弹窗** —— 返回「没有任何入口按钮能打开」的 `dialogs` 键。
 *
 * 起因（AI-27 落地时实测）：三端 `es-crud-page` 的两个归一化器对「什么是显式模式」
 * 判断**不一致** —— `normalizedToolbarBtns` 见到 `schema.dialogs` 就整块返回 `[]`
 * （不派生工具栏按钮），而 `normalizedOperationColumn` **不认** `dialogs`、照旧从
 * `actions` 派生操作列。后果：只声明 `dialogs` 而不声明入口按钮的配置，页面上没有任何
 * 「新增」入口 —— 弹窗配好了却点不开，且**零告警**。
 * 修法是让 `dialogs` 退出按钮派生（`dialogs` 定义弹窗、不定义按钮面；见三端
 * `normalizedToolbarBtns` 注释），本函数是把该规则**算出来**的那一半：
 *
 * 本函数逐字镜像三端归一化器的**派生规则**，任何一侧改了规则都必须同改这里
 * （`check-threeway-consistency.mjs` 的轴⑤ 会用「三端门必须只认 `operationColumn`」
 * 的静态断言把它钉死，`crud-runtime.spec.ts` 再用真渲染做行为见证）。
 *
 * 保留的两种残余形态（修 runtime 派生也盖不住的，正是本函数存在的理由）：
 *   1. `dialogs[add]` 但 `actions` 里没有 `add`（没有东西能派生出入口）；
 *   2. 显式声明了 `toolbarBtns` / `operationColumn`（按钮面交给用户），但其中没有
 *      任何 `dialogKey === add` 的按钮。
 * 二者都是**合法但静默失败**的配置 —— 生成器据此发警告（不静默），不抛错。
 */
export function findDialogsWithoutOpener(config: StructuredCrudConfig): string[] {
  const actions: string[] = config.actions?.length ? [...config.actions] : ['add', 'edit', 'delete']

  // ① 有哪些弹窗（镜像 `normalizedDialogs`：显式 dialogs 优先，否则由 legacy
  //    `dialogFormItems` + actions 派生；AI 契约里没有 dialogFormItems，宿主手写配置才有）
  const legacyItems = (config as { dialogFormItems?: unknown[] }).dialogFormItems
  const dialogKeys = config.dialogs
    ? Object.keys(config.dialogs)
    : Array.isArray(legacyItems) && legacyItems.length
      ? ['add', 'edit', 'view'].filter((k) => actions.includes(k))
      : []
  if (!dialogKeys.length) return []

  // ② 哪些 key 有入口（镜像 toolbar / tableBtns / operation column 三处派生）
  const reachable = new Set<string>()
  const oc = config.operationColumn

  if (config.toolbarBtns !== undefined) {
    for (const b of config.toolbarBtns ?? []) if (b.dialogKey) reachable.add(b.dialogKey)
  } else if (oc === undefined) {
    // 只声明 dialogs 不算「显式按钮面」；但显式 operationColumn 会抑制工具栏派生
    if (actions.includes('add')) reachable.add('add')
  }

  for (const b of config.tableBtns ?? []) if (b.dialogKey) reachable.add(b.dialogKey)

  if (oc !== undefined) {
    if (oc !== false) for (const b of oc.btns ?? []) if (b.dialogKey) reachable.add(b.dialogKey)
  } else {
    const hasActionCol = (config.columns ?? []).some(
      (c) => c.prop === 'action' || c.prop === 'operate' || 'btns' in c
    )
    if (!hasActionCol) for (const k of ['view', 'edit']) if (actions.includes(k)) reachable.add(k)
  }

  return dialogKeys.filter((k) => !reachable.has(k))
}

export function generateFromConfig(config: StructuredCrudConfig): StructuredGenerateResult {
  assertValidConfig(config)
  const mode = config.mode || 'schema'
  const result = mode === 'sfc' ? generateSFC(config) : generateSchema(config)
  // 只在这一处汇总跨模式的通用提示，避免两个模式各写一遍而分叉。
  const propWarnings = warnNonIdentifierProps(config)
  // AI-35：只在 schema 模式报 —— sfc 模式整体不消费 `config.dialogs`（已有专门降级告警），
  // 再说一遍「弹窗打不开」是噪音（那时根本没有弹窗）。
  const orphanWarnings =
    mode === 'schema'
      ? (() => {
          const orphans = findDialogsWithoutOpener(config)
          if (!orphans.length) return []
          const keys = orphans.map((k) => `dialogs.${k}`).join(', ')
          return [
            `${keys} has no opener: 生成的页面里没有任何按钮能打开它（无入口 = 点不开，且不会报错）。` +
              `按当前规则，工具栏按钮由 \`actions\` 派生（\`add\` ⇒ 新增）、行内按钮由 \`actions\` 的 \`view\`/\`edit\` 派生；` +
              `若你显式声明了 \`toolbarBtns\`/\`tableBtns\`/\`operationColumn\`，它们**整体接管**按钮面，` +
              `就必须自己给出 \`dialogKey: "${orphans[0]}"\` 的入口按钮（或把对应动作加回 \`actions\`）。`,
          ]
        })()
      : []
  const extra = [...propWarnings, ...orphanWarnings]
  if (extra.length) {
    return { ...result, warnings: [...extra, ...(result.warnings || [])] }
  }
  return result
}

function generateSchema(config: StructuredCrudConfig): StructuredGenerateResult {
  const warnings: string[] = []
  const target = readTarget(config)
  const queryFields = config.fields.filter(f => f.inQuery !== false)
  const tableFields = config.fields.filter(f => f.inTable !== false)
  const formFields = config.fields.filter(f => f.inForm !== false)
  const hasDelete = config.actions.includes('delete')
  const hasDialog = config.actions.includes('add') || config.actions.includes('edit') || config.actions.includes('view')
  const useNewDialogMode = !!(config.dialogs || config.toolbarBtns || config.tableBtns || config.operationColumn !== undefined)

  const renderFields = tableFields.filter(f => f.render)
  if (renderFields.length > 0) {
    warnings.push(`Schema mode cannot inline a render function. Fields [${renderFields.map(f => f.prop).join(', ')}] emit a marked \`TODO(es-plus)\` extension-point slot in the wrapper SFC (a default status-tag stub echoing your requested render) — replace the stub with the real markup. The requirement is preserved as a marker, not dropped.`)
  }

  // WS-5: formatter（列格式化函数）同样无法序列化进 JSON schema —— 不静默丢弃，
  // 发出降级警告，保留原始 formatter 意图供开发者手动补回。
  const formatterFields = tableFields.filter(f => typeof f.formatter === 'string' && f.formatter)
  if (formatterFields.length > 0) {
    const hints = formatterFields.map(f => `"${f.prop}": ${sanitizeForComment(f.formatter!)}`).join('; ')
    warnings.push(`Schema mode cannot inline a formatter function (JSON cannot hold functions). Fields [${formatterFields.map(f => f.prop).join(', ')}] are emitted unformatted — re-add \`formatter\` manually. Original formatters: ${hints}. The requirement is marked, not silently dropped.`)
  }

  // AI-31①：表单面的 render（`buildFormItem` 无 render 分支）此前**静默**丢。这里发
  // 一条与 formatter 同规的降级告警，并在 wrapper SFC 里落 TODO(es-plus) 注释占位。
  const formFaceRenderWarn = formFaceRenderWarning(config, { includeDialogs: true })
  if (formFaceRenderWarn) warnings.push(formFaceRenderWarn)

  // Vue 2 不支持虚拟滚动 (Element UI 无 el-table-v2)，提前发出警告。
  // 只警告 `virtual: true` 与 `engine: 'virtual'`（二者等价）—— 这两者确实会降级。
  //
  // **`engine: 'vxe'` 刻意不警告**：vue2 有完整的 vxe 适配器
  // （`packages/vue2/src/components/es-table/engines/vxe-engine.vue`，带单测），
  // 生成物里的 `engine` 也原样透传（见下方 `...(tOpts.engine ? …)`），
  // 运行时确实走 vxe 引擎；三端对 vxe-table 的依赖声明也完全一致
  // （optional peerDependency，vue2 用 ^3.8.0）。vue3/antdv 下不警告，vue2 下同样不该警告。
  // 此前这里用「vxe 引擎只存在于 vue3/antdv、vue2 会退回普通 el-table」告警 ——
  // 那是 vue2 引入 vxe 引擎（2026-07-28）之前的旧事实，属**错误告警**：
  // 它会让一个完全可用的 vue2 配置收到「你的配置被忽略了」的假信息。
  const tOptsForWarn = (config.tableOptions || {}) as Record<string, unknown>
  const wantsVirtual2 = target === 'vue2' && (tOptsForWarn.virtual || tOptsForWarn.engine === 'virtual')
  if (wantsVirtual2) {
    warnings.push('target=vue2: Element UI does not support virtual scrolling (no el-table-v2). The "virtual" option will be ignored at runtime — use normal el-table for large datasets and consider server-side pagination, or switch to the vxe engine (`engine: \'vxe\'`), which vue2 does support.')
  }

  // 行内编辑仅 vxe 引擎生效（AI-09 子项④）：配置了 editConfig 但引擎不是 vxe →
  // 默认/virtual 引擎会在运行时静默忽略，发告警以免「配了却毫无反应」的假承诺。
  if (tOptsForWarn.editConfig !== undefined && tOptsForWarn.engine !== 'vxe') {
    warnings.push(`tableOptions.editConfig requires engine: 'vxe' — the current engine is '${(tOptsForWarn.engine as string) || 'default'}', so inline editing will be silently ignored at runtime.`)
  }

  const schema: Record<string, unknown> = {}

  if (queryFields.length > 0) {
    schema.formItems = queryFields.map(f => buildFormItem(f, 'query', config.i18n))
  }

  // 表格列：显式 `columns` 逃生数组优先（多级表头 / 非字段列 / 精确列序），
  // 否则从 `fields` 派生「一字段一列」。override **非** merge —— 给了 columns 就
  // 不再混入派生列（避免排序 / 同 prop 重复的二义）。操作列不在此处：schema 模式下
  // 它由 es-crud-page 按 operationColumn/actions 在运行时追加（见 SFC 分支注释）。
  schema.columns =
    config.columns && config.columns.length > 0
      ? applyExpandConfig(config.columns as Array<Record<string, unknown>>, config, warnings)
      : applyExpandConfig(tableFields.map(f => buildTableColumn(f, config.i18n)), config, warnings)

  const tOpts: TableOpts = (config.tableOptions || {}) as TableOpts
  schema.tableOptions = {
    border: tOpts.border !== false,
    stripe: tOpts.stripe !== false,
    highlightCurrentRow: tOpts.highlightCurrentRow !== false,
    headerCellStyle: tOpts.headerCellStyle || { background: '#f5f7fa' },
    apiParams: { url: config.apiUrl },
    rowkey: tOpts.rowkey || 'id',
    ...(tOpts.heightType ? { heightType: tOpts.heightType } : {}),
    ...(tOpts.tabHeight ? { tabHeight: tOpts.tabHeight } : {}),
    ...(tOpts.height ? { height: tOpts.height } : {}),
    ...(tOpts.multiSelect ? { multiSelect: true } : {}),
    ...(tOpts.virtual ? { virtual: true } : {}),
    ...(tOpts.engine ? { engine: tOpts.engine } : {}),
    ...(tOpts.rowHeight ? { rowHeight: tOpts.rowHeight } : {}),
    ...(tOpts.estimatedRowHeight ? { estimatedRowHeight: tOpts.estimatedRowHeight } : {}),
    ...(tOpts.overscanCount ? { overscanCount: tOpts.overscanCount } : {}),
    ...(tOpts.rowClassName ? { rowClassName: tOpts.rowClassName } : {}),
    ...(tOpts.configTableOut ? { configTableOut: tOpts.configTableOut } : {}),
    // vxe 行内编辑开关（AI-09 子项④）→ 运行时唯一家 tableOptions.editConfig，原样透传。
    ...(tOpts.editConfig ? { editConfig: tOpts.editConfig } : {}),
    // AI-22：此前 AI Zod 未声明、故被静默剥掉的 tableOptions 键（三端运行时早已消费）。
    // `false` 是这些布尔键的有效取值（如 showHeader:false 隐藏表头），故用 `!== undefined`。
    ...(tOpts.size ? { size: tOpts.size } : {}),
    ...(tOpts.showHeader !== undefined ? { showHeader: tOpts.showHeader } : {}),
    ...(tOpts.emptyText ? { emptyText: tOpts.emptyText } : {}),
    ...(tOpts.snIndex !== undefined ? { snIndex: tOpts.snIndex } : {}),
    ...(tOpts.leftText ? { leftText: tOpts.leftText } : {}),
    ...(tOpts.cachePageSelection !== undefined ? { cachePageSelection: tOpts.cachePageSelection } : {}),
    ...(tOpts.defaultSort ? { defaultSort: tOpts.defaultSort } : {}),
    ...(tOpts.refetchKeepPage !== undefined ? { refetchKeepPage: tOpts.refetchKeepPage } : {}),
    ...(tOpts.localPagination !== undefined ? { localPagination: tOpts.localPagination } : {}),
    // 顶层 treeConfig（AI-09 子项③）→ 运行时唯一家 tableOptions.treeConfig。
    // vxe 原样认 childrenField/expandAll；el-table/a-table 在组件侧翻译成 tree-props /
    // childrenColumnName + default-expand-all(-rows)。即便子键为空也发（vxe 靠 treeConfig
    // 的存在进入树模式；默认引擎靠行数据里的嵌套子数组，treeConfig 存在不产生副作用）。
    ...(config.treeConfig
      ? {
          treeConfig: {
            ...(config.treeConfig.childrenField ? { childrenField: config.treeConfig.childrenField } : {}),
            ...(config.treeConfig.expandAll ? { expandAll: true } : {}),
          },
        }
      : {}),
    // 顶层 mergeConfig（AI-23）→ 运行时唯一家 tableOptions.mergeConfig。
    // 三端组件侧读到它后各自落地：el-table spanMethod / a-table 列级 customCell /
    // vxe mergeMethod（求值全部复用 core buildRowSpanMethod，三端等价由构造保证）。
    ...(config.mergeConfig ? { mergeConfig: { rowsBy: [...config.mergeConfig.rowsBy] } } : {}),
  }

  // Query form layout (minFoldRows for collapse)
  if (config.formLayout) {
    schema.formLayout = config.formLayout
  }

  // New multi-dialog mode
  if (useNewDialogMode) {
    if (config.toolbarBtns) {
      schema.toolbarBtns = config.toolbarBtns
    }
    if (config.tableBtns) {
      schema.tableBtns = config.tableBtns
    }
    if (config.operationColumn !== undefined) {
      schema.operationColumn = config.operationColumn
    }
    if (config.dialogs) {
      const schemaDialogs: Record<string, unknown> = {}
      for (const [key, dlg] of Object.entries(config.dialogs)) {
        const dialogSchema: Record<string, unknown> = {}
        if (dlg.title) dialogSchema.title = dlg.title
        if (dlg.width) dialogSchema.width = dlg.width
        if (dlg.formItems) {
          dialogSchema.formItems = dlg.formItems.map((f: any) => buildFormItem(f, 'form', config.i18n))
        }
        if (dlg.formLayout) dialogSchema.formLayout = dlg.formLayout
        if (dlg.isDraggable) dialogSchema.isDraggable = true
        if (dlg.maxHeight) dialogSchema.maxHeight = dlg.maxHeight
        if (dlg.fullscreen) dialogSchema.fullscreen = true
        if (dlg.isHiddenFooter) dialogSchema.isHiddenFooter = true
        // AI-27：弹窗底座数据键 —— AI 契约已放行，但生成器此前只逐键拷贝 9 个，
        // 于是即便宿主 LLM 声明了 `showClose:false`，产物里也没有这个键
        // （AI-27 前的第二道静默丢弃：契约放行 → 生成器丢 → 运行时无从消费）。
        // 逐键显式拷贝、不 spread，是为了让 check-schema-contract 的
        // `dialogSchema.KEY =` 扫描能逐个咬住「声明了却没发射」。
        if (dlg.showClose !== undefined) dialogSchema.showClose = dlg.showClose
        if (dlg.destroyOnClose !== undefined) dialogSchema.destroyOnClose = dlg.destroyOnClose
        if (dlg.modal !== undefined) dialogSchema.modal = dlg.modal
        if (dlg.closeOnClickModal !== undefined) dialogSchema.closeOnClickModal = dlg.closeOnClickModal
        if (dlg.closeOnPressEscape !== undefined) dialogSchema.closeOnPressEscape = dlg.closeOnPressEscape
        if (dlg.hiddenFullBtn) dialogSchema.hiddenFullBtn = true
        if (dlg.appendTo) dialogSchema.appendTo = dlg.appendTo
        if (dlg.cacheKey) dialogSchema.cacheKey = dlg.cacheKey
        if (dlg.configBtn) dialogSchema.configBtn = dlg.configBtn
        if (dlg.hasCustomRender) {
          dialogSchema.hasCustomRender = true
          warnings.push(`Dialog "${sanitizeForComment(key)}" has hasCustomRender=true — implement render function in wrapper SFC.`)
        }
        schemaDialogs[key] = dialogSchema
      }
      schema.dialogs = schemaDialogs
    }
  } else {
    // Legacy mode: use dialogFormItems + actions
    if (formFields.length > 0 && hasDialog) {
      schema.dialogFormItems = formFields.map(f => buildFormItem(f, 'form', config.i18n))
    }
    schema.actions = config.actions
  }

  schema.pagination = { pageSize: config.pagination?.pageSize || 10 }

  // 用 inlineJson 而非裸 JSON.stringify：schema 会被内联进 wrapper SFC 的 <script>，
  // 用户可控的 label 含 `</script>` 时否则能提前闭合宿主 script 标签。正常内容字节不变。
  const schemaJson = inlineJson(schema, 2)
  const wrapperCode = useNewDialogMode
    ? buildSchemaWrapperNew(config, renderFields, warnings, target)
    : buildSchemaWrapper(config, hasDelete, hasDialog, renderFields, target)

  const esPlusPkg = getEsPlusPackageName(target)
  const tsImport = config.typescript
    ? `import type { CrudPageSchema } from '${esPlusPkg}'\n\nexport const pageSchema: CrudPageSchema = `
    : `export const pageSchema = `

  const code = `${tsImport}${schemaJson}\n`

  const dialogCount = config.dialogs ? Object.keys(config.dialogs).length : (hasDialog ? 1 : 0)
  const summary = [
    `Generated CrudPageSchema (structured mode, target=${target}):`,
    `- ${queryFields.length} query fields, ${tableFields.length} table columns`,
    `- ${dialogCount} dialog(s) configured`,
    `- Actions: ${config.actions.join(', ')}`,
    `- API: ${config.apiUrl}`,
    `- Mode: schema + wrapper SFC`,
    useNewDialogMode ? '- Multi-dialog mode' : '- Legacy actions mode',
    config.typescript ? '- TypeScript enabled' : '',
    config.permissions ? '- Permissions configured' : '',
    target === 'vue2'
      ? '- Target: Vue 2 + Element UI (@es-plus/vue2)'
      : target === 'antdv'
        ? '- Target: Vue 3 + Ant Design Vue (@es-plus/adapter-antdv)'
        : '- Target: Vue 3 + Element Plus (@es-plus/vue3)',
  ].filter(Boolean).join('\n')

  return { code, wrapperCode, summary, warnings }
}

function generateSFC(config: StructuredCrudConfig): StructuredGenerateResult {
  const warnings: string[] = []
  const target = readTarget(config)
  const isVue2 = target === 'vue2'
  const esPlusPkg = getEsPlusPackageName(target)
  const queryFields = config.fields.filter(f => f.inQuery !== false)
  const tableFields = config.fields.filter(f => f.inTable !== false)
  const formFields = config.fields.filter(f => f.inForm !== false)
  const hasDelete = config.actions.includes('delete')
  const hasDialog = config.actions.includes('add') || config.actions.includes('edit') || config.actions.includes('view')
  const hasRender = tableFields.some(f => f.render)
  const ts = config.typescript

  // Vue 2 SFC 模式提醒：JSX render 需 babel-preset-jsx-vue2，且 Element UI 无虚拟滚动
  if (isVue2) {
    if (hasDialog) {
      warnings.push('target=vue2 + mode=sfc: dialog uses JSX render — ensure your project includes @vue/babel-preset-jsx (or use mode=schema for simpler output).')
    }
    const tOptsForWarn = (config.tableOptions || {}) as Record<string, unknown>
    // `engine: 'vxe'` 不警告 —— vue2 有 vxe 适配器，见 schema 模式同处的说明。
    if (tOptsForWarn.virtual || tOptsForWarn.engine === 'virtual') {
      warnings.push('target=vue2: virtual scrolling is not supported in Element UI — option will be ignored.')
    }
  } else if (hasDialog) {
    // vue3 / antdv：弹窗 render 用 JSX，需 <script setup lang="tsx|jsx"> + @vitejs/plugin-vue-jsx
    warnings.push(`target=${target} + mode=sfc: dialog uses a JSX render function, so the generated <script setup> is emitted with lang="${ts ? 'tsx' : 'jsx'}". Ensure @vitejs/plugin-vue-jsx is installed and registered in vite.config (alongside @vitejs/plugin-vue). Use mode=schema if you prefer a JSX-free wrapper.`)
  }

  // 行内编辑仅 vxe 引擎生效（AI-09 子项④）：配置了 editConfig 但引擎不是 vxe → 告警
  //（对三端都适用，故在 isVue2 分支之外）。见 schema 模式同处说明。
  {
    const tOptsWarn = (config.tableOptions || {}) as Record<string, unknown>
    if (tOptsWarn.editConfig !== undefined && tOptsWarn.engine !== 'vxe') {
      warnings.push(`tableOptions.editConfig requires engine: 'vxe' — the current engine is '${(tOptsWarn.engine as string) || 'default'}', so inline editing will be silently ignored at runtime.`)
    }
  }

  // antdv + SFC + 列 render：render 字符串按 Element 语义编写（h(ElTag, { type })），
  // 生成器只能重命名符号（ElTag→Tag），无法把 { type: 'success' } 改写为 antdv 的
  // { color: 'green' }。提醒用户核对，或改用 mode=schema（走 buildStatusTagTemplate 生成
  // 正确的 <a-tag :color>）。
  if (target === 'antdv' && hasRender) {
    warnings.push('target=antdv + mode=sfc: inline column render() is emitted using Element Plus semantics (e.g. <Tag type="success">). Ant Design Vue\'s Tag uses `color` (green/red), not `type`. Adjust the render props, or use mode=schema which generates a correct <a-tag :color> slot automatically.')
  }

  // WS-5「标记而非静默丢弃」：SFC 模式当前只从 actions 推导单个通用弹窗与操作列，
  // 不消费 config.dialogs / tableBtns / toolbarBtns / operationColumn（schema 模式才全量支持）。
  // 检测到这些键就显式告警，引导改用 mode=schema 或手工补全，而不是默默忽略。
  const ignoredInSfc: string[] = []
  if (config.dialogs && Object.keys(config.dialogs).length) {
    ignoredInSfc.push('dialogs (per-dialog titles/formItems/layout — a single generic dialog is derived from actions instead)')
  }
  if (Array.isArray(config.tableBtns) && config.tableBtns.length) {
    ignoredInSfc.push('tableBtns (toolbar buttons + code:1/2 positioning)')
  }
  // toolbarBtns 此前**漏在清单外**：generateSFC 全程不读它（引用数 0），于是它既不生效、
  // 也不告警 —— 违反本函数自己的「显式告警，而不是默默忽略」约定。SFC 模式下表单按钮由
  // queryBtns/actions 派生，toolbarBtns 的 name/position/dialogKey 全部丢失。
  if (Array.isArray(config.toolbarBtns) && config.toolbarBtns.length) {
    ignoredInSfc.push('toolbarBtns (form-area buttons + position/dialogKey)')
  }
  if (config.operationColumn) {
    ignoredInSfc.push('operationColumn (width/label/fixed)')
  }
  if (ignoredInSfc.length) {
    warnings.push(
      `mode=sfc does not yet consume: ${ignoredInSfc.join('; ')}. ` +
        `These were IGNORED (surfaced here, not dropped silently). Use mode=schema for full support, or add them to the emitted SFC by hand.`
    )
  }

  // AI-31①：表单面的 render 在这里同样载不动 —— 查询表单与（旧式）弹窗表单都是内联 JSON
  // （下方 `const formItems` / `const dialogFormItems`）。dialogs 不收：新式 dialogs 已被上面
  // 的 ignoredInSfc 整体告警，重复报同一件事只会稀释信号。
  const sfcFormFaceRenderWarn = formFaceRenderWarning(config, { includeDialogs: false })
  if (sfcFormFaceRenderWarn) warnings.push(sfcFormFaceRenderWarn)

  // F3（W2.4）：顶层 formLayout 此前只有 schema 模式消费（EsCrudPage 的 formLayoutProps），
  // SFC 模式从不读 —— 同一份 config 换 mode 布局就静默丢失。这里按 EsCrudPage 的映射
  // （labelWidth → labelBtnWidth、minFoldRows 直传、rowLayProps.gutter=16）把等价的
  // layoutFormProps 绑到查询 es-form。`span` 已于 AI-31③ 从契约删除（layout 级无消费者，
  // 列数是逐字段的 querySpan/formSpan）。
  const sfcFormLayout = (config.formLayout || {}) as { labelWidth?: string | number; minFoldRows?: number }
  const sfcFormLayProps: Record<string, unknown> = {}
  if (sfcFormLayout.labelWidth !== undefined) sfcFormLayProps.labelBtnWidth = sfcFormLayout.labelWidth
  if (sfcFormLayout.minFoldRows) sfcFormLayProps.minFoldRows = sfcFormLayout.minFoldRows
  const hasSfcFormLayout = Object.keys(sfcFormLayProps).length > 0

  const lines: string[] = []

  // Template
  lines.push(`<template>`)
  lines.push(`  <es-table`)
  lines.push(`    ref="tableRef"`)
  lines.push(`    :columns="columns"`)
  lines.push(`    :options="options"`)
  if (isVue2) {
    // F7：vue2 es-table 从不 emit `update:dataSource`，`.sync` 是永不触发的假承诺；
    // 只发单向输入。`pagination` 仍会 emit `update:pagination`，`.sync` 成立。
    lines.push(`    :data-source="tableData"`)
    lines.push(`    :pagination.sync="pagination"`)
  } else {
    lines.push(`    v-model:data-source="tableData"`)
    lines.push(`    v-model:pagination="pagination"`)
  }
  lines.push(`  >`)
  lines.push(
    `    <es-form :model="queryForm" :form-item-list="formItems" :config-btn="queryBtns"` +
      (hasSfcFormLayout ? ` :layout-form-props="formLayoutProps"` : '') +
      ` />`,
  )
  lines.push(`  </es-table>`)
  lines.push(`</template>`)
  lines.push(``)

  // Script — Vue 2 需要 defineComponent + setup() 包装，Vue 3 直接用 <script setup>。
  // 两端一致：弹窗 render 走 JSX（vue2 用 @vue/babel-preset-jsx / @vitejs/plugin-vue2-jsx，
  // vue3 用 @vitejs/plugin-vue-jsx），因此 hasDialog 时必须标 lang="tsx|jsx"，否则 esbuild
  // 的 ts/js loader 遇到 <EsForm/> 直接解析失败（Expected ">" but found "ref"）。
  const scriptLang = hasDialog ? (ts ? 'tsx' : 'jsx') : (ts ? 'ts' : '')
  if (isVue2) {
    lines.push(scriptLang ? `<script lang="${scriptLang}">` : `<script>`)
  } else {
    lines.push(scriptLang ? `<script setup lang="${scriptLang}">` : `<script setup>`)
  }

  // Imports
  const vueImports = isVue2 ? ['defineComponent', 'reactive', 'ref'] : ['reactive', 'ref']
  if (hasRender) vueImports.push('h')
  lines.push(`import { ${vueImports.join(', ')} } from 'vue'`)

  // es-plus 具名导入：弹窗需 useDialog + EsForm（JSX render 引用）；增删改查需全局 httpRequest（方案B）
  const esPlusNamed: string[] = []
  if (hasDialog) esPlusNamed.push('useDialog', 'EsForm')
  if (hasDelete || hasDialog) esPlusNamed.push('httpRequest')
  if (esPlusNamed.length > 0) {
    lines.push(`import { ${esPlusNamed.join(', ')} } from '${esPlusPkg}'`)
  }

  // Element 命名映射（ElMessage/ElTag → Vue 2 的 Message/Tag）
  const epImports: string[] = []
  if (hasRender) epImports.push('ElTag')
  if (hasDelete) epImports.push('ElMessageBox', 'ElMessage')
  if (epImports.length > 0) {
    lines.push(buildElementImport(epImports, target))
  }
  lines.push(``)

  // Vue 2 模式：开始 defineComponent({ setup() {
  if (isVue2) {
    lines.push(`export default defineComponent({`)
    lines.push(`  setup() {`)
  }

  // TypeScript interface
  if (ts && queryFields.length > 0) {
    lines.push(`interface QueryForm {`)
    for (const f of queryFields) {
      const tsType = inferTsType(f)
      lines.push(`  ${qKey(f.prop)}: ${tsType}`)
    }
    lines.push(`}`)
    lines.push(``)
  }

  // Reactive state
  const modelInit = queryFields.map(f => `${qKey(f.prop)}: ${getDefaultValue(f)}`).join(', ')
  if (ts) {
    lines.push(`const queryForm = reactive<QueryForm>({ ${modelInit} })`)
  } else {
    lines.push(`const queryForm = reactive({ ${modelInit} })`)
  }
  lines.push(`const tableData = ref([])`)
  lines.push(`const tableRef = ref(null)`)
  // pageSizes 由 es-table 从 pagination 对象读取（component.vue: paginationConfig.pageSizes）。
  // 配置里声明了 pageSizes 就透传，避免静默丢弃用户的每页条数选项。
  const pageSizesPart = Array.isArray(config.pagination?.pageSizes) && config.pagination.pageSizes.length
    ? `, pageSizes: ${inlineJson(config.pagination.pageSizes)}`
    : ''
  lines.push(`const pagination = ref({ current: 1, pageSize: ${config.pagination?.pageSize || 10}, total: 0${pageSizesPart} })`)
  if (hasDialog) lines.push(`const dialog = useDialog()`)
  lines.push(``)

  // formItems —— 这段 JSON 会被内联进生成 SFC 的 <script> 块，必须用 inlineJson：
  // 用户可控的 label 里写 `</script>` 否则能提前闭合宿主 script 标签（见 codegen-escape.ts）。
  const formItemsJson = inlineJson(queryFields.map(f => buildFormItem(f, 'query', config.i18n)), 2)
  lines.push(...buildFormFaceRenderPlaceholderLines(config, '', { includeDialogs: false, dialect: 'js' }))
  lines.push(`const formItems = ${formItemsJson}`)
  if (hasSfcFormLayout) {
    // 与 schema 模式（EsCrudPage.formLayoutProps）等价：labelWidth 映射到按钮区 label 宽度。
    lines.push(
      `const formLayoutProps = { rowLayProps: { gutter: 16 }, formLayProps: ${inlineJson(sfcFormLayProps)} }`,
    )
  }
  lines.push(``)

  // queryBtns
  lines.push(`const queryBtns = [`)
  lines.push(`  { name: '查询', type: 'primary', key: '${SPECIAL_BTN_KEYS.QUERY}', triggerEvent: true },`)
  lines.push(`  { name: '重置', key: '${SPECIAL_BTN_KEYS.RESET}', triggerEvent: true },`)
  if (config.actions.includes('add')) {
    const perm = config.permissions?.add ? `, permissionValue: ${q(config.permissions.add)}` : ''
    lines.push(`  { name: '新增', type: 'primary', key: 'add', icon: 'Plus', click: () => openForm('新增')${perm} },`)
  }
  if (config.actions.includes('export')) {
    const perm = config.permissions?.export ? `, permissionValue: ${q(config.permissions.export)}` : ''
    lines.push(`  { name: '导出', key: 'export', icon: 'Download', click: () => handleExport()${perm} },`)
  }
  if (config.actions.includes('import')) {
    const perm = config.permissions?.import ? `, permissionValue: ${q(config.permissions.import)}` : ''
    lines.push(`  { name: '导入', key: 'import', icon: 'Upload', click: () => handleImport()${perm} },`)
  }
  lines.push(`]`)
  lines.push(``)

  // columns
  lines.push(`const columns = [`)
  // AI-09 子项②：顶层 `expandConfig` 在此落到展开列。若 columns 里没有 `type:'expand'`
  // 列，前置一个（展开列与数据列正交，不破坏 columns 的 override 语义）。
  const hasExpandColSfc = ((config.columns ?? []) as Array<Record<string, unknown>>).some((c) => c.type === 'expand')
  if (config.expandConfig && !hasExpandColSfc) {
    pushSfcColumn({ type: 'expand', expandConfig: config.expandConfig }, lines, '  ', warnings)
  }
  if (config.columns && config.columns.length > 0) {
    // 显式列逃生数组（override 非 merge）：数据列的顺序/构成完全由 columns 决定，
    // `fields` 不再派生表格列。逐列递归发射（`groups` 多级表头自指）。操作列仍按
    // 下方 actionBtns 追加（与派生路径一致，schema 模式同语义）。
    for (const c of config.columns as Array<Record<string, unknown>>) {
      const col = config.expandConfig && c.type === 'expand' ? { ...c, expandConfig: config.expandConfig } : c
      pushSfcColumn(col, lines, '  ', warnings)
    }
  } else {
    for (const f of tableFields) {
      const col = buildTableColumnSFC(f, config, warnings)
      lines.push(`  ${col},`)
    }
  }
  // operation column
  const actionBtns = buildActionBtns(config)
  if (actionBtns.length > 0) {
    lines.push(`  {`)
    lines.push(`    prop: '${OPERATION_COLUMN_PROP_SFC}',`)
    lines.push(`    label: '操作',`)
    lines.push(`    width: ${actionBtns.length * 80 + 20},`)
    lines.push(`    fixed: 'right',`)
    lines.push(`    btns: [`)
    for (const btn of actionBtns) {
      lines.push(`      ${btn},`)
    }
    lines.push(`    ]`)
    lines.push(`  }`)
  }
  lines.push(`]`)
  lines.push(``)

  // options
  const tOpts: TableOpts = (config.tableOptions || {}) as TableOpts
  lines.push(`const options = {`)
  lines.push(`  border: ${tOpts.border !== false},`)
  lines.push(`  stripe: ${tOpts.stripe !== false},`)
  lines.push(`  highlightCurrentRow: ${tOpts.highlightCurrentRow !== false},`)
  // F3（W2.4）：`headerCellStyle` 一度在这里写死 `{ background: '#f5f7fa' }` ——
  // schema 模式尊重用户值（上方 tableOptions 构造的 `tOpts.headerCellStyle || 默认`），
  // SFC 却把它静默换回默认值：同 config 换 mode 表头样式就变，且零告警。
  lines.push(`  headerCellStyle: ${inlineJson(tOpts.headerCellStyle || { background: '#f5f7fa' })},`)
  lines.push(`  apiParams: { url: ${q(config.apiUrl)} },`)
  lines.push(`  rowkey: ${q(tOpts.rowkey || 'id')},`)
  if (tOpts.heightType) lines.push(`  heightType: ${q(tOpts.heightType)},`)
  if (tOpts.tabHeight) lines.push(`  tabHeight: ${numOrStr(tOpts.tabHeight)},`)
  // AI-30①：下列键**不得**寄生在 `if (tOpts.virtual)` 里。此前 `rowHeight`/`height` 被
  // 该分支门住 —— 于是「配了 height 但没开 virtual」的配置在 SFC 模式下**静默丢高度**
  // （schema 模式照发 `height: 400`，两模式产物不等价）。`height` 就是 el-table 自己的
  // `height` prop（与虚拟滚动无关），`rowHeight`/`estimatedRowHeight`/`overscanCount` 才
  // 是虚拟引擎的调优键 —— 但**发射**它们与开不开虚拟无关：运行时自会按引擎取用，
  // 生成器不该替宿主决定「这个值有没有意义」而把它丢掉（「发射而非静默丢弃」，同 AI-22）。
  if (tOpts.virtual) lines.push(`  virtual: true,`)
  if (tOpts.rowHeight) lines.push(`  rowHeight: ${tOpts.rowHeight},`)
  if (tOpts.height) lines.push(`  height: ${numOrStr(tOpts.height)},`)
  // AI-30②：这三键 schema 模式早已发射（见上方 tableOptions 构造），SFC 块漏了 —— 同 config
  // 换 mode 就丢键。逐键补上，形态与 schema 模式一致（数字直出、字符串经 q()）。
  if (tOpts.estimatedRowHeight) lines.push(`  estimatedRowHeight: ${tOpts.estimatedRowHeight},`)
  if (tOpts.overscanCount) lines.push(`  overscanCount: ${tOpts.overscanCount},`)
  if (tOpts.rowClassName) lines.push(`  rowClassName: ${q(tOpts.rowClassName)},`)
  if (tOpts.engine) lines.push(`  engine: ${q(tOpts.engine)},`)
  if (tOpts.multiSelect) lines.push(`  multiSelect: true,`)
  // 后端响应字段映射：SFC 的 options 是手搓块（非 JSON.stringify），逐键用 q() 转义
  // —— 与 schema 模式同等地「发射而非静默丢弃」（WS-5）。
  if (tOpts.configTableOut) {
    const cto = tOpts.configTableOut
    const ctoParts = (['total', 'tableData', 'pageSize', 'current'] as const)
      .filter((k) => cto[k])
      .map((k) => `${k}: ${q(cto[k])}`)
    if (ctoParts.length) lines.push(`  configTableOut: { ${ctoParts.join(', ')} },`)
  }
  // vxe 行内编辑开关（AI-09 子项④）→ options.editConfig。纯 JSON 数据（无函数值）→
  // 用既有 inlineJson() 序列化（转义 </script>，同 schema/formItems 的做法）。
  if (tOpts.editConfig) lines.push(`  editConfig: ${inlineJson(tOpts.editConfig)},`)
  // AI-22：与 schema 模式同等地「发射而非静默丢弃」这些 tableOptions 键（SFC 的 options
  // 是手搓块，字符串/数字经 q()/numOrStr() 转义；defaultSort 是纯 JSON → inlineJson）。
  if (tOpts.size) lines.push(`  size: ${q(tOpts.size)},`)
  if (tOpts.showHeader !== undefined) lines.push(`  showHeader: ${tOpts.showHeader},`)
  if (tOpts.emptyText) lines.push(`  emptyText: ${q(tOpts.emptyText)},`)
  if (tOpts.snIndex !== undefined) lines.push(`  snIndex: ${tOpts.snIndex},`)
  if (tOpts.leftText) lines.push(`  leftText: ${q(tOpts.leftText)},`)
  if (tOpts.cachePageSelection !== undefined) lines.push(`  cachePageSelection: ${tOpts.cachePageSelection},`)
  if (tOpts.defaultSort) lines.push(`  defaultSort: ${inlineJson(tOpts.defaultSort)},`)
  if (tOpts.refetchKeepPage !== undefined) lines.push(`  refetchKeepPage: ${tOpts.refetchKeepPage},`)
  if (tOpts.localPagination !== undefined) lines.push(`  localPagination: ${tOpts.localPagination},`)
  // 顶层 treeConfig（AI-09 子项③）→ options.treeConfig。手搓块逐键 q() 转义（同 configTableOut）。
  if (config.treeConfig) {
    const tcParts: string[] = []
    if (config.treeConfig.childrenField) tcParts.push(`childrenField: ${q(config.treeConfig.childrenField)}`)
    if (config.treeConfig.expandAll) tcParts.push(`expandAll: true`)
    lines.push(`  treeConfig: { ${tcParts.join(', ')} },`)
  }
  // 顶层 mergeConfig（AI-23）→ options.mergeConfig。rowsBy 是字符串数组（纯 JSON）→ inlineJson 序列化。
  if (config.mergeConfig) {
    lines.push(`  mergeConfig: ${inlineJson({ rowsBy: config.mergeConfig.rowsBy })},`)
  }
  lines.push(`}`)

  // delete handler
  if (hasDelete) {
    lines.push(``)
    lines.push(`function handleDelete(row${ts ? ': any' : ''}) {`)
    lines.push(...buildDeleteConfirmBlock({
      target,
      indent: '  ',
      bodyLines: [
        `await httpRequest({ url: \`${qBt(config.apiUrl)}/\${row${qMember(tOpts.rowkey || 'id')}}\`, method: 'DELETE' })`,
        `ElMessage.success('删除成功')`,
        `tableRef.value?.httpRequestInstance()`,
      ],
    }))
    lines.push(`}`)
  }

  // export/import handlers
  if (config.actions.includes('export')) {
    lines.push(``)
    lines.push(`function handleExport() {`)
    lines.push(`  window.open(\`${qBt(config.apiUrl)}/export?\${new URLSearchParams(queryForm as any).toString()}\`)`)
    lines.push(`}`)
  }
  if (config.actions.includes('import')) {
    lines.push(``)
    lines.push(`function handleImport() {`)
    lines.push(`  // Implement import dialog/upload logic`)
    lines.push(`}`)
  }

  // dialog form
  if (hasDialog) {
    lines.push(``)
    lines.push(`function openForm(title${ts ? ': string' : ''}, row${ts ? ': any' : ''} = {}) {`)
    const dialogModelInit = formFields.map(f => `${qKey(f.prop)}: ${getDefaultValue(f)}`).join(', ')
    // 当没有任何表单字段（全部 inForm:false）时 dialogModelInit 为空串，直接拼
    // `{ ${''}, ...row }` 会产出前导逗号 `reactive({ , ...row })` —— JS 语法错。
    // filter(Boolean) 剔除空段，保证 `reactive({ ...row })` 恒合法。
    const formInit = [dialogModelInit, '...row'].filter(Boolean).join(', ')
    lines.push(`  const formData = reactive({ ${formInit} })`)
    lines.push(`  const isView = title === '查看'`)
    lines.push(``)

    const dialogFormItemsJson = inlineJson(formFields.map(f => buildFormItem(f, 'form', config.i18n)), 4)
    lines.push(`  const dialogFormItems = ${dialogFormItemsJson}`)
    lines.push(``)

    lines.push(`  dialog({`)
    lines.push(`    title,`)
    lines.push(`    width: '560px',`)
    lines.push(`    render: (h, { registerRef }) => (`)
    lines.push(`      <EsForm`)
    lines.push(`        ref={el => el && registerRef('form', el)}`)
    lines.push(`        model={formData}`)
    lines.push(`        formItemList={dialogFormItems}`)
    lines.push(`        layoutFormProps={{ formLayProps: { labelWidth: '100px', isBtnHidden: true } }}`)
    lines.push(`      />`)
    lines.push(`    ),`)
    lines.push(`    configBtn: isView ? [`)
    lines.push(`      { name: '关闭', click: (_, { close }) => close() }`)
    lines.push(`    ] : [`)
    lines.push(`      { name: '取消', click: (_, { close }) => close() },`)
    lines.push(`      { name: '确定', type: 'primary', click: async (_, { close, getRefs }) => {`)
    lines.push(`        try {`)
    lines.push(`          await getRefs('form')?.validate()`)
    lines.push(`        } catch {`)
    lines.push(`          return // 表单校验未通过：用户需修正，静默中止`)
    lines.push(`        }`)
    lines.push(`        try {`)
    lines.push(`          const method = title === '新增' ? 'POST' : 'PUT'`)
    lines.push(`          const url = title === '新增' ? ${q(config.apiUrl)} : \`${qBt(config.apiUrl)}/\${formData${qMember(tOpts.rowkey || 'id')}}\``)
    lines.push(`          await httpRequest({ url, method, data: formData })`)
    lines.push(`          ElMessage.success(\`\${title}成功\`)`)
    lines.push(`          close()`)
    lines.push(`          tableRef.value?.httpRequestInstance()`)
    lines.push(`        } catch (err) {`)
    lines.push(`          ElMessage.error(\`\${title}失败\`) // 请求失败：弹错误提示并保持弹窗打开`)
    lines.push(`        }`)
    lines.push(`      }}`)
    lines.push(`    ]`)
    lines.push(`  })`)
    lines.push(`}`)
  }

  // Vue 2 模式：闭合 setup() 并把所有顶层声明 return 出去
  if (isVue2) {
    const exposedNames: string[] = ['queryForm', 'formItems', 'queryBtns', 'tableRef', 'tableData', 'pagination', 'columns', 'options']
    if (hasDialog) exposedNames.push('dialog', 'openForm')
    if (hasDelete) exposedNames.push('handleDelete')
    if (config.actions.includes('export')) exposedNames.push('handleExport')
    if (config.actions.includes('import')) exposedNames.push('handleImport')
    lines.push(``)
    lines.push(`    return { ${exposedNames.join(', ')} }`)
    lines.push(`  }`)
    lines.push(`})`)

    // 给 setup 体内的语句加 4 空格缩进（除 export default 之前的 import / 模板部分）
    // 此处不做缩进改写，因为模板字符串生成时 setup() 体本身不带缩进，
    // Vue 2 setup() 中的代码缩进等价于 Vue 3 顶层代码——babel/typescript 不强制缩进，
    // 仅风格上略不一致，保留原样以减少改造面。
  }

  lines.push(`</script>`)

  let code = lines.join('\n')

  // 目标 UI 库命名替换：ElMessage/ElMessageBox/ElTag → 对应命名
  // （antdv 的 ElMessageBox 结构差异已由 buildDeleteConfirmBlock 处理，此处仅收尾标识符）
  code = rewriteElementUsage(code, target)

  const summary = [
    `Generated full SFC (structured mode, target=${target}):`,
    `- ${queryFields.length} query fields, ${tableFields.length} table columns, ${formFields.length} dialog fields`,
    `- Actions: ${config.actions.join(', ')}`,
    `- API: ${config.apiUrl}`,
    config.typescript ? '- TypeScript enabled' : '',
    config.permissions ? '- Permissions configured' : '',
    isVue2
      ? '- Target: Vue 2 + Element UI (@es-plus/vue2). JSX render needs @vue/babel-preset-jsx.'
      : target === 'antdv'
        ? '- Target: Vue 3 + Ant Design Vue (@es-plus/adapter-antdv)'
        : '- Target: Vue 3 + Element Plus (@es-plus/vue3)',
  ].filter(Boolean).join('\n')

  return { code, summary, warnings }
}

function buildSchemaWrapper(config: StructuredCrudConfig, hasDelete: boolean, _hasDialog: boolean, renderFields: FieldConfig[], target: TargetFramework): string {
  const ts = config.typescript
  const isVue2 = target === 'vue2'
  const esPlusPkg = getEsPlusPackageName(target)
  const tOpts: TableOpts = (config.tableOptions || {}) as TableOpts
  const lines: string[] = []

  lines.push(`<template>`)
  lines.push(`  <es-crud-page`)
  lines.push(`    ref="crudRef"`)
  lines.push(`    :schema="pageSchema"`)
  lines.push(`    :http-request="fetchData"`)
  if (hasDelete) lines.push(`    @delete="handleDelete"`)
  lines.push(`    @btn-click="handleBtnClick"`)
  lines.push(`  >`)
  if (renderFields.length > 0) {
    for (const f of renderFields) {
      // Vue 2.6+ scoped slot 在模板中也用 #name="..."，与 Vue 3 写法兼容
      lines.push(...buildExtensionPointSlotLines(f, target))
    }
  }
  lines.push(...buildFormFaceRenderPlaceholderLines(config, '    ', { includeDialogs: true }))
  lines.push(`  </es-crud-page>`)
  lines.push(`</template>`)
  lines.push(``)

  // Script 头：Vue 3 用 <script setup>，Vue 2 用 defineComponent
  if (isVue2) {
    lines.push(ts ? `<script lang="ts">` : `<script>`)
    lines.push(`import { defineComponent, ref } from 'vue'`)
  } else {
    lines.push(ts ? `<script setup lang="ts">` : `<script setup>`)
    lines.push(`import { ref } from 'vue'`)
  }

  const epImports: string[] = []
  if (hasDelete) epImports.push('ElMessageBox', 'ElMessage')
  else epImports.push('ElMessage')
  lines.push(buildElementImport([...new Set(epImports)], target))

  // 全局 HTTP 请求自由函数（方案B）：fetchData / 增删改共用同一请求实例
  lines.push(`import { httpRequest } from '${esPlusPkg}'`)
  lines.push(`import { pageSchema } from './schema'`)
  lines.push(``)

  // Vue 2: 包一层 defineComponent
  if (isVue2) {
    lines.push(`export default defineComponent({`)
    lines.push(`  setup() {`)
  }

  // 共享业务体（Vue 2 / Vue 3 一致；命名差异通过最终的字符串替换处理）
  const indent = isVue2 ? '    ' : ''
  const body: string[] = []
  body.push(`${indent}const crudRef = ref(null)`)
  body.push(``)
  body.push(`${indent}async function fetchData(params${ts ? ': any' : ''}) {`)
  body.push(`${indent}  const res = await httpRequest({`)
  body.push(`${indent}    url: ${q(config.apiUrl)},`)
  body.push(`${indent}    method: 'GET',`)
  body.push(`${indent}    params: { ...params.formParams, pageIndex: params.pageIndex, pageSize: params.pageSize }`)
  body.push(`${indent}  })`)
  body.push(`${indent}  return res`)
  body.push(`${indent}}`)

  if (hasDelete) {
    body.push(``)
    body.push(`${indent}function handleDelete(row${ts ? ': any' : ''}) {`)
    body.push(...buildDeleteConfirmBlock({
      target,
      indent: `${indent}  `,
      bodyLines: [
        `await httpRequest({ url: \`${qBt(config.apiUrl)}/\${row${qMember(tOpts.rowkey || 'id')}}\`, method: 'DELETE' })`,
        `ElMessage.success('删除成功')`,
        isVue2 ? 'crudRef.value && crudRef.value.refresh && crudRef.value.refresh()' : 'crudRef.value?.refresh()',
      ],
    }))
    body.push(`${indent}}`)
  }

  body.push(``)
  body.push(`${indent}function handleBtnClick(key${ts ? ': string' : ''}, data${ts ? ': any' : ''}) {`)
  if (config.actions.includes('add')) {
    body.push(`${indent}  if (key === '${CRUD_PAGE_BTN_CLICK_KEYS.ADD_CONFIRM}') {`)
    body.push(`${indent}    httpRequest({ url: ${q(config.apiUrl)}, method: 'POST', data }).then(() => {`)
    body.push(`${indent}      ElMessage.success('新增成功')`)
    body.push(`${indent}      ${isVue2 ? 'crudRef.value && crudRef.value.refresh && crudRef.value.refresh()' : 'crudRef.value?.refresh()'}`)
    body.push(`${indent}    }).catch(() => {`)
    body.push(`${indent}      ElMessage.error('新增失败')`)
    body.push(`${indent}    })`)
    body.push(`${indent}  }`)
  }
  if (config.actions.includes('edit')) {
    body.push(`${indent}  if (key === '${CRUD_PAGE_BTN_CLICK_KEYS.EDIT_CONFIRM}') {`)
    body.push(`${indent}    httpRequest({ url: \`${qBt(config.apiUrl)}/\${data${qMember(tOpts.rowkey || 'id')}}\`, method: 'PUT', data }).then(() => {`)
    body.push(`${indent}      ElMessage.success('编辑成功')`)
    body.push(`${indent}      ${isVue2 ? 'crudRef.value && crudRef.value.refresh && crudRef.value.refresh()' : 'crudRef.value?.refresh()'}`)
    body.push(`${indent}    }).catch(() => {`)
    body.push(`${indent}      ElMessage.error('编辑失败')`)
    body.push(`${indent}    })`)
    body.push(`${indent}  }`)
  }
  body.push(`${indent}}`)

  lines.push(...body)

  if (isVue2) {
    const exposed = ['crudRef', 'fetchData', 'handleBtnClick']
    if (hasDelete) exposed.splice(2, 0, 'handleDelete')
    lines.push(``)
    lines.push(`    return { ${exposed.join(', ')} }`)
    lines.push(`  }`)
    lines.push(`})`)
  }

  lines.push(`</script>`)

  let code = lines.join('\n')
  // 目标 UI 库命名替换（antdv 的 ElMessageBox 结构差异已由 buildDeleteConfirmBlock 处理）
  code = rewriteElementUsage(code, target)
  return code
}

function buildSchemaWrapperNew(config: StructuredCrudConfig, renderFields: FieldConfig[], warnings: string[], target: TargetFramework): string {
  const ts = config.typescript
  const isVue2 = target === 'vue2'
  const esPlusPkg = getEsPlusPackageName(target)
  const tOpts: TableOpts = (config.tableOptions || {}) as TableOpts
  const lines: string[] = []
  const hasDelete = config.actions.includes('delete')
  const dialogs = config.dialogs || {}
  const customRenderDialogs = Object.entries(dialogs).filter(([, d]) => d.hasCustomRender)

  lines.push(`<template>`)
  lines.push(`  <es-crud-page`)
  lines.push(`    ref="crudRef"`)
  lines.push(`    :schema="pageSchema"`)
  lines.push(`    :http-request="fetchData"`)
  if (hasDelete) lines.push(`    @delete="handleDelete"`)
  lines.push(`    @dialog-confirm="handleDialogConfirm"`)
  lines.push(`    @btn-click="handleBtnClick"`)
  lines.push(`  >`)
  if (renderFields.length > 0) {
    for (const f of renderFields) {
      lines.push(...buildExtensionPointSlotLines(f, target))
    }
  }
  lines.push(...buildFormFaceRenderPlaceholderLines(config, '    ', { includeDialogs: true }))
  lines.push(`  </es-crud-page>`)
  lines.push(`</template>`)
  lines.push(``)

  // Script 头：Vue 3 用 <script setup>，Vue 2 用 defineComponent + setup()
  if (isVue2) {
    lines.push(ts ? `<script lang="ts">` : `<script>`)
    lines.push(`import { defineComponent, ref } from 'vue'`)
  } else {
    lines.push(ts ? `<script setup lang="ts">` : `<script setup>`)
    lines.push(`import { ref } from 'vue'`)
  }

  const epImports: string[] = []
  if (hasDelete) epImports.push('ElMessageBox', 'ElMessage')
  else epImports.push('ElMessage')
  // 使用 buildElementImport 自动适配命名（ElMessage → Message 等）和包名
  lines.push(buildElementImport([...new Set(epImports)], target))
  // 全局 HTTP 请求自由函数（方案B）：fetchData / 弹窗确认 / 删除共用同一请求实例
  lines.push(`import { httpRequest } from '${esPlusPkg}'`)
  lines.push(`import { pageSchema } from './schema'`)
  lines.push(``)

  // Vue 2: 包一层 defineComponent({ setup() {
  if (isVue2) {
    lines.push(`export default defineComponent({`)
    lines.push(`  setup() {`)
  }

  // 业务体：Vue 2 模式下整体加 4 空格缩进作为 setup() 函数体内容
  // 命名差异（ElMessageBox/ElMessage）通过末尾的字符串替换处理
  const indent = isVue2 ? '    ' : ''
  const refreshExpr = isVue2 ? 'crudRef.value && crudRef.value.refresh && crudRef.value.refresh()' : 'crudRef.value?.refresh()'
  const body: string[] = []

  body.push(`${indent}const crudRef = ref(null)`)
  body.push(``)

  // fetchData
  body.push(`${indent}async function fetchData(params${ts ? ': any' : ''}) {`)
  body.push(`${indent}  const res = await httpRequest({`)
  body.push(`${indent}    url: ${q(config.apiUrl)},`)
  body.push(`${indent}    method: 'GET',`)
  body.push(`${indent}    params: { ...params.formParams, pageIndex: params.pageIndex, pageSize: params.pageSize }`)
  body.push(`${indent}  })`)
  body.push(`${indent}  return res`)
  body.push(`${indent}}`)

  // delete handler
  if (hasDelete) {
    body.push(``)
    body.push(`${indent}function handleDelete(row${ts ? ': any' : ''}) {`)
    body.push(...buildDeleteConfirmBlock({
      target,
      indent: `${indent}  `,
      bodyLines: [
        `await httpRequest({ url: \`${qBt(config.apiUrl)}/\${row${qMember(tOpts.rowkey || 'id')}}\`, method: 'DELETE' })`,
        `ElMessage.success('删除成功')`,
        refreshExpr,
      ],
    }))
    body.push(`${indent}}`)
  }

  // dialog-confirm handler
  body.push(``)
  body.push(`${indent}function handleDialogConfirm(dialogKey${ts ? ': string' : ''}, data${ts ? ': any' : ''}) {`)
  const dialogEntries = Object.entries(dialogs).filter(([, d]) => !d.hasCustomRender)
  for (const [key] of dialogEntries) {
    const method = key === 'add' ? 'POST' : 'PUT'
    const url = key === 'add' ? `${q(config.apiUrl)}` : `\`${qBt(config.apiUrl)}/\${data${qMember(tOpts.rowkey || 'id')}}\``
    body.push(`${indent}  if (dialogKey === ${q(key)}) {`)
    body.push(`${indent}    httpRequest({ url: ${url}, method: '${method}', data }).then(() => {`)
    body.push(`${indent}      ElMessage.success('操作成功')`)
    body.push(`${indent}      ${refreshExpr}`)
    body.push(`${indent}    }).catch(() => {`)
    body.push(`${indent}      ElMessage.error('操作失败')`)
    body.push(`${indent}    })`)
    body.push(`${indent}  }`)
  }
  body.push(`${indent}}`)

  // btn-click handler (for non-dialog actions like export)
  body.push(``)
  body.push(`${indent}function handleBtnClick(key${ts ? ': string' : ''}, payload${ts ? '?: any' : ''}) {`)
  if (config.actions.includes('export')) {
    body.push(`${indent}  if (key === 'export') {`)
    body.push(`${indent}    window.open(\`${qBt(config.apiUrl)}/export?\${new URLSearchParams(payload || {}).toString()}\`)`)
    body.push(`${indent}  }`)
  }
  body.push(`${indent}}`)

  // Custom render dialog placeholders
  if (customRenderDialogs.length > 0) {
    body.push(``)
    body.push(`${indent}// Custom render dialogs — implement in pageSchema.dialogs[key].render`)
    for (const [key] of customRenderDialogs) {
      body.push(`${indent}// Dialog "${sanitizeForComment(key)}" uses custom render — configure in schema or override via openDialog`)
    }
  }

  lines.push(...body)

  // Vue 2: 闭合 setup() 并把所有顶层声明 return 出去
  if (isVue2) {
    const exposed = ['crudRef', 'fetchData', 'handleDialogConfirm', 'handleBtnClick']
    if (hasDelete) exposed.splice(2, 0, 'handleDelete')
    lines.push(``)
    lines.push(`    return { ${exposed.join(', ')} }`)
    lines.push(`  }`)
    lines.push(`})`)
  }

  lines.push(`</script>`)

  let code = lines.join('\n')
  // 目标 UI 库命名替换（antdv 的 ElMessageBox 结构差异已由 buildDeleteConfirmBlock 处理）
  code = rewriteElementUsage(code, target)
  return code
}

/**
 * 表单面的 render（AI-31①）。`buildFormItem` 此前**没有** render 分支 —— 文档站 demo 07/13
 * 「表单里的 render」经 AI 入口声明后，schema / SFC 两种模式下都**静默**退化成默认控件。
 *
 * 判定只收「**表格面够不着**的 render」：`inTable === false` 且参与查询/表单面，以及弹窗
 * `formItems` 自带的 render。`FieldConfig.render` 是**单一**字段级扩展点，而表格列在用它
 * （15 个 render 语料皆是）时其源码本就是单元格签名 `(_, { row })`，把它顺带喂给表单控件
 * 是**语义错位** —— 那些字段既不告警也不发射，正是本节只收「表格面够不着」的原因。
 *
 * 为什么只标记不发射（源码论证，非「偷懒」）：两条独立的硬事实各自都足以否决「注入」——
 *   1. **载体不够**：两种模式的表单项都是 **JSON 数据**（schema 的 `pageSchema.formItems`、
 *      SFC 内联的 `const formItems` / `const dialogFormItems`），JSON 载不动函数。
 *   2. **签名与调用点都不对**：即使硬塞进去也不会被调用。`es-form.vue` 的 `RenderDomForm`
 *      调用约定是 `props.render?.(h, model, { row, index })`（`es-form.vue:678`），与表格
 *      单元格的 `(h, { row })` 不同形；更关键的是它**只在 `v-else` 分支被读**
 *      （`es-form.vue:16-21`：有 `formtype` 走 `formInputComponents(item)`，无 `formtype` 才
 *      用 `item.render`），而 `buildFormItem` **恒**写 `formtype`（`:1127`）。即注入的 render
 *      是一段**永不可达**的死代码 —— 那才是真正的「假修复」。
 * 故与本文件 `formatter` 的降级同规：发含源码的告警 + 在产物里落 `TODO(es-plus)` 注释占位
 * —— **标记而非丢弃**。手工接线时需同时**去掉该项的 `formtype`**，render 才会被 `es-form` 调用。
 */
function collectFormFaceRenderFields(
  config: StructuredCrudConfig,
  opts: { includeDialogs?: boolean } = {}
): FieldConfig[] {
  const out: FieldConfig[] = []
  const seen = new Set<string>()
  const add = (f: FieldConfig | undefined) => {
    if (f && f.render && f.prop && !seen.has(f.prop)) {
      seen.add(f.prop)
      out.push(f)
    }
  }
  for (const f of config.fields) {
    if (f.inTable === false && (f.inQuery !== false || f.inForm !== false)) add(f)
  }
  // 新式 dialogs 的 formItems：**schema 模式**要收（弹窗表单项在 schema 里同样载不动函数）；
  // **SFC 模式**不收 —— 那里整个 dialogs 已被 ignoredInSfc 整体告警（见 generateSFC），
  // 再报一次表单面的 render 只会重复同一件事。
  if (opts.includeDialogs) {
    for (const d of Object.values(config.dialogs ?? {})) {
      for (const f of (d as { formItems?: FieldConfig[] }).formItems ?? []) add(f)
    }
  }
  return out
}

/** 表单面 render 的降级告警文案（无此类字段则 null）；两种模式共用，避免各写一份而分叉。 */
function formFaceRenderWarning(
  config: StructuredCrudConfig,
  opts: { includeDialogs?: boolean } = {}
): string | null {
  const fields = collectFormFaceRenderFields(config, opts)
  if (!fields.length) return null
  const hints = fields.map((f) => `"${f.prop}": ${sanitizeForComment(String(f.render))}`).join('; ')
  return (
    `A form-item render function cannot be inlined (form items are serialized as JSON data in both modes, and the form-control render signature differs from a table cell's). ` +
    `Fields [${fields.map((f) => f.prop).join(', ')}] will fall back to the default control; a \`TODO(es-plus)\` marker is written into the generated SFC. ` +
    `Original renders: ${hints}. The requirement is marked, not silently dropped.`
  )
}

/** 上述标记在产物里的落点：纯注释，零运行时面。`dialect` 决定注释语法（模板 vs `<script>`）。 */
function buildFormFaceRenderPlaceholderLines(
  config: StructuredCrudConfig,
  indent: string,
  opts: { includeDialogs?: boolean; dialect?: 'html' | 'js' } = {}
): string[] {
  const fields = collectFormFaceRenderFields(config, opts)
  if (!fields.length) return []
  const js = opts.dialect === 'js'
  const head = js ? '//' : '<!--'
  const tail = js ? '' : ' -->'
  const lines = [`${indent}${head} TODO(es-plus): form-item render requested but not emittable (AI-31①) — wire these in a wrapper (drop the item's \`formtype\`, es-form only calls item.render when formtype is absent):${tail}`]
  for (const f of fields) {
    lines.push(`${indent}${head}   "${sanitizeForComment(String(f.prop))}": ${sanitizeForComment(String(f.render))}${tail}`)
  }
  return lines
}

function buildExtensionPointSlotLines(field: FieldConfig, target: TargetFramework): string[] {
  // 优雅降级契约（WS-5）：schema 模式无法内联 render 函数。与其静默丢弃需求，
  // 生成一个带 TODO(es-plus) 标记的扩展点插槽，并把用户原始的 render 意图作为
  // 注释回显——占位内容是可编译的默认状态标签，等待开发者替换为真实标记。
  const lines: string[] = []
  // prop 落在这里是 **HTML 属性值** 位置（#column-xxx 插槽名），q()/qBt() 都放行 `"`，
  // 必须走 qAttr：实测 prop 含 `"@mouseover="` 会凭空注入一个 HTML 事件属性。
  lines.push(`    <template #column-${qAttr(field.prop)}="{ row }">`)
  lines.push(`      <!-- TODO(es-plus): custom render for "${sanitizeForComment(String(field.label))}" — replace this default stub with your markup. -->`)
  if (field.render) {
    lines.push(`      <!-- requested render: ${sanitizeForComment(field.render)} -->`)
  }
  lines.push(...buildStatusTagTemplate({ target, prop: field.prop, indent: '      ' }))
  lines.push(`    </template>`)
  return lines
}

// 转义器已提到 codegen-escape.ts 单源 —— 本包 4 处生成代码共用同一份实现。
// `formatter`/`render` 是源码扩展点（函数源码串），刻意不经转义。

export function buildFormItem(field: FieldConfig, context: 'query' | 'form', i18n?: boolean): Record<string, unknown> {
  const item: Record<string, unknown> = {
    prop: field.prop,
    // labelKey 优先序（AI-22）：字段级显式 labelKey → i18n 派生的 `field.<prop>` → label。
    ...(field.labelKey ? { labelKey: field.labelKey } : i18n ? { labelKey: `field.${field.prop}` } : { label: field.label }),
    formtype: field.formtype,
    span: context === 'query'
      ? (field.querySpan || (field.formtype === 'DatePicker' || field.formtype === 'TimePicker' ? 8 : 6))
      : (field.formSpan || 24),
    attrs: { clearable: true, ...(field.attrs || {}) },
  }

  if (field.dataOptions) item.dataOptions = field.dataOptions
  if (field.apiParams) item.apiParams = field.apiParams
  // 字段级权限编码：字符串，可直接进 schema 模式 JSON；运行时由 es-form 的 formItemListFilter
  // 按全局 permission(code) 过滤（无权限则整个表单项不渲染）。按钮级 permissions 是另一回事。
  if (field.permissionValue) item.permissionValue = field.permissionValue
  // 声明式显隐条件：**纯 JSON 数据**（非 JS 函数），可直接内联进 schema 模式的 pageSchema
  // （SFC 模式同样经 inlineJson 序列化 formItems），故此处两种模式共用一个 emit 点。
  // 运行时由 core `normalizeFormItem` 编译为谓词（三端 formItemListFilter 照旧调用 isHidden）。
  // 只作用于 query / 弹窗表单（buildFormItem 的两个 context），**不进**表格列（buildTableColumn）。
  if (field.isHidden) item.isHidden = field.isHidden
  // 字段联动（AI-07）：**纯 JSON 数据**（非 JS 回调）—— dependencies/when/fulfill 全是可
  // JSON 化的表达式节点与字面量选项数组，schema 模式直接内联、SFC 模式随 inlineJson 序列化，
  // 故两种模式共用同一 emit 点（同 isHidden，无需降级分支）。同样只作用于 query / 弹窗表单，
  // **不进**表格列（buildTableColumn 不处理 reactions）。
  if (field.reactions) item.reactions = field.reactions

  if (context === 'form') {
    const rules: any[] = []
    if (field.required) {
      const isSelectType = ['Select', 'Radio', 'Checkbox', 'Cascader', 'DatePicker', 'TimePicker', 'Switch'].includes(field.formtype)
      rules.push({
        required: true,
        message: `请${isSelectType ? '选择' : '输入'}${field.label}`,
        trigger: isSelectType ? 'change' : 'blur',
      })
    }
    if (field.rules) {
      for (const r of field.rules) {
        const rule: any = { message: r.message }
        if (r.required) rule.required = true
        if (r.pattern) rule.pattern = r.pattern
        if (r.min !== undefined) rule.min = r.min
        if (r.max !== undefined) rule.max = r.max
        if (r.type) rule.type = r.type
        if (r.trigger) rule.trigger = r.trigger
        rules.push(rule)
      }
    }
    if (rules.length > 0) {
      item.formItemOptions = { rules }
    }
  }

  return item
}

/**
 * AI-09 子项②：把顶层声明式 `expandConfig` 落到展开列上（schema 模式）。
 *
 * 语义：`expandConfig` 一旦给出，表格就必须**恰好有一个**行展开器。
 * - 若 columns 里已有 `type:'expand'` 列 → 内容挂到它（位置保留）。
 * - 否则前置一个 `{ type:'expand', expandConfig }`（展开列与数据列正交，不破坏
 *   `columns` 的 override 语义）。
 *
 * 「mark, never drop」的边界：vxe / virtual 引擎不消费列上的声明式展开内容
 * （vxe 走插槽、el-table-v2 无 detail row），此时发**降级告警**而非静默——数据仍保留。
 */
function applyExpandConfig(
  columns: Array<Record<string, unknown>>,
  config: StructuredCrudConfig,
  warnings: string[],
): Array<Record<string, unknown>> {
  const ec = config.expandConfig
  if (!ec) return columns
  const engine = (config.tableOptions as Record<string, unknown> | undefined)?.engine
  if (engine === 'vxe') {
    warnings.push('expandConfig 的声明式展开内容不会被 vxe 引擎渲染（vxe 展开内容走插槽）——数据已保留，但需宿主提供 expand 插槽或改用默认引擎。')
  } else if (engine === 'virtual' || (config.tableOptions as Record<string, unknown> | undefined)?.virtual) {
    warnings.push('expandConfig 的声明式展开内容不会被虚拟滚动引擎渲染（el-table-v2 无 detail row）——数据已保留，但需改用默认引擎。')
  }
  const out = columns.map((c) => ({ ...c }))
  const idx = out.findIndex((c) => c.type === 'expand')
  if (idx >= 0) out[idx] = { ...out[idx], expandConfig: ec }
  else out.unshift({ type: 'expand', expandConfig: ec })
  return out
}

export function buildTableColumn(field: FieldConfig, i18n?: boolean): Record<string, unknown> {
  const col: Record<string, unknown> = {
    prop: field.prop,
    // labelKey 优先序（AI-22）：字段级显式 labelKey → i18n 派生的 `field.<prop>` → label。
    ...(field.labelKey ? { labelKey: field.labelKey } : i18n ? { labelKey: `field.${field.prop}` } : { label: field.label }),
  }
  if (field.width) col.width = field.width
  if (field.minWidth) col.minWidth = field.minWidth
  if (field.align) col.align = field.align
  if (field.fixed) col.fixed = field.fixed
  if (field.ellipsis) col.showOverflowTooltip = true
  // Schema mode cannot inline render expressions, so the wrapper emits a
  // `<template #column-<prop>>` scoped slot. es-table (all three renderers)
  // only renders that slot when the column declares scopedSlots.customRender,
  // so wire it up here — otherwise the emitted template is dead code.
  if (field.render) col.scopedSlots = { customRender: `column-${field.prop}` }
  // 字段级权限编码：字符串，可直接进 schema 模式 JSON；运行时由 es-table 的 filteredColumns
  // 按全局 permission(code) 过滤（无权限则该列不渲染）。与静态 hidCol 同层。
  if (field.permissionValue) col.permissionValue = field.permissionValue
  return col
}

/**
 * 递归发射一个显式列（`config.columns` 元素）为 SFC 对象字面量。
 *
 * `groups` 自指递归 → 多级表头。只发结构化属性：字符串一律经 `q()` 转义、
 * 数字/px 经 `numOrStr()`，因此数据字段永远不会变成可执行 JS（与 `buildTableColumnSFC`
 * 同一条防线）。**刻意不发 `render`/`formatter`**：显式列是结构化路径，自定义单元格
 * 仍走字段级扩展点（`FieldConfig.render`/`formatter`，那两处才有源码闸）。
 *
 * 键顺序固定为「标识 → 尺寸 → 行为 → 权限 → 嵌套」，与派生列风格一致；缺省键一律省略，
 * 产物可读。`type`/`ellipsis`/`groups` 均按渲染契约原名发射（vue3/vue2 `column-item.vue`
 * 直接读 `type`（原生透传）与 `ellipsis`（:57），不读 `showOverflowTooltip`——派生路径
 * 把它规范成 el-table 原生 prop 是另一条路，显式列按用户所写原样保留）。
 */
function pushSfcColumn(
  col: Record<string, unknown>,
  lines: string[],
  indent: string,
  warnings: string[],
): void {
  const inner = `${indent}  `
  lines.push(`${indent}{`)
  const str = (k: string) => {
    if (col[k] !== undefined) lines.push(`${inner}${k}: ${q(String(col[k]))},`)
  }
  const num = (k: string) => {
    if (col[k] !== undefined) lines.push(`${inner}${k}: ${numOrStr(col[k] as string | number)},`)
  }
  const bool = (k: string) => {
    if (col[k] !== undefined) lines.push(`${inner}${k}: ${col[k] === true},`)
  }
  str('prop')
  str('label')
  str('labelKey')
  str('type')
  str('align')
  if (col.fixed !== undefined) {
    lines.push(`${inner}fixed: ${typeof col.fixed === 'boolean' ? col.fixed : q(String(col.fixed))},`)
  }
  num('width')
  num('minWidth')
  bool('sortable')
  bool('ellipsis')
  bool('showOverflowTooltip')
  str('permissionValue')
  if (Array.isArray(col.groups) && col.groups.length > 0) {
    lines.push(`${inner}groups: [`)
    for (const g of col.groups as Array<Record<string, unknown>>) {
      pushSfcColumn(g, lines, `${inner}  `, warnings)
    }
    lines.push(`${inner}],`)
  }
  // btns 是数据显示（name/type/permissionValue），不是源码扩展点 → 用 JSON 序列化。
  // 含函数等不可序列化值时省略 + 告警，保持「发射的永远能编译」。
  if (Array.isArray(col.btns) && col.btns.length > 0) {
    let serialized: string | null = null
    try {
      serialized = JSON.stringify(col.btns)
    } catch {
      serialized = null
    }
    if (serialized !== null) lines.push(`${inner}btns: ${serialized},`)
    else warnings.push('显式 columns 里的 btns 含无法序列化的值（如函数），已省略以保证编译通过。')
  }
  // expandConfig（AI-09 子项②）是纯 JSON 数据（title/fields 字段明细）→ 同 btns 用 JSON 序列化。
  if (col.expandConfig !== undefined && col.expandConfig !== null) {
    let serialized: string | null = null
    try {
      serialized = JSON.stringify(col.expandConfig)
    } catch {
      serialized = null
    }
    if (serialized !== null) lines.push(`${inner}expandConfig: ${serialized},`)
    else warnings.push('行展开 expandConfig 含无法序列化的值，已省略以保证编译通过。')
  }
  // editRender（AI-09 子项④）→ 列级行内编辑器，纯 JSON 数据 → 同 btns/expandConfig 用 JSON 序列化。
  // 含函数等不可序列化值时省略 + 告警，保持「发射的永远能编译」。
  if (col.editRender !== undefined && col.editRender !== null) {
    let serialized: string | null = null
    try {
      serialized = JSON.stringify(col.editRender)
    } catch {
      serialized = null
    }
    if (serialized !== null) lines.push(`${inner}editRender: ${serialized},`)
    else warnings.push('列级行内编辑器 editRender 含无法序列化的值，已省略以保证编译通过。')
  }
  lines.push(`${indent}},`)
}

export function buildTableColumnSFC(field: FieldConfig, config: StructuredCrudConfig, warnings?: string[]): string {
  const parts: string[] = []
  parts.push(`prop: ${q(field.prop)}`)
  // i18n 模式与 schema 模式（buildTableColumn/buildFormItem）统一走 labelKey：
  // es-table 内部按 labelKey 解析 i18n 文案。绝不能内联 `label: '${t('...')}'` ——
  // 内层单引号会截断外层字符串（编译失败），且 SFC 从不 import/定义 t。
  if (field.labelKey) {
    // 字段级显式 labelKey 优先（AI-22）。
    parts.push(`labelKey: ${q(field.labelKey)}`)
  } else if (config.i18n) {
    parts.push(`labelKey: ${q(`field.${field.prop}`)}`)
  } else {
    parts.push(`label: ${q(field.label)}`)
  }
  // width/minWidth/align/fixed 此前是手写裸拼（`'${field.width}'`），未复用本文件
  // 已有的转义器 —— 实测 width 传 `20' + (1) + '` 会生成
  // `width: '20' + (1) + '',`，把数据字段变成可执行 JS。numOrStr/q 对正常值
  // （数字、'20px'、'left'）的输出与原先逐字节相同，仅注入场景才变。
  if (field.width) parts.push(`width: ${numOrStr(field.width)}`)
  if (field.minWidth) parts.push(`minWidth: ${numOrStr(field.minWidth)}`)
  if (field.align) parts.push(`align: ${q(field.align)}`)
  if (field.fixed) parts.push(`fixed: ${typeof field.fixed === 'boolean' ? field.fixed : q(field.fixed)}`)
  if (field.ellipsis) parts.push(`showOverflowTooltip: true`)
  // 字段级权限编码：字符串权限码（非表达式），经 q() 转义后内联 —— 运行时由 es-table 的
  // filteredColumns 按全局 permission(code) 过滤（无权限则该列不渲染）。刻意不过 assertEmittableExpr：
  // 它是权限码不是 JS 源码。与静态 hidCol 同层。
  if (field.permissionValue) parts.push(`permissionValue: ${q(field.permissionValue)}`)
  // formatter/render 是源码扩展点，原样内联。发射前过语法闸（assertEmittableExpr）：
  // 畸形字符串内联进对象字面量会让整个 SFC 编译失败，而本函数不抛错 —— 坏码会静默
  // 产出。闸不过就**省略该扩展点 + 降级告警**（与 schema 模式「emit unformatted + warn」
  // 一致），于是「发射的东西永远能编译」成为结构性保证。
  if (field.formatter) {
    if (assertEmittableExpr(field.formatter)) {
      parts.push(`formatter: ${field.formatter}`)
    } else {
      warnings?.push(`Field "${field.prop}" 的 formatter 不是合法的 JS/TS 表达式，已省略以保证编译通过（原文：${sanitizeForComment(field.formatter)}）。请修正后手动补回。`)
    }
  }
  if (field.render) {
    if (assertEmittableExpr(field.render)) {
      parts.push(`render: ${field.render}`)
    } else {
      warnings?.push(`Field "${field.prop}" 的 render 不是合法的 JS/TS 表达式，已省略以保证编译通过（原文：${sanitizeForComment(field.render)}）。请修正后手动补回。`)
    }
  }
  return `{ ${parts.join(', ')} }`
}

export function buildActionBtns(config: StructuredCrudConfig): string[] {
  const btns: string[] = []
  if (config.actions.includes('view')) {
    const perm = config.permissions?.view ? `, permissionValue: ${q(config.permissions.view)}` : ''
    btns.push(`{ name: '查看', type: 'primary', clickEvent: (row) => openForm('查看', row)${perm} }`)
  }
  if (config.actions.includes('edit')) {
    const perm = config.permissions?.edit ? `, permissionValue: ${q(config.permissions.edit)}` : ''
    btns.push(`{ name: '编辑', type: 'primary', clickEvent: (row) => openForm('编辑', row)${perm} }`)
  }
  if (config.actions.includes('delete')) {
    const perm = config.permissions?.delete ? `, permissionValue: ${q(config.permissions.delete)}` : ''
    btns.push(`{ name: '删除', type: 'danger', clickEvent: (row) => handleDelete(row)${perm} }`)
  }
  return btns
}

export function inferTsType(field: FieldConfig): string {
  switch (field.formtype) {
    case 'Switch': return 'boolean'
    case 'InputNumber': return 'number | null'
    case 'Rate':
    case 'Slider': return 'number'
    case 'Checkbox':
    case 'Transfer': return 'any[]'
    case 'Cascader': return 'any[]'
    case 'DatePicker':
    case 'TimePicker':
      return field.attrs?.type?.toString().includes('range') ? 'string[]' : 'string'
    case 'Select':
      return "string | number | ''"
    default: return 'string'
  }
}

export function getDefaultValue(field: FieldConfig): string {
  switch (field.formtype) {
    case 'Switch': return 'false'
    case 'InputNumber': return 'null'
    case 'Rate':
    case 'Slider': return '0'
    case 'Checkbox':
    case 'Transfer':
    case 'Cascader': return '[]'
    case 'DatePicker':
    case 'TimePicker':
      return field.attrs?.type?.toString().includes('range') ? '[]' : "''"
    default: return "''"
  }
}
