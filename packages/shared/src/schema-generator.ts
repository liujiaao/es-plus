import { generateCrudConfig, type GeneratedConfig } from "./crud-engine.js"
import { SPECIAL_BTN_KEYS, OPERATION_COLUMN_PROP_CRUD_PAGE, CRUD_PAGE_BTN_CLICK_KEYS } from "./contract.js"
import {
  type TargetFramework,
  DEFAULT_TARGET,
  getEsPlusPackageName,
  buildElementImport,
  buildDeleteConfirmBlock,
  rewriteVModelSync,
  rewriteElementUsage,
} from "./target.js"

export interface CrudSchemaResult {
  schema: Record<string, unknown>
  wrapperCode: string
  summary: string
  /** 实际使用的目标框架（缺省时为 'vue3'） */
  target: TargetFramework
  /**
   * 规则引擎**识别到**、但产物无法结构化表达的特性（多 tab 弹窗 / 多步表单 /
   * 跨页选择栏 …，措辞见 crud-engine 的 featureHints）。
   *
   * 这个字段此前在适配器里被丢弃 —— 调用方（站点 / MCP / CLI）于是只能看到一张
   * 平表，连「这个需求需要手工实现」都无从得知。透传是**事实**，不是提示。
   */
  featureHints?: string[]
  /**
   * 生成过程中被降级/丢弃的诉求（例如 schema 无法内联的 `columns[].render`）。
   * 与 featureHints 的区别：featureHints 是「识别到了但没实现」，warnings 是
   * 「本可以表达、但这条路径表达不了」。
   */
  warnings?: string[]
}

/**
 * 从自然语言描述生成 CrudPageSchema + 包装 SFC
 *
 * @param description 中/英文页面描述
 * @param target      目标框架，'vue3' (Element Plus, 默认) | 'vue2' (Element UI)
 *
 * 注意：返回的 `schema` JSON 在两个 target 间完全一致 —— 这是 schema 模式的核心价值。
 * 仅 `wrapperCode` 会根据 target 输出不同语法（v-model:* vs :*.sync, script setup vs defineComponent...）。
 */
export function generateCrudSchema(
  description: string,
  target: TargetFramework = DEFAULT_TARGET
): CrudSchemaResult {
  const config = generateCrudConfig(description)
  const { schema, warnings } = buildCrudPageSchema(config)
  const wrapperCode = buildWrapperSFC(config, target)
  const summary = buildSummary(config, target)
  return {
    schema,
    wrapperCode,
    summary,
    target,
    // 规则引擎的识别结果必须原样透出：这既是站点提示条的输入，也是 MCP/CLI
    // 唯一能告诉调用方「哪些诉求没有落地」的渠道。
    featureHints: config.featureHints ?? [],
    warnings,
  }
}

function buildCrudPageSchema(config: GeneratedConfig): {
  schema: Record<string, unknown>
  warnings: string[]
} {
  const schema: Record<string, unknown> = {}
  const warnings: string[] = []

  if (config.formItems.length > 0) {
    schema.formItems = config.formItems
  }

  const renderProps: string[] = []
  const columns = config.columns
    .filter(col => col.prop !== 'operate')
    .map(col => {
      const { render, ...rest } = col
      if (render) renderProps.push(String(col.prop))
      return rest
    })
  schema.columns = columns

  // AN-08/AI-22 的同一条契约：`tableOptions` 是容器级配置的唯一家。
  // 这里此前把整块**硬编码**成 6 个键，于是规则引擎已经识别并写好的
  // `virtual` / `cachePageSelection` / `multiSelect`（虚拟滚动、跨页批量选择）
  // 在适配器里被静默扔掉 —— 产物与「引擎实际产出的配置」不一致。
  // 保留默认项垫底，再用引擎输出覆盖：默认值只补缺省，不覆盖事实。
  schema.tableOptions = {
    border: true,
    stripe: true,
    highlightCurrentRow: true,
    // 表头底色不设默认值：内联样式会压过宿主主题（暗色表头成唯一亮块），
    // 底色由主题 CSS 负责；用户传了才透传（下面的 ...config.tableOptions）。
    apiParams: { url: '/api/xxx' },
    rowkey: 'id',
    ...(config.tableOptions ?? {}),
  }

  if (config.dialogFormItems && config.dialogFormItems.length > 0) {
    schema.dialogFormItems = config.dialogFormItems
  }

  // 工具栏按钮：规则引擎已经按动作词算好了「新增 / 导出 / 批准 / 拒绝 / 批量上架…」
  // （`config.queryBtns`），但适配器此前**整块丢弃** —— 于是「支持批量上下架」
  // 的预设产物里既没有选择列（现已透传 multiSelect）也没有按钮。
  //
  // 只透传查询表单之外的按钮：`查询 / 重置` 由 es-crud-page 自己合成（它总是先
  // 放一对基础按钮），原样带上会出现两组。声明 `toolbarBtns` 会**接管**派生按钮面
  // （core 的显式优先规则），因此这里必须包含引擎认为该有的全部非查询按钮，
  // 而不是只挑几个。
  const toolbarBtns = (config.queryBtns ?? [])
    .filter((btn: { key?: string }) => btn.key !== 'query' && btn.key !== 'rest')
    .map((btn: { key?: string; [k: string]: unknown }) => {
      // 派生按钮靠 `dialogKey` 打开弹窗（es-crud-page 的旧模式会从
      // dialogFormItems + actions 合成 add/edit/view 三个弹窗）。这里透传的按钮
      // 若不带上，点击只会 emit 一个没人监听的事件 —— 看起来能点、实际没反应。
      if (btn.key === 'add') return { ...btn, dialogKey: 'add' }
      if (btn.key === 'export') return { ...btn, actionType: 'export' }
      if (btn.key === 'import') return { ...btn, actionType: 'import' }
      return btn
    })
  if (toolbarBtns.length > 0) {
    schema.toolbarBtns = toolbarBtns
  }

  schema.actions = config.actions

  schema.pagination = { pageSize: 10 }

  if (renderProps.length > 0) {
    // schema 是 JSON，函数无法序列化；但「丢掉了」和「明确告诉你丢掉了」是
    // 两种完全不同的产品行为。structured-generator 在同样场景会发 TODO 槽位
    // 告警，规则引擎这条路径不能更沉默。
    warnings.push(
      `规则引擎无法把 columns[].render 内联进 JSON schema（${renderProps.join(', ')}）；` +
        `已从 schema 剥离，请在包装 SFC 中补实现`
    )
  }

  return { schema, warnings }
}

/**
 * 包装 SFC 生成（同时支持 vue3 和 vue2 target）
 *
 * Vue 3 风格：<script setup> + ElMessageBox + '@es-plus/vue3'
 * Vue 2 风格：<script>defineComponent({ setup() {} })</script> + MessageBox + '@es-plus/vue2'
 */
function buildWrapperSFC(config: GeneratedConfig, target: TargetFramework): string {
  const hasDelete = config.actions.includes('delete')
  // 导出/导入按钮的**真实来源**是 queryBtns（下面 toolbarBtns 由它派生）：actions 里有、
  // 但按钮没生成时不需要处理函数；反之自定义按钮也必须接住。此前 handleBtnClick 只认
  // add/edit 两个确认键，export/import 点下去只 emit 一个没人分支的事件 —— 能点、零反馈。
  const hasExport = (config.queryBtns ?? []).some((b: { key?: string }) => b.key === 'export')
  const hasImport = (config.queryBtns ?? []).some((b: { key?: string }) => b.key === 'import')
  const hasStatusRender = config.hasStatusRender
  const isVue2 = target === 'vue2'
  const esPlusPkg = getEsPlusPackageName(target)

  const lines: string[] = []
  lines.push(`<template>`)
  lines.push(`  <es-crud-page`)
  lines.push(`    ref="crudRef"`)
  lines.push(`    :schema="pageSchema"`)
  lines.push(`    :http-request="fetchData"`)
  if (hasDelete) lines.push(`    @delete="handleDelete"`)
  lines.push(`    @btn-click="handleBtnClick"`)
  lines.push(`  />`)
  lines.push(`</template>`)
  lines.push(``)

  if (isVue2) {
    // Vue 2 / defineComponent + setup()
    lines.push(`<script>`)
    lines.push(`import { defineComponent, ref } from 'vue'`)

    const epImports: string[] = []
    if (hasDelete) epImports.push('ElMessageBox', 'ElMessage')
    // 导出/导入的「尚未实现」提示同样要 ElMessage（target 映射由 buildElementImport 负责）。
    else if (hasExport || hasImport) epImports.push('ElMessage')
    if (hasStatusRender) epImports.push('ElTag')
    if (epImports.length > 0) {
      lines.push(buildElementImport(epImports, target))
    }

    lines.push(`import { pageSchema } from './schema'`)
    lines.push(``)
    lines.push(`export default defineComponent({`)
    lines.push(`  name: 'CrudPageWrapper',`)
    lines.push(`  setup() {`)
    lines.push(`    const crudRef = ref(null)`)
    lines.push(``)
    lines.push(`    async function fetchData(params) {`)
    lines.push(`      // TODO: 替换为实际接口调用`)
    lines.push(`      // const { data } = await axios.get('/api/list', { params: params.formParams })`)
    lines.push(`      // return data`)
    lines.push(`    }`)

    if (hasDelete) {
      lines.push(``)
      lines.push(`    function handleDelete(row) {`)
      lines.push(`      MessageBox.confirm('确定删除该条数据吗？', '提示', { type: 'warning' })`)
      lines.push(`        .then(async () => {`)
      lines.push(`          try {`)
      lines.push(`            // TODO: 调用删除接口`)
      lines.push(`            Message.success('删除成功')`)
      lines.push(`            crudRef.value && crudRef.value.refresh && crudRef.value.refresh()`)
      lines.push(`          } catch (err) {`)
      lines.push(`            Message.error('删除失败')`)
      lines.push(`          }`)
      lines.push(`        })`)
      lines.push(`        .catch(() => {})`)
      lines.push(`    }`)
    }

    lines.push(``)
    lines.push(`    function handleBtnClick(key, data) {`)
    lines.push(`      if (key === '${CRUD_PAGE_BTN_CLICK_KEYS.ADD_CONFIRM}') {`)
    lines.push(`        // TODO: 调用新增接口`)
    lines.push(`        crudRef.value && crudRef.value.refresh && crudRef.value.refresh()`)
    lines.push(`      }`)
    lines.push(`      if (key === '${CRUD_PAGE_BTN_CLICK_KEYS.EDIT_CONFIRM}') {`)
    lines.push(`        // TODO: 调用编辑接口`)
    lines.push(`        crudRef.value && crudRef.value.refresh && crudRef.value.refresh()`)
    lines.push(`      }`)
    // 规则引擎不知道导出/导入接口（GeneratedConfig 里没有 apiUrl）；替宿主发请求只会猜错，
    // 但「点了没反应」是另一回事 —— 至少让「尚未实现」可见、可定位（与 SFC 引擎同一纪律）。
    if (hasExport) {
      lines.push(`      if (key === 'export') {`)
      lines.push(`        ElMessage.warning('导出尚未实现：请在 handleBtnClick 中接入导出接口')`)
      lines.push(`      }`)
    }
    if (hasImport) {
      lines.push(`      if (key === 'import') {`)
      lines.push(`        ElMessage.warning('导入尚未实现：请在 handleBtnClick 中接入导入接口')`)
      lines.push(`      }`)
    }
    lines.push(`    }`)

    lines.push(``)
    lines.push(`    return { crudRef, fetchData, ${hasDelete ? 'handleDelete, ' : ''}handleBtnClick }`)
    lines.push(`  }`)
    lines.push(`})`)
    lines.push(`</script>`)

    return rewriteElementUsage(lines.join('\n'), target)
  }

  // Vue 3 / <script setup>
  lines.push(`<script setup>`)
  lines.push(`import { ref } from 'vue'`)

  const epImports: string[] = []
  if (hasDelete) epImports.push('ElMessageBox', 'ElMessage')
  else if (hasExport || hasImport) epImports.push('ElMessage')
  if (hasStatusRender) epImports.push('ElTag')
  if (epImports.length > 0) {
    lines.push(buildElementImport(epImports, target))
  }

  lines.push(`import { pageSchema } from './schema'`)
  lines.push(``)
  lines.push(`const crudRef = ref(null)`)
  lines.push(``)
  lines.push(`async function fetchData(params) {`)
  lines.push(`  // TODO: 替换为实际接口调用`)
  lines.push(`  // const { data } = await axios.get('/api/list', { params: params.formParams })`)
  lines.push(`  // return data`)
  lines.push(`}`)

  if (hasDelete) {
    lines.push(``)
    lines.push(`function handleDelete(row) {`)
    // vue3 走 ElMessageBox.confirm 的 Promise 形态，antdv 走 Modal.confirm 的对象形态
    // （由 buildDeleteConfirmBlock 按 target 区分）。生成的 ElMessage 引用在 return 前
    // 统一由 rewriteElementUsage 改写为目标 UI 库命名。
    lines.push(...buildDeleteConfirmBlock({
      target,
      indent: '  ',
      bodyLines: ['// TODO: 调用删除接口', `ElMessage.success('删除成功')`, 'crudRef.value?.refresh()'],
    }))
    lines.push(`}`)
  }

  lines.push(``)
  lines.push(`function handleBtnClick(key, data) {`)
  lines.push(`  if (key === '${CRUD_PAGE_BTN_CLICK_KEYS.ADD_CONFIRM}') {`)
  lines.push(`    // TODO: 调用新增接口`)
  lines.push(`    crudRef.value?.refresh()`)
  lines.push(`  }`)
  lines.push(`  if (key === '${CRUD_PAGE_BTN_CLICK_KEYS.EDIT_CONFIRM}') {`)
  lines.push(`    // TODO: 调用编辑接口`)
  lines.push(`    crudRef.value?.refresh()`)
  lines.push(`  }`)
  if (hasExport) {
    lines.push(`  if (key === 'export') {`)
    lines.push(`    ElMessage.warning('导出尚未实现：请在 handleBtnClick 中接入导出接口')`)
    lines.push(`  }`)
  }
  if (hasImport) {
    lines.push(`  if (key === 'import') {`)
    lines.push(`    ElMessage.warning('导入尚未实现：请在 handleBtnClick 中接入导入接口')`)
    lines.push(`  }`)
  }
  lines.push(`}`)
  lines.push(`</script>`)

  // vue3 / antdv 共用 Vue 3 语法，但 UI 库符号不同（ElMessage→message、ElTag→Tag …）。
  // 此前该分支漏掉这一步，导致 antdv 产物 import 了 Modal/message、代码体仍引用
  // ElMessageBox/ElMessage，生成结果不可编译。
  return rewriteElementUsage(lines.join('\n'), target)
}

function buildSummary(config: GeneratedConfig, target: TargetFramework): string {
  return [
    `Generated CrudPageSchema (${target}) with:`,
    `- ${config.formItems.length} query form fields`,
    `- ${config.columns.filter(c => c.prop !== 'operate').length} table columns`,
    `- Actions: ${config.actions.join(', ')}`,
    config.dialogFormItems?.length
      ? `- ${config.dialogFormItems.length} dialog form fields (with validation rules)`
      : '',
    `- Output: CrudPageSchema JSON + EsCrudPage wrapper SFC`,
    target === 'vue2'
      ? `- Target: Vue 2 + Element UI (use @es-plus/vue2)`
      : target === 'antdv'
        ? `- Target: Vue 3 + Ant Design Vue (use @es-plus/adapter-antdv)`
        : `- Target: Vue 3 + Element Plus (use @es-plus/vue3)`,
    ``,
    `Note: 需要在 main.${target === 'vue2' ? 'js' : 'ts'} 中配置 ${target === 'vue2' ? 'Vue.use(EsPlus)' : 'app.use(ESPlus)'} 全局插件`,
  ].filter(Boolean).join('\n')
}
