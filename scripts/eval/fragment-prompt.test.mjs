#!/usr/bin/env node
/**
 * 片段 prompt 守卫（`check:fragment-prompts`，无需 API key）。
 *
 * 这里钉的是「prompt 没有骗模型」：
 *   1) 三个片段工具的**真实注册**能捕获（esbuild 现打包 `shared/src`，不允许读 `build/`）；
 *   2) 渲染出的键清单覆盖 shape 的**每一个顶层键**与**每个可下潜对象的子键**——
 *      工具加了一个键而 prompt 没渲染出来（或渲染器漏了某类 zod 包装），此处必红；
 *   3) 工具 description 与 `.describe()` 文案原样进入 prompt（与生产 `tools/list` 同源）；
 *   4) 场景专属规则（rowButtons / context+buttons / mode）存在于对应场景；
 *   5) given 行：宿主给了 `target` 就必须明示「照抄」，没给则不得凭空出现；
 *      `fixedFields` 同理（与 188 条 CRUD 同规矩：prop 由宿主给定，语义由模型推断），
 *      并且 system prompt 有对应的「照抄 props」规则。
 */

import {
  buildFragmentSystemPrompt,
  buildFragmentInitialMessages,
  renderShape,
  nestedShape,
} from './fragment-prompt.mjs'
import { setupFragmentTools } from '../lib/fragment-shapes.mjs'

let failures = 0
function check(cond, msg) {
  if (cond) return
  failures++
  console.error(`  ✗ ${msg}`)
}

const SCENES = [
  ['table', 'generate_table'],
  ['form', 'generate_form'],
  ['dialog', 'generate_dialog'],
]

const tools = await setupFragmentTools()

console.log('meta-eval: fragment prompt covers every registered key')
for (const [scene, toolName] of SCENES) {
  const tool = tools[toolName]
  check(!!tool, `没有捕获到 ${toolName}`)
  if (!tool) continue
  check(typeof tool.description === 'string' && tool.description.trim().length > 0,
    `${toolName}: description 为空 —— 生产宿主看不到工具语义`)
  check(tool.shape && Object.keys(tool.shape).length > 0, `${toolName}: shape 为空`)

  const prompt = buildFragmentSystemPrompt(scene, tool)
  check(prompt.includes(`Tool: ${toolName}`), `${scene}: prompt 缺 Tool 行`)
  check(prompt.includes(tool.description), `${scene}: 工具 description 未进 prompt`)

  // 顶层键 + 一层子键（与 renderShape 的下潜口径一致）
  const rendered = renderShape(tool.shape)
  const text = rendered.join('\n')
  const topKeys = Object.keys(tool.shape)
  for (const key of topKeys) {
    check(text.includes(`- ${key} (`), `${scene}: prompt 未渲染顶层键 "${key}"`)
    const nested = nestedShape(tool.shape[key])
    for (const child of Object.keys(nested ?? {})) {
      check(
        text.includes(`    - ${child} (`),
        `${scene}: prompt 未渲染 "${key}" 的子键 "${child}"`
      )
    }
  }
  // 子键清单非空（防止嵌套渲染整体失效却仍「全绿」）
  const childCount = topKeys.reduce((n, k) => n + Object.keys(nestedShape(tool.shape[k]) ?? {}).length, 0)
  check(childCount > 0, `${scene}: 一个子键都没渲染 —— 嵌套下潜失效`)

  // .describe() 原文必须可见（抽一个形态稳定的键）
  const descProbe = {
    table: ['apiUrl', 'REST endpoint for the list'],
    form: ['context', 'form'],
    dialog: ['mode', 'composable'],
  }[scene]
  check(text.includes(descProbe[1]), `${scene}: 键 ${descProbe[0]} 的 .describe() 文案未进 prompt`)

  // JSON-only 契约
  check(prompt.includes('Respond with ONLY the JSON object'), `${scene}: 缺「只输出 JSON」规则`)
  check(prompt.includes('Output a single JSON object and nothing else.'), `${scene}: 缺末行输出约束`)
}

console.log('meta-eval: fragment scene rules')
{
  const t = buildFragmentSystemPrompt('table', tools.generate_table)
  check(t.includes('`rowButtons`'), 'table: 缺 rowButtons 规则')
  const f = buildFragmentSystemPrompt('form', tools.generate_form)
  check(f.includes('`context`') && f.includes('`buttons`'), 'form: 缺 context/buttons 规则')
  const d = buildFragmentSystemPrompt('dialog', tools.generate_dialog)
  check(d.includes('`mode`') && d.includes('`defaultTitle`'), 'dialog: 缺 mode/defaultTitle 规则')
  let threw = false
  try {
    buildFragmentSystemPrompt('crud', tools.generate_table)
  } catch {
    threw = true
  }
  check(threw, '未知场景应抛错，而不是静默套用别的场景规则')
}

console.log('meta-eval: fragment given line')
{
  const withTarget = buildFragmentInitialMessages('一张用户表', 'vue2')
  check(withTarget.length === 1 && withTarget[0].role === 'user', 'given: 应产出单条 user 消息')
  check(withTarget[0].content.includes('一张用户表'), 'given: 丢了 NL 原文')
  check(withTarget[0].content.includes('target=vue2'), 'given: target 未显式给出')
  check(withTarget[0].content.includes('emit them EXACTLY as stated'), 'given: 缺「照抄」语义')

  const noTarget = buildFragmentInitialMessages('一张用户表')
  check(noTarget[0].content === '一张用户表', 'given: 未给 target 时不应凭空出现 given 行')

  // fixedFields：给了就必须出现在消息里且用「EXACTLY these props」措辞；
  // 没给则不得凭空出现（保持旧 prompt 逐字节不变）。
  const withFields = buildFragmentInitialMessages('一张用户表', 'vue3', ['name', 'status'])
  check(withFields[0].content.includes('Fields (given — use EXACTLY these props'), 'fields: 缺 given 字段行')
  check(withFields[0].content.includes('name, status'), 'fields: props 未列出')
  check(withFields[0].content.includes('target=vue3'), 'fields: 与 given 行共存时不应丢 target')
  const noFields = buildFragmentInitialMessages('一张用户表', 'vue3')
  check(!noFields[0].content.includes('Fields (given'), 'fields: 未给 fixedFields 时不应凭空出现字段行')

  // system prompt 必须教模型「照抄给定 props」，否则只有 user 行的软约束。
  for (const [scene, toolName] of SCENES) {
    const prompt = buildFragmentSystemPrompt(scene, tools[toolName])
    check(
      prompt.includes('Fields (given') && prompt.includes('exactly those `prop` values'),
      `${scene}: system prompt 缺「照抄给定 props」规则`
    )
  }
}

if (failures) {
  console.error(`\nfragment-prompt meta-eval FAILED — ${failures} 处`)
  process.exit(1)
}
console.log('\nfragment-prompt meta-eval OK — 3 个片段工具的 prompt 与注册形状一致')
