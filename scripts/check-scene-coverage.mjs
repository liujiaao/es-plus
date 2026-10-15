#!/usr/bin/env node
/**
 * 场景覆盖门禁（Wave 1.2）。
 *
 * ## 守的是什么
 *
 * `AI-SCENE-COVERAGE-PLAN.md` §1.2 的实测结论是**被测集合 ⊊ 宣称集合**：186 条语料
 * 全是 CRUD 组合，独立 `es-table` / `es-form` / `useDialog` **零语料**，只有
 * `toContain` 字符串断言（证明「源码里有这串字」）与 esbuild **语法**解析
 * （证明「拼出来的能解析」）——两者都不是「这个场景真的被测了」的见证。
 *
 * 本门禁把「宣称支持的场景」变成**可失败断言**，两类：
 *
 *   (a) **覆盖无空格**：每个场景都要有语料，且覆盖到该场景全部 target
 *       （crud 另需覆盖两个 mode）。缺哪一格就**点名哪一格**。
 *       同时静态断言四个场景工具仍在 MCP 注册表里 —— 工具被删/改名即红。
 *
 *   (b) **片段语料真能编译**：一条语料若没人编译就是个死用例。这里把每条片段用例
 *       真跑一遍 `generate*Block`，再用与 `compile-smoke.mjs` **同一把尺子**
 *       （`scripts/lib/compile-check.mjs`）解析产物。
 *
 * ## 关于「两模式」
 *
 * `mode`（schema/sfc）是 **CRUD 独有**的轴：`fragment-generator.ts` 里 `\bmode\b`
 * 零匹配，三个片段工具的形状里没有 mode，前门 no-table 分支也从不传 mode。
 * 故断言矩阵是 `crud`: 3 端 × 2 模式、`table|form|dialog`: 3 端 × 1 —— 计划原文的
 * 「四场景 × 三端 × 两模式」在算术上不成立，此处按事实实现（见 scenes.mjs 头注）。
 *
 * ## 明确不做
 *
 * 不评片段准确率（无 scorer，硬造会产出恒真伪信号）。片段本轮的口径是**覆盖 + 编译**；
 * 准确率要等片段 scorer 落地后再进 `definition95` 分母。
 *
 * 用法：node scripts/check-scene-coverage.mjs
 * 退出码：0 = 覆盖无空格且片段语料全部可解析；1 = 有空缺格或产物解析失败。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateFormBlock, generateTableBlock, generateDialogBlock } from '@es-plus/shared'
import { SCENES, SCENE_TOOL, modesOf, cellOf, cellName, sceneOf } from './eval/scenes.mjs'
import { parseSfc, parseComposable } from './lib/compile-check.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const CASES_DIR = join(ROOT, '__tests__', 'golden', 'cases')
const TOOLS_DIR = join(ROOT, 'packages', 'mcp-server', 'src', 'tools')
const ALL_TARGETS = ['vue3', 'vue2', 'antdv']

const failures = []
const fail = (msg) => failures.push(msg)

/** 场景 → 真正把该场景跑出产物的生成器（用于 (b) 的编译断言）。 */
const FRAGMENT_GENERATORS = {
  table: (input) => generateTableBlock(input),
  form: (input) => generateFormBlock(input),
  dialog: (input) => generateDialogBlock(input),
}

// ── 读语料 ──────────────────────────────────────────────
const files = readdirSync(CASES_DIR).filter((f) => f.endsWith('.json')).sort()
const cases = []
for (const file of files) {
  let raw
  try {
    raw = JSON.parse(readFileSync(join(CASES_DIR, file), 'utf8'))
  } catch (err) {
    fail(`${file}: 不是合法 JSON — ${err.message}`)
    continue
  }
  cases.push({ file, raw, scene: sceneOf(raw) })
}

// ── (a) 覆盖无空格 ───────────────────────────────────────
const present = new Set() // `${scene}|${target}|${mode ?? ''}`
for (const c of cases) {
  const { scene, target, mode } = cellOf(c.raw)
  if (!target) {
    fail(`${c.file}: scene=${scene} 缺 target（片段输入不含 target，必须由用例顶层给出）`)
    continue
  }
  present.add(`${scene}|${target}|${mode ?? ''}`)
}

/** 该场景的语料应覆盖的全部格（用于点名缺失格）。 */
function expectedCells(scene) {
  return ALL_TARGETS.flatMap((target) => modesOf(scene).map((mode) => ({ scene, target, mode })))
}

for (const scene of SCENES) {
  const cells = expectedCells(scene)
  const missing = cells.filter((x) => !present.has(`${x.scene}|${x.target}|${x.mode ?? ''}`))
  if (missing.length === cells.length) {
    fail(`场景 ${scene} 零语料 —— 该场景完全未被测量，宣称与被测不符`)
    continue
  }
  for (const m of missing) fail(`缺格：${cellName(m)} 无用例`)
}

// 工具注册表：静态断言四个场景工具仍然存在（纯文本正则，沿用 check-fragment-contract.mjs 的手法）。
const indexSrc = readFileSync(join(TOOLS_DIR, 'index.ts'), 'utf8')
for (const [scene, tool] of Object.entries(SCENE_TOOL)) {
  const toolFile = `${tool.replace(/^generate_/, 'generate-').replace(/_/g, '-')}.ts`
  let src
  try {
    src = readFileSync(join(TOOLS_DIR, toolFile), 'utf8')
  } catch {
    fail(`场景 ${scene} 的工具文件 ${toolFile} 不存在（SCENE_TOOL 指向了已被删除/改名的工具）`)
    continue
  }
  // 工具名必须真的在该文件里被注册，且该文件必须在 index.ts 里被 register 调用。
  if (!new RegExp(`["'\`]${tool}["'\`]`).test(src)) {
    fail(`场景 ${scene}：${toolFile} 里没有注册工具名 "${tool}"（改名即红，防止门禁守着一个不存在的场景）`)
  }
  const registrar = toolFile.replace(/\.ts$/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase())
  if (!indexSrc.includes(`register${registrar[0].toUpperCase()}${registrar.slice(1)}`)) {
    fail(`场景 ${scene}：index.ts 未注册 ${toolFile}（工具存在但没挂上）`)
  }
}

// ── (b) 片段语料真能编译 ─────────────────────────────────
const fragmentResults = []
for (const c of cases) {
  const gen = FRAGMENT_GENERATORS[c.scene]
  if (!gen) continue // crud 场景的编译保证在 golden:e2e（真 vite build）
  const label = `${cellName(cellOf(c.raw))} — ${c.file}`
  const input = { ...c.raw.config, target: c.raw.target }
  let r
  try {
    r = gen(input)
  } catch (err) {
    fail(`${label}: 生成器抛错 — ${err.message}`)
    continue
  }
  const before = failures.length
  if (c.scene === 'dialog') {
    // dialog 产物是 composable 模块（非 SFC），整体按 tsx/jsx 解析。
    parseComposable(r.code, input.typescript !== false, label, failures)
  } else {
    parseSfc(r.code, label, failures)
  }
  fragmentResults.push({ label, ok: failures.length === before })
}

// ── 报告 ────────────────────────────────────────────────
const byScene = (s) => cases.filter((c) => c.scene === s).length
console.log('[scene-coverage] 语料格覆盖')
for (const scene of SCENES) {
  const cells = expectedCells(scene)
  const hit = cells.filter((x) => present.has(`${x.scene}|${x.target}|${x.mode ?? ''}`)).length
  const modeNote = modesOf(scene)[0] === null ? '（该场景无 mode 轴）' : ` × ${modesOf(scene).length} 模式`
  console.log(`  ${scene.padEnd(7)} ${hit}/${cells.length} 格 · ${String(byScene(scene)).padEnd(3)} 例${modeNote}`)
}
if (fragmentResults.length) {
  console.log(`[scene-coverage] 片段语料编译：${fragmentResults.filter((x) => x.ok).length}/${fragmentResults.length} 可解析`)
} else {
  fail('没有任何片段语料被编译 —— 覆盖断言形同虚设')
}

if (failures.length) {
  console.error(`\n❌ check:scene-coverage FAILED（${failures.length} 处）：`)
  for (const m of failures) console.error(`   - ${m}`)
  process.exit(1)
}
console.log('✅ check:scene-coverage：四场景覆盖无空格，片段语料产物全部可解析。')
