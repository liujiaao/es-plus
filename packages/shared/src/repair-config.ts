/**
 * AN-24 —— 确定性修复环（deterministic repair）。
 *
 * 目标：把**常见格式错误**在入口修掉，不消耗模型的一轮自纠。
 *
 * ## 与 `normalizeConfig` / `validateAndRepair` 的分工
 *
 *   - `normalizeConfig`：**词汇/形态**归一（别名、`rowkey` 搬迁、`dialogs` 罐头键与
 *     `formItems` 简写展开）。它只认识「同一个概念的旧写法」。
 *   - `repairConfig`（本文件）：**数据形状**修复（`null` 当作未声明、`"false"` 当作
 *     `false`、弹窗字段引用展开）。它先跑 `normalizeConfig`，再做 schema 驱动的修复。
 *   - `validateAndRepair`：**只判不改**（C2·A3）。`validate_config` 仍走它，不调用这里。
 *
 * ## 为什么是「schema 驱动 + 单调改进」
 *
 * 修复不写死字段清单，而是让 `StructuredCrudConfigSchema` 告诉我们哪里不合法：
 *
 *   1. `safeParse` → issues；
 *   2. 对每个 issue 生成**有据可查**的候选修复（见 `candidatesFor`）；
 *   3. 把候选应用到副本，重新校验：**只有 issue 总数严格下降**才接受。
 *
 * 第 3 步是安全阀：任何一条修复若不能减少错误（比如删掉一个必填键只是把
 * "类型错" 换成 "缺失"），都会被拒绝。于是修复永远不会把配置改得更坏，也不会
 * 在多个候选之间凭猜测选一个。
 *
 * ## 刻意不做的修复
 *
 *   - 不猜拼写（`rowKey`→`rowkey`、`type`→`formtype`）：多义，交给 `collectUnknownKeys`；
 *   - 不补 `.default()`（省略的 `inQuery` 仍保持省略——生成器按 `!== false` 解释，
 *     显式补 `true` 会改写输入语义，见 `assertValidConfig` 头注）；
 *   - 不把无法解析的字符串"尽力猜"成对象（顶层找不到同 `prop` 就原样留给校验报错）。
 */
import { StructuredCrudConfigSchema } from './structured-config.schema.js'
import { normalizeConfig, projectDialogFormItem, type ConfigRename } from './normalize-config.js'
import type { ZodIssueLike } from './validate-and-repair.js'

/** 修复种类（给宿主看的机器可读分类）。 */
export type ConfigRepairKind =
  | 'remove-null'
  | 'coerce-boolean'
  | 'expand-dialogs'
  | 'expand-form-item'

export interface ConfigRepair {
  /** 被修复的路径，如 `/formLayout`、`/fields/0/inQuery`。 */
  path: string
  kind: ConfigRepairKind
  /** 人话说明（含依据）。 */
  note: string
}

export interface RepairConfigResult<T = unknown> {
  config: T
  /** 实际应用的形状修复（不含别名/搬迁——那些在 `renames` 里）。 */
  repairs: ConfigRepair[]
  /** `normalizeConfig` 的别名/搬迁记录。 */
  renames: ConfigRename[]
}

type Path = (string | number)[]

/** zod issue 的扩展形状：修复需要看 `received` / `expected`。 */
interface IssueLike extends ZodIssueLike {
  received?: string
}

const MEMBERSHIP_KEYS = new Set(['inQuery', 'inTable', 'inForm'])
const CANNED_DIALOG_KEYS = new Set(['add', 'edit', 'view'])
const REQUIRED_DIALOG_FIELD_KEYS = new Set(['label', 'formtype'])

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function cloneValue<T>(value: T): T {
  const sc = (globalThis as { structuredClone?: <V>(v: V) => V }).structuredClone
  if (typeof sc === 'function') return sc(value)
  return JSON.parse(JSON.stringify(value)) as T
}

function valueAt(root: unknown, path: Path): unknown {
  let cur: unknown = root
  for (const segment of path) {
    if (cur === null || cur === undefined) return undefined
    if (typeof segment === 'number') {
      if (!Array.isArray(cur)) return undefined
      cur = cur[segment]
    } else {
      if (!isPlainObject(cur)) return undefined
      cur = cur[segment]
    }
  }
  return cur
}

function deleteAt(root: unknown, path: Path): boolean {
  if (path.length === 0) return false
  const key = path[path.length - 1]
  if (typeof key !== 'string') return false
  const parent = valueAt(root, path.slice(0, -1))
  if (!isPlainObject(parent) || !(key in parent)) return false
  delete parent[key]
  return true
}

function setAt(root: unknown, path: Path, value: unknown): boolean {
  if (path.length === 0) return false
  const key = path[path.length - 1]
  const parent = valueAt(root, path.slice(0, -1))
  if (typeof key === 'number') {
    if (!Array.isArray(parent) || key < 0 || key >= parent.length) return false
    parent[key] = value
    return true
  }
  if (!isPlainObject(parent)) return false
  parent[key] = value
  return true
}

function formatPath(path: Path): string {
  if (path.length === 0) return '(root)'
  return '/' + path.map((p) => String(p)).join('/')
}

interface Candidate {
  repair: ConfigRepair
  apply: (config: unknown) => boolean
}

/** `["dialogs", "<key>", "formItems", <index>]` */
function isFormItemPath(path: Path): boolean {
  return (
    path.length === 4 &&
    path[0] === 'dialogs' &&
    typeof path[1] === 'string' &&
    path[2] === 'formItems' &&
    typeof path[3] === 'number'
  )
}

/** `["dialogs", "<key>", "formItems", <index>, "label" | "formtype"]` */
function isFormItemKeyPath(path: Path): boolean {
  return (
    path.length === 5 &&
    path[0] === 'dialogs' &&
    typeof path[1] === 'string' &&
    path[2] === 'formItems' &&
    typeof path[3] === 'number' &&
    typeof path[4] === 'string'
  )
}

function isMembershipPath(path: Path): boolean {
  const last = path[path.length - 1]
  if (typeof last !== 'string' || !MEMBERSHIP_KEYS.has(last)) return false
  // 顶层 fields: ["fields", <index>, "<membership>"]
  if (path.length === 3 && path[0] === 'fields' && typeof path[1] === 'number') return true
  // 弹窗 formItems: ["dialogs", <key>, "formItems", <index>, "<membership>"]
  return isFormItemKeyPath(path)
}

function fieldByProp(config: unknown, prop: unknown): Record<string, unknown> | undefined {
  if (!isNonEmptyString(prop) || !isPlainObject(config) || !Array.isArray(config.fields)) {
    return undefined
  }
  for (const field of config.fields) {
    if (isPlainObject(field) && field.prop === prop) return field
  }
  return undefined
}

/**
 * 对一个 issue 生成候选修复。返回顺序 = 优先级；调用方逐条试，接受第一条
 * 「能减少 issue 总数」的候选。
 */
function candidatesFor(issue: IssueLike, config: unknown): Candidate[] {
  const path: Path = Array.isArray(issue.path) ? issue.path : []
  const current = valueAt(config, path)
  const out: Candidate[] = []

  // ① 可选键上的 null = 「没写」。删除它；如果是必填键，删除不会减少 issue，
  //    单调检查会拒绝（把「类型错」换成「缺失」不算改进）。
  if (current === null && path.length > 0 && typeof path[path.length - 1] === 'string') {
    out.push({
      repair: {
        path: formatPath(path),
        kind: 'remove-null',
        note: 'null 视为未声明（可选键），已删除；默认值/缺省语义保持不变。',
      },
      apply: (cfg) => deleteAt(cfg, path),
    })
  }

  // ② 成员布尔：只认无歧义的字面量编码（"true"/"false"、1/0）。
  if (isMembershipPath(path)) {
    const asBoolean =
      current === 'true' || current === 1
        ? true
        : current === 'false' || current === 0
          ? false
          : undefined
    if (asBoolean !== undefined) {
      out.push({
        repair: {
          path: formatPath(path),
          kind: 'coerce-boolean',
          note: `成员布尔写成了 ${JSON.stringify(current)}，已按无歧义字面量转为 ${asBoolean}。`,
        },
        apply: (cfg) => setAt(cfg, path, asBoolean),
      })
    }
  }

  // ③ dialogs 罐头键数组（normalizeConfig 已处理；这里是 repairConfig 单独被调用时的兜底）。
  if (path.length === 1 && path[0] === 'dialogs' && Array.isArray(current)) {
    if (current.length > 0 && current.every((k) => isNonEmptyString(k) && CANNED_DIALOG_KEYS.has(k))) {
      const expanded: Record<string, unknown> = {}
      for (const key of current as string[]) if (!(key in expanded)) expanded[key] = {}
      out.push({
        repair: {
          path: '/dialogs',
          kind: 'expand-dialogs',
          note: `dialogs 是罐头键数组（${current.join(', ')}），已展开为 record。`,
        },
        apply: (cfg) => setAt(cfg, path, expanded),
      })
    }
  }

  // ④ dialogs[k] === true（同理，normalizeConfig 的兜底）。
  if (
    path.length === 2 &&
    path[0] === 'dialogs' &&
    typeof path[1] === 'string' &&
    current === true
  ) {
    out.push({
      repair: {
        path: formatPath(path),
        kind: 'expand-dialogs',
        note: 'dialogs 的一项写成了 true，已展开为空对象（全部取默认）。',
      },
      apply: (cfg) => setAt(cfg, path, {}),
    })
  }

  // ⑤ 弹窗表单项的字符串简写：`formItems: ['name']` → 顶层同 prop 字段（只投影表单面）。
  if (isFormItemPath(path) && isNonEmptyString(current)) {
    const field = fieldByProp(config, current)
    if (field) {
      out.push({
        repair: {
          path: formatPath(path),
          kind: 'expand-form-item',
          note: `弹窗表单项写成了字符串 "${current}"，已按顶层 fields 中同 prop 的字段定义展开。`,
        },
        apply: (cfg) => setAt(cfg, path, projectDialogFormItem(field)),
      })
    }
  }

  // ⑥ 弹窗表单项缺 label/formtype：用顶层同 prop 字段补全（条目自身已给的键不动）。
  if (
    isFormItemKeyPath(path) &&
    typeof path[4] === 'string' &&
    REQUIRED_DIALOG_FIELD_KEYS.has(path[4]) &&
    current === undefined
  ) {
    const item = valueAt(config, path.slice(0, 4))
    const field = fieldByProp(config, isPlainObject(item) ? item.prop : undefined)
    const fill = field?.[path[4]]
    if (fill !== undefined) {
      out.push({
        repair: {
          path: formatPath(path),
          kind: 'expand-form-item',
          note: `弹窗表单项缺少 ${path[4]}，已用顶层 fields 中同 prop 的字段补全。`,
        },
        apply: (cfg) => setAt(cfg, path, cloneValue(fill)),
      })
    }
  }

  return out
}

function issueCount(config: unknown): number {
  const parsed = StructuredCrudConfigSchema.safeParse(config)
  return parsed.success ? 0 : parsed.error.issues.length
}

function issuesOf(config: unknown): IssueLike[] {
  const parsed = StructuredCrudConfigSchema.safeParse(config)
  return parsed.success ? [] : (parsed.error.issues as IssueLike[])
}

/**
 * 修复配置：先 `normalizeConfig`（别名/搬迁/形态展开），再按 schema issue 做
 * 确定性、单调改进的修复。不修改入参。
 *
 * 返回的 `config` **可能仍然非法**（遇到无法有据修复的问题时原样保留，交给
 * `assertValidConfig` / `validateAndRepair` 报错）。这不是失败——修复环只承诺
 * 「不把配置改坏」，不承诺「什么都修得好」。
 */
export function repairConfig<T = unknown>(input: T): RepairConfigResult<T> {
  const normalized = normalizeConfig(input)
  let config: unknown = normalized.config
  const repairs: ConfigRepair[] = []

  // 上限：每一轮必须让 issue 数严格下降，故轮数天然有界；显式上限只防病态 schema。
  for (let round = 0; round < 100; round++) {
    const issues = issuesOf(config)
    if (issues.length === 0) break
    const before = issues.length

    let accepted = false
    for (const issue of issues) {
      for (const candidate of candidatesFor(issue, config)) {
        const next = cloneValue(config)
        if (!candidate.apply(next)) continue
        if (issueCount(next) >= before) continue
        config = next
        repairs.push(candidate.repair)
        accepted = true
        break
      }
      if (accepted) break
    }
    if (!accepted) break
  }

  return { config: config as T, repairs, renames: normalized.renames }
}
