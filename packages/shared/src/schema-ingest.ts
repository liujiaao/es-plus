import { VALID_FORM_TYPES, type FormType } from './contract.js'
import type { SurfaceField } from './compose-crud-config.js'

/**
 * B1 摄取层（确定性,零 LLM）——把一份结构化 schema 翻译成 `SurfaceField[]`,
 * 接上既有唯一落地路径 `composeCrudConfig → generateFromConfig`。
 *
 * **只负责数据类型 → formtype 这条轴**（integer→InputNumber、boolean→Switch…),
 * 与 ai-nl-to-config-prompt.ts 教的「按字段**含义**推断」(status→Select) 是两条
 * 不同的轴:prompt 面向自然语言、本层面向结构化类型。两者不共享映射表,也不该共享——
 * 强行让语义 prompt「引用」类型表是错配(见 wave-2 设计 §4.2 的核实修正)。
 *
 * 本层对 formtype 的唯一不变量:`defaultFormtypeForType` **全覆盖**(任何输入都返回一个
 * 合法 formtype,绝不落空到 undefined),且输出**恒 ∈ VALID_FORM_TYPES**。这正面堵住
 * Wave-1 踩过的「prompt fall-through 到 Input 教错」那个坑——由 schema-ingest.spec.ts
 * 的全覆盖断言守护。
 */

export type SchemaKind = 'openapi' | 'jsonSchema' | 'ts-interface' | 'sql-ddl' | 'sample-json'

export interface IngestResult {
  /** 从 schema 的 title / schema key 推出的 PascalCase 资源名;推不出则留空,由调用方补。 */
  name?: string
  /** 扁平属性表(不含 inQuery/inTable/inForm 成员——那由 composeCrudConfig 推导)。 */
  fields: SurfaceField[]
  /** 永不抛错:解析失败 / 不支持的 kind / 无法映射的字段都降级为告警。 */
  warnings: string[]
}

/** 数据类型描述——摄取层从各 kind 归一出的最小判定输入。 */
export interface TypeDescriptor {
  /** JSON Schema / OpenAPI 的 type:string | integer | number | boolean | array | object。 */
  type: string
  /** JSON Schema format:date | date-time | time | binary | email | … */
  format?: string
  /** 该字段(或数组 items)是否带有限枚举。 */
  hasEnum?: boolean
}

/**
 * 数据类型 → formtype 的**单一事实源**(供摄取层预填)。
 *
 * 全覆盖 + 输出恒 ∈ VALID_FORM_TYPES:任何 type 都有确定归宿,未知/对象/裸数组统一
 * 兜底到 Input(调用方另发「不可直接表单化」告警,而非静默吞字段)。
 */
export function defaultFormtypeForType(d: TypeDescriptor): FormType {
  const type = (d.type || '').toLowerCase()
  const format = (d.format || '').toLowerCase()
  switch (type) {
    case 'integer':
    case 'number':
      return 'InputNumber'
    case 'boolean':
      return 'Switch'
    case 'array':
      // 带枚举 items → 多选 Checkbox;裸数组无声明控件 → Input 兜底(调用方告警)。
      return d.hasEnum ? 'Checkbox' : 'Input'
    case 'string': {
      if (format === 'date' || format === 'date-time' || format === 'datetime') return 'DatePicker'
      if (format === 'time') return 'TimePicker'
      if (format === 'binary' || format === 'byte') return 'Upload'
      if (d.hasEnum) return 'Select'
      return 'Input'
    }
    case 'object':
    default:
      // 嵌套对象 / 未知类型:无标量控件 → Input 兜底(调用方告警)。
      return 'Input'
  }
}

// ── 公共小工具 ──────────────────────────────────────────────

/** 把任意字符串归一为 PascalCase 资源名;空/无字母数字 → undefined。 */
function pascalCase(s: unknown): string | undefined {
  if (typeof s !== 'string') return undefined
  const parts = s.split(/[^A-Za-z0-9]+/).filter(Boolean)
  if (!parts.length) return undefined
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('')
}

/** 取字段标签:优先 schema 的 title,否则回落到属性键。 */
function labelOf(raw: unknown, key: string): string {
  if (raw && typeof raw === 'object') {
    const title = (raw as Record<string, unknown>).title
    if (typeof title === 'string' && title.trim()) return title
  }
  return key
}

/**
 * 归一 JSON Schema 的 type:
 *  - 数组形态(`['string','null']`)取首个非 null;
 *  - 缺省/非字符串但带 enum → 'string'(JSON Schema 允许 enum-only);
 *  - 其余缺省 → 'string'(最终兜底 Input)。
 */
function normalizeSchemaType(raw: Record<string, unknown>): string {
  let t = raw.type
  if (Array.isArray(t)) t = t.find((x) => x !== 'null') ?? t[0]
  if (typeof t === 'string') return t
  return 'string'
}

/** 从枚举值数组生成 dataOptions(label 用字符串化的值,value 原样保留)。 */
function enumToDataOptions(enumVals: unknown[]): Array<{ label: string; value: unknown }> {
  return enumVals.map((v) => ({ label: String(v), value: v }))
}

// ── JSON Schema / OpenAPI ────────────────────────────────────

/** 把一个 JSON Schema object(含 properties)翻成字段表。 */
function ingestJsonSchemaObject(
  schemaObj: Record<string, unknown> | null | undefined,
  warnings: string[],
): { name?: string; fields: SurfaceField[] } {
  const fields: SurfaceField[] = []
  const props = schemaObj && typeof schemaObj === 'object' ? schemaObj.properties : undefined
  if (!props || typeof props !== 'object') {
    warnings.push('schema 没有 properties —— 无法抽取字段。')
    return { fields }
  }
  const requiredList = schemaObj && Array.isArray(schemaObj.required) ? schemaObj.required : []
  const requiredSet = new Set(requiredList)

  for (const [key, rawUnknown] of Object.entries(props as Record<string, unknown>)) {
    const raw = (rawUnknown && typeof rawUnknown === 'object' ? rawUnknown : {}) as Record<string, unknown>

    if (typeof raw.$ref === 'string') {
      warnings.push(`字段 "${key}" 是 $ref(${raw.$ref})—— 未解析引用,已按 Input 兜底。`)
      fields.push({ prop: key, label: labelOf(raw, key), formtype: 'Input' })
      continue
    }

    const type = normalizeSchemaType(raw)
    // 枚举可能挂在字段本身(string enum)或数组 items 上(array of enum)。
    const items = raw.items && typeof raw.items === 'object' ? (raw.items as Record<string, unknown>) : null
    const enumVals = Array.isArray(raw.enum)
      ? raw.enum
      : items && Array.isArray(items.enum)
        ? items.enum
        : null
    const hasEnum = !!enumVals && enumVals.length > 0

    const formtype = defaultFormtypeForType({
      type,
      format: typeof raw.format === 'string' ? raw.format : undefined,
      hasEnum,
    })
    const field: SurfaceField = { prop: key, label: labelOf(raw, key), formtype }
    if (requiredSet.has(key)) field.required = true
    if (hasEnum && (formtype === 'Select' || formtype === 'Checkbox' || formtype === 'Radio')) {
      field.dataOptions = enumToDataOptions(enumVals as unknown[])
    }
    if (type === 'object') warnings.push(`字段 "${key}" 是嵌套对象 —— 已按 Input 兜底,可能需手工展开。`)
    if (type === 'array' && !hasEnum) warnings.push(`字段 "${key}" 是无枚举数组 —— 已按 Input 兜底。`)
    fields.push(field)
  }

  const name = pascalCase(schemaObj?.title)
  return { name, fields }
}

/** 从 OpenAPI 文档的 components.schemas 取目标 schema,再委托 jsonSchema 路径。 */
function ingestOpenApi(
  doc: Record<string, unknown>,
  warnings: string[],
): { name?: string; fields: SurfaceField[] } {
  const components = doc.components && typeof doc.components === 'object' ? (doc.components as Record<string, unknown>) : null
  const schemas = components && components.schemas && typeof components.schemas === 'object'
    ? (components.schemas as Record<string, unknown>)
    : null
  if (!schemas) {
    warnings.push('OpenAPI 文档没有 components.schemas —— 无法抽取字段。')
    return { fields: [] }
  }
  const keys = Object.keys(schemas)
  if (keys.length === 0) {
    warnings.push('components.schemas 为空 —— 无 schema 可摄取。')
    return { fields: [] }
  }
  if (keys.length > 1) {
    warnings.push(`components.schemas 含多个 schema(${keys.join(', ')})—— 已取第一个 "${keys[0]}"。`)
  }
  const target = schemas[keys[0]] as Record<string, unknown>
  const result = ingestJsonSchemaObject(target, warnings)
  return { name: result.name ?? pascalCase(keys[0]), fields: result.fields }
}

// ── 样例 JSON ────────────────────────────────────────────────

const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?/

/** 从一个样例值推断 type/format(无 schema 信息,只能靠 typeof + ISO 日期启发)。 */
function inferSampleType(v: unknown): TypeDescriptor {
  if (typeof v === 'number') return { type: Number.isInteger(v) ? 'integer' : 'number' }
  if (typeof v === 'boolean') return { type: 'boolean' }
  if (Array.isArray(v)) return { type: 'array' }
  if (v && typeof v === 'object') return { type: 'object' }
  if (typeof v === 'string' && ISO_DATE.test(v)) return { type: 'string', format: 'date-time' }
  // string / null / undefined → 回落 string → Input。
  return { type: 'string' }
}

/** 从一条样例对象(数组则取首元素)推断字段表。 */
function ingestSampleJson(
  value: unknown,
  warnings: string[],
): { name?: string; fields: SurfaceField[] } {
  let obj = value
  if (Array.isArray(value)) {
    if (value.length === 0) {
      warnings.push('样例 JSON 是空数组 —— 无法推断字段。')
      return { fields: [] }
    }
    obj = value[0]
  }
  if (!obj || typeof obj !== 'object') {
    warnings.push('样例 JSON 不是对象 —— 无法推断字段。')
    return { fields: [] }
  }
  const fields: SurfaceField[] = []
  for (const [key, v] of Object.entries(obj as Record<string, unknown>)) {
    const desc = inferSampleType(v)
    fields.push({ prop: key, label: key, formtype: defaultFormtypeForType(desc) })
    if (desc.type === 'object') warnings.push(`字段 "${key}" 是嵌套对象 —— 已按 Input 兜底。`)
    if (desc.type === 'array') warnings.push(`字段 "${key}" 是数组 —— 样例无枚举信息,已按 Input 兜底。`)
  }
  return { fields }
}

// ── 入口 ─────────────────────────────────────────────────────

/**
 * 把结构化 schema 文本摄取为字段表。永不抛错——所有失败路径都降级为 warnings。
 *
 * - `jsonSchema`:解析 JSON,读 properties(+required+enum+title)。
 * - `openapi`:取 components.schemas 的首个 schema,复用 jsonSchema 路径;YAML 本版只告警。
 * - `sample-json`:按 typeof + ISO 日期启发推断(无 enum 信息)。
 * - `ts-interface` / `sql-ddl`:本版 stub,返回空 + 指引告警。
 */
export function ingestSchema(text: string, kind: SchemaKind): IngestResult {
  if (kind === 'ts-interface' || kind === 'sql-ddl') {
    return {
      fields: [],
      warnings: [`kind "${kind}" 暂未支持 —— 请改用 JSON Schema / OpenAPI / 样例 JSON。`],
    }
  }

  const warnings: string[] = []
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    warnings.push(
      `无法解析为 JSON${kind === 'openapi' ? '(OpenAPI 的 YAML 形态本版暂不支持,请转成 JSON)' : ''}:${detail}`,
    )
    return { fields: [], warnings }
  }

  const doc = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>
  let out: { name?: string; fields: SurfaceField[] }
  switch (kind) {
    case 'openapi':
      out = ingestOpenApi(doc, warnings)
      break
    case 'jsonSchema':
      out = ingestJsonSchemaObject(doc, warnings)
      break
    case 'sample-json':
      out = ingestSampleJson(parsed, warnings)
      break
    default: {
      // 穷尽保护:新增 kind 时若漏接会在此被类型系统逮住。
      const _exhaustive: never = kind
      out = { fields: [] }
      void _exhaustive
    }
  }
  return { name: out.name, fields: out.fields, warnings }
}

/** 导出给全覆盖断言用:摄取层保证 defaultFormtypeForType 的输出恒落在此集合内。 */
export const INGEST_FORM_TYPES: readonly FormType[] = VALID_FORM_TYPES
