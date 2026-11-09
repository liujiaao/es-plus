#!/usr/bin/env node
/**
 * CRUD 语料的公平性守卫（`nlStatedDims`）：进 CI 的 check:consistency。
 *
 * ## 它防的是什么
 *
 * 片段的 `exactIntentStated` 与弹窗腿早已要求「NL 说了才允许钉」，**CRUD 腿没有这一层**
 * ——`scoreAll` 的 scoped 口径只读 `pinnedDims`，于是任何一个 pin 都可以既无 NL 依据、
 * 又照进分数。2026-11-06 的结构债拍板把它补齐：每个 CRUD 用例显式写出
 * `nlStatedDims`（模型被告知过的维度），并守住
 *
 *   ① 每个用例都必须有 `nlStatedDims`，且 token 合法（`isValidPinnedDim`）；
 *   ② `pinnedDims ⊆ nlStatedDims`（公平性不变量：不许钉没说过的东西）；
 *   ③ 每个 token 对该用例的 gold **适用**（gold 没用到这个维度就别声称说过）；
 *   ④ 每个 token 都能对上一句真实措辞（`scripts/lib/nl-evidence.mjs` 的保守下界）；
 *   ⑤ 语料选择器没有静默漏掉用例。
 *
 * ## ④ 为什么是自报的「诚实性」下界，而不是自报本身
 *
 * 把每个 pin 原样抄进 `nlStatedDims` 也能让 ② 恒真——自报的产物证明不了自己诚实
 * （`check-membership-trap` 的同一结论）。所以另有一张措辞表：token 必须能在这条用例
 * 的**初版 NL 或某一轮纠正**里找到明确说法。措辞表刻意保守（认不出即 false），
 * 认不出时应当**摘 pin 或补 NL**，而不是放宽正则。
 *
 * ## 为什么口径包含纠正轮
 *
 * 收敛语料**故意**把铰链维度留到纠正轮（见各 `conv-*` 的 `notes`：欠定 NL + gold =
 * 最终意图，turn-0 结构性 miss 才能让循环真的 fire）。模型最终确实被告知了该维度，
 * 所以「整个交互里说过」才是对 `pinnedDims` 的公平下界；零编辑腿的严格口径由
 * `nlOnlyText` 保留，本守卫只把「仅纠正轮说到」的 token 作为观测信息打印出来。
 *
 * ## 自检
 *
 * 正则/谓词型守卫的最大风险是「悄悄失配后恒绿地通过」。运行语料之前先跑内联夹具：
 * 措辞表必须**认正例、否反例**（如「表格展示…日期」不能被当成 DatePicker 的控件依据），
 * 单例审计必须抓得住四类缺陷（漏标、钉了没说过、说了但 gold 用不到、非法 token）。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { CAPABILITY_SCORERS, isValidPinnedDim, parsePinnedDim } from './scorers.mjs'
import { isCrudCase } from './scenes.mjs'
import { HOST_GIVEN_DIMS, nlOnlyText, statedText, tokenEvidence } from '../lib/nl-evidence.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CASES_DIR = join(__dirname, '..', '..', '__tests__', 'golden', 'cases')

/** 对照组下限：语料选择器若失效，扫描条数会暴跌——这里兜底，避免「静默全绿」。 */
const MIN_CRUD_CASES = 150

const WHOLE = new Map(CAPABILITY_SCORERS.map((s) => [s.key, s]))

/** 用例的 gold（`target`/`mode` 可能写在用例顶层，也可能写在 config 里）。 */
function goldOf(raw) {
  return { ...raw.config, target: raw.target ?? raw.config.target, mode: raw.mode ?? raw.config.mode }
}

/**
 * 该 token 对本用例的 gold 是否**有定义**（gold 没用到这个维度，说「被告知过」也没意义）。
 *
 * 字段级 token 与字段级 scorer 的语义对齐：`dataOptions`/`apiParams` 在字段没声明时
 * 判据恒真（「空钉即过」），`isHidden`/`reactions` 在字段没声明时恒假（钉了必红）。
 * 两种情形都说明「这个 token 不承载信息」，不该出现在 `nlStatedDims` 里。
 */
function dimApplicable(token, gold) {
  const { dim, field } = parsePinnedDim(token)
  if (field === undefined) {
    if (dim === 'propSet') return true
    // target/mode 是宿主给定；只有**非默认**时 prompt 的 given 行才会出现（vue3 / schema 是默认）。
    if (dim === 'target') return (gold.target ?? 'vue3') !== 'vue3'
    if (dim === 'mode') return gold.mode === 'sfc'
    const s = WHOLE.get(dim)
    return !!s && !!s.applicable(gold)
  }
  const f = (gold.fields ?? []).find((x) => x.prop === field)
  if (!f) return false
  switch (dim) {
    case 'dataOptions':
      return (f.dataOptions ?? []).length > 0
    case 'apiParams':
      return !!f.apiParams
    case 'extPoints':
      return !!(f.render || f.formatter || f.permissionValue)
    case 'isHidden':
      return f.isHidden !== undefined
    case 'reactions':
      return f.reactions !== undefined
    case 'formtype':
    case 'membership':
    case 'inQuery':
    case 'inTable':
    case 'inForm':
      return true
    default:
      return false
  }
}

/** 审计一条用例，返回问题清单（空 = 通过）。 */
export function auditCase(raw, { file = 'fixture' } = {}) {
  const problems = []
  const stated = raw.nlStatedDims
  if (!Array.isArray(stated) || stated.length === 0) {
    return [`${file}: 缺少 nlStatedDims（CRUD 用例必须显式声明模型被告知的维度）`]
  }
  const seen = new Set()
  for (const t of stated) {
    if (typeof t !== 'string' || !t) {
      problems.push(`${file}: nlStatedDims 含非字符串项 ${JSON.stringify(t)}`)
      continue
    }
    if (seen.has(t)) problems.push(`${file}: nlStatedDims 重复项 ${t}`)
    seen.add(t)
  }
  const gold = goldOf(raw)
  const text = statedText(raw)
  for (const t of seen) {
    if (!isValidPinnedDim(t)) {
      problems.push(`${file}: 非法 token ${t}（不是可评分的维度/字段）`)
      continue
    }
    if (!dimApplicable(t, gold)) {
      problems.push(`${file}: ${t} 对 gold 不适用（gold 未用到该维度）`)
      continue
    }
    if (!HOST_GIVEN_DIMS.includes(t) && !tokenEvidence(t, { nl: text, gold })) {
      problems.push(`${file}: ${t} 在 NL/纠正轮里找不到措辞依据`)
    }
  }
  for (const p of (raw.pinnedDims ?? []).map(String)) {
    if (!seen.has(p)) problems.push(`${file}: pin ${p} 未列入 nlStatedDims（公平性不变量 pinnedDims ⊆ nlStatedDims）`)
  }
  return problems
}

// ── 自检夹具（失配即红）──────────────────────────────────────────────────────
let failures = 0
const fail = (msg) => {
  failures++
  console.error(`  ✗ ${msg}`)
}

{
  const FIELDS = [
    { prop: 'username', label: '用户名' },
    { prop: 'status', label: '状态', formtype: 'Select', dataOptions: [{ label: '启用', value: 1 }] },
    { prop: 'avatar', label: '头像' },
    { prop: 'createdAt', label: '创建时间', formtype: 'DatePicker' },
    { prop: 'remark', label: '备注', isHidden: { field: 'status', op: 'eq', value: 0 } },
  ]
  const GOLD = { fields: FIELDS, actions: ['add', 'edit'], target: 'vue3' }

  // 措辞表：认正例
  const YES = [
    ['查询条件有用户名、状态；表格展示用户名、头像。', 'inQuery:username'],
    ['查询条件有用户名、状态；表格展示用户名、头像。', 'inTable:avatar'],
    ['用户管理：查询条件有用户名；表格展示用户名、头像；支持新增、编辑、删除。', 'actions'],
    ['状态（启用/禁用）下拉选择。', 'dataOptions:status'],
    ['创建时间也要能当查询条件，按时间区间筛选，不只是在表格里看。', 'inQuery:createdAt'],
    ['表格支持行内编辑，单击单元格修改。', 'virtualScroll'],
    ['状态不是启用时隐藏备注。', 'isHidden:remark'],
    // P1-3 分组容器：页签/分步/折叠是 formLayout.layout 的措辞依据（与标签宽度同维）
    ['查询区用页签分成「基础条件」和「高级筛选」两组。', 'formLayout'],
  ]
  // 措辞表：否反例（认不出必须返回 false，不许「差不多就算」）
  const NO = [
    ['查询条件有用户名、状态；表格展示用户名、头像。', 'inQuery:avatar'], // 只在表格面
    ['查询条件有用户名、状态；表格展示用户名、头像。', 'inTable:remark'], // 哪一面都没提
    ['用户管理：查询条件有用户名；表格展示用户名、头像；支持新增、编辑、删除。', 'i18n'],
    ['「离职日期」这一列如果为空显示“在职”，否则显示日期。', 'formtype:createdAt'], // 展示句不是控件依据
    ['用户管理：查询条件有用户名；表格展示用户名、头像。', 'isHidden:remark'], // 没提显隐
  ]
  for (const [nl, token] of YES) {
    if (!tokenEvidence(token, { nl, gold: GOLD })) fail(`措辞表自检：应认作有依据却判否 →「${nl}」× ${token}`)
  }
  for (const [nl, token] of NO) {
    if (tokenEvidence(token, { nl, gold: GOLD })) fail(`措辞表自检：应判否却认作有依据 →「${nl}」× ${token}`)
  }

  // 单例审计：四类缺陷各一条
  const OK = {
    nl: '用户管理：查询条件有用户名、状态；表格展示用户名、头像；支持新增、编辑、删除。',
    pinnedDims: ['propSet', 'actions', 'inQuery:username'],
    nlStatedDims: ['propSet', 'actions', 'inQuery:username', 'inTable:avatar'],
    config: GOLD,
  }
  if (auditCase(OK).length) fail(`单例自检：合法用例被判红 → ${JSON.stringify(auditCase(OK))}`)

  const CASES = [
    ['漏标', { ...OK, nlStatedDims: undefined }, '缺少 nlStatedDims'],
    ['钉了没说过', { ...OK, pinnedDims: [...OK.pinnedDims, 'isHidden:remark'], nlStatedDims: [...OK.nlStatedDims, 'isHidden:remark'] }, '找不到措辞依据'],
    ['说了但 gold 用不到', { ...OK, nlStatedDims: [...OK.nlStatedDims, 'columns'] }, '不适用'],
    ['非法 token', { ...OK, nlStatedDims: [...OK.nlStatedDims, 'bogus'] }, '非法 token'],
    ['pin 未列入', { ...OK, pinnedDims: [...OK.pinnedDims, 'inQuery:status'] }, '未列入 nlStatedDims'],
  ]
  for (const [name, raw, want] of CASES) {
    const got = auditCase(raw).join(' | ')
    if (!got.includes(want)) fail(`单例自检「${name}」：期望含「${want}」，实得 ${got || '(空)'}`)
  }
}

// ── 扫语料 ────────────────────────────────────────────────────────────────
// 用例选择用**评测器自己的**选择器（`isCrudCase`）：重扫目录证明不了执行器会跑它
// （见 e2e filter 静默跳过的教训），两边一旦分叉就是「守卫绿的、评测没跑」。
const files = readdirSync(CASES_DIR).filter((f) => f.endsWith('.json')).sort()
const crud = []
for (const f of files) {
  const raw = JSON.parse(readFileSync(join(CASES_DIR, f), 'utf8'))
  if (!isCrudCase(raw)) continue
  crud.push([f, raw])
}

const problems = []
let scanned = 0
let refinementOnly = 0
let statedTotal = 0
for (const [f, raw] of crud) {
  scanned++
  if (!Array.isArray(raw.config?.fields)) {
    problems.push(`${f}: CRUD 用例缺少 config.fields，无法审计`)
    continue
  }
  statedTotal += Array.isArray(raw.nlStatedDims) ? raw.nlStatedDims.length : 0
  problems.push(...auditCase(raw, { file: f }))
  const text = statedText(raw)
  const nlOnly = nlOnlyText(raw)
  const gold = goldOf(raw)
  for (const t of raw.nlStatedDims ?? []) {
    if (tokenEvidence(t, { nl: text, gold }) && !tokenEvidence(t, { nl: nlOnly, gold })) refinementOnly++
  }
}

if (scanned < MIN_CRUD_CASES) fail(`扫描到的 CRUD 用例只有 ${scanned} 条（下限 ${MIN_CRUD_CASES}）——选择器疑似失效`)

if (problems.length) {
  for (const p of problems) console.error(`  ✗ ${p}`)
  fail(`${problems.length} 处公平性缺陷`)
}

if (failures) {
  console.error(`\ncheck:crud-fairness FAILED: ${failures} 处`)
  console.error(
    '  修法（按优先级）：① pin 在 NL/纠正轮里确有依据 → 补措辞表或补 NL；\n'
    + '  ② 确实没说过 → 从 pinnedDims 摘掉该 pin（gold 也随之无依据）；\n'
    + '  ③ 维度对 gold 不适用 → 说明 pin 本来就是空钉，直接摘掉。\n'
    + '  不要为了让守卫变绿而放宽措辞表——那等于把公平性下界变成自报。'
  )
  process.exit(1)
}
console.log(
  `[crud-fairness] 扫描 ${scanned} 条 CRUD 用例 / ${statedTotal} 个 nlStatedDims token；`
  + 'pinnedDims ⊆ nlStatedDims、token 适用、措辞可对 ✔'
  + `（其中 ${refinementOnly} 个 token 仅在纠正轮说到：收敛语料的铰链，属正常）`
)
