#!/usr/bin/env node
/**
 * 片段 eval 的 prompt 组装（纯函数、无 SDK、可无 key 单测）。
 *
 * ## 与生产同源
 *
 * 生产里宿主 LLM 看到的是 MCP `tools/list` 的结果：工具 **name + description + inputSchema**。
 * `inputSchema` 由 MCP SDK 从 zod3 shape 生成（`zod-json-schema-compat.js`），键的语义来自
 * `.describe()`。本模块**不手写第二份键清单**，而是直接对运行时捕获的 shape 做自省
 * （`scripts/lib/fragment-shapes.mjs`）——因此工具形状一改，prompt 自动跟着改，不存在
 * 「prompt 说 A、schema 是 B」的漂移面。`fragment-prompt.test.mjs` 只钉自省器的正确性。
 *
 * ## 为什么片段需要自己的 system prompt
 *
 * CRUD 的 `buildNlToConfigSystemPrompt()` 教的是 `StructuredCrudConfig`（query/table/form
 * 三面 + actions + dialogs + tableBtns…）。片段的输入是**另一个**工具形状
 * （`fields` + 场景容器键），拿 CRUD prompt 去问只会得到「三面组合」的答案。
 *
 * ## target 是宿主给定（与 F9 同一条论证）
 *
 * 生产里 `target` 由 `detect_project_target` 决定、作为工具入参**显式传入**，不是模型从 NL
 * 猜的。故与 CRUD eval 一样把它喂成「given」，并且仍然比对模型有没有**照抄**。
 * dialog 的 `mode` 不在此列：它由用户措辞决定（composable vs component），必须由模型推断。
 *
 * ## 为什么不喂 few-shot
 *
 * 生产宿主看到的是 `tools/list` 的 name + description + inputSchema —— 没有 CRUD 那份
 * `NL_TO_CONFIG_FEWSHOT`。片段 eval 也只用同一份信息；否则测到的是「模型能否复述我们塞进
 * prompt 的样张」，而不是「给定工具契约时能否把 NL 落成入参」。代价是分数会低一些，但它
 * 与生产一致（且片段数字只观测、不门禁）。
 */

import { buildGivenLine, buildFieldsLine } from './prompt.mjs'

/**
 * 形态标签：zod3 用 `_def.typeName`（`ZodString`…），zod4 用 `_def.type`（`string`…）。
 * 自省一律先取标签再分派，**绝不**用 `instanceof` —— 脚本用 esbuild 从源码打包，
 * 跨副本的 `instanceof` 会静默失配。
 */
const tagOf = (def) => def?.typeName ?? def?.type ?? ''

/** zod4 把 `.describe()` 文本放进全局 registry，只经公开 getter 暴露；zod3 落在 `_def`。 */
const descOf = (t) => t?.description ?? t?._def?.description

/** 把包装层剥掉，同时收集 optional / default / description（zod3 / zod4 双词汇）。 */
function unwrap(t) {
  let cur = t
  let optional = false
  let defaultValue
  let description = ''
  const seen = new Set()
  while (cur && cur._def && !seen.has(cur)) {
    seen.add(cur)
    const d = cur._def
    const desc = descOf(cur)
    if (desc && !description) description = desc
    const tag = tagOf(d)
    if (tag === 'ZodOptional' || tag === 'optional') {
      optional = true
      cur = d.innerType
    } else if (tag === 'ZodNullable' || tag === 'nullable') {
      optional = true
      cur = d.innerType
    } else if (tag === 'ZodDefault' || tag === 'default' || tag === 'prefault') {
      optional = true
      try {
        // zod3 的 `defaultValue` 恒为函数；zod4 存的是值本身（`z.string().default(fn)` 才存函数）
        defaultValue = typeof d.defaultValue === 'function' ? d.defaultValue() : d.defaultValue
      } catch {
        defaultValue = undefined
      }
      cur = d.innerType
    } else if (tag === 'ZodEffects' || tag === 'effects') {
      cur = d.schema
    } else if (tag === 'pipe') {
      // 展示取变换后的类型（zod4 `.transform()` 的 `out`）
      cur = d.out ?? d.in
    } else {
      break
    }
  }
  return { inner: cur, optional, defaultValue, description }
}

/** `ZodObject` 的 shape 在不同版本可能是函数、实例 getter 或 `_def` 上的对象。 */
function objectShape(t) {
  const s = t?.shape ?? t?._def?.shape
  const obj = typeof s === 'function' ? s() : s
  return obj && typeof obj === 'object' ? obj : null
}

/** 类型的人类可读渲染（只在 prompt 里用，不求完整 JSON Schema 语义）。 */
export function describeZodType(t, seen = new Set()) {
  if (!t || !t._def) return 'unknown'
  if (seen.has(t)) return '…'
  seen.add(t)
  const { inner } = unwrap(t)
  const d = inner?._def ?? {}
  switch (tagOf(d)) {
    case 'ZodString':
    case 'string':
      return 'string'
    case 'ZodNumber':
    case 'number':
      return 'number'
    case 'ZodBoolean':
    case 'boolean':
      return 'boolean'
    case 'ZodEnum':
      return (d.values ?? d.options ?? []).map((v) => `'${v}'`).join(' | ')
    case 'enum':
      // zod4：`_def.entries` 是 { key: value } 对象
      return Object.keys(d.entries ?? {}).map((v) => `'${v}'`).join(' | ')
    case 'ZodNativeEnum':
    case 'nativeEnum':
      return Object.keys(d.values ?? {}).filter((k) => Number.isNaN(Number(k))).map((v) => `'${v}'`).join(' | ')
    case 'ZodLiteral':
    case 'literal':
      return JSON.stringify(Array.isArray(d.values) ? d.values[0] : d.value)
    case 'ZodArray':
    case 'array':
      // zod3 `_def.type` / zod4 `_def.element`
      return `${describeZodType(d.element ?? d.type, seen)}[]`
    case 'ZodRecord':
    case 'record':
      return `Record<string, ${describeZodType(d.valueType, seen)}>`
    case 'ZodUnion':
    case 'union':
      return (d.options ?? []).map((o) => describeZodType(o, new Set(seen))).join(' | ')
    case 'ZodObject':
    case 'object':
      return 'object'
    case 'ZodLazy':
    case 'lazy': {
      const resolved = d.getter()
      return describeZodType(resolved, seen)
    }
    case 'ZodAny':
    case 'ZodUnknown':
    case 'any':
    case 'unknown':
      return 'any'
    case 'ZodEffects':
    case 'effects':
      return describeZodType(d.schema, seen)
    default:
      return String(tagOf(d) ?? 'unknown').replace(/^Zod/, '').toLowerCase()
  }
}

/** 若是可下潜的对象（或对象数组），返回其键；否则 null。 */
export function nestedShape(t) {
  const { inner } = unwrap(t)
  const tag = tagOf(inner?._def)
  if (!tag) return null
  if (tag === 'ZodObject' || tag === 'object') return objectShape(inner)
  if (tag === 'ZodArray' || tag === 'array') {
    const el = unwrap(inner._def.element ?? inner._def.type).inner
    const elTag = tagOf(el?._def)
    const resolved = elTag === 'ZodLazy' || elTag === 'lazy' ? el._def.getter() : el
    const resolvedTag = tagOf(resolved?._def)
    if (resolvedTag === 'ZodObject' || resolvedTag === 'object') return objectShape(resolved)
  }
  return null
}

/**
 * 把裸 shape（`{ key: ZodType }`）渲染成 prompt 里的键清单。
 *
 * `depth` = 还能下潜几层（顶层的对象/对象数组下潜一层；再深就只给类型，避免
 * `dataOptions.children` 这类递归把 prompt 撑爆）。
 */
export function renderShape(shape, { indent = '', depth = 1 } = {}) {
  const lines = []
  for (const key of Object.keys(shape ?? {})) {
    const t = shape[key]
    const { optional, defaultValue, description } = unwrap(t)
    const type = describeZodType(t)
    const meta = [
      optional ? 'optional' : 'required',
      defaultValue !== undefined ? `default ${JSON.stringify(defaultValue)}` : null,
    ]
      .filter(Boolean)
      .join(', ')
    const desc = description ? ` — ${description}` : ''
    lines.push(`${indent}- ${key} (${meta}): ${type}${desc}`)

    const nested = depth > 0 ? nestedShape(t) : null
    if (nested) {
      lines.push(...renderShape(nested, { indent: indent + '    ', depth: depth - 1 }))
    }
  }
  return lines
}

/** 场景 ↔ 真实工具名。eval 与 prompt 指纹守卫共用这一份，避免两处各写一遍。 */
export const FRAGMENT_SCENE_TOOLS = Object.freeze({
  table: 'generate_table',
  form: 'generate_form',
  dialog: 'generate_dialog',
})

/** 场景专属提示：只补**工具描述里没有明说**的通用契约，不另写 NL→键映射表。 */
const SCENE_RULES = {
  table: [
    'Row action buttons go in `rowButtons` (name + optional type/key). Emit them only when the user asks for them.',
  ],
  form: [
    "`context`: 'query' for a search/filter form, 'form' for an add/edit or settings form.",
    "`buttons`: 'query' when the user asks for 查询/重置, 'submit' when they ask for 保存/提交, otherwise 'none'.",
  ],
  dialog: [
    "`mode`: the user asking for a composable/hook → 'composable'; a standalone dialog component → 'component'. Default 'composable'.",
    '`defaultTitle` and `composableName` are optional; omit them unless the user names one.',
  ],
}

/**
 * 构造片段场景的 system prompt。
 * @param {'table'|'form'|'dialog'} scene
 * @param {{name:string, description:string, shape:Record<string, unknown>}} tool 捕获自真实注册
 */
export function buildFragmentSystemPrompt(scene, tool) {
  if (!SCENE_RULES[scene]) throw new Error(`buildFragmentSystemPrompt: 未知片段场景 "${scene}"`)
  return [
    'You are the configuration engine behind the es-plus MCP server.',
    'The user describes one standalone UI element in natural language. The host will call the tool',
    'below with the JSON object you return — your job is to produce exactly that input object.',
    '',
    `Tool: ${tool.name}`,
    tool.description,
    '',
    'Input schema (a single JSON object; "optional" keys may be omitted):',
    // depth=2：生产宿主看到的是 MCP 的**完整 JSON Schema**（嵌套 properties 都在），
    // 而 depth=1 会把 `fields[].rules` / `fields[].dataOptions` 的子键压成一行
    // `object[]` —— 实测模型因此整组丢掉 rules（AI-47 的 fieldRules miss）。
    // AI-47 复测：`fields[].reactions[].fulfill` 是第三层，depth=2 时仍被压成
    // `object`，模型把 `fulfill.required` 写成裸 `true`。故放到 depth=3；
    // 递归到 depth 0 即停，`dataOptions.children` 这类自指不会撑爆 prompt。
    ...renderShape(tool.shape, { depth: 3 }),
    '',
    'Rules:',
    '1. Respond with ONLY the JSON object — no prose, no markdown fences, no comments.',
    '2. Use only the keys listed above. Never invent extra keys.',
    '3. `fields`: one entry per described field; use the user\'s wording for `label` and a camelCase `prop`.',
    '   Pick `formtype` by the field MEANING (status/enum → Select; date → DatePicker; long text → Input with',
    '   attrs.type "textarea"; on/off → Switch; image/file → Upload; multi-choice → Checkbox; tree → Cascader).',
    '4. `dataOptions`: when the user names a fixed set of choices, emit every named option. Do not invent',
    '   choices the user did not name. Values may be strings or numbers.',
    '5. `required`: only when the user says 必填 / required.',
    '6. Omit optional keys the user did not ask for. Do not fill in defaults.',
    '7. If a "Fields (given …)" line lists props, emit exactly those `prop` values in `fields` —',
    '   do not rename, drop, or invent fields. Infer everything else from the description.',
    ...SCENE_RULES[scene],
    '',
    'Output a single JSON object and nothing else.',
  ].join('\n')
}

/**
 * 初始用户消息：NL + 宿主给定行（`target`）+ 给定字段行（`fixedFields`）。
 * 复用 CRUD 的 `buildGivenLine` / `buildFieldsLine`，保证两种场景的措辞与
 * 「给了就必须照抄」语义完全一致（片段此前**不喂** fixedFields ⟹ prop 全靠猜中文 label）。
 */
export function buildFragmentInitialMessages(nl, target, fixedFields) {
  const blocks = [String(nl)]
  const givenLine = buildGivenLine({ target })
  if (givenLine) blocks.push(givenLine)
  const fieldsLine = buildFieldsLine(fixedFields)
  if (fieldsLine) blocks.push(fieldsLine)
  return [{ role: 'user', content: blocks.join('\n\n') }]
}
