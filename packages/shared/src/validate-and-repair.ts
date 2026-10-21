import { StructuredCrudConfigSchema } from './structured-config.schema.js'
import type { ValidationResult } from './schema-validator.js'
import { collectUnknownKeys, formatUnknownKey, type UnknownKeyFinding } from './unknown-keys.js'

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
  const unknownKeys = collectUnknownKeys(StructuredCrudConfigSchema, config)
  const unknownErrors = unknownKeys.map(formatUnknownKey)
  const unknownSuggestions = unknownKeys
    .filter((f): f is UnknownKeyFinding & { suggestion: string } => !!f.suggestion)
    .map((f) => `${formatIssuePath([...f.path, f.key])} → did you mean "${f.suggestion}"?`)

  const result = StructuredCrudConfigSchema.safeParse(config)
  if (result.success) {
    if (unknownKeys.length === 0) return { valid: true, errors: [], suggestions: [], unknownKeys }
    // Zod 说「通过」，但它把键剥掉了 —— 那正是本项要消灭的假绿。
    return { valid: false, errors: unknownErrors, suggestions: unknownSuggestions, unknownKeys }
  }

  // zod 4 用 `issues`；旧版（及部分被包装过的 error 对象）用 `errors`。两处都读——
  // 拿不到 issue 列表时宁可回一句泛化错误，也不能因字段名差异而误报「校验通过」。
  const error = result.error as unknown as { issues?: ZodIssueLike[]; errors?: ZodIssueLike[] }
  const issues = error.issues ?? error.errors ?? []
  if (issues.length === 0) {
    return {
      valid: false,
      errors: ['Configuration failed structured-config validation (no issue details available)', ...unknownErrors],
      suggestions: ['Check the config against the structured CRUD page schema', ...unknownSuggestions],
      unknownKeys,
    }
  }
  const rendered = zodIssuesToResult(issues)
  return {
    valid: false,
    errors: [...rendered.errors, ...unknownErrors],
    suggestions: [...rendered.suggestions, ...unknownSuggestions],
    unknownKeys,
  }
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
