import { SPECIAL_BTN_KEYS, OPERATION_COLUMN_PROP_SFC, OPERATION_COLUMN_PROP_CRUD_PAGE, CRUD_PAGE_BTN_CLICK_KEYS } from './contract.js'
import type { StructuredCrudConfig, FieldConfig } from './structured-config.schema.js'
import {
  type TargetFramework,
  DEFAULT_TARGET,
  getEsPlusPackageName,
  buildElementImport,
} from './target.js'

export type { StructuredCrudConfig }

/**
 * 从 config 中安全读取 target，兼容旧调用（未传 target 时回落到 'vue3'）
 */
function readTarget(config: StructuredCrudConfig): TargetFramework {
  const t = (config as unknown as { target?: TargetFramework }).target
  return t === 'vue2' ? 'vue2' : DEFAULT_TARGET
}

interface TableOpts {
  border?: boolean
  stripe?: boolean
  rowkey?: string
  heightType?: string
  tabHeight?: number | string
  multiSelect?: boolean
  highlightCurrentRow?: boolean
  headerCellStyle?: Record<string, string>
  virtual?: boolean
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

export function generateFromConfig(config: StructuredCrudConfig): StructuredGenerateResult {
  const mode = config.mode || 'schema'
  if (mode === 'sfc') {
    return generateSFC(config)
  }
  return generateSchema(config)
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
    warnings.push(`Schema mode does not support inline render expressions. Fields [${renderFields.map(f => f.prop).join(', ')}] have render — handle in wrapper SFC via scopedSlots or event handlers.`)
  }

  // Vue 2 不支持虚拟滚动 (Element UI 无 el-table-v2)，提前发出警告
  const tOptsForWarn = (config.tableOptions || {}) as Record<string, unknown>
  if (target === 'vue2' && tOptsForWarn.virtual) {
    warnings.push('target=vue2: Element UI does not support virtual scrolling (no el-table-v2). The "virtual" option will be ignored at runtime — use normal el-table for large datasets and consider server-side pagination.')
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
    ...(tOpts.multiSelect ? { multiSelect: true } : {}),
    ...(tOpts.virtual ? { virtual: true } : {}),
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
          warnings.push(`Dialog "${key}" has hasCustomRender=true — implement render function in wrapper SFC.`)
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

  const schemaJson = JSON.stringify(schema, null, 2)
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
    if (tOptsForWarn.virtual) {
      warnings.push('target=vue2: virtual scrolling is not supported in Element UI — option will be ignored.')
    }
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

  // Script — Vue 2 需要 defineComponent + setup() 包装，Vue 3 直接用 <script setup>
  if (isVue2) {
    lines.push(ts ? `<script lang="ts">` : `<script>`)
  } else {
    lines.push(ts ? `<script setup lang="ts">` : `<script setup>`)
  }

  // Imports
  const vueImports = isVue2 ? ['defineComponent', 'reactive', 'ref'] : ['reactive', 'ref']
  if (hasRender) vueImports.push('h')
  lines.push(`import { ${vueImports.join(', ')} } from 'vue'`)

  if (hasDialog) {
    lines.push(`import { useDialog } from '${esPlusPkg}'`)
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
      lines.push(`  ${f.prop}: ${tsType}`)
    }
    lines.push(`}`)
    lines.push(``)
  }

  // Reactive state
  const modelInit = queryFields.map(f => `${f.prop}: ${getDefaultValue(f)}`).join(', ')
  if (ts) {
    lines.push(`const queryForm = reactive<QueryForm>({ ${modelInit} })`)
  } else {
    lines.push(`const queryForm = reactive({ ${modelInit} })`)
  }
  lines.push(`const tableData = ref([])`)
  lines.push(`const tableRef = ref(null)`)
  lines.push(`const pagination = ref({ current: 1, pageSize: ${config.pagination?.pageSize || 10}, total: 0 })`)
  if (hasDialog) lines.push(`const dialog = useDialog()`)
  lines.push(``)

  // formItems
  const formItemsJson = JSON.stringify(queryFields.map(f => buildFormItem(f, 'query', config.i18n)), null, 2)
  lines.push(`const formItems = ${formItemsJson}`)
  lines.push(``)

  // queryBtns
  lines.push(`const queryBtns = [`)
  lines.push(`  { name: '查询', type: 'primary', key: '${SPECIAL_BTN_KEYS.QUERY}', triggerEvent: true },`)
  lines.push(`  { name: '重置', key: '${SPECIAL_BTN_KEYS.RESET}', triggerEvent: true },`)
  if (config.actions.includes('add')) {
    const perm = config.permissions?.add ? `, permissionValue: '${config.permissions.add}'` : ''
    lines.push(`  { name: '新增', type: 'primary', key: 'add', icon: 'Plus', click: () => openForm('新增')${perm} },`)
  }
  if (config.actions.includes('export')) {
    const perm = config.permissions?.export ? `, permissionValue: '${config.permissions.export}'` : ''
    lines.push(`  { name: '导出', key: 'export', icon: 'Download', click: () => handleExport()${perm} },`)
  }
  if (config.actions.includes('import')) {
    const perm = config.permissions?.import ? `, permissionValue: '${config.permissions.import}'` : ''
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
  lines.push(`  apiParams: { url: '${config.apiUrl}' },`)
  lines.push(`  rowkey: '${tOpts.rowkey || 'id'}',`)
  if (tOpts.virtual) {
    lines.push(`  virtual: true,`)
    if (tOpts.rowHeight) lines.push(`  rowHeight: ${tOpts.rowHeight},`)
    if (tOpts.tabHeight) lines.push(`  tabHeight: ${tOpts.tabHeight},`)
    if (tOpts.heightType) lines.push(`  heightType: '${tOpts.heightType}',`)
  }
  if (tOpts.multiSelect) lines.push(`  multiSelect: true,`)
  lines.push(`}`)

  // delete handler
  if (hasDelete) {
    lines.push(``)
    lines.push(`function handleDelete(row${ts ? ': any' : ''}) {`)
    lines.push(`  ElMessageBox.confirm('确定删除该条数据吗？', '提示', { type: 'warning' })`)
    lines.push(`    .then(async () => {`)
    lines.push(`      await httpRequest({ url: \`${config.apiUrl}/\${row.${tOpts.rowkey || 'id'}}\`, method: 'DELETE' })`)
    lines.push(`      ElMessage.success('删除成功')`)
    lines.push(`      tableRef.value?.httpRequestInstance()`)
    lines.push(`    })`)
    lines.push(`    .catch(() => {})`)
    lines.push(`}`)
  }

  // export/import handlers
  if (config.actions.includes('export')) {
    lines.push(``)
    lines.push(`function handleExport() {`)
    lines.push(`  window.open(\`${config.apiUrl}/export?\${new URLSearchParams(queryForm as any).toString()}\`)`)
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
    const dialogModelInit = formFields.map(f => `${f.prop}: ${getDefaultValue(f)}`).join(', ')
    lines.push(`  const formData = reactive({ ${dialogModelInit}, ...row })`)
    lines.push(`  const isView = title === '查看'`)
    lines.push(``)

    const dialogFormItemsJson = JSON.stringify(formFields.map(f => buildFormItem(f, 'form', config.i18n)), null, 4)
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
    lines.push(`          const method = title === '新增' ? 'POST' : 'PUT'`)
    lines.push(`          const url = title === '新增' ? '${config.apiUrl}' : \`${config.apiUrl}/\${formData.${tOpts.rowkey || 'id'}}\``)
    lines.push(`          await httpRequest({ url, method, data: formData })`)
    lines.push(`          ElMessage.success(\`\${title}成功\`)`)
    lines.push(`          close()`)
    lines.push(`          tableRef.value?.httpRequestInstance()`)
    lines.push(`        } catch {}`)
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

  // Vue 2 模式：把 ElMessage / ElMessageBox 的使用替换为 Message / MessageBox
  if (isVue2) {
    code = code
      .replace(/\bElMessageBox\b/g, 'MessageBox')
      .replace(/\bElMessage\b/g, 'Message')
      .replace(/\bElTag\b/g, 'Tag')
  }

  const summary = [
    `Generated full SFC (structured mode, target=${target}):`,
    `- ${queryFields.length} query fields, ${tableFields.length} table columns, ${formFields.length} dialog fields`,
    `- Actions: ${config.actions.join(', ')}`,
    `- API: ${config.apiUrl}`,
    config.typescript ? '- TypeScript enabled' : '',
    config.permissions ? '- Permissions configured' : '',
    isVue2
      ? '- Target: Vue 2 + Element UI (@es-plus/vue2). JSX render needs @vue/babel-preset-jsx.'
      : '- Target: Vue 3 + Element Plus (@es-plus/vue3)',
  ].filter(Boolean).join('\n')

  return { code, summary, warnings }
}

function buildSchemaWrapper(config: StructuredCrudConfig, hasDelete: boolean, _hasDialog: boolean, renderFields: FieldConfig[], target: TargetFramework): string {
  const ts = config.typescript
  const isVue2 = target === 'vue2'
  const tOpts: TableOpts = (config.tableOptions || {}) as TableOpts
  const lines: string[] = []

  lines.push(`<template>`)
  lines.push(`  <es-crud-page`)
  lines.push(`    ref="crudRef"`)
  lines.push(`    :schema="pageSchema"`)
  lines.push(`    :http-request="fetchData"`)
  if (hasDelete) lines.push(`    @delete="handleDelete"`)
  lines.push(`    @btn-click="handleBtnClick"`)
  if (renderFields.length > 0) {
    for (const f of renderFields) {
      lines.push(`    #column-${f.prop}="{ row }"`)
    }
  }
  lines.push(`  >`)
  if (renderFields.length > 0) {
    for (const f of renderFields) {
      // Vue 2.6+ scoped slot 在模板中也用 #name="..."，与 Vue 3 写法兼容
      lines.push(`    <template #column-${f.prop}="{ row }">`)
      lines.push(`      <!-- ${f.label} custom render -->`)
      lines.push(`      <el-tag :type="row.${f.prop} === 1 ? 'success' : 'danger'">`)
      lines.push(`        {{ row.${f.prop} === 1 ? '启用' : '禁用' }}`)
      lines.push(`      </el-tag>`)
      lines.push(`    </template>`)
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
  body.push(`${indent}    url: '${config.apiUrl}',`)
  body.push(`${indent}    method: 'GET',`)
  body.push(`${indent}    params: { ...params.formParams, pageIndex: params.pageIndex, pageSize: params.pageSize }`)
  body.push(`${indent}  })`)
  body.push(`${indent}  return res`)
  body.push(`${indent}}`)

  if (hasDelete) {
    body.push(``)
    body.push(`${indent}function handleDelete(row${ts ? ': any' : ''}) {`)
    body.push(`${indent}  ElMessageBox.confirm('确定删除该条数据吗？', '提示', { type: 'warning' })`)
    body.push(`${indent}    .then(async () => {`)
    body.push(`${indent}      await httpRequest({ url: \`${config.apiUrl}/\${row.${tOpts.rowkey || 'id'}}\`, method: 'DELETE' })`)
    body.push(`${indent}      ElMessage.success('删除成功')`)
    body.push(`${indent}      ${isVue2 ? 'crudRef.value && crudRef.value.refresh && crudRef.value.refresh()' : 'crudRef.value?.refresh()'}`)
    body.push(`${indent}    })`)
    body.push(`${indent}    .catch(() => {})`)
    body.push(`${indent}}`)
  }

  body.push(``)
  body.push(`${indent}function handleBtnClick(key${ts ? ': string' : ''}, data${ts ? ': any' : ''}) {`)
  if (config.actions.includes('add')) {
    body.push(`${indent}  if (key === '${CRUD_PAGE_BTN_CLICK_KEYS.ADD_CONFIRM}') {`)
    body.push(`${indent}    httpRequest({ url: '${config.apiUrl}', method: 'POST', data }).then(() => {`)
    body.push(`${indent}      ElMessage.success('新增成功')`)
    body.push(`${indent}      ${isVue2 ? 'crudRef.value && crudRef.value.refresh && crudRef.value.refresh()' : 'crudRef.value?.refresh()'}`)
    body.push(`${indent}    })`)
    body.push(`${indent}  }`)
  }
  if (config.actions.includes('edit')) {
    body.push(`${indent}  if (key === '${CRUD_PAGE_BTN_CLICK_KEYS.EDIT_CONFIRM}') {`)
    body.push(`${indent}    httpRequest({ url: \`${config.apiUrl}/\${data.${tOpts.rowkey || 'id'}}\`, method: 'PUT', data }).then(() => {`)
    body.push(`${indent}      ElMessage.success('编辑成功')`)
    body.push(`${indent}      ${isVue2 ? 'crudRef.value && crudRef.value.refresh && crudRef.value.refresh()' : 'crudRef.value?.refresh()'}`)
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
  // Vue 2 命名替换：ElMessageBox → MessageBox, ElMessage → Message
  if (isVue2) {
    code = code
      .replace(/\bElMessageBox\b/g, 'MessageBox')
      .replace(/\bElMessage\b/g, 'Message')
  }
  return code
}

function buildSchemaWrapperNew(config: StructuredCrudConfig, renderFields: FieldConfig[], warnings: string[], target: TargetFramework): string {
  const ts = config.typescript
  const isVue2 = target === 'vue2'
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
      lines.push(`    <template #column-${f.prop}="{ row }">`)
      lines.push(`      <el-tag :type="row.${f.prop} === 1 ? 'success' : 'danger'">`)
      lines.push(`        {{ row.${f.prop} === 1 ? '启用' : '禁用' }}`)
      lines.push(`      </el-tag>`)
      lines.push(`    </template>`)
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
  body.push(`${indent}    url: '${config.apiUrl}',`)
  body.push(`${indent}    method: 'GET',`)
  body.push(`${indent}    params: { ...params.formParams, pageIndex: params.pageIndex, pageSize: params.pageSize }`)
  body.push(`${indent}  })`)
  body.push(`${indent}  return res`)
  body.push(`${indent}}`)

  // delete handler
  if (hasDelete) {
    body.push(``)
    body.push(`${indent}function handleDelete(row${ts ? ': any' : ''}) {`)
    body.push(`${indent}  ElMessageBox.confirm('确定删除该条数据吗？', '提示', { type: 'warning' })`)
    body.push(`${indent}    .then(async () => {`)
    body.push(`${indent}      await httpRequest({ url: \`${config.apiUrl}/\${row.${tOpts.rowkey || 'id'}}\`, method: 'DELETE' })`)
    body.push(`${indent}      ElMessage.success('删除成功')`)
    body.push(`${indent}      ${refreshExpr}`)
    body.push(`${indent}    })`)
    body.push(`${indent}    .catch(() => {})`)
    body.push(`${indent}}`)
  }

  // dialog-confirm handler
  body.push(``)
  body.push(`${indent}function handleDialogConfirm(dialogKey${ts ? ': string' : ''}, data${ts ? ': any' : ''}) {`)
  const dialogEntries = Object.entries(dialogs).filter(([, d]) => !d.hasCustomRender)
  for (const [key] of dialogEntries) {
    const method = key === 'add' ? 'POST' : 'PUT'
    const url = key === 'add' ? `'${config.apiUrl}'` : `\`${config.apiUrl}/\${data.${tOpts.rowkey || 'id'}}\``
    body.push(`${indent}  if (dialogKey === '${key}') {`)
    body.push(`${indent}    httpRequest({ url: ${url}, method: '${method}', data }).then(() => {`)
    body.push(`${indent}      ElMessage.success('操作成功')`)
    body.push(`${indent}      ${refreshExpr}`)
    body.push(`${indent}    })`)
    body.push(`${indent}  }`)
  }
  body.push(`${indent}}`)

  // btn-click handler (for non-dialog actions like export)
  body.push(``)
  body.push(`${indent}function handleBtnClick(key${ts ? ': string' : ''}, payload${ts ? '?: any' : ''}) {`)
  if (config.actions.includes('export')) {
    body.push(`${indent}  if (key === 'export') {`)
    body.push(`${indent}    window.open(\`${config.apiUrl}/export?\${new URLSearchParams(payload || {}).toString()}\`)`)
    body.push(`${indent}  }`)
  }
  body.push(`${indent}}`)

  // Custom render dialog placeholders
  if (customRenderDialogs.length > 0) {
    body.push(``)
    body.push(`${indent}// Custom render dialogs — implement in pageSchema.dialogs[key].render`)
    for (const [key] of customRenderDialogs) {
      body.push(`${indent}// Dialog "${key}" uses custom render — configure in schema or override via openDialog`)
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
  // Vue 2 命名替换：ElMessageBox → MessageBox, ElMessage → Message
  if (isVue2) {
    code = code
      .replace(/\bElMessageBox\b/g, 'MessageBox')
      .replace(/\bElMessage\b/g, 'Message')
  }
  return code
}

function buildFormItem(field: FieldConfig, context: 'query' | 'form', i18n?: boolean): Record<string, unknown> {
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

function buildTableColumn(field: FieldConfig, i18n?: boolean): Record<string, unknown> {
  const col: Record<string, unknown> = {
    prop: field.prop,
    ...(i18n ? { labelKey: `field.${field.prop}` } : { label: field.label }),
  }
  if (field.width) col.width = field.width
  if (field.minWidth) col.minWidth = field.minWidth
  if (field.align) col.align = field.align
  if (field.fixed) col.fixed = field.fixed
  if (field.ellipsis) col.showOverflowTooltip = true
  return col
}

function buildTableColumnSFC(field: FieldConfig, config: StructuredCrudConfig): string {
  const parts: string[] = []
  parts.push(`prop: '${field.prop}'`)
  parts.push(`label: '${config.i18n ? `\${t('field.${field.prop}')}` : field.label}'`)
  if (field.width) parts.push(`width: ${typeof field.width === 'number' ? field.width : `'${field.width}'`}`)
  if (field.minWidth) parts.push(`minWidth: ${typeof field.minWidth === 'number' ? field.minWidth : `'${field.minWidth}'`}`)
  if (field.align) parts.push(`align: '${field.align}'`)
  if (field.fixed) parts.push(`fixed: ${typeof field.fixed === 'boolean' ? field.fixed : `'${field.fixed}'`}`)
  if (field.ellipsis) parts.push(`showOverflowTooltip: true`)
  if (field.formatter) parts.push(`formatter: ${field.formatter}`)
  if (field.render) parts.push(`render: ${field.render}`)
  return `{ ${parts.join(', ')} }`
}

function buildActionBtns(config: StructuredCrudConfig): string[] {
  const btns: string[] = []
  if (config.actions.includes('view')) {
    const perm = config.permissions?.view ? `, permissionValue: '${config.permissions.view}'` : ''
    btns.push(`{ name: '查看', type: 'primary', clickEvent: (row) => openForm('查看', row)${perm} }`)
  }
  if (config.actions.includes('edit')) {
    const perm = config.permissions?.edit ? `, permissionValue: '${config.permissions.edit}'` : ''
    btns.push(`{ name: '编辑', type: 'primary', clickEvent: (row) => openForm('编辑', row)${perm} }`)
  }
  if (config.actions.includes('delete')) {
    const perm = config.permissions?.delete ? `, permissionValue: '${config.permissions.delete}'` : ''
    btns.push(`{ name: '删除', type: 'danger', clickEvent: (row) => handleDelete(row)${perm} }`)
  }
  return btns
}

function inferTsType(field: FieldConfig): string {
  switch (field.formtype) {
    case 'Switch': return 'boolean'
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

function getDefaultValue(field: FieldConfig): string {
  switch (field.formtype) {
    case 'Switch': return 'false'
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
