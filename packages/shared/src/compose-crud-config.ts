import type { StructuredCrudConfigInput } from './structured-config.schema.js'
import type { TargetFramework } from './target.js'
import type { CrudAction } from './contract.js'

/**
 * 组合层（确定性,零 LLM）——把 query / table / form 三个「面」的字段表归并成**一个**
 * 合法 `StructuredCrudConfig`,再交给既有的 `generateFromConfig` 落地。
 *
 * 为什么必须在 config/IR 层组合、而不是拼接代码串:拼字符串会产生重复 `<script>` 块、
 * 重复 import、没有共享响应式状态、也接不上 form↔table 的 provide/inject。归并到
 * 一份 `fields[]`(每个字段带 `inQuery/inTable/inForm`)后,走的是本就被 341 测试 +
 * golden 覆盖的唯一落地路径,编译保证现成。
 *
 * **只负责「含表格」的子集**(table / query+table / table+dialog / 全量)——这些正是
 * `generateFromConfig` 能发射的形态(它总是产出 es-crud-page 或 `<es-table><es-form/></es-table>`)。
 * 不含表格的子集(独立表单 / 独立弹窗 / 表单+弹窗)由 `fragment-generator` 的独立发射器处理,
 * 不走这里。
 *
 * 字段协调优先级(固定):
 *   - 标识(prop/label/formtype):首次出现为准,冲突发告警(不静默改写)
 *   - 语义(required/rules/dataOptions/apiParams/attrs):form 面优先(覆盖 query)
 *   - 展示(width/minWidth/align/fixed/ellipsis/formatter/render):table 面优先
 *   - querySpan 来自 query 面、formSpan 来自 form 面
 */

/** 单个「面」里的字段描述 —— 与 `FieldConfig` 共用词汇,但不含 inQuery/inTable/inForm(由组合推导)。 */
export interface SurfaceField {
  prop: string
  label: string
  formtype: string
  querySpan?: number
  formSpan?: number
  required?: boolean
  rules?: unknown[]
  attrs?: Record<string, unknown>
  dataOptions?: unknown[]
  apiParams?: { url: string; method?: 'GET' | 'POST'; labelField?: string; valueField?: string }
  width?: number | string
  minWidth?: number | string
  align?: 'left' | 'center' | 'right'
  fixed?: boolean | 'left' | 'right'
  ellipsis?: boolean
  formatter?: string
  render?: string
  permissionValue?: string
}

export interface ComposeCrudInput {
  name: string
  apiUrl: string
  target?: TargetFramework
  mode?: 'schema' | 'sfc'
  typescript?: boolean
  i18n?: boolean
  /** 查询面字段(表格上方的过滤条件)。 */
  query?: SurfaceField[]
  /** 表格面字段(可见列)。 */
  table?: SurfaceField[]
  /** 表单面字段(新增/编辑弹窗)。 */
  form?: SurfaceField[]
  /** 显式 CRUD 动作;省略则按 dialogs / 表单存在性推导。 */
  actions?: CrudAction[]
  tableOptions?: StructuredCrudConfigInput['tableOptions']
  pagination?: StructuredCrudConfigInput['pagination']
  permissions?: Record<string, string>
  formLayout?: StructuredCrudConfigInput['formLayout']
  operationColumn?: StructuredCrudConfigInput['operationColumn']
  tableBtns?: StructuredCrudConfigInput['tableBtns']
  toolbarBtns?: StructuredCrudConfigInput['toolbarBtns']
  dialogs?: StructuredCrudConfigInput['dialogs']
}

export interface ComposeResult {
  config: StructuredCrudConfigInput
  warnings: string[]
}

const SEMANTIC_KEYS = ['required', 'rules', 'dataOptions', 'apiParams', 'attrs'] as const
const DISPLAY_KEYS = ['width', 'minWidth', 'align', 'fixed', 'ellipsis', 'formatter', 'render'] as const

function copyDefinedKeys(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  keys: readonly string[],
): void {
  for (const k of keys) {
    if (source[k] !== undefined) target[k] = source[k]
  }
}

/**
 * 把三面字段表归并为一个 `StructuredCrudConfig`。纯函数、确定性:同一输入恒产出同一配置
 * 与同一告警序列。产出的 config 仍会被 `generateFromConfig` 的入口 schema 校验。
 */
export function composeCrudConfig(input: ComposeCrudInput): ComposeResult {
  const warnings: string[] = []
  const acc = new Map<string, Record<string, unknown>>()
  const order: string[] = []
  const inQuery = new Set<string>()
  const inTable = new Set<string>()
  const inForm = new Set<string>()

  const query = input.query ?? []
  const table = input.table ?? []
  const form = input.form ?? []

  // 1) 标识:首次出现为准,冲突告警。按 query → table → form 固定顺序确定「首次」。
  const ensure = (f: SurfaceField): Record<string, unknown> => {
    let cur = acc.get(f.prop)
    if (!cur) {
      cur = { prop: f.prop, label: f.label, formtype: f.formtype }
      acc.set(f.prop, cur)
      order.push(f.prop)
      return cur
    }
    if (cur.label !== f.label) {
      warnings.push(
        `字段 "${f.prop}" 的 label 在不同面冲突（"${String(cur.label)}" vs "${f.label}"）——取首次出现的 "${String(cur.label)}"。`,
      )
    }
    if (cur.formtype !== f.formtype) {
      warnings.push(
        `字段 "${f.prop}" 的 formtype 在不同面冲突（"${String(cur.formtype)}" vs "${f.formtype}"）——取首次出现的 "${String(cur.formtype)}"。`,
      )
    }
    return cur
  }

  for (const f of query) { ensure(f); inQuery.add(f.prop) }
  for (const f of table) { ensure(f); inTable.add(f.prop) }
  for (const f of form) { ensure(f); inForm.add(f.prop) }

  // 2) span:各自面所有。
  for (const f of query) if (f.querySpan !== undefined) acc.get(f.prop)!.querySpan = f.querySpan
  for (const f of form) if (f.formSpan !== undefined) acc.get(f.prop)!.formSpan = f.formSpan

  // 3) 语义:query 先铺底,form 覆盖(form 面所有)。
  for (const f of query) copyDefinedKeys(acc.get(f.prop)!, f as unknown as Record<string, unknown>, SEMANTIC_KEYS)
  for (const f of form) copyDefinedKeys(acc.get(f.prop)!, f as unknown as Record<string, unknown>, SEMANTIC_KEYS)

  // 4) 展示:query/form 先铺底,table 覆盖(table 面所有)。
  for (const f of query) copyDefinedKeys(acc.get(f.prop)!, f as unknown as Record<string, unknown>, DISPLAY_KEYS)
  for (const f of form) copyDefinedKeys(acc.get(f.prop)!, f as unknown as Record<string, unknown>, DISPLAY_KEYS)
  for (const f of table) copyDefinedKeys(acc.get(f.prop)!, f as unknown as Record<string, unknown>, DISPLAY_KEYS)

  // 5) permissionValue:任一面给了就取(首个非空)。
  for (const f of [...query, ...table, ...form]) {
    if (f.permissionValue && acc.get(f.prop)!.permissionValue === undefined) {
      acc.get(f.prop)!.permissionValue = f.permissionValue
    }
  }

  // 6) 组装 fields[],显式写入三个成员布尔。
  const fields = order.map((prop) => {
    const c = acc.get(prop)!
    return {
      ...c,
      inQuery: inQuery.has(prop),
      inTable: inTable.has(prop),
      inForm: inForm.has(prop),
    }
  }) as StructuredCrudConfigInput['fields']

  // 7) actions:显式优先;否则按 dialogs / 表单存在性推导。
  const actions = input.actions ?? deriveActions(input)

  const config: StructuredCrudConfigInput = {
    name: input.name,
    apiUrl: input.apiUrl,
    fields,
    actions,
    ...(input.target !== undefined ? { target: input.target } : {}),
    ...(input.mode !== undefined ? { mode: input.mode } : {}),
    ...(input.typescript !== undefined ? { typescript: input.typescript } : {}),
    ...(input.i18n !== undefined ? { i18n: input.i18n } : {}),
    ...(input.tableOptions !== undefined ? { tableOptions: input.tableOptions } : {}),
    ...(input.pagination !== undefined ? { pagination: input.pagination } : {}),
    ...(input.permissions !== undefined ? { permissions: input.permissions } : {}),
    ...(input.formLayout !== undefined ? { formLayout: input.formLayout } : {}),
    ...(input.operationColumn !== undefined ? { operationColumn: input.operationColumn } : {}),
    ...(input.tableBtns !== undefined ? { tableBtns: input.tableBtns } : {}),
    ...(input.toolbarBtns !== undefined ? { toolbarBtns: input.toolbarBtns } : {}),
    ...(input.dialogs !== undefined ? { dialogs: input.dialogs } : {}),
  }

  return { config, warnings }
}

/**
 * 动作推导(仅当调用方未显式给 actions):
 *   - 有 dialogs → 按 dialog key 命中 add/edit/view
 *   - 否则有表单面 → ['add','edit']
 *   - 否则 → ['view'](只读列表)
 */
function deriveActions(input: ComposeCrudInput): CrudAction[] {
  const dialogKeys = input.dialogs ? Object.keys(input.dialogs) : []
  if (dialogKeys.length) {
    const out: CrudAction[] = []
    for (const k of ['add', 'edit', 'view'] as const) {
      if (dialogKeys.includes(k)) out.push(k)
    }
    if (out.length) return out
  }
  if ((input.form ?? []).length) return ['add', 'edit']
  return ['view']
}
