#!/usr/bin/env node
/**
 * P12 —— gold 自评分（尺子的自证）。
 *
 * ## 为什么需要它
 *
 * 语料是尺子的地标：一条用例的 **gold 自己跑不过尺子**，只可能是尺子的建模有缺陷
 * （或语料自相矛盾），此时任何模型分数都不可比 —— 分母里混着「本来就判不对」的行。
 * PRD 腿早有逐例自评（`prd-leg.test.mjs`），CRUD 216 例与片段语料此前只有合成样例
 * 单测，没有逐例自评。本守卫补上这一腿。
 *
 * 它当场抓到过一条真实尺子缺陷：`dialogs` 的 `formItems` 派生只回填 pred 侧，
 * gold 写 `dialogs.add: { showClose… }` 而省略 `formItems` 时，gold 侧按空集比 ⟹
 * gold-vs-gold 判负（`12-role-form-layout` / `18-notice-custom-dialog`）。
 *
 * ## 判据（全部必须为真）
 *
 * - CRUD：`scoreAll(gold, gold, mask)` 的 `exactIntentCore` / `exactIntentFull` /
 *   `exactIntentScoped` 均为 true，且每个 applicable 维度 pass；
 * - CRUD 动作面（L5）：`actions` 的每一项、`tableBtns` 的每一个按钮都能在 NL
 *   （含纠正轮）里找到措辞依据 —— 见下方 `ACTION_CUES` 与 `actionEvidenceProblems`；
 * - 片段：`scoreFragment(scene, gold, gold, mask)` 的 `exactIntentCore` / `Full` /
 *   `Scoped` / `Stated` 均为 true，且每个 applicable 维度 pass。
 *
 * 只跑 zh 那一份 gold（en 腿共用同一 gold，自评无语言差异）。不生成代码、不调模型、
 * 不读写 accuracy 产物 —— 纯离线、纯确定。
 *
 * 用法：`node scripts/check-gold-self-score.mjs`
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { StructuredCrudConfigSchema } from '@es-plus/shared'
import { scoreAll } from './eval/scorers.mjs'
import { scoreFragment } from './eval/fragment-scorers.mjs'
import { isCrudCase, sceneOf } from './eval/scenes.mjs'
import { CASES_DIR } from './eval/artifact.mjs'
import { fragmentInput, FRAGMENT_GENERATORS } from './lib/fragment-cases.mjs'
import { actionEvidenceProblems } from './lib/action-evidence.mjs'

const failures = []
const fail = (msg) => {
  failures.push(msg)
  console.error(`✗ ${msg}`)
}

// ── L5：动作面的 NL 证据 ─────────────────────────────────────────────────────
//
// 判据与措辞表落在 `scripts/lib/action-evidence.mjs`（一次性审计脚本
// `scripts/eval/audit-actions.mjs` 共用同一份，避免「守卫以为标对了、审计按另一套
// 谓词写」）。这里只保留自检夹具与逐例调用。

// 自检夹具：认正例、否反例（守卫失配时必须当场红，而不是静默全绿）。
{
  const ok = { nl: '用户管理：表格展示用户名；支持新增、编辑、删除。', config: { actions: ['add', 'edit', 'delete'], tableBtns: [{ name: '批量导出', actionType: 'export' }] } }
  const okText = { ...ok, nl: '用户管理：表格展示用户名；支持增删改查；工具栏有「批量导出」按钮。' }
  const byAction = { nl: '表格上方放一个导出按钮。', config: { actions: ['export'], tableBtns: [{ name: '导出明细', actionType: 'export' }] } }
  for (const [tag, raw] of [['正例-直述', okText], ['正例-按钮动作词', byAction]]) {
    const got = actionEvidenceProblems(raw)
    if (got.length) fail(`动作面自检「${tag}」：合法用例被判红 → ${got.join(' | ')}`)
  }
  const bad = [
    ['死动作', { nl: '表格展示用户名，只读。', config: { actions: ['add'], tableBtns: [] } }, 'actions 的 add'],
    ['死按钮', { nl: '支持新增、编辑。', config: { actions: ['add', 'edit'], tableBtns: [{ name: '批量导出', actionType: 'export' }] } }, '批量导出'],
    ['纠正轮不算反例', { nl: '支持新增。', refinements: [{ correction: '再加一个导出按钮。' }], config: { actions: ['add', 'export'], tableBtns: [] } }, null],
  ]
  for (const [tag, raw, want] of bad) {
    const got = actionEvidenceProblems(raw).join(' | ')
    if (want && !got.includes(want)) fail(`动作面自检「${tag}」：期望含「${want}」，实得 ${got || '(空)'}`)
    if (!want && got) fail(`动作面自检「${tag}」：纠正轮里的措辞应被认作依据，实得 ${got}`)
  }
}

const files = readdirSync(CASES_DIR)
  .filter((f) => f.endsWith('.json'))
  .sort()

let crudCount = 0
let fragmentCount = 0

for (const file of files) {
  const raw = JSON.parse(readFileSync(join(CASES_DIR, file), 'utf8'))
  const scene = sceneOf(raw)

  if (!isCrudCase(raw)) {
    if (!FRAGMENT_GENERATORS[scene]) continue
    fragmentCount++
    const gold = fragmentInput({ raw })
    const mask = {
      pinnedDims: Array.isArray(raw.pinnedDims) ? raw.pinnedDims : [],
      statedDims: Array.isArray(raw.nlStatedDims) ? raw.nlStatedDims : [],
    }
    let s
    try {
      s = scoreFragment(scene, gold, gold, mask)
    } catch (err) {
      fail(`${file}: gold 自评抛错 — ${err instanceof Error ? err.message : String(err)}`)
      continue
    }
    const badDims = Object.entries(s.byDim)
      .filter(([, c]) => c.applicable && !c.pass)
      .map(([k]) => k)
    if (badDims.length) fail(`${file} [frag:${scene}]: gold 自评未通过维度 ${badDims.join(' / ')}`)
    if (!s.exactIntentCore) fail(`${file} [frag:${scene}]: exactIntentCore 为 false`)
    if (!s.exactIntentFull) fail(`${file} [frag:${scene}]: exactIntentFull 为 false`)
    if (!s.exactIntentScoped) fail(`${file} [frag:${scene}]: exactIntentScoped 为 false`)
    if (!s.exactIntentStated) fail(`${file} [frag:${scene}]: exactIntentStated 为 false`)
    continue
  }

  crudCount++
  // L5：动作面证据（与打分无关，防的是「NL 从没说过、gold 却要求」的语料缺陷）。
  for (const p of actionEvidenceProblems(raw, { file })) fail(p)
  let gold
  try {
    gold = StructuredCrudConfigSchema.parse(raw.config)
  } catch (err) {
    fail(`${file}: gold 无法通过 StructuredCrudConfigSchema — ${err instanceof Error ? err.message : String(err)}`)
    continue
  }
  const mask = { pinnedDims: Array.isArray(raw.pinnedDims) ? raw.pinnedDims : [] }
  let s
  try {
    s = scoreAll(gold, gold, mask)
  } catch (err) {
    fail(`${file}: gold 自评抛错 — ${err instanceof Error ? err.message : String(err)}`)
    continue
  }
  const badDims = Object.entries(s.byCapability)
    .filter(([, c]) => c.applicable && !c.pass)
    .map(([k]) => k)
  if (badDims.length) fail(`${file}: gold 自评未通过维度 ${badDims.join(' / ')}`)
  if (!s.exactIntentCore) fail(`${file}: exactIntentCore 为 false`)
  if (!s.exactIntentFull) fail(`${file}: exactIntentFull 为 false`)
  if (!s.exactIntentScoped) fail(`${file}: exactIntentScoped 为 false`)
}

if (failures.length) {
  console.error(`\n✗ gold 自评分 ${failures.length} 处未通过（CRUD ${crudCount} / 片段 ${fragmentCount}）`)
  process.exit(1)
}

console.log(
  `✓ gold 自评分 100%：CRUD ${crudCount} 例 / 片段 ${fragmentCount} 例，全部维度自洽（core / full / scoped / stated）`
)
