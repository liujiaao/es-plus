#!/usr/bin/env node
/**
 * 场景注册表门禁（P1）。
 *
 * 守的是「场景 → 语料 → 工具 → 生成器」四方的**同一性**：
 *
 *   (a) 注册表自身：id 唯一、四场景齐全、每个场景至少一个 artifact、三端齐全、
 *       模式轴符合事实（crud = schema/sfc、dialog = composable/component、
 *       table/form = 无轴）。
 *   (b) 语料：每条用例的 scene 必须能在注册表里找到；每个场景至少一条语料；
 *       片段场景的文件前缀必须与 `eval.casePrefix` 一致（防止「把 table 用例
 *       丢进 form 目录」这种静默错位）。
 *   (c) 工具：`entry.tool` 指向的工具文件必须存在、文件内必须注册该工具名、
 *       `tools/index.ts` 必须真的调用对应 register（防止「注册表说有，产品里没有」）。
 *   (d) 生成器：`scripts/lib/fragment-cases.mjs` 的 `FRAGMENT_GENERATORS` 键集
 *       必须精确等于「非 crud 场景」，不能多也不能少。
 *   (e) 罐头弹窗标题：emit / 评测打分器不得自带一份，生成器模板里的字面量必须与
 *       注册表常量一致（模板不能 import，只能反向比对）。
 *   (f) 运行时见证：`runtime.witnesses` 登记的每一条路径必须**真的存在** ——
 *       声明了却没人跑的门禁等于没有门禁（P6a 补；此前 4 条 vue2 路径全是死链）。
 *
 * 明确不做：不评准确率、不跑生成、不替代 `check-scene-coverage` 的编译/e2e 断言。
 *
 * 用法：node scripts/check-scene-registry.mjs
 * 退出码：0 = 四方一致；1 = 有任何漂移。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  SCENES,
  SCENE_TOOL,
  SCENE_REGISTRY,
  DEFAULT_SCENE,
  SCENE_IDS,
  DIALOG_TITLES,
  dialogTitleFor,
  sceneOf,
  artifactFamilyOf,
} from '@es-plus/shared/scene'
import { generateFormBlock, generateTableBlock, generateDialogBlock } from '@es-plus/shared'
import { FRAGMENT_GENERATORS } from './lib/fragment-cases.mjs'
import { toolFileFor } from './lib/tool-files.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const CASES_DIR = join(ROOT, '__tests__', 'golden', 'cases')
const TOOLS_DIR = join(ROOT, 'packages', 'mcp-server', 'src', 'tools')
const ALL_TARGETS = ['vue3', 'vue2', 'antdv']

const failures = []
const fail = (msg) => failures.push(msg)

// ── (a) 注册表自身 ──────────────────────────────────────
const ids = SCENE_REGISTRY.map((s) => s.id)
if (new Set(ids).size !== ids.length) fail(`注册表有重复 scene id：${ids.join(', ')}`)
for (const id of SCENE_IDS) {
  if (!ids.includes(id)) fail(`注册表缺少场景 ${id}`)
}
for (const scene of SCENE_REGISTRY) {
  const label = `场景 ${scene.id}`
  if (!scene.artifacts.length) fail(`${label}: artifacts 为空`)
  for (const target of ALL_TARGETS) {
    if (!scene.targets.includes(target)) fail(`${label}: 缺 target ${target}`)
  }
  if (!scene.modes.length) fail(`${label}: modes 为空（无轴也应显式 [null]）`)

  if (scene.id === 'crud') {
    if (!scene.modes.includes('schema') || !scene.modes.includes('sfc')) {
      fail(`${label}: 模式轴必须是 schema + sfc，实际 ${JSON.stringify(scene.modes)}`)
    }
    if (scene.artifactFamily !== 'crud-page') fail(`${label}: artifactFamily 必须是 crud-page`)
  } else if (scene.id === 'dialog') {
    if (!scene.modes.includes('composable') || !scene.modes.includes('component')) {
      fail(`${label}: 形态轴必须是 composable + component，实际 ${JSON.stringify(scene.modes)}`)
    }
    if (scene.artifactFamily !== 'dialog') fail(`${label}: artifactFamily 必须是 dialog`)
    for (const artifact of ['dialog-composable', 'dialog-component']) {
      if (!scene.artifacts.includes(artifact)) fail(`${label}: 缺 artifact ${artifact}`)
    }
  } else {
    if (scene.modes.length !== 1 || scene.modes[0] !== null) {
      fail(`${label}: table/form 必须是无模式轴 [null]，实际 ${JSON.stringify(scene.modes)}`)
    }
    if (scene.artifactFamily !== scene.id) fail(`${label}: artifactFamily 必须是 ${scene.id}`)
    if (scene.artifacts.length !== 1 || scene.artifacts[0] !== scene.id) {
      fail(`${label}: artifacts 必须恰为 ["${scene.id}"]，实际 ${JSON.stringify(scene.artifacts)}`)
    }
  }
  if (!scene.intent.required.length) fail(`${label}: intent.required 为空`)
  if (scene.eval.minCasesFor95 < 60) {
    fail(`${label}: minCasesFor95=${scene.eval.minCasesFor95}，95% 门禁下限不得低于 60（n=21 时 1 例=4.8pp）`)
  }
  if (scene.id !== 'crud' && scene.eval.gate === 'definition95') {
    fail(`${label}: 片段场景在当前样本量下只能标 fragment-global，不得直接标 definition95`)
  }
}

// ── (b) 语料 ────────────────────────────────────────────
const files = readdirSync(CASES_DIR).filter((f) => f.endsWith('.json')).sort()
const byScene = new Map(SCENES.map((s) => [s, []]))
for (const file of files) {
  let raw
  try {
    raw = JSON.parse(readFileSync(join(CASES_DIR, file), 'utf8'))
  } catch (err) {
    fail(`${file}: 不是合法 JSON — ${err.message}`)
    continue
  }
  const scene = sceneOf(raw)
  if (!SCENES.includes(scene)) {
    fail(`${file}: scene=${scene} 不在注册表（合法值：${SCENES.join('/')}）`)
    continue
  }
  const contract = SCENE_REGISTRY.find((s) => s.id === scene)
  if (contract.eval.casePrefix && !file.startsWith(contract.eval.casePrefix)) {
    fail(
      `${file}: scene=${scene} 但文件名不以 ${contract.eval.casePrefix} 开头（场景语料混入了别的文件族）`
    )
  }
  byScene.get(scene).push(file)
}
for (const scene of SCENES) {
  const list = byScene.get(scene)
  if (!list.length) fail(`场景 ${scene} 零语料 —— 注册表声称支持，但语料里没有任何用例`)
  console.log(`  ${scene.padEnd(6)} ${String(list.length).padStart(3)} 条语料`)
}

// 门禁口径必须与**真实语料量**挂钩：声明 definition95 的场景，语料数不得低于
// 它自己写的 minCasesFor95。只比常数（(a) 段）挡不住「语料缩水但门禁口径没改」——
// 21 条上 1 例 = 4.8pp，那时谈 95% 是噪声而不是成绩。
for (const scene of SCENES) {
  const contract = SCENE_REGISTRY.find((s) => s.id === scene)
  if (contract.eval.gate !== 'definition95') continue
  const count = byScene.get(scene).length
  if (count < contract.eval.minCasesFor95) {
    fail(
      `场景 ${scene}: 声称 definition95 门禁，但语料只有 ${count} 条（minCasesFor95=${contract.eval.minCasesFor95}）` +
        `—— 样本不足以支撑 95% 口径，请扩语料或降级门禁口径`,
    )
  }
}

// ── (c) 工具注册 ────────────────────────────────────────
const indexSrc = readFileSync(join(TOOLS_DIR, 'index.ts'), 'utf8')
if (Object.keys(SCENE_TOOL).length !== SCENES.length) {
  fail(`SCENE_TOOL 键数 ${Object.keys(SCENE_TOOL).length} != 场景数 ${SCENES.length}`)
}

/** 工具文件必须存在、文件内必须注册该工具名、`tools/index.ts` 必须真的调用对应 register。 */
function checkTool(tool, label) {
  const toolFile = toolFileFor(tool)
  let src
  try {
    src = readFileSync(join(TOOLS_DIR, toolFile), 'utf8')
  } catch {
    fail(`${label}: 工具文件 ${toolFile} 不存在（entry 指向了已删除/改名的工具）`)
    return
  }
  if (!new RegExp(`["'\`]${tool}["'\`]`).test(src)) {
    fail(`${label}: ${toolFile} 里没有注册工具名 "${tool}"`)
  }
  const registrar = toolFile
    .replace(/\.ts$/, '')
    .replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    .replace(/^generate/, 'registerGenerate')
  if (!indexSrc.includes(registrar)) {
    fail(`${label}: index.ts 未调用 ${registrar}（工具存在但没挂上）`)
  }
}

const checkedTools = new Set()
for (const scene of SCENES) {
  const contract = SCENE_REGISTRY.find((s) => s.id === scene)
  const tool = contract.entry.tool
  if (SCENE_TOOL[scene] !== tool) {
    fail(`场景 ${scene}: SCENE_TOOL=${SCENE_TOOL[scene]} 与 entry.tool=${tool} 不一致`)
  }
  for (const [kind, name] of [
    ['canonical', tool],
    ...contract.entry.adapters.map((a) => ['adapter', a]),
  ]) {
    if (checkedTools.has(name)) continue
    checkedTools.add(name)
    checkTool(name, `场景 ${scene} 的 ${kind} 入口 ${name}`)
  }
}
// canonical 入口必须真的覆盖每个场景：`generate_scene` 的 scene 枚举从注册表派生，
// 这里同时断言它出现在源码里（防止「注册表说 canonical，产品里其实没这个工具」）。
if (!SCENE_TOOL[SCENES[0]]) fail('SCENE_TOOL 为空 —— canonical 入口没有派生出来')

// ── (d) 片段生成器 ──────────────────────────────────────
const fragmentScenes = SCENES.filter((s) => s !== DEFAULT_SCENE).sort()
const generatorScenes = Object.keys(FRAGMENT_GENERATORS).sort()
if (JSON.stringify(fragmentScenes) !== JSON.stringify(generatorScenes)) {
  fail(
    `FRAGMENT_GENERATORS 键集与注册表不一致：注册表 ${JSON.stringify(fragmentScenes)}，生成器 ${JSON.stringify(generatorScenes)}`
  )
}

// 键集相同还不够：把 table 场景接到 form 生成器，键集依旧「一致」，
// 但那是最危险的一类静默错位。按 artifactFamily 比对**函数身份**。
const EXPECTED_GENERATOR = {
  table: generateTableBlock,
  form: generateFormBlock,
  dialog: generateDialogBlock,
}
for (const scene of fragmentScenes) {
  const family = artifactFamilyOf(scene)
  const expected = EXPECTED_GENERATOR[family]
  if (!expected) {
    fail(`场景 ${scene}: artifactFamily=${family} 没有已知生成器`)
    continue
  }
  if (FRAGMENT_GENERATORS[scene] !== expected) {
    fail(`场景 ${scene}: FRAGMENT_GENERATORS 接错了生成器（family=${family}）`)
  }
}

// ── (e) 罐头弹窗标题单一真源 ────────────────────────────
// 标题既是文案，又是提交方法 / 只读语义的判据（'新增'→POST、'查看'→只读）。
// 注册表是唯一真源；emit 层与评测组合打分器必须 import 它，生成器模板里的字面量
// 无法 import（会改变产物字节），因此由守卫**反向比对**常量与模板。
const readSrc = (relPath) => readFileSync(join(ROOT, relPath), 'utf8')

const emitSrc = readSrc('packages/shared/src/scene/emit.ts')
if (/const\s+DIALOG_TITLES\s*=/.test(emitSrc)) {
  fail('emit.ts 自己定义了 DIALOG_TITLES —— 必须从 registry 导入')
}
if (!/import\s*\{[^}]*DIALOG_TITLES[^}]*\}\s*from\s*'\.\/registry\.js'/.test(emitSrc)) {
  fail('emit.ts 没有从 registry 导入 DIALOG_TITLES')
}

const scorerSrc = readSrc('scripts/eval/composition-scorers.mjs')
if (/const\s+DIALOG_TITLES\s*=/.test(scorerSrc)) {
  fail('composition-scorers.mjs 自己定义了 DIALOG_TITLES —— 必须从 scenes.mjs 导入 dialogTitleFor')
}
if (!/import\s*\{[^}]*dialogTitleFor[^}]*\}\s*from\s*'\.\/scenes\.mjs'/.test(scorerSrc)) {
  fail('composition-scorers.mjs 没有从 scenes.mjs 导入 dialogTitleFor')
}

const titleHeuristics = [
  ['packages/shared/src/structured-generator.ts', `=== '${DIALOG_TITLES.add}'`, `=== '${DIALOG_TITLES.view}'`],
  ['packages/shared/src/fragment-generator.ts', `=== '${DIALOG_TITLES.add}'`, `=== '${DIALOG_TITLES.view}'`],
  ['packages/shared/src/crud-engine.ts', `openForm('${DIALOG_TITLES.add}')`, `=== '${DIALOG_TITLES.view}'`],
]
for (const [file, addLiteral, viewLiteral] of titleHeuristics) {
  const src = readSrc(file)
  if (!src.includes(addLiteral)) {
    fail(`${file}: 缺少标题启发式 ${addLiteral}（DIALOG_TITLES.add 改了但生成器模板没跟）`)
  }
  if (!src.includes(viewLiteral)) {
    fail(`${file}: 缺少标题启发式 ${viewLiteral}（DIALOG_TITLES.view 改了但生成器模板没跟）`)
  }
}

if (dialogTitleFor('add') !== DIALOG_TITLES.add || dialogTitleFor('custom-key') !== 'custom-key') {
  fail('dialogTitleFor 语义漂移：罐头 key 取标题、未知 key 原样返回')
}

// 测试也是消费者：断言文件里手抄一份标题表，同样会在常量改名时静默错位
// （P6a：三份为 vue3/antdv 的 composition-runtime.spec 与 mcp 的 surfaces-examples.spec）。
function collectSpecFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'build' || entry.name === 'dist') continue
    const p = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...collectSpecFiles(p))
    else if (/\.(spec|test)\.(ts|js|mjs)$/.test(entry.name)) out.push(p)
  }
  return out
}
for (const file of collectSpecFiles(join(ROOT, 'packages'))) {
  const src = readFileSync(file, 'utf8')
  if (/\bconst\s+DIALOG_TITLES\s*[:=]/.test(src)) {
    fail(`${file.slice(ROOT.length + 1)} 自己定义了 DIALOG_TITLES —— 测试也必须从 shared 导入`)
  }
}

// ── (f) 运行时见证路径 ──────────────────────────────────
// 「声明了但没人跑」的见证与没有见证等价：这里只做存在性断言，不代替真的跑测试。
for (const scene of SCENE_REGISTRY) {
  for (const witness of scene.runtime.witnesses) {
    if (!existsSync(join(ROOT, witness))) {
      fail(`场景 ${scene.id}: 运行时见证 ${witness} 不存在（路径死链，等于没有见证）`)
    }
  }
}

// ── 输出 ────────────────────────────────────────────────
if (failures.length) {
  console.error(`\n✖ 场景注册表有 ${failures.length} 处漂移：`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}
console.log(
  `\n✓ 场景注册表一致：${SCENES.length} 场景 / ${files.length} 条语料 / ${Object.keys(FRAGMENT_GENERATORS).length} 个片段生成器`
)
