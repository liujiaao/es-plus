/**
 * AN-19 — system prompt for the PRD → surfaces observation leg.
 *
 * ## Same source as production
 *
 * The host in production sees `tools/list` (name + description + inputSchema)
 * and may fetch `esplus://design-extraction`. This module builds exactly that:
 * the captured `generate_crud` description/shape plus the resource's own text
 * (`buildDesignExtractionContent`, injected by the caller from the bundled
 * resource module). There is no second hand-written contract here, so a change
 * to the published resource automatically changes what the eval measures.
 *
 * ## Host-given fields
 *
 * `name`, `apiUrl`, `target`, `mode` are decided by the host in production
 * (`detect_project_target`, routing table, project conventions). The spec text
 * does not contain them, so they are given and must be copied. The measured
 * question is only: which surfaces and which labelled fields.
 *
 * ## No few-shot
 *
 * Adding NL→surfaces samples would measure recall of the sample. The resource's
 * positive/negative examples are part of the published contract and therefore
 * fair game; extra eval-only examples are not.
 */
import { renderShape } from './fragment-prompt.mjs'

export function buildPrdSystemPrompt(tool, contract) {
  return [
    'You are the host LLM for the es-plus MCP server, working on the FIRST MILE:',
    'turning a specification into the `generate_crud` intent table (`surfaces`).',
    'Do not write Vue code — the server routes and emits deterministically.',
    '',
    `Tool: ${tool.name}`,
    tool.description,
    '',
    'Input schema (a single JSON object; "optional" keys may be omitted):',
    ...renderShape(tool.shape, { depth: 3 }),
    '',
    'Published extraction contract (resource esplus://design-extraction):',
    contract,
    '',
    'Rules:',
    '1. Respond with ONLY the JSON object — no prose, no markdown fences, no comments.',
    '2. The host has already decided `name`, `apiUrl`, `target` and `mode`; copy the given values verbatim.',
    '3. Set only the surfaces the specification implies. Membership is expressed by PRESENCE in',
    '   `surfaces.query` / `surfaces.table` / `surfaces.form` / `surfaces.dialog`.',
    '   NEVER emit `inQuery` / `inTable` / `inForm` — those are not front-door keys.',
    '4. Use the specification\'s wording verbatim for `label`; infer a camelCase `prop`.',
    '5. Pick `formtype` by meaning (status/enum → Select; date → DatePicker; number/money →',
    '   InputNumber; on/off → Switch; image/file → Upload; long text → Input + attrs.type "textarea").',
    '6. Read-only wording ("只读", "仅展示", "不可编辑") removes `form` and every mutating dialog.',
    '   System-generated fields (创建时间 / 更新时间 / 创建人 / 单号 ids) are never form fields.',
    '7. A custom dialog (named id/title or per-dialog fields) uses the full object',
    '   `{ "key", "title"?, "formItems"? }`; canned add/edit/view stay as strings.',
    '8. Omit every key the specification does not mention. Do not invent options, validation,',
    '   permissions or API parameters.',
    '',
    'Output a single JSON object and nothing else.',
  ].join('\n')
}

/** Initial user message: the spec plus the host-given values. */
export function buildPrdInitialMessages(spec, given = {}) {
  const lines = [
    'Host-given (copy verbatim):',
    `name=${given.name ?? ''}`,
    `apiUrl=${given.apiUrl ?? ''}`,
    `target=${given.target ?? 'vue3'}`,
    `mode=${given.mode ?? 'schema'}`,
  ]
  return [
    {
      role: 'user',
      content: `${String(spec)}\n\n${lines.join('\n')}`,
    },
  ]
}
