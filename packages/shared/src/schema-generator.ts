import { generateCrudConfig, type GeneratedConfig } from "./crud-engine.js"
import { SPECIAL_BTN_KEYS, OPERATION_COLUMN_PROP_CRUD_PAGE, CRUD_PAGE_BTN_CLICK_KEYS } from "./contract.js"

export interface CrudSchemaResult {
  schema: Record<string, unknown>
  wrapperCode: string
  summary: string
}

export function generateCrudSchema(description: string): CrudSchemaResult {
  const config = generateCrudConfig(description)
  const schema = buildCrudPageSchema(config)
  const wrapperCode = buildWrapperSFC(config)
  const summary = buildSummary(config)
  return { schema, wrapperCode, summary }
}

function buildCrudPageSchema(config: GeneratedConfig): Record<string, unknown> {
  const schema: Record<string, unknown> = {}

  if (config.formItems.length > 0) {
    schema.formItems = config.formItems
  }

  const columns = config.columns
    .filter(col => col.prop !== 'operate')
    .map(col => {
      const { render, ...rest } = col
      return rest
    })
  schema.columns = columns

  schema.tableOptions = {
    border: true,
    stripe: true,
    highlightCurrentRow: true,
    headerCellStyle: { background: '#f5f7fa' },
    apiParams: { url: '/api/xxx' },
    rowkey: 'id',
  }

  if (config.dialogFormItems && config.dialogFormItems.length > 0) {
    schema.dialogFormItems = config.dialogFormItems
  }

  schema.actions = config.actions

  schema.pagination = { pageSize: 10 }

  return schema
}

function buildWrapperSFC(config: GeneratedConfig): string {
  const hasDelete = config.actions.includes('delete')
  const hasStatusRender = config.hasStatusRender

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
  lines.push(`<script setup>`)
  lines.push(`import { ref } from 'vue'`)

  const epImports: string[] = []
  if (hasDelete) epImports.push('ElMessageBox', 'ElMessage')
  if (hasStatusRender) epImports.push('ElTag')
  if (epImports.length > 0) {
    lines.push(`import { ${epImports.join(', ')} } from 'element-plus'`)
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
    lines.push(`  ElMessageBox.confirm('确定删除该条数据吗？', '提示', { type: 'warning' })`)
    lines.push(`    .then(async () => {`)
    lines.push(`      // TODO: 调用删除接口`)
    lines.push(`      ElMessage.success('删除成功')`)
    lines.push(`      crudRef.value?.refresh()`)
    lines.push(`    })`)
    lines.push(`    .catch(() => {})`)
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
  lines.push(`}`)
  lines.push(`</script>`)

  return lines.join('\n')
}

function buildSummary(config: GeneratedConfig): string {
  return [
    `Generated CrudPageSchema with:`,
    `- ${config.formItems.length} query form fields`,
    `- ${config.columns.filter(c => c.prop !== 'operate').length} table columns`,
    `- Actions: ${config.actions.join(', ')}`,
    config.dialogFormItems?.length
      ? `- ${config.dialogFormItems.length} dialog form fields (with validation rules)`
      : '',
    `- Output: CrudPageSchema JSON + EsCrudPage wrapper SFC`,
    ``,
    `Note: 需要在 main.ts 中配置全局 app.use(ESPlus, { EsTable: { methods: { $httpRequest, configQueryFieldOutput } } })`,
  ].filter(Boolean).join('\n')
}
