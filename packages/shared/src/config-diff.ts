import type { StructuredCrudConfig, FieldConfig } from './structured-config.schema.js'

/**
 * 两份 StructuredCrudConfig 的结构化差异（B3 refinement loop）。
 *
 * 用途：pin（调用方自持的那份 JSON）被一轮 NL 纠正改写成 next 之后，确定性地回答
 * 「这一轮到底改了什么」——字段增删、formtype/归属/布局变更、操作增删。供 refine_config
 * 工具回显，也供 eval 的收敛判定旁证。**纯函数、不依赖 Zod**：对 input 形态（成员布尔可缺省）
 * 也成立——三成员布尔按 schema 默认（true）归一后再比，与 generateFromConfig 的运行时语义一致。
 */

/** 单个字段属性的一处变更。 */
export interface FieldAttrChange {
  attr: string
  from: unknown
  to: unknown
}

/** 一个在两份配置里都存在、但属性有差异的字段。 */
export interface FieldChange {
  prop: string
  changes: FieldAttrChange[]
}

export interface ConfigDiff {
  /** 页面名变更（仅在变化时出现）。 */
  name?: { from: string; to: string }
  /** API 基址变更（仅在变化时出现）。 */
  apiUrl?: { from: string; to: string }
  /** next 有、prev 无的字段 prop。 */
  fieldsAdded: string[]
  /** prev 有、next 无的字段 prop。 */
  fieldsRemoved: string[]
  /** 两边都在、但属性有差异的字段。 */
  fieldsChanged: FieldChange[]
  /** next 新增的操作。 */
  actionsAdded: string[]
  /** next 移除的操作。 */
  actionsRemoved: string[]
  /** 整份配置无任何差异时为 true。 */
  isEmpty: boolean
}

/**
 * 参与比对的标量字段属性。三成员布尔（inQuery/inTable/inForm）按 schema 默认 true 归一，
 * 其余按原值比（undefined ↔ 具体值也算一处真实变更）。刻意不比 dataOptions/attrs/rules
 * 这类复合属性——refinement 的可读 diff 聚焦「含义级」改动，复合属性留给整份配置回显。
 */
const SCALAR_ATTRS = ['label', 'formtype', 'inQuery', 'inTable', 'inForm', 'align', 'width', 'required'] as const
const MEMBERSHIP_ATTRS = new Set(['inQuery', 'inTable', 'inForm'])

function attrValue(field: FieldConfig, attr: string): unknown {
  const raw = (field as Record<string, unknown>)[attr]
  // 成员布尔缺省即 true（与 FieldConfigSchema 的 .default(true) 一致），避免把
  // 「省略 inForm」误报成「inForm 从 undefined 改成 true」。
  if (raw === undefined && MEMBERSHIP_ATTRS.has(attr)) return true
  return raw
}

function fieldMap(config: StructuredCrudConfig | undefined | null): Map<string, FieldConfig> {
  const map = new Map<string, FieldConfig>()
  for (const f of config?.fields ?? []) map.set(f.prop, f)
  return map
}

/** prev → next 的结构化差异。两参数都容忍松散形态（字段可缺省成员布尔、整体可为 null）。 */
export function diffConfig(
  prev: StructuredCrudConfig | undefined | null,
  next: StructuredCrudConfig | undefined | null,
): ConfigDiff {
  const prevFields = fieldMap(prev)
  const nextFields = fieldMap(next)

  const fieldsAdded: string[] = []
  const fieldsRemoved: string[] = []
  const fieldsChanged: FieldChange[] = []

  for (const prop of nextFields.keys()) {
    if (!prevFields.has(prop)) fieldsAdded.push(prop)
  }
  for (const prop of prevFields.keys()) {
    if (!nextFields.has(prop)) fieldsRemoved.push(prop)
  }
  for (const [prop, nf] of nextFields) {
    const pf = prevFields.get(prop)
    if (!pf) continue
    const changes: FieldAttrChange[] = []
    for (const attr of SCALAR_ATTRS) {
      const from = attrValue(pf, attr)
      const to = attrValue(nf, attr)
      if (from !== to) changes.push({ attr, from, to })
    }
    if (changes.length) fieldsChanged.push({ prop, changes })
  }

  const prevActions = new Set(prev?.actions ?? [])
  const nextActions = new Set(next?.actions ?? [])
  const actionsAdded = [...nextActions].filter((a) => !prevActions.has(a))
  const actionsRemoved = [...prevActions].filter((a) => !nextActions.has(a))

  const diff: ConfigDiff = {
    fieldsAdded,
    fieldsRemoved,
    fieldsChanged,
    actionsAdded,
    actionsRemoved,
    isEmpty: false,
  }
  if (prev?.name !== next?.name && (prev?.name !== undefined || next?.name !== undefined)) {
    diff.name = { from: String(prev?.name ?? ''), to: String(next?.name ?? '') }
  }
  if (prev?.apiUrl !== next?.apiUrl && (prev?.apiUrl !== undefined || next?.apiUrl !== undefined)) {
    diff.apiUrl = { from: String(prev?.apiUrl ?? ''), to: String(next?.apiUrl ?? '') }
  }

  diff.isEmpty =
    !diff.name &&
    !diff.apiUrl &&
    fieldsAdded.length === 0 &&
    fieldsRemoved.length === 0 &&
    fieldsChanged.length === 0 &&
    actionsAdded.length === 0 &&
    actionsRemoved.length === 0

  return diff
}

const show = (v: unknown): string => (v === undefined ? '∅' : JSON.stringify(v))

/** 把 ConfigDiff 渲染成逐行可读文本（供 refine_config 工具回显）。无差异时回单行提示。 */
export function summarizeDiff(diff: ConfigDiff): string[] {
  if (diff.isEmpty) return ['（无差异——这一轮纠正没有改变配置）']
  const lines: string[] = []
  if (diff.name) lines.push(`name: ${show(diff.name.from)} → ${show(diff.name.to)}`)
  if (diff.apiUrl) lines.push(`apiUrl: ${show(diff.apiUrl.from)} → ${show(diff.apiUrl.to)}`)
  for (const p of diff.fieldsAdded) lines.push(`+ 字段 ${p}`)
  for (const p of diff.fieldsRemoved) lines.push(`- 字段 ${p}`)
  for (const fc of diff.fieldsChanged) {
    const parts = fc.changes.map((c) => `${c.attr} ${show(c.from)} → ${show(c.to)}`)
    lines.push(`~ 字段 ${fc.prop}: ${parts.join(', ')}`)
  }
  for (const a of diff.actionsAdded) lines.push(`+ 操作 ${a}`)
  for (const a of diff.actionsRemoved) lines.push(`- 操作 ${a}`)
  return lines
}
