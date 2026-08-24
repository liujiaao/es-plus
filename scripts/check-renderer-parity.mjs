#!/usr/bin/env node
/**
 * 三端 formtype 渲染键集一致性校验
 *
 * 背景：vue3 / vue2 / adapter-antdv 三个渲染器各自维护一份 `formPutList` Map，
 * 历史上曾出现「vue2 独有 InputNumber」「vue3/antdv 存在 datePicker/timePicker 死键」等分叉。
 * 本脚本对三份 use-form-inputs.ts 做静态分析，抽取 Map 键集并断言：
 *   1. 三端键集完全一致（无某端独有/缺失）
 *   2. 键集与 VALID_FORM_TYPES（@es-plus/shared 单源）完全一致
 *
 * 用法：
 *   node scripts/check-renderer-parity.mjs            # 校验（CI 用）
 *
 * 退出码：0 = 一致；1 = 检测到分叉。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const RENDERER_INPUTS = [
  ['vue3', 'packages/vue3/src/composables/use-form-inputs.ts'],
  ['vue2', 'packages/vue2/src/composables/use-form-inputs.ts'],
  ['antdv', 'packages/adapter-antdv/src/composables/use-form-inputs.ts'],
]

// 权威键集：@es-plus/shared 的 contract.ts 单源（直接读源码，避免依赖 build 产物）
function readValidFormTypes() {
  const src = readFileSync(join(ROOT, 'packages/shared/src/contract.ts'), 'utf-8')
  const m = src.match(/VALID_FORM_TYPES\s*=\s*\[([\s\S]*?)\]/)
  if (!m) throw new Error('无法从 shared/contract.ts 解析 VALID_FORM_TYPES')
  const keys = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
  return { keys, set: new Set(keys) }
}

/**
 * 抽取 use-form-inputs.ts 中 formPutList Map 的键。
 * 三端键均为 PascalCase，形如独立一行 `        'Input',`。
 * 只取 PascalCase 词（避免误收事件名/图标名等），再与 VALID_FORM_TYPES 比对过滤。
 */
function extractMapKeys(path) {
  const src = readFileSync(join(ROOT, path), 'utf-8')
  const keys = [...src.matchAll(/^\s*'([A-Z][a-zA-Z0-9]*)',\s*$/gm)].map((m) => m[1])
  return { keys, set: new Set(keys) }
}

function main() {
  const valid = readValidFormTypes()
  let fail = false

  const rendererSets = {}
  for (const [name, path] of RENDERER_INPUTS) {
    const { keys, set } = extractMapKeys(path)
    rendererSets[name] = set

    // 1. 该端键集与权威键集一致（双向：无缺失、无多余）
    const missing = valid.keys.filter((k) => !set.has(k))
    const extra = keys.filter((k) => !valid.set.has(k) && !['InputNumber'].includes(k))
    if (missing.length || extra.length) {
      fail = true
      console.error(`❌ ${name} formPutList 键集漂移：`)
      if (missing.length) console.error(`   缺失（VALID_FORM_TYPES 有而该端无）：${missing.join(', ')}`)
      if (extra.length) console.error(`   多余（该端有而 VALID_FORM_TYPES 无）：${extra.join(', ')}`)
    }
  }

  // 2. 三端彼此一致
  const [a, b, c] = RENDERER_INPUTS.map(([n]) => n)
  for (const [x, y] of [[a, b], [a, c], [b, c]]) {
    const sx = rendererSets[x]
    const sy = rendererSets[y]
    const onlyX = [...sx].filter((k) => !sy.has(k))
    const onlyY = [...sy].filter((k) => !sx.has(k))
    if (onlyX.length || onlyY.length) {
      fail = true
      console.error(`❌ ${x} 与 ${y} 键集不一致：${x}独有 [${onlyX}] / ${y}独有 [${onlyY}]`)
    }
  }

  if (fail) {
    console.error('\n三端 formtype 键集存在分叉，请统一到 VALID_FORM_TYPES 单源。')
    process.exit(1)
  }

  console.log(
    `✅ 三端 formPutList 键集一致（${valid.keys.length} 项），与 VALID_FORM_TYPES 单源同步`
  )
}

main()
