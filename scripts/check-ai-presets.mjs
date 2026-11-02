#!/usr/bin/env node
/**
 * check:ai-presets —— 旗舰站预设的「宣称 = 产物」守卫。
 *
 * 背景：站点 `/ai-crud` 的六个预设各自描述一种能力（虚拟滚动、跨页批量、
 * 多 tab 弹窗…）。此前它们**从未被任何守卫覆盖**：
 *
 *   - `packages/shared/__tests__/crud-engine-presets.spec.ts` 断言的是旧引擎
 *     `generateCrudConfig`，而站点走的是适配器 `generateCrudSchema`；
 *   - 适配器把 `tableOptions` 硬编码、丢掉 `featureHints` / `queryBtns`，
 *     于是 4/6 预设的宣称在产物里根本不存在，而所有测试全绿。
 *
 * 本守卫只认**上线那条函数**：`@es-plus/shared` 的 `generateCrudSchema`
 * （MCP `generate_crud_schema` / CLI `create` 离线路径 / 站点离线路径同一实现）。
 * 预设里声明的 `capabilities` 是可执行契约，不是宣传语。
 *
 * 断言三类事实：
 *   1. actions 精确一致（顺序无关）；
 *   2. tableOptions 子集匹配（声明了的必须为真值）；
 *   3. featureHints 必须点名「识别到但产物无法表达」的能力 —— 沉默才是 bug。
 *
 * 另加一条与具体预设无关的按钮面规则：动作出现在 `actions` 里，就必须有对应的
 * 工具栏入口（否则「支持批量上下架」只是配置里的一个字符串）。
 */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function loadPresets() {
  const result = await build({
    entryPoints: [path.join(ROOT, 'es-plus-docs/src/utils/preset-examples.ts')],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    logLevel: 'silent',
  })
  const code = result.outputFiles[0].text
  const mod = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  return mod.PRESETS
}

/** 动作 → 工具栏按钮必须出现的 key */
const ACTION_BUTTON_KEYS = {
  add: ['add'],
  export: ['export'],
  import: ['import'],
  approve: ['approve'],
  reject: ['reject'],
  toggleListing: ['batchList', 'batchUnlist'],
}

function subsetMismatch(actual, expected) {
  const misses = []
  for (const [k, v] of Object.entries(expected)) {
    if (actual?.[k] !== v) misses.push(`${k}=${JSON.stringify(actual?.[k])} ≠ ${JSON.stringify(v)}`)
  }
  return misses
}

const { generateCrudSchema } = await import(
  new URL('../packages/shared/build/index.js', import.meta.url).href
)

const presets = await loadPresets()
const failures = []
/** AI-only 的片段预设：产物由「模型按信封协议调片段工具」产出，离线无法重算 */
const aiOnly = []

const FRAGMENT_TOOLS = ['generate_table', 'generate_form', 'generate_dialog']

for (const preset of presets) {
  const where = `preset "${preset.id}"`

  // 片段预设（AI-only）：离线规则引擎没有片段入口，不能拿 generateCrudSchema 重算。
  // 能断言的只有「声明本身是自洽的」—— 工具名合法、字段非空、showcases 点名了工具。
  if (preset.requiresAi) {
    const fragment = preset.fragment
    if (!fragment) {
      failures.push(`${where}: requiresAi 的预设必须声明 fragment（工具 + 声称的字段）`)
      continue
    }
    if (!FRAGMENT_TOOLS.includes(fragment.tool)) {
      failures.push(`${where}: fragment.tool "${fragment.tool}" 不是片段工具`)
    }
    if (!Array.isArray(fragment.fields) || fragment.fields.length === 0) {
      failures.push(`${where}: fragment.fields 不能为空`)
    }
    if (!(preset.showcases ?? []).includes(fragment.tool)) {
      failures.push(`${where}: showcases 必须点名工具 "${fragment.tool}"，否则用户在卡片上看不出它走哪条链路`)
    }
    aiOnly.push(preset.id)
    continue
  }

  const capabilities = preset.capabilities
  if (!capabilities) {
    failures.push(`${where}: 缺少 capabilities 声明（预设必须可验证）`)
    continue
  }

  let result
  try {
    result = generateCrudSchema(preset.prompt.zh, 'vue3')
  } catch (e) {
    failures.push(`${where}: generateCrudSchema 抛错 — ${e.message}`)
    continue
  }

  const schema = result.schema
  const actions = [...((schema.actions ?? []) )].sort()
  const expectedActions = [...capabilities.actions].sort()
  if (JSON.stringify(actions) !== JSON.stringify(expectedActions)) {
    failures.push(
      `${where}: actions ${JSON.stringify(actions)} ≠ 宣称 ${JSON.stringify(expectedActions)}`
    )
  }

  if (capabilities.tableOptions) {
    const misses = subsetMismatch(schema.tableOptions ?? {}, capabilities.tableOptions)
    if (misses.length) failures.push(`${where}: tableOptions 缺失 ${misses.join('; ')}`)
  }

  const hints = (result.featureHints ?? []).join(' ')
  for (const keyword of capabilities.hints ?? []) {
    if (!hints.includes(keyword)) {
      failures.push(`${where}: featureHints 未点名「${keyword}」（实际：${hints || '(空)'}）`)
    }
  }

  // 按钮面：动作声明了就必须有入口
  const toolbarKeys = new Set(
    (schema.toolbarBtns ?? []).map((b) => b.key).filter(Boolean)
  )
  for (const action of capabilities.actions) {
    const required = ACTION_BUTTON_KEYS[action]
    if (!required) continue // edit/delete/view 走行内按钮，由 actions 派生
    for (const key of required) {
      if (!toolbarKeys.has(key)) {
        failures.push(`${where}: actions 含 "${action}"，但 toolbarBtns 里没有 "${key}"`)
      }
    }
  }

  // 行内按钮：view/edit/delete 由 es-crud-page 从 actions 派生（core
  // resolveCrudActions），这里只保证 actions 本身透出了（上一段已断言）。
}

if (failures.length) {
  console.error(`\n✗ check:ai-presets — ${failures.length} 处「宣称 ≠ 产物」：\n`)
  for (const f of failures) console.error(`  - ${f}`)
  console.error(
    '\n修法二选一：补实现（让产物真的具备该能力），或降宣称（删掉 capabilities 并让 featureHints 承认它未实现）。\n'
  )
  process.exit(1)
}

console.log(
  `✓ check:ai-presets — ${presets.length} 个预设的宣称与产物一致` +
    (aiOnly.length
      ? `（其中 ${aiOnly.length} 个 AI-only 片段预设只校验声明：${aiOnly.join(', ')} —— 产物由模型路径产出，离线不复现）`
      : '')
)
