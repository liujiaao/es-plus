#!/usr/bin/env node
/**
 * 产物运行时契约门禁（P4）。
 *
 * 守的是「`ARTIFACT_RUNTIME` 声明的通道」与「生成器真的发出去的产物」之间的同一性：
 * 表里写了 `expose: ['refresh', 'reload']`，产物就必须真的把它交给宿主；写了
 * `emits: ['row-action']`，产物就必须真的声明并派发它。否则就是承诺了不存在的
 * 能力 —— 与 F5a（删掉的 es-form confirm/reset）、AI-43（被丢弃的弹窗默认插槽）
 * 同一类缺陷，只是这次发生在**片段包装层**。
 *
 * ## 校验项
 *
 *   (a) 表自身：`ARTIFACT_RUNTIME` 的键集 ≡ `ARTIFACT_KINDS`（不多不少）；
 *       `runtimeOf()` 对未知形态响亮抛错。
 *   (b) 每一种 artifact 形态都至少有一条 golden 语料产出它 —— 没有语料见证的契约行
 *       等于没人跑过的承诺。
 *   (c) 每条产物：
 *       - 契约里的每个 `expose` 都出现在 `defineExpose({...})`（vue3/antdv）或
 *         setup 的 `return {...}`（vue2）里；
 *       - 契约里的每个 `emits` 都出现在 `defineEmits([...])`（vue3/antdv）或
 *         `emits: [...]`（vue2）里；
 *       - `success.kind === 'event'` → 至少一条表单产物里真的 `emit('<name>'`；
 *       - `success.kind === 'callback'` → 每条弹窗产物的 `open()` 都带 `onSuccess`
 *         形参且体内真的调用 `onSuccess?.(`；
 *       - `success.kind === 'none'` → 契约不要求产物出现任何提交通道。
 *
 * 明确不做：不评准确率、不挂载组件、不替代 Tier-1/Tier-2 的运行时见证
 * （本门禁只证明「通道被发射」，不证明「通道在浏览器里能跑」）。
 *
 * 用法：node scripts/check-artifact-runtime.mjs
 * 退出码：0 = 契约与产物一致；1 = 有漂移。
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ARTIFACT_KINDS,
  ARTIFACT_RUNTIME,
  runtimeOf,
} from '@es-plus/shared/scene'
import { loadGoldenCases, generateFragment } from './lib/fragment-cases.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const CASES_DIR = join(ROOT, '__tests__', 'golden', 'cases')

const failures = []
const fail = (msg) => failures.push(msg)

// ── (a) 表自身 ──────────────────────────────────────────
const runtimeKinds = Object.keys(ARTIFACT_RUNTIME).sort()
const expectedKinds = [...ARTIFACT_KINDS].sort()
if (runtimeKinds.join(',') !== expectedKinds.join(',')) {
  fail(
    `ARTIFACT_RUNTIME 的键集 ≠ ARTIFACT_KINDS：表=[${runtimeKinds}] 注册表=[${expectedKinds}]`
  )
}
for (const kind of ARTIFACT_KINDS) {
  try {
    const contract = runtimeOf(kind)
    if (contract !== ARTIFACT_RUNTIME[kind]) fail(`runtimeOf('${kind}') 返回的不是表里的同一对象`)
  } catch (e) {
    fail(`runtimeOf('${kind}') 抛错：${e.message}`)
  }
}
try {
  runtimeOf('not-an-artifact')
  fail('runtimeOf 对未知形态没有抛错（会静默返回 undefined）')
} catch {
  /* 预期 */
}

// ── 契约块提取 ──────────────────────────────────────────
/** `defineExpose({ ... })`（vue3/antdv）或 setup 的 `return { ... }`（vue2）。 */
function exposedBlock(code) {
  const m = /defineExpose\(\{([\s\S]*?)\}\)/.exec(code)
  if (m) return m[1]
  const idx = code.lastIndexOf('return {')
  if (idx === -1) return null
  const end = code.indexOf('}', idx)
  return end === -1 ? null : code.slice(idx + 'return {'.length, end)
}

/** `defineEmits([...])`（vue3/antdv）或 `emits: [...]`（vue2）。 */
function emittedNames(code) {
  const m = /defineEmits\(\s*\[([^\]]*)\]/.exec(code) || /emits:\s*\[([^\]]*)\]/.exec(code)
  if (!m) return null
  return [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1])
}

/** 形态判定：table/form 由场景直接给出，dialog 由围栏区分 composable / component。 */
function kindOf(fragmentCase, fence) {
  if (fragmentCase.scene === 'table') return 'table'
  if (fragmentCase.scene === 'form') return 'form'
  if (fragmentCase.scene === 'dialog') return fence === 'tsx' ? 'dialog-composable' : 'dialog-component'
  throw new Error(`场景 ${fragmentCase.scene} 没有 artifact 形态判定`)
}

// ── (b)(c) 逐条语料 ────────────────────────────────────
const { fragments, errors } = loadGoldenCases(CASES_DIR)
if (errors.length) {
  for (const e of errors) fail(`语料读取失败：${e}`)
}
if (!fragments.length) fail('没有片段语料 —— 本门禁无从验证')

const seenKinds = new Set()
/** form 产物的提交通道出现次数（按契约里的 success.name 统计）。 */
const successChannelHits = new Map()

for (const fragmentCase of fragments) {
  const label = `${fragmentCase.file}`
  let result
  try {
    result = generateFragment(fragmentCase)
  } catch (e) {
    fail(`${label}: 生成失败 — ${e.message}`)
    continue
  }
  const code = result.code
  const fence = result.fence ?? 'vue'
  let kind
  try {
    kind = kindOf(fragmentCase, fence)
  } catch (e) {
    fail(`${label}: ${e.message}`)
    continue
  }
  seenKinds.add(kind)
  const contract = ARTIFACT_RUNTIME[kind]

  // expose
  const exposed = exposedBlock(code)
  if (!exposed) {
    fail(`${label}: 产物没有 defineExpose/return 块，契约 expose=[${contract.expose.join(', ')}] 无从落地`)
  } else {
    for (const name of contract.expose) {
      if (!new RegExp(`\\b${name}\\b`).test(exposed)) {
        fail(`${label}: 契约声明 expose '${name}'，但产物暴露块里没有它`)
      }
    }
  }

  // emits —— table 的 row-action 只在产物真的带行操作按钮时才存在（没有按钮就没有
  // 派发源）；form/dialog 则无条件声明整组通道。
  const config = fragmentCase.raw?.config ?? {}
  const rowButtons = Array.isArray(config.rowButtons) ? config.rowButtons : []
  const needsEmits = kind === 'table' ? rowButtons.length > 0 : true
  const declared = emittedNames(code)
  if (needsEmits) {
    for (const name of contract.emits) {
      if (!declared) {
        fail(`${label}: 契约声明 emits '${name}'，但产物没有 defineEmits/emits 声明`)
        break
      }
      if (!declared.includes(name)) {
        fail(`${label}: 契约声明 emits '${name}'，产物实际声明 [${declared.join(', ')}]`)
      }
    }
  }

  // success
  const success = contract.success
  if (success.kind === 'event') {
    const needle = `emit('${success.name}'`
    const hit = code.includes(needle)
    successChannelHits.set(success.name, (successChannelHits.get(success.name) || 0) + (hit ? 1 : 0))
  } else if (success.kind === 'callback') {
    // 公开形参名必须出现在 open(...) 签名里（component / composable 两种形态同名叫 onSuccess）。
    if (!new RegExp(`open\\([^)]*\\b${success.name}\\b[^)]*\\)`).test(code)) {
      fail(`${label}: 契约声明 success=callback(${success.name})，但 open() 签名里没有 '${success.name}' 形参`)
    }
    // 调用点可能存进内部变量（component 形态是 successHandler），故只钉「真的拿着提交
    // 数据调用了一次回调」——成功通道的判据是 `?.(formData)`，不是变量名。
    if (!/\?\.\(formData\)/.test(code)) {
      fail(`${label}: 契约声明 success=callback(${success.name})，但产物提交成功后没有调用回调`)
    }
  }
}

// 每种形态都必须被至少一条语料见证。`crud-page` 例外：它由 generate_crud 产出，
// 不在片段语料里 —— 但它的契约必须是**空**的，否则就是「声明了片段语料见证不到的通道」。
for (const kind of ARTIFACT_KINDS) {
  if (kind === 'crud-page') {
    const c = ARTIFACT_RUNTIME[kind]
    if (c.expose.length || c.emits.length || c.success.kind !== 'none') {
      fail(
        `crud-page 的契约必须为空（整页能力由 CrudPageSchema 声明）：expose=[${c.expose}] emits=[${c.emits}] success=${c.success.kind}`
      )
    }
    continue
  }
  if (!seenKinds.has(kind)) fail(`artifact 形态 '${kind}' 没有任何 golden 语料产出（契约行无人见证）`)
}

// event 通道必须在某个产物里真的发出（query 表单只有 query/reset，故按通道聚合）
for (const kind of ARTIFACT_KINDS) {
  const success = ARTIFACT_RUNTIME[kind].success
  if (success.kind !== 'event') continue
  const hits = successChannelHits.get(success.name) || 0
  if (hits === 0) fail(`契约声明 ${kind} 的 success=event('${success.name}')，但没有任何产物真的 emit 它`)
}

// ── 汇总 ────────────────────────────────────────────────
if (failures.length) {
  console.error(`❌ 产物运行时契约有 ${failures.length} 处漂移：`)
  for (const f of failures) console.error(`   - ${f}`)
  process.exit(1)
}
console.log(
  `✅ 产物运行时契约一致：${fragments.length} 条片段语料 / ${seenKinds.size} 种 artifact / ${ARTIFACT_KINDS.length} 行契约`
)
