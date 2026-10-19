#!/usr/bin/env node
/**
 * few-shot 登记守卫（F8）。进 CI 的 check:consistency。
 *
 * ## 它防的是什么
 *
 * `NL_TO_CONFIG_FEWSHOT` 的每条 few-shot 都逐字进 system prompt。语料里若有同源/变体 case
 * 混在 heldout，测的就是复述而非泛化 → 准确率虚高。F8 实测：登记 6 个 vs few-shot 22 条，
 * 语料里确有大量派生 case 未被排除（`63-order-expand-detail` 与 few#19 的 NL 相似度 0.89）。
 *
 * ## 它怎么做
 *
 * 语义裁定不可机械化，但**一个保守下界可以**：
 *   候选 ⟺ (prop 名 Jaccard ≥ 0.6 ∨ NL 字符 bigram Jaccard ≥ 0.35) ∧ actions 完全相同
 *
 * 该下界在 F8 里机检地抓到了 16 条新登记中的 11 条。本守卫断言：
 *
 *   ① **下界候选 ⊆ FEWSHOT_DERIVED** —— 新增同源 case 而忘记登记 → 红；
 *   ② 登记的每个文件都真实存在于语料 —— 语料改名/删除后登记表变成静默死条目 → 红；
 *   ③ 登记数 ≤ 语料总数 且 heldout 非空 —— 防「靠把语料全登记成 few-shot 洗白」。
 *   ③b heldout 绝对地板 `HELDOUT_FLOOR`（AI-33⑦）—— ③ 是**相对**的（删一半语料仍过半），
 *      绝对地板补上「语料整体缩水」这条它看不见的路。
 *
 * 下界**不是**全集（人工裁定会并入低相似度同源例，见 fewshot-derived.mjs 头注），
 * 故本守卫只报「机检下界之外的额外登记」供复核，不作为失败条件。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { StructuredCrudConfigSchema, NL_TO_CONFIG_FEWSHOT } from '@es-plus/shared'
import { FEWSHOT_DERIVED } from './eval/fewshot-derived.mjs'
import { HELDOUT_FLOOR } from './eval/ratchet.mjs'
import { isCrudCase } from './eval/scenes.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CASES_DIR = join(__dirname, '..', '__tests__', 'golden', 'cases')

const PROP_MIN = 0.6
const NL_MIN = 0.35

let failures = 0
const fail = (msg) => { failures++; console.error(`  ✗ ${msg}`) }

const bg = (s) => { const t = String(s || '').replace(/[\s\p{P}]/gu, ''); const o = new Set(); for (let i = 0; i + 1 < t.length; i++) o.add(t.slice(i, i + 2)); return o }
const jac = (a, b) => { if (!a.size || !b.size) return 0; let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i) }
const propsOf = (c) => new Set((c.fields || []).map((f) => f.prop))
const actsOf = (c) => [...(c.actions || [])].sort().join(',')

const files = readdirSync(CASES_DIR).filter((f) => f.endsWith('.json')).sort()
// 同源性只对 CRUD 场景有意义（few-shot 与登记表都是 CRUD 配置；propsOf/actsOf 也读
// config.fields/config.actions）。片段用例（Wave 1.1）既无 fields 语义也不在 few-shot 里，
// 混进来只会制造假候选，故先滤掉。
const cases = files
  .map((f) => ({ f, raw: JSON.parse(readFileSync(join(CASES_DIR, f), 'utf8')) }))
  .filter(({ raw }) => isCrudCase(raw))
  .map(({ f, raw }) => ({ f, bg: bg(raw.nl), pr: propsOf(raw.config), ac: actsOf(raw.config) }))

// ① 下界候选 ⊆ 登记表
const candidates = new Map()
for (const [i, x] of NL_TO_CONFIG_FEWSHOT.entries()) {
  const pr = propsOf(x.config), ac = actsOf(x.config), b = bg(x.nl)
  for (const c of cases) {
    const sameActs = ac === c.ac && ac !== ''
    if (!sameActs) continue
    const p = jac(pr, c.pr), n = jac(b, c.bg)
    if (p < PROP_MIN && n < NL_MIN) continue
    if (!candidates.has(c.f)) candidates.set(c.f, { few: i + 1, prop: p, nl: n })
  }
}
for (const [f, why] of [...candidates].sort()) {
  if (!FEWSHOT_DERIVED.has(f)) {
    fail(`${f} 与 few#${why.few} 同源却未登记（prop=${why.prop.toFixed(2)} nl=${why.nl.toFixed(2)}）`
      + ` —— 它会以 heldout 身份给「复述」计分，请裁定后登记进 scripts/eval/fewshot-derived.mjs`)
  }
}

// ② 登记条目必须真实存在
for (const f of FEWSHOT_DERIVED) {
  if (!files.includes(f)) fail(`登记表里的 ${f} 在语料中不存在（改名/删除后未同步登记表）`)
}

// ③ 防洗白：heldout 必须非空且占多数。
// 口径只取 CRUD 场景 —— 「heldout」是 LLM eval **gate** 的分母概念，而 95% 定义
// 只针对 CRUD 组合页语料（片段场景自 AI-45 起有自己的记分卡，但只观测、不进 gate）。
// 把片段语料算进分母会让这里的比例失真，且掩盖真正的 crud heldout 规模。
const crudFiles = cases.map((c) => c.f)
const heldout = crudFiles.filter((f) => !FEWSHOT_DERIVED.has(f))
if (!heldout.length) fail('heldout 为空 —— 全部语料都被登记成 few-shot 派生，门禁失去意义')
if (heldout.length * 2 < crudFiles.length) {
  fail(`heldout 仅 ${heldout.length}/${crudFiles.length}，不足半数 —— 登记表疑似被滥用（防「登记洗分」）`)
}
// ③b 绝对地板（AI-33⑦）。上面那条是**相对**守卫：把语料整体删一半，10/20 照样过半。
// 相对守卫防「登记洗白」，绝对地板防「语料缩水」，二者互补，缺一即有一个绕过口。
// 地板取自 ratchet.mjs 单源（不在此重定义常数，避免两处漂移）。
if (heldout.length < HELDOUT_FLOOR) {
  fail(`heldout 仅 ${heldout.length} 条，低于绝对地板 ${HELDOUT_FLOOR} —— 语料规模不足以支撑泛化结论`
    + `（单例噪声会盖过真实差异；若确属有意收缩，须经 PR 评审同步下调 ratchet.mjs 的 HELDOUT_FLOOR）`)
}

// 报告：机检下界之外的额外登记（人工裁定覆盖，供复核，不失败）
const manualOnly = [...FEWSHOT_DERIVED].filter((f) => !candidates.has(f)).sort()
if (failures) {
  console.error(`\ncheck:fewshot-registration FAILED: ${failures} 处`)
  process.exit(1)
}
console.log(`[fewshot-registration] few-shot 共 ${NL_TO_CONFIG_FEWSHOT.length} 条；语料 ${files.length} 例`
  + `（crud ${crudFiles.length} → 登记 ${FEWSHOT_DERIVED.size} / heldout ${heldout.length}；`
  + `另 ${files.length - crudFiles.length} 例非-crud 场景不进 eval 分母）`)
console.log(`[fewshot-registration] 机检下界命中 ${candidates.size} 例，全部已登记 ✔`)
console.log(`[fewshot-registration] 人工裁定额外登记 ${manualOnly.length} 例（低相似度同源，下界抓不到）：`)
for (const f of manualOnly) console.log(`    - ${f}`)
console.log('[fewshot-registration] OK — 无同源未登记用例、登记表无死条目、heldout 未被洗白。')
