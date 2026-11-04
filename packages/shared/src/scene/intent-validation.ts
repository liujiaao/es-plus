/**
 * 宿主意图的**生成前校验**（P13）—— 只判、不改、不生成。
 *
 * ## 为什么需要它
 *
 * `generate_scene` 拿到意图后直接发射：结构错了有 Zod 挡着，但**语义性错误**在结构上
 * 完全合法 —— 明细字段被放进 `query`、同一个 `prop` 在一个面里写了两遍、把
 * `inQuery: true` 这种「组合配置的键」抄进意图表、`label` 与规格原文对不上、把
 * 创建时间放进可编辑表单。这些都能顺利生成一份「不报错但不对」的页面，正是 P13
 * 要堵的宿主抽取缺口。
 *
 * 本模块提供**确定性**判据（不调模型、不写库、不修配置），返回逐条 issue：
 *   - `errors`   —— 生成器会拒绝或静默丢弃的形状（未知面名、重复 prop、未知弹窗 key…）；
 *   - `warnings` —— 合法但高度可疑（空面、query 字段不是表格列、label 不在规格里、
 *                   系统字段进了表单、能力降级）。
 *
 * 结构级问题（类型不符、未知键）由 MCP 层的**同一份 Zod schema** 补判 —— 那层能直接
 * 复用 `SCENE_INTENT_SCHEMAS`，不会长出第三份字段清单；本模块只做 schema 看不见的
 * 那一半。能力判定复用 P9 的 `assessIntent`，不另写一套降级规则。
 *
 * ## 边界
 *
 * 纯函数、不抛错（未知场景除外 —— 那是调用方的编程错误）。它**不生成代码**，
 * 也不回灌模型：宿主拿到报告后自己修意图，再调生成工具。
 */
import { FORM_TYPE_ALIASES, VALID_FORM_TYPES } from '../contract.js'
import { isSafeProp } from '../prop-safety.js'
import { assessIntent, type IntentCapability } from './capability.js'
import { DIALOG_TITLES, type SceneId } from './registry.js'

export const INTENT_VALIDATION_CONTRACT_VERSION = 'es-plus.intent-validation@1' as const

/** CRUD 意图里合法的面名（与 design-extraction / generate_crud 的 surfaces 一致）。 */
export const SURFACE_NAMES = ['query', 'table', 'form', 'dialog'] as const
export type SurfaceName = (typeof SURFACE_NAMES)[number]

/**
 * 组合配置的成员键。它们在 `StructuredCrudConfig.fields` 里表达归属，**不在**前门意图
 * 里出现 —— 前门的归属由「字段在哪个面数组」表达。抄进意图会被 Zod 静默剥掉，
 * 于是宿主以为限制了面、实际没有。设计契约 N3 专门点名过这条。
 */
export const MEMBERSHIP_FLAGS = ['inQuery', 'inTable', 'inForm'] as const

/** 系统生成字段：默认不该进可编辑表单（design-extraction N2）。 */
const SYSTEM_FIELD_PROP_RE =
  /^(?:id|createdAt|updatedAt|createTime|updateTime|createdBy|updatedBy|createBy|updateBy|creator|updater)$/
/** 规格里的中文说法同样识别（“创建时间 / 更新时间 / 创建人”）。 */
const SYSTEM_FIELD_LABEL_RE = /(创建|更新|修改)(时间|人|者)|系统生成/

const FORM_TYPE_SET = new Set<string>([...VALID_FORM_TYPES, ...Object.keys(FORM_TYPE_ALIASES)])

export interface IntentIssue {
  /** 与 Zod issue 同形态：`/surfaces/query/0/formtype`。 */
  path: string
  /** 稳定机器码（宿主/评测可按码过滤，不依赖文案）。 */
  code: string
  message: string
}

export interface IntentSurfaceStats {
  query: number
  table: number
  form: number
  dialog: number
}

export interface IntentValidationReport {
  contract: typeof INTENT_VALIDATION_CONTRACT_VERSION
  scene: SceneId
  ok: boolean
  /** P9 能力台账的逐键判定（accepted / degraded / unsupported / missing）。 */
  capability: IntentCapability
  errors: readonly IntentIssue[]
  warnings: readonly IntentIssue[]
  stats: {
    /** 字段条目总数（query + table + form + dialog.formItems + 片段 fields）。 */
    fields: number
    /** CRUD 四个面的条目数；非 CRUD 场景为 null。 */
    surfaces: IntentSurfaceStats | null
  }
}

export interface ValidateIntentInput {
  scene: SceneId
  intent: unknown
  /** 规格原文（可选）。提供时 `label` 必须能在原文里逐字找到（design-extraction N6）。 */
  spec?: string
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

const joinPath = (base: string, key: string | number) => `${base}/${key}`

function issue(path: string, code: string, message: string): IntentIssue {
  return { path, code, message }
}

interface FieldListResult {
  errors: IntentIssue[]
  warnings: IntentIssue[]
  /** 列表条目数（弹窗里 = 弹窗个数，不是字段数）。 */
  count: number
  /** 字段条目数；弹窗列表用它单独累计 `formItems`。 */
  fields: number
  props: string[]
}

interface FieldListOptions {
  /** `query` / `form` / 片段表单必填；`table` 的 formtype 是幻影要求（生成器不读）。 */
  formtypeRequired: boolean
  /** 这是「可编辑表单」面：系统生成字段出现时给一条警告。 */
  editableForm?: boolean
  spec?: string
  /** 该列表在意图里的根路径（`/surfaces/query` 或 `/fields`）。 */
  path: string
}

/**
 * 校验一个字段列表。归属规则与 `surfaceFieldSchema` 对齐，但**不重复**它的类型/枚举
 * 检查（那层由 MCP 的同一份 Zod 形状补判）；这里只做 Zod 结构上看不见的判断：
 * 重复 prop、成员键残留、label 与规格不一致、系统字段进表单。
 */
function checkFieldList(list: unknown, opts: FieldListOptions): FieldListResult {
  const { path, formtypeRequired, editableForm = false, spec } = opts
  const errors: IntentIssue[] = []
  const warnings: IntentIssue[] = []

  if (!Array.isArray(list)) {
    errors.push(issue(path || '/', 'field-list-not-array', 'must be an array of field entries.'))
    return { errors, warnings, count: 0, fields: 0, props: [] }
  }

  const firstIndexByProp = new Map<string, number>()
  const props: string[] = []

  list.forEach((entry, index) => {
    const here = joinPath(path, index)
    if (!isRecord(entry)) {
      errors.push(
        issue(here, 'field-not-object', 'each field entry must be an object with prop / label / formtype.'),
      )
      return
    }

    const prop = entry.prop
    if (typeof prop !== 'string' || prop.trim() === '') {
      errors.push(issue(joinPath(here, 'prop'), 'missing-prop', 'prop is required (camelCase data key).'))
    } else {
      props.push(prop)
      if (!isSafeProp(prop)) {
        errors.push(
          issue(
            joinPath(here, 'prop'),
            'unsafe-prop',
            `prop "${prop}" must not contain path separators (/ \\), empty/"."/".." segments, or __proto__/constructor/prototype.`,
          ),
        )
      }
      const first = firstIndexByProp.get(prop)
      if (first !== undefined) {
        errors.push(
          issue(
            joinPath(here, 'prop'),
            'duplicate-prop',
            `duplicate prop "${prop}" in the same surface (first at ${joinPath(path, first)}) — ` +
              'the generator would render two columns/controls bound to the same key.',
          ),
        )
      } else {
        firstIndexByProp.set(prop, index)
      }
    }

    const label = entry.label
    if (typeof label !== 'string' || label.trim() === '') {
      errors.push(issue(joinPath(here, 'label'), 'missing-label', 'label is required (use the spec\'s wording).'))
    } else if (spec && spec.length > 0 && !spec.includes(label)) {
      warnings.push(
        issue(
          joinPath(here, 'label'),
          'label-not-in-spec',
          `label "${label}" does not appear verbatim in the provided spec — the reviewer compares labels; ` +
            'copy the user\'s wording instead of inventing one.',
        ),
      )
    }

    const rawFormtype = entry.formtype
    const formtype = typeof rawFormtype === 'string' ? rawFormtype : undefined
    if (formtype === undefined || formtype.trim() === '') {
      if (formtypeRequired) {
        errors.push(
          issue(
            joinPath(here, 'formtype'),
            'missing-formtype',
            'formtype is required for this surface — pick by MEANING (status/enum → Select, date → DatePicker, number → InputNumber, on/off → Switch).',
          ),
        )
      }
    } else if (!FORM_TYPE_SET.has(formtype)) {
      errors.push(
        issue(
          joinPath(here, 'formtype'),
          'unknown-formtype',
          `unknown formtype "${formtype}" — legal values: ${[...FORM_TYPE_SET].join(', ')}.`,
        ),
      )
    }

    for (const flag of MEMBERSHIP_FLAGS) {
      if (flag in entry) {
        errors.push(
          issue(
            joinPath(here, flag),
            'membership-flag',
            `"${flag}" is not part of the front-door intent — membership is expressed by WHICH surface list ` +
              'contains the field. Remove the flag (it would be silently dropped, leaving the membership wrong).',
          ),
        )
      }
    }

    if (editableForm) {
      const byProp = typeof prop === 'string' && SYSTEM_FIELD_PROP_RE.test(prop)
      const byLabel = typeof label === 'string' && SYSTEM_FIELD_LABEL_RE.test(label)
      if (byProp || byLabel) {
        warnings.push(
          issue(
            joinPath(here, 'prop'),
            'system-field-in-form',
            `"${String(prop ?? label)}" looks system-generated (id / created / updated / 创建时间 / 创建人) — ` +
              'system fields belong in the table (at most), never in an editable form.',
          ),
        )
      }
    }
  })

  return { errors, warnings, count: list.length, fields: list.length, props }
}

/** 弹窗条目：罐头 key（add/edit/view）或全参对象；自定义 key 必须用对象形态。 */
function checkDialogs(list: unknown, path: string, spec?: string): FieldListResult & { count: number } {
  const errors: IntentIssue[] = []
  const warnings: IntentIssue[] = []
  let fieldCount = 0

  if (!Array.isArray(list)) {
    errors.push(issue(path || '/', 'dialog-list-not-array', 'surfaces.dialog must be an array.'))
    return { errors, warnings, count: 0, fields: 0, props: [] }
  }

  const seenKeys = new Map<string, number>()
  const canned = new Set(Object.keys(DIALOG_TITLES))

  list.forEach((entry, index) => {
    const here = joinPath(path, index)
    let key: string | null = null

    if (typeof entry === 'string') {
      key = entry
      if (!canned.has(entry)) {
        errors.push(
          issue(
            here,
            'unknown-dialog-key',
            `unknown canned dialog key "${entry}" — canned keys are ${[...canned].join(' / ')}; ` +
              'a custom dialog must use the object form { key, title?, formItems? }.',
          ),
        )
      }
    } else if (isRecord(entry)) {
      if (typeof entry.key !== 'string' || entry.key.trim() === '') {
        errors.push(
          issue(joinPath(here, 'key'), 'missing-dialog-key', 'a dialog object needs a non-empty `key`.'),
        )
      } else {
        key = entry.key
      }
      if (entry.formItems !== undefined) {
        const formItems = checkFieldList(entry.formItems, {
          path: joinPath(here, 'formItems'),
          formtypeRequired: true,
          spec,
          editableForm: entry.key !== 'view',
        })
        errors.push(...formItems.errors)
        warnings.push(...formItems.warnings)
        fieldCount += formItems.count
      }
    } else {
      errors.push(
        issue(
          here,
          'dialog-entry',
          'a dialog entry must be a canned key string ("add"/"edit"/"view") or an object { key, title?, formItems? }.',
        ),
      )
    }

    if (key !== null) {
      const first = seenKeys.get(key)
      if (first !== undefined) {
        errors.push(
          issue(here, 'duplicate-dialog-key', `duplicate dialog key "${key}" (first at ${joinPath(path, first)}).`),
        )
      } else {
        seenKeys.set(key, index)
      }
    }
  })

  return { errors, warnings, count: list.length, fields: fieldCount, props: [] }
}

/**
 * 校验一份意图：能力判定（P9 台账）+ 面归属/字段语义。
 *
 * 不抛错：非法 `intent` 形状会变成一条错误 issue，而不是异常。未知 `scene` 由调用方
 * 保证（MCP 层用 enum，CLI 侧用 `isScene`）。
 */
export function validateIntentPlan(input: ValidateIntentInput): IntentValidationReport {
  const { scene, spec } = input
  const intent = input.intent
  const capability = assessIntent({ scene, intent })

  const errors: IntentIssue[] = []
  const warnings: IntentIssue[] = []
  let fields = 0
  let surfaces: IntentSurfaceStats | null = null

  if (!isRecord(intent)) {
    errors.push(issue('/', 'intent-not-object', 'intent must be a JSON object.'))
  } else if (scene === 'crud') {
    const raw = intent.surfaces
    if (raw !== undefined && !isRecord(raw)) {
      errors.push(issue('/surfaces', 'surfaces-not-object', 'surfaces must be an object keyed by query / table / form / dialog.'))
    } else if (isRecord(raw)) {
      const stats: IntentSurfaceStats = { query: 0, table: 0, form: 0, dialog: 0 }
      for (const key of Object.keys(raw)) {
        if (!(SURFACE_NAMES as readonly string[]).includes(key)) {
          errors.push(
            issue(
              joinPath('/surfaces', key),
              'unknown-surface',
              `unknown surface "${key}" — the visible surfaces are ${SURFACE_NAMES.join(' / ')}. ` +
                'A surface the spec does not imply must be OMITTED, not invented.',
            ),
          )
        }
      }

      let queryProps: string[] = []
      let tableProps: string[] = []
      let tablePresent = false

      for (const name of SURFACE_NAMES) {
        const value = raw[name]
        if (value === undefined) continue
        const here = joinPath('/surfaces', name)

        if (name === 'dialog') {
          const dialog = checkDialogs(value, here, spec)
          errors.push(...dialog.errors)
          warnings.push(...dialog.warnings)
          stats.dialog = dialog.count
          // 弹窗字段也是字段：`stats.fields` 的口径是「所有会渲染成控件的条目」。
          fields += dialog.fields
          continue
        }

        const result = checkFieldList(value, {
          path: here,
          formtypeRequired: name !== 'table',
          editableForm: name === 'form',
          spec,
        })
        errors.push(...result.errors)
        warnings.push(...result.warnings)
        fields += result.count
        stats[name] = result.count
        if (name === 'query') queryProps = result.props
        if (name === 'table') {
          tableProps = result.props
          tablePresent = result.count > 0
        }
        if (result.count === 0) {
          warnings.push(
            issue(
              here,
              'empty-surface',
              `"${name}" is an empty list — an empty list is an omission, not a hint. Omit the key entirely.`,
            ),
          )
        }
      }

      // 「明细字段放进 query」的确定性近似：查询条件通常也是可见列；不在表格里的查询字段
      // 值得宿主复核（日期区间这类纯过滤条件会正常命中，故只是警告）。
      if (tablePresent && queryProps.length) {
        const tableSet = new Set(tableProps)
        const value = raw.query
        if (Array.isArray(value)) {
          value.forEach((entry, index) => {
            if (!isRecord(entry) || typeof entry.prop !== 'string') return
            if (tableSet.has(entry.prop)) return
            warnings.push(
              issue(
                joinPath(joinPath('/surfaces/query', index), 'prop'),
                'query-field-not-column',
                `query field "${entry.prop}" is not a table column — confirm it is a real filter ` +
                  '(a detail-only field belongs in table/form, not query).',
              ),
            )
          })
        }
      }

      surfaces = stats
    }
  } else {
    // 片段场景：`fields` 是唯一的字段列表；table 的 formtype 仍是幻影要求。
    if (Array.isArray(intent.fields)) {
      const result = checkFieldList(intent.fields, {
        path: '/fields',
        formtypeRequired: scene !== 'table',
        editableForm: scene === 'form',
        spec,
      })
      errors.push(...result.errors)
      warnings.push(...result.warnings)
      fields = result.count
    }
  }

  // 能力台账：unsupported / missing 是「按现在这份意图生成不出来」，degraded 是「能生成但不保真」。
  for (const key of capability.unsupported) {
    const entry = capability.declared.find((d) => d.key === key)
    errors.push(issue(`/${key}`, 'unsupported-key', entry?.reason ?? `unknown key "${key}" for scene '${scene}'.`))
  }
  for (const key of capability.missing) {
    errors.push(issue(`/${key}`, 'missing-required', `required key "${key}" is missing for scene '${scene}'.`))
  }
  for (const key of capability.degraded) {
    const entry = capability.declared.find((d) => d.key === key)
    warnings.push(
      issue(
        `/${key}`,
        'degraded-key',
        `${entry?.reason ?? `${key} is not fully emitted in this mode`} ` +
          'The page still generates, but this key does not land faithfully — treat it as an extension point.',
      ),
    )
  }

  return Object.freeze({
    contract: INTENT_VALIDATION_CONTRACT_VERSION,
    scene,
    ok: errors.length === 0,
    capability,
    errors: Object.freeze(errors),
    warnings: Object.freeze(warnings),
    stats: Object.freeze({ fields, surfaces }),
  })
}
