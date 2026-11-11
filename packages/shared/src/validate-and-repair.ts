import { StructuredCrudConfigSchema } from './structured-config.schema.js'
import type { ValidationResult } from './schema-validator.js'
import { collectUnknownKeys, formatUnknownKey, type UnknownKeyFinding } from './unknown-keys.js'

/**
 * D3（127/132）确定性软告警：reactions 里拿「中文标签」当分支依据。
 *
 * 事实：`when: { '==': [{var:'settleType'}, '跨境结算'] }` 而 settleType **没有 dataOptions**。
 * 这在真实后端下永不成立 —— 行数据里存的是码值（domestic/cross），不是界面标签。
 * 正确写法是给该字段声明 `dataOptions`（label 照 NL，value 自选稳定码），并比较 **value**。
 *
 * 为什么是 warning 不是 error：条件里出现中文字面量也可能是合法的（比如比较某一列的中文
 * 常量、或数据本身就是中文）。判定只在「该字面量不等于本配置任何 dataOptions 的 label」时
 * 触发 —— 一旦两侧都按码表写了，告警自然消失。只判不改（与 validate_config 同纪律）。
 */
const CJK_RE = /[㐀-䶿一-鿿]/

function collectOptionLabels(node: unknown, out: Set<string>): void {
  if (Array.isArray(node)) {
    for (const item of node) collectOptionLabels(item, out)
    return
  }
  if (!node || typeof node !== 'object') return
  const obj = node as Record<string, unknown>
  if (Array.isArray(obj.dataOptions)) {
    for (const opt of obj.dataOptions) {
      if (opt && typeof opt === 'object' && typeof (opt as { label?: unknown }).label === 'string') {
        out.add((opt as { label: string }).label)
      }
    }
  }
  for (const v of Object.values(obj)) collectOptionLabels(v, out)
}

/** json-rules-engine 里承载「比较」的键。只有这些位置的字符串才是**条件**操作数。 */
const COMPARISON_OPS = new Set(['==', '===', '!=', '!==', '>', '>=', '<', '<=', 'in', 'nin'])

/**
 * 收集**条件位置**上的中文字面量。
 *
 * 关键边界：`fulfill.value` 是「结果」表达式，里面的中文可能是合法的目标值
 * （「命中后自动填成『已结案』」），不能一律告警。所以这里不做盲目遍历，只认：
 *   - 比较操作符（`==` 等）的操作数；
 *   - `{field, op, value}` 简写条件的 `value`；
 *   - `if` 数组的**第 0 项**（条件分支；第 1/2 项是 true/false 结果）；
 *   - `and` / `or` / `!` 的子条件。
 * 其余键（`then`/`else`/`dataOptions`/`label`…）一律不下钻。
 */
function collectCjkLiterals(node: unknown, out: Set<string>): void {
  // 表达式里的字面量既可能是对象的键值，也可能是数组元素（`['==', [x, '跨境结算']]`），
  // 因此原语必须在**入口**处理，不能只在对象分支里看。
  if (typeof node === 'string') {
    if (CJK_RE.test(node)) out.add(node)
    return
  }
  if (Array.isArray(node)) {
    for (const item of node) collectCjkLiterals(item, out)
    return
  }
  if (!node || typeof node !== 'object') return
  const obj = node as Record<string, unknown>
  if (typeof obj.var === 'string') return
  // 简写条件 `{field, op, value}`：value 是操作数。
  if (typeof obj.field === 'string' && 'value' in obj) {
    collectCjkLiterals(obj.value, out)
    return
  }
  for (const [k, v] of Object.entries(obj)) {
    if (COMPARISON_OPS.has(k)) {
      collectCjkLiterals(v, out)
    } else if (k === 'if') {
      // `{if:[cond, then, else]}`：只看 cond，then/else 是结果。
      if (Array.isArray(v)) collectCjkLiterals(v[0], out)
      else collectCjkLiterals(v, out)
    } else if (k === 'and' || k === 'or' || k === '!' || k === '&&' || k === '||') {
      collectCjkLiterals(v, out)
    }
  }
}

export function codeTableWarnings(config: unknown): string[] {
  // 先过 schema：只有合法配置才谈得上「条件语义」（非法配置的键可能已被 strip）。
  // 传进本函数的是**原始**配置，未知键同样不影响：只读扫描。
  const parsed = StructuredCrudConfigSchema.safeParse(config)
  if (!parsed.success) return []
  const fields = parsed.data.fields ?? []
  const labels = new Set<string>()
  for (const f of fields) collectOptionLabels(f, labels)
  const warnings: string[] = []
  for (const f of fields) {
    const reactions = (f as { reactions?: unknown[] }).reactions
    if (!Array.isArray(reactions)) continue
    for (const [i, rule] of reactions.entries()) {
      const literals = new Set<string>()
      const r = rule as {
        when?: unknown
        fulfill?: { required?: unknown; disabled?: unknown; value?: unknown }
      }
      // 只收**条件位置**的中文字面量。`fulfill.value` 也扫 —— 条件可以写在
      // `value.if[0]`（Excel 式写法同样常见）；但扫描器只认比较操作数 / `if` 的条件槽，
      // 结果槽（自动填成某个中文状态值）不会被误伤。
      collectCjkLiterals(r.when, literals)
      collectCjkLiterals(r.fulfill?.required, literals)
      collectCjkLiterals(r.fulfill?.disabled, literals)
      collectCjkLiterals(r.fulfill?.value, literals)
      for (const lit of literals) {
        if (labels.has(lit)) continue
        warnings.push(
          `/fields/${f.prop}/reactions/${i}: the condition compares the Chinese string "${lit}", but no \`dataOptions\` label in this config equals it. Row data carries code VALUES, not UI labels — declare \`dataOptions\` on the compared field (label verbatim from the request, value = a stable code) and compare the VALUE instead.`
        )
      }
    }
  }
  return warnings
}

/**
 * 确定性前门校验（C2 · A3）。
 *
 * 把 `StructuredCrudConfigSchema` 的权威 Zod 校验 + 结构化错误/建议渲染抽到 shared，
 * 让三条路径（mcp-server 前门、CLI `--from-config`、eval）共用同一份判定与同一种错误串格式，
 * 不再各写一份字段清单。
 *
 * **刻意不在这里「修复」**：
 *   1. 无模型。es-plus 的 MCP 工具一律确定性，LLM 推理只活在宿主（host/CLI/eval）。设计 §6
 *      原写的「≤2 次结构化 issue 回灌」是**模型驱动**的回环，只能在握着 client 的宿主侧跑
 *      （eval 的 `driveToValidConfig` 已有）；塞进确定性工具会破坏「MCP 确定性 + 宿主推理」承重分界。
 *   2. 不按 schema 默认改写输入。`StructuredCrudConfigSchema` 带大量 `.default()`，用 `safeParse`
 *      的解析结果会把省略的 `inQuery` 等落成显式 `true`——那是另一层语义变更，`structured-generator.ts`
 *      的 `assertValidConfig` 已明确拒绝（见其注释）。这里与它保持一致：**只判、不改**。
 *
 * 于是本函数就是「校验 → 回传结构化 errors/suggestions」，供宿主下一轮据此自纠。校验通过则
 * `{ valid:true, errors:[], suggestions:[] }`；失败则把 zod issue 渲染成与 Ajv 分支一致的
 * `/path: message` 形态，错误串格式对调用方（宿主 LLM）两条分支看起来相同。
 *
 * ## AN-08：未知键 = error
 *
 * Zod 的 `z.object()` 默认**静默剥掉**未知键且不产生 issue —— 于是 `rowKey`（应为
 * `rowkey`）这种拼写错误也回「✓ 配置有效」，校验器名不副实。这里额外走一遍
 * `collectUnknownKeys`（只读，不改配置），把未知键并进 errors，并附 Levenshtein 建议。
 *
 * 两条边界：
 *   - `x-*` 放行（JSON Schema 惯例的扩展键，见 `isExtensionKey`）；
 *   - 只**报告**，不在这里搬键/改名 —— 有据可查的别名搬迁在 `normalizeConfig`，
 *     两件事分开，是因为「校验」与「入口归一」的调用方不同（validate_config 只判不改）。
 */
export function validateAndRepair(config: unknown): ValidationResult {
  // 软告警与判定正交：配置非法时也可能命中（且更有用），所以先算、每条返回都带上。
  const warnings = codeTableWarnings(config)
  const targeted = engineSelectionHints(config)
  const unknownKeys = collectUnknownKeys(StructuredCrudConfigSchema, config)
  const unknownErrors = unknownKeys.map(formatUnknownKey)
  const unknownSuggestions = unknownKeys
    .filter((f): f is UnknownKeyFinding & { suggestion: string } => !!f.suggestion)
    .map((f) => `${formatIssuePath([...f.path, f.key])} → did you mean "${f.suggestion}"?`)

  const result = StructuredCrudConfigSchema.safeParse(config)
  if (result.success) {
    if (unknownKeys.length === 0) return { valid: true, errors: [], suggestions: targeted, unknownKeys, warnings }
    // Zod 说「通过」，但它把键剥掉了 —— 那正是本项要消灭的假绿。
    return {
      valid: false,
      errors: unknownErrors,
      suggestions: [...targeted, ...unknownSuggestions],
      unknownKeys,
      warnings,
    }
  }

  // zod 4 用 `issues`；旧版（及部分被包装过的 error 对象）用 `errors`。两处都读——
  // 拿不到 issue 列表时宁可回一句泛化错误，也不能因字段名差异而误报「校验通过」。
  const error = result.error as unknown as { issues?: ZodIssueLike[]; errors?: ZodIssueLike[] }
  const issues = error.issues ?? error.errors ?? []
  if (issues.length === 0) {
    return {
      valid: false,
      errors: ['Configuration failed structured-config validation (no issue details available)', ...unknownErrors],
      suggestions: [
        'Check the config against the structured CRUD page schema',
        ...targeted,
        ...unknownSuggestions,
      ],
      unknownKeys,
      warnings,
    }
  }
  const rendered = zodIssuesToResult(issues)
  return {
    valid: false,
    errors: [...rendered.errors, ...unknownErrors],
    suggestions: [...rendered.suggestions, ...targeted, ...unknownSuggestions],
    unknownKeys,
    warnings,
  }
}

/**
 * L4：`tableOptions.engine:'auto'` 刻意不支持 —— 「按配置猜引擎」猜错会静默降级
 * （例如有 `editRender` 却落到 default，编辑完全不生效）。枚举本身已判红；这里补一条
 * **确定性纠正**，让模型撞一次就知道按需求显式选，而不是反复试『auto』。
 */
function engineSelectionHints(config: unknown): string[] {
  const tableOptions = (config as { tableOptions?: { engine?: unknown } } | null | undefined)?.tableOptions
  if (tableOptions?.engine !== 'auto') return []
  return [
    '/tableOptions/engine: "auto" is not supported (guessing an engine fails silently) — pick explicitly: inline editing → "vxe"; large data on vue3 → "virtual"; otherwise "default"',
  ]
}

/** zod issue 的最小形状（只取我们用来生成 errors/suggestions 的字段）。 */
export interface ZodIssueLike {
  path?: (string | number)[]
  message: string
  code?: string
  expected?: string
  values?: unknown[]
  minimum?: number
  maximum?: number
}

/**
 * Zod issue 按 Ajv 的 `instancePath: message` 形态渲染（前导斜杠，如 `/fields/2/formtype`）。
 * 刻意与 Ajv 分支一致：调用方看到的两种分支错误串格式应当相同，否则会以为遇到了两类错误。
 */
export function formatIssuePath(path: (string | number)[] | undefined): string {
  if (!path || path.length === 0) return '(root)'
  return '/' + path.map((p) => String(p)).join('/')
}

export function zodIssuesToResult(issues: ZodIssueLike[]): ValidationResult {
  const errors = issues.map((i) => `${formatIssuePath(i.path)}: ${i.message}`)

  const suggestions: string[] = []
  for (const issue of issues) {
    const path = formatIssuePath(issue.path)
    switch (issue.code) {
      case 'invalid_type':
        if (issue.expected) suggestions.push(`${path} should be type "${issue.expected}"`)
        break
      case 'invalid_value':
        if (issue.values?.length) {
          const shown = issue.values.slice(0, 12).join(', ')
          const more = issue.values.length > 12 ? ', …' : ''
          suggestions.push(`Valid values for ${path}: ${shown}${more}`)
        }
        break
      case 'too_small':
        if (issue.minimum !== undefined) {
          suggestions.push(`${path} must have at least ${issue.minimum}`)
        }
        break
      case 'too_big':
        if (issue.maximum !== undefined) {
          suggestions.push(`${path} must have at most ${issue.maximum}`)
        }
        break
      case 'invalid_union':
        suggestions.push(`${path} does not match any of the allowed shapes`)
        break
    }
  }

  return { valid: false, errors, suggestions }
}
