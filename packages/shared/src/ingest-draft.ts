/**
 * 摄取 → 草拟配置（`ingest_schema` 与 `es-plus ingest` 共用的唯一实现）
 *
 * 为什么落在 shared：同一条「schema 文本 → 可运行的 StructuredCrudConfig 草稿」被两个
 * 宿主消费 —— MCP 工具（`packages/mcp-server/src/tools/ingest-schema.ts`）与 CLI
 * （`packages/cli/src/commands/ingest.ts`）。两处各写一份占位符文案，迟早会漂成
 * 「MCP 告警说 A、CLI 告警说 B」。放在这里 = 一次改动两个宿主同时生效。
 *
 * 刻意只出**草稿**：摄取只能定「类型 → formtype」这条确定性轴，查询面取舍、按钮、
 * 弹窗等仍须人（或宿主 LLM）按原始需求补全。契约 = ingest(预填) → 人改 → generate(落地)。
 */

import { ingestSchema, type SchemaKind } from './schema-ingest.js'
import { composeCrudConfig } from './compose-crud-config.js'
import type { StructuredCrudConfigInput } from './structured-config.schema.js'

/** 摄取层支持的全部输入形态（顺序即 help / 报错里的展示顺序）。 */
export const INGEST_KINDS = [
  'openapi',
  'jsonSchema',
  'sample-json',
  'ts-interface',
  'sql-ddl',
] as const satisfies readonly SchemaKind[]

export interface BuildIngestDraftInput {
  text: string
  kind: SchemaKind
  name?: string
  apiUrl?: string
}

export interface BuildIngestDraftResult {
  /** 草拟配置;字段数为 0 时(解析失败 / 不支持的 kind)不产出,仅回告警。 */
  config?: StructuredCrudConfigInput
  /** 摄取 + 组合两段的告警合并。 */
  warnings: string[]
}

/**
 * 纯函数:摄取 → 组合草拟配置。独立导出以便直接单测(与 generate-from-config 的
 * buildSemanticWarnings 同一范式——测逻辑,不起传输层)。
 */
export function buildIngestDraft(input: BuildIngestDraftInput): BuildIngestDraftResult {
  const ingested = ingestSchema(input.text, input.kind)
  const warnings = [...ingested.warnings]

  if (ingested.fields.length === 0) {
    // 不点名具体工具：这条告警在两种宿主下都会出现，而 `generate_crud_from_config`
    // 在 MCP 的 `front-door` 档不注册（见 profile.ts）。指向「手工写一份字段表」本身。
    warnings.push(
      '未能从该 schema 抽取任何字段 —— 请检查输入,或手工填写一份 StructuredCrudConfig 字段表。',
    )
    return { warnings }
  }

  const name = input.name ?? ingested.name
  const resolvedName = name ?? 'IngestedPage'
  if (!name) {
    warnings.push(
      '未提供 name 且无法从 schema 推断 —— 已占位 "IngestedPage",请改成真实页面名(PascalCase)。',
    )
  }
  const apiUrl = input.apiUrl ?? '/api/REPLACE_ME'
  if (!input.apiUrl) {
    warnings.push('未提供 apiUrl —— 已占位 "/api/REPLACE_ME",请改成真实 REST 端点。')
  }

  // 摄取只给扁平字段表:默认每个属性既是列、也是表单项(inTable/inForm),查询面留空
  // 由调用方按需收窄——composeCrudConfig 据此推导三成员布尔。
  const { config, warnings: composeWarnings } = composeCrudConfig({
    name: resolvedName,
    apiUrl,
    table: ingested.fields,
    form: ingested.fields,
  })
  warnings.push(...composeWarnings)

  return { config, warnings }
}
