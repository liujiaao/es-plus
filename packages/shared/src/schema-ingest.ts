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

// ── 通用扫描小工具（TS / SQL 共用）───────────────────────────

/**
 * 从 `{` / `(` 处取平衡闭合内的文本。
 * 字符串与注释里的括号不计 —— 否则 `DEFAULT '}'` 或 `enum('a(b')` 会提前截断。
 */
function sliceBalanced(text: string, openIndex: number): string | null {
  const open = text[openIndex]
  if (open !== '{' && open !== '(') return null
  const close = open === '{' ? '}' : ')'
  let depth = 0
  let quote: string | null = null
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i]
    if (quote) {
      if (ch === '\\') i++
      else if (ch === quote) quote = null
      continue
    }
    if (ch === '/' && text[i + 1] === '/') {
      const nl = text.indexOf('\n', i)
      i = nl === -1 ? text.length : nl
      continue
    }
    if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2)
      i = end === -1 ? text.length : end + 1
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch
      continue
    }
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return text.slice(openIndex + 1, i)
    }
  }
  return null
}

/** 按顶层分隔符切分；括号/泛型/字符串/注释内部的分隔符不切。 */
function splitTopLevel(text: string, sepChars: string): string[] {
  const out: string[] = []
  let cur = ''
  let depth = 0
  let quote: string | null = null
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quote) {
      cur += ch
      if (ch === '\\') cur += text[++i] ?? ''
      else if (ch === quote) quote = null
      continue
    }
    if (ch === '/' && text[i + 1] === '/') {
      const nl = text.indexOf('\n', i)
      i = nl === -1 ? text.length : nl - 1
      continue
    }
    if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2)
      i = end === -1 ? text.length : end + 1
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch
      cur += ch
      continue
    }
    if ('([{<'.includes(ch)) {
      depth++
      cur += ch
      continue
    }
    if (')]}>'.includes(ch)) {
      depth = Math.max(0, depth - 1)
      cur += ch
      continue
    }
    if (depth === 0 && sepChars.includes(ch)) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim()).filter(Boolean)
}

function stripIdent(s: string): string {
  return s.replace(/^[`"'[]/, '').replace(/[`"'\]]$/, '')
}

// ── TypeScript interface / type 字面量 ──────────────────────

/**
 * 切出 TS 类型体的成员；紧邻成员的 JSDoc 保留为 label。
 * 只按顶层换行/分号切（内联对象、泛型参数里的分隔符不切）。
 */
function splitTsMembers(body: string): Array<{ raw: string; doc?: string }> {
  const chunks: string[] = []
  let cur = ''
  let depth = 0
  let quote: string | null = null
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (quote) {
      cur += ch
      if (ch === '\\') cur += body[++i] ?? ''
      else if (ch === quote) quote = null
      continue
    }
    if (ch === '/' && body[i + 1] === '/') {
      const nl = body.indexOf('\n', i)
      i = nl === -1 ? body.length : nl - 1
      continue
    }
    if (ch === '/' && body[i + 1] === '*') {
      const end = body.indexOf('*/', i + 2)
      cur += body.slice(i, end === -1 ? body.length : end + 2)
      i = end === -1 ? body.length : end + 1
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch
      cur += ch
      continue
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth = Math.max(0, depth - 1)
    if (depth === 0 && (ch === '\n' || ch === ';')) {
      chunks.push(cur)
      cur = ''
      continue
    }
    cur += ch === '\n' ? ' ' : ch
  }
  chunks.push(cur)

  const out: Array<{ raw: string; doc?: string }> = []
  let pendingDoc: string | undefined
  const normalizeDoc = (s: string) =>
    s
      .split('\n')
      .map((l) => l.replace(/^\s*\*?\s?/, '').trim())
      .filter(Boolean)
      .join(' ')

  for (const chunk of chunks) {
    const trimmed = chunk.trim()
    if (!trimmed) continue
    // 纯 JSDoc 块（注释独占一行/被换行切开）→ 挂到下一个成员。
    const pure = /^\/\*\*([\s\S]*?)\*\/$/.exec(trimmed)
    if (pure) {
      pendingDoc = normalizeDoc(pure[1]) || undefined
      continue
    }
    const m = /^\/\*\*([\s\S]*?)\*\/\s*([\s\S]*)$/.exec(trimmed)
    if (m) {
      const doc = normalizeDoc(m[1]) || pendingDoc
      out.push({ raw: m[2].trim(), doc })
    } else {
      out.push({ raw: trimmed, doc: pendingDoc })
    }
    pendingDoc = undefined
  }
  return out.filter((x) => x.raw)
}

type IngestTypeDescriptor = TypeDescriptor & { enumVals?: unknown[] }

/** TS 类型表达式 → 摄取层的最小判定输入。未知命名类型告警并兜底 Input。 */
function parseTsType(raw: string, warnings: string[], key: string): IngestTypeDescriptor {
  const literal = (s: string): string | null => {
    const m = /^(['"`])([\s\S]*)\1$/.exec(s)
    return m ? m[2] : null
  }
  // `string | null` 去掉 null/undefined；字面量联合 = 枚举。
  const members = splitTopLevel(raw, '|').filter((s) => s !== 'null' && s !== 'undefined')
  if (members.length === 0) return { type: 'string' }
  if (members.length > 1) {
    const lits = members.map(literal)
    if (lits.every((v) => v !== null)) {
      return { type: 'string', hasEnum: true, enumVals: lits as string[] }
    }
    warnings.push(
      `字段 "${key}" 是联合类型(${members.join(' | ')})—— 已按首个分支兜底；需要枚举请写成字符串字面量联合。`,
    )
    return parseTsType(members[0], warnings, key)
  }

  let s = members[0]
  if (s.startsWith('(') && s.endsWith(')')) s = s.slice(1, -1).trim()

  let arrayItem: string | null = null
  if (s.endsWith('[]')) arrayItem = s.slice(0, -2).trim()
  else {
    const arr = /^(?:ReadonlyArray|Array)\s*<([\s\S]+)>$/.exec(s)
    if (arr) arrayItem = arr[1].trim()
  }
  if (arrayItem !== null) {
    const inner = parseTsType(arrayItem, warnings, key)
    return inner.hasEnum
      ? { type: 'array', hasEnum: true, enumVals: inner.enumVals }
      : { type: 'array' }
  }

  if (s === 'string') return { type: 'string' }
  if (s === 'number' || s === 'bigint') return { type: 'number' }
  if (s === 'boolean') return { type: 'boolean' }
  if (s === 'Date') return { type: 'string', format: 'date-time' }
  if (s === 'any' || s === 'unknown' || s === 'null' || s === 'undefined') return { type: 'string' }
  const lit = literal(s)
  if (lit !== null) return { type: 'string', hasEnum: true, enumVals: [lit] }
  if (s.startsWith('{') || /^(?:Record|Map|Set|object)\b/.test(s)) return { type: 'object' }

  warnings.push(`字段 "${key}" 的类型 "${s}" 未能识别 —— 已按 Input 兜底(嵌套类型请手工展开)。`)
  return { type: 'string' }
}

/**
 * 解析 `interface X { ... }` / `type X = { ... }`。
 * 只做「类型 → formtype」：非可选成员标记 required（TS 语义），JSDoc 首行作 label。
 */
function ingestTsInterface(
  text: string,
  warnings: string[],
): { name?: string; fields: SurfaceField[] } {
  const declRe = /\b(?:export\s+)?(?:default\s+)?(?:interface|type)\s+([A-Za-z_$][\w$]*)\s*(?:<[^>{}]*>)?\s*(?:=\s*)?\{/g
  const decls = [...text.matchAll(declRe)]
  if (decls.length === 0) {
    warnings.push('没有找到 interface / type 字面量声明 —— 无法抽取字段。')
    return { fields: [] }
  }
  if (decls.length > 1) {
    warnings.push(
      `发现多个 interface/type 声明(${decls.map((m) => m[1]).join(', ')})—— 已取第一个 "${decls[0][1]}"。`,
    )
  }
  const first = decls[0]
  const openIndex = (first.index ?? 0) + first[0].lastIndexOf('{')
  const body = sliceBalanced(text, openIndex)
  if (body === null) {
    warnings.push(`interface "${first[1]}" 的花括号不完整 —— 无法抽取字段。`)
    return { fields: [] }
  }

  const fields: SurfaceField[] = []
  for (const member of splitTsMembers(body)) {
    const m = /^(?:readonly\s+|public\s+|private\s+|protected\s+)?([A-Za-z_$][\w$]*|"[^"]+"|'[^']+')\s*(\?)?\s*:\s*([\s\S]+)$/.exec(
      member.raw,
    )
    if (!m) {
      warnings.push(`成员 "${member.raw.slice(0, 40)}" 不是 "prop: type" 形态 —— 已忽略。`)
      continue
    }
    const prop = stripIdent(m[1])
    const optional = m[2] === '?'
    const desc = parseTsType(m[3], warnings, prop)
    const formtype = defaultFormtypeForType(desc)
    const field: SurfaceField = { prop, label: member.doc ?? prop, formtype }
    if (!optional) field.required = true
    if (
      desc.hasEnum &&
      desc.enumVals?.length &&
      (formtype === 'Select' || formtype === 'Checkbox' || formtype === 'Radio')
    ) {
      field.dataOptions = enumToDataOptions(desc.enumVals)
    }
    if (desc.type === 'object') {
      warnings.push(`字段 "${prop}" 是嵌套对象 —— 已按 Input 兜底,可能需手工展开。`)
    }
    if (desc.type === 'array' && !desc.hasEnum) {
      warnings.push(`字段 "${prop}" 是无枚举数组 —— 已按 Input 兜底。`)
    }
    fields.push(field)
  }
  if (fields.length === 0) warnings.push('interface 体里没有可摄取的数据字段。')
  return { name: pascalCase(first[1]), fields }
}

// ── SQL DDL ─────────────────────────────────────────────────

const SQL_INT_TYPES = new Set([
  'INT', 'INTEGER', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT',
  'SERIAL', 'BIGSERIAL', 'SMALLSERIAL', 'INT2', 'INT4', 'INT8',
])
const SQL_NUM_TYPES = new Set(['DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE', 'REAL', 'MONEY'])
const SQL_BOOL_TYPES = new Set(['BOOLEAN', 'BOOL', 'BIT'])
const SQL_DATETIME_TYPES = new Set(['DATETIME', 'TIMESTAMP', 'TIMESTAMPTZ'])
const SQL_BINARY_TYPES = new Set(['BLOB', 'BINARY', 'VARBINARY', 'BYTEA', 'TINYBLOB', 'MEDIUMBLOB', 'LONGBLOB'])
const SQL_JSON_TYPES = new Set(['JSON', 'JSONB'])
const SQL_STRING_TYPES = new Set([
  'CHAR', 'CHARACTER', 'NCHAR', 'VARCHAR', 'NVARCHAR', 'TEXT', 'TINYTEXT', 'MEDIUMTEXT',
  'LONGTEXT', 'CLOB', 'UUID', 'STRING', 'VARYING',
])

/** SQL 列类型 → 摄取层最小判定输入；`ENUM/SET(...)` 的值进 dataOptions。 */
function parseSqlType(raw: string, warnings: string[], key: string): IngestTypeDescriptor {
  const enumMatch = /^\s*(ENUM|SET)\s*\(([\s\S]*)\)\s*$/i.exec(raw)
  if (enumMatch) {
    const vals = splitTopLevel(enumMatch[2], ',')
      .map((s) => s.trim().replace(/^(['"])([\s\S]*)\1$/, '$2'))
      .filter(Boolean)
    return vals.length ? { type: 'string', hasEnum: true, enumVals: vals } : { type: 'string' }
  }

  // 去掉长度/精度参数与 UNSIGNED/ZEROFILL 修饰后取首词（DOUBLE PRECISION → DOUBLE）。
  const base = raw
    .trim()
    .toUpperCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\bUNSIGNED\b|\bZEROFILL\b/g, ' ')
    .trim()
  const head = base.split(/\s+/)[0] ?? ''

  if (SQL_INT_TYPES.has(head)) return { type: 'integer' }
  if (SQL_NUM_TYPES.has(head)) return { type: 'number' }
  if (SQL_BOOL_TYPES.has(head)) return { type: 'boolean' }
  if (head === 'DATE') return { type: 'string', format: 'date' }
  if (SQL_DATETIME_TYPES.has(head)) return { type: 'string', format: 'date-time' }
  if (head === 'TIME' || head === 'TIMETZ') return { type: 'string', format: 'time' }
  if (SQL_BINARY_TYPES.has(head)) return { type: 'string', format: 'binary' }
  if (SQL_JSON_TYPES.has(head)) return { type: 'object' }
  if (SQL_STRING_TYPES.has(head)) return { type: 'string' }

  warnings.push(`字段 "${key}" 的 SQL 类型 "${raw.trim()}" 未能识别 —— 已按 Input 兜底。`)
  return { type: 'string' }
}

/**
 * 解析 `CREATE TABLE ... (...)`（MySQL / PostgreSQL 常见列定义）。
 * 表级约束（PRIMARY KEY (...)、KEY、CONSTRAINT、FOREIGN KEY…）整条跳过；
 * `NOT NULL` / `PRIMARY KEY` 标记 required，`COMMENT '...'` 作 label。
 */
function ingestSqlDdl(
  text: string,
  warnings: string[],
): { name?: string; fields: SurfaceField[] } {
  const tableRe = /\bCREATE\s+(?:TEMP(?:ORARY)?\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(]+)\s*\(/gi
  const tables = [...text.matchAll(tableRe)]
  if (tables.length === 0) {
    warnings.push('没有找到 CREATE TABLE 声明 —— 无法抽取字段。')
    return { fields: [] }
  }
  if (tables.length > 1) {
    warnings.push(`发现 ${tables.length} 个 CREATE TABLE —— 已取第一个 "${tables[0][1]}"。`)
  }
  const first = tables[0]
  const openIndex = (first.index ?? 0) + first[0].lastIndexOf('(')
  const body = sliceBalanced(text, openIndex)
  if (body === null) {
    warnings.push('CREATE TABLE 的括号不完整 —— 无法抽取字段。')
    return { fields: [] }
  }

  const tableName = stripIdent(first[1].split('.').pop() ?? '')
  const CONSTRAINT_RE = /\s+(?=NOT\s+NULL\b|NULL\b|DEFAULT\b|PRIMARY\s+KEY\b|UNIQUE\b|AUTO_INCREMENT\b|AUTOINCREMENT\b|COMMENT\b|REFERENCES\b|CHECK\b|COLLATE\b|GENERATED\b|ON\s+UPDATE\b)/i

  const fields: SurfaceField[] = []
  for (const item of splitTopLevel(body, ',')) {
    if (/^(?:CONSTRAINT|PRIMARY\s+KEY|UNIQUE|KEY|INDEX|FOREIGN\s+KEY|CHECK|FULLTEXT|SPATIAL)\b/i.test(item)) {
      continue
    }
    const m = /^(`[^`]+`|"[^"]+"|\[[^\]]+\]|[A-Za-z_][\w$]*)\s+([\s\S]+)$/.exec(item)
    if (!m) {
      warnings.push(`列定义 "${item.slice(0, 40)}" 无法识别 —— 已忽略。`)
      continue
    }
    const prop = stripIdent(m[1])
    const rest = m[2]
    const typeText = rest.split(CONSTRAINT_RE)[0].trim()
    const desc = parseSqlType(typeText, warnings, prop)
    const formtype = defaultFormtypeForType(desc)
    const comment = /\bCOMMENT\s+(['"])([\s\S]*?)\1/i.exec(rest)
    const field: SurfaceField = { prop, label: comment?.[2]?.trim() || prop, formtype }
    if (/\bNOT\s+NULL\b|\bPRIMARY\s+KEY\b/i.test(rest)) field.required = true
    if (
      desc.hasEnum &&
      desc.enumVals?.length &&
      (formtype === 'Select' || formtype === 'Checkbox' || formtype === 'Radio')
    ) {
      field.dataOptions = enumToDataOptions(desc.enumVals)
    }
    if (desc.type === 'object') {
      warnings.push(`字段 "${prop}" 是 JSON 对象 —— 已按 Input 兜底,可能需手工展开。`)
    }
    fields.push(field)
  }
  if (fields.length === 0) warnings.push('CREATE TABLE 体里没有可摄取的列。')
  return { name: pascalCase(tableName), fields }
}

// ── 入口 ─────────────────────────────────────────────────────

/**
 * 把结构化 schema 文本摄取为字段表。永不抛错——所有失败路径都降级为 warnings。
 *
 * - `jsonSchema`:解析 JSON,读 properties(+required+enum+title)。
 * - `openapi`:取 components.schemas 的首个 schema,复用 jsonSchema 路径;YAML 本版只告警。
 * - `sample-json`:按 typeof + ISO 日期启发推断(无 enum 信息)。
 * - `ts-interface`:`interface X { ... }` / `type X = { ... }`;JSDoc 作 label,类型→formtype。
 * - `sql-ddl`:`CREATE TABLE ...`;列类型→formtype,`COMMENT` 作 label,`NOT NULL` 作 required。
 */
export function ingestSchema(text: string, kind: SchemaKind): IngestResult {
  const warnings: string[] = []
  if (kind === 'ts-interface') {
    const out = ingestTsInterface(text, warnings)
    return { name: out.name, fields: out.fields, warnings }
  }
  if (kind === 'sql-ddl') {
    const out = ingestSqlDdl(text, warnings)
    return { name: out.name, fields: out.fields, warnings }
  }

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
