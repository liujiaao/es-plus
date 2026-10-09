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

export function generateFromConfig(config: StructuredCrudConfig): StructuredGenerateResult {
  assertValidConfig(config)
  const mode = config.mode || 'schema'
  const result = mode === 'sfc' ? generateSFC(config) : generateSchema(config)
  // 只在这一处汇总跨模式的通用提示，避免两个模式各写一遍而分叉。
  const propWarnings = warnNonIdentifierProps(config)
  if (propWarnings.length) {
    return { ...result, warnings: [...propWarnings, ...(result.warnings || [])] }
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

  const schema: Record<string, unknown> = {}

  if (queryFields.length > 0) {
    schema.formItems = queryFields.map(f => buildFormItem(f, 'query', config.i18n))
  }

  schema.columns = tableFields.map(f => buildTableColumn(f, config.i18n))

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

  const lines: string[] = []

  // Template
  lines.push(`<template>`)
  lines.push(`  <es-table`)
  lines.push(`    ref="tableRef"`)
  lines.push(`    :columns="columns"`)
  lines.push(`    :options="options"`)
  if (isVue2) {
    lines.push(`    :data-source.sync="tableData"`)
    lines.push(`    :pagination.sync="pagination"`)
  } else {
    lines.push(`    v-model:data-source="tableData"`)
    lines.push(`    v-model:pagination="pagination"`)
  }
  lines.push(`  >`)
  lines.push(`    <es-form :model="queryForm" :form-item-list="formItems" :config-btn="queryBtns" />`)
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
  lines.push(`const formItems = ${formItemsJson}`)
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
  for (const f of tableFields) {
    const col = buildTableColumnSFC(f, config)
    lines.push(`  ${col},`)
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
  lines.push(`  headerCellStyle: { background: '#f5f7fa' },`)
  lines.push(`  apiParams: { url: ${q(config.apiUrl)} },`)
  lines.push(`  rowkey: ${q(tOpts.rowkey || 'id')},`)
  if (tOpts.heightType) lines.push(`  heightType: ${q(tOpts.heightType)},`)
  if (tOpts.tabHeight) lines.push(`  tabHeight: ${numOrStr(tOpts.tabHeight)},`)
  if (tOpts.virtual) {
    lines.push(`  virtual: true,`)
    if (tOpts.rowHeight) lines.push(`  rowHeight: ${tOpts.rowHeight},`)
    if (tOpts.height) lines.push(`  height: ${numOrStr(tOpts.height)},`)
  }
  if (tOpts.engine) lines.push(`  engine: ${q(tOpts.engine)},`)
  if (tOpts.multiSelect) lines.push(`  multiSelect: true,`)
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
    ...(i18n ? { labelKey: `field.${field.prop}` } : { label: field.label }),
    formtype: field.formtype,
    span: context === 'query'
      ? (field.querySpan || (field.formtype === 'DatePicker' || field.formtype === 'TimePicker' ? 8 : 6))
      : (field.formSpan || 24),
    attrs: { clearable: true, ...(field.attrs || {}) },
  }

  if (field.dataOptions) item.dataOptions = field.dataOptions
  if (field.apiParams) item.apiParams = field.apiParams

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

export function buildTableColumn(field: FieldConfig, i18n?: boolean): Record<string, unknown> {
  const col: Record<string, unknown> = {
    prop: field.prop,
    ...(i18n ? { labelKey: `field.${field.prop}` } : { label: field.label }),
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
  return col
}

export function buildTableColumnSFC(field: FieldConfig, config: StructuredCrudConfig): string {
  const parts: string[] = []
  parts.push(`prop: ${q(field.prop)}`)
  // i18n 模式与 schema 模式（buildTableColumn/buildFormItem）统一走 labelKey：
  // es-table 内部按 labelKey 解析 i18n 文案。绝不能内联 `label: '${t('...')}'` ——
  // 内层单引号会截断外层字符串（编译失败），且 SFC 从不 import/定义 t。
  if (config.i18n) {
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
  if (field.formatter) parts.push(`formatter: ${field.formatter}`)
  if (field.render) parts.push(`render: ${field.render}`)
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
