#!/usr/bin/env node
/**
 * AN-19 — offline guards for the PRD extraction leg.
 *
 * Two layers:
 *   1. **Scorer boundaries** on synthetic surfaces (presence, membership,
 *      dialogs, measurement discipline). These run without a key.
 *   2. **Corpus fairness** on the real `__tests__/golden/prd/` set: ≥20 cases,
 *      unique ids, every gold label actually present in the spec (otherwise the
 *      model is asked to guess a label it was never given), route coverage
 *      (table-bearing AND no-table), and a self-score of every gold case.
 *
 * The real front door / compile evidence lives in `check:prd`
 * (`scripts/check-prd.mjs`), because that needs the esbuild-captured handler.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  SURFACE_KEYS,
  PRD_MIN_CASES,
  normalizeLabel,
  labelOf,
  surfaceSets,
  presentSurfaces,
  scorePrdSurfaces,
  summarizePrd,
  loadPrdCases,
} from './prd-leg.mjs'
import { buildPrdSystemPrompt, buildPrdInitialMessages } from './prd-prompt.mjs'
import { deriveSurfaces } from '../lib/front-door.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const PRD_DIR = join(ROOT, '__tests__', 'golden', 'prd')

let failures = 0
function check(cond, msg) {
  if (cond) return
  failures++
  console.error(`  ✗ ${msg}`)
}
function eq(actual, expected, msg) {
  check(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${msg} — want ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
  )
}

const surf = (query = [], table = [], form = [], dialog = []) => ({ query, table, form, dialog });
const f = (label, prop = label) => ({ prop, label, formtype: 'Input' });

// ─── normalization ──────────────────────────────────────────────────────────
{
  eq(normalizeLabel('  IP  地址 '), 'ip地址', '标签归一：去空白 + ASCII 小写')
  eq(labelOf({ prop: 'x' }), 'x', 'label 缺失时退回 prop')
  eq(labelOf({ label: '用户名', prop: 'userName' }), '用户名', 'label 优先于 prop')
  const sets = surfaceSets(surf([f('用户名')], [], [], ['add', { key: 'BlackList' }]))
  eq([...sets.query], ['用户名'], 'query 集合')
  check(sets.table === undefined, '空 table 面不得存在（presence 看非空而非键存在）')
  eq([...sets.dialog].sort(), ['add', 'blacklist'], 'dialog 字符串/对象统一取 key 并归一化')
  eq(presentSurfaces(surf([f('a')], [], [], ['add'])), ['query', 'dialog'], 'presence 只列非空面')
}

// ─── scoring boundaries ─────────────────────────────────────────────────────
{
  const gold = surf([f('用户名'), f('状态')], [f('用户名'), f('创建时间')], [f('用户名'), f('状态')], ['add', 'edit'])
  const perfect = scorePrdSurfaces(gold, gold)
  check(perfect.exact, '完全相同 → exact')
  check(perfect.membership.total === 6, `membership 分母应为 6 个面-字段决策，实际 ${perfect.membership.total}`)
  eq(perfect.membership.rate, 1, 'membership 满分')

  // 多一个字段 = 该面多一条 want-out 决策
  const extra = surf([f('用户名'), f('状态'), f('手机号')], [f('用户名'), f('创建时间')], [f('用户名'), f('状态')], ['add', 'edit'])
  const sExtra = scorePrdSurfaces(extra, gold)
  check(!sExtra.exact && !sExtra.membership.ok, '多出字段必须判错')
  check(sExtra.membership.correct === 6 && sExtra.membership.total === 7, '多出字段只增加 1 个决策')

  // 少一个面 = presence 红
  const missingForm = surf([f('用户名'), f('状态')], [f('用户名'), f('创建时间')], [], ['add', 'edit'])
  const sMissing = scorePrdSurfaces(missingForm, gold)
  check(!sMissing.exact && !sMissing.presence.ok, '丢失 form 面必须 presence 红')
  eq(sMissing.presence.want, ['query', 'table', 'form', 'dialog'], 'presence want 全列')
  eq(sMissing.presence.got, ['query', 'table', 'dialog'], 'presence got 缺 form')

  // 放错面：同一个字段从 table 挪到 form → 两个面各错一次
  const swapped = surf([f('用户名'), f('状态')], [f('用户名'), f('创建时间'), f('状态')], [f('用户名')], ['add', 'edit'])
  const sSwap = scorePrdSurfaces(swapped, gold)
  check(!sSwap.exact, '放错面不得 exact')
  check(
    sSwap.membership.misses.some((m) => m.startsWith('table:状态:want-out:got-in')) &&
      sSwap.membership.misses.some((m) => m.startsWith('form:状态:want-in:got-out')),
    `放错面必须在两个面各记一次，实际 ${JSON.stringify(sSwap.membership.misses)}`
  )

  // 弹窗键
  const wrongDialog = surf([f('用户名'), f('状态')], [f('用户名'), f('创建时间')], [f('用户名'), f('状态')], ['add'])
  const sDialog = scorePrdSurfaces(wrongDialog, gold)
  check(!sDialog.dialogs.ok && !sDialog.exact, '少一个弹窗键必须判错')

  // 归一化：空白/大小写不影响
  const spaced = surf(
    [f('用 户 名'), f('状 态')],
    [f('用 户 名'), f('创 建 时 间')],
    [f('用 户 名'), f('状 态')],
    ['ADD', 'Edit']
  )
  check(scorePrdSurfaces(spaced, gold).exact, '空白与大小写差异不得误判')

  // 空预测：所有 gold 面都缺失，membership 每个 union 元素各错一次
  const empty = scorePrdSurfaces({}, gold)
  check(!empty.exact && !empty.presence.ok && !empty.dialogs.ok, '空预测全红')
  check(empty.membership.correct === 0 && empty.membership.total === 6, '空预测 membership 全错')

  // 只有弹窗的用例：没有面-字段决策时 membership 应真空通过
  const dialogOnlyGold = surf([], [], [], [{ key: 'feedback', title: '意见反馈' }])
  const dialogOnlyPred = surf([], [], [], [{ key: 'feedback', title: '意见反馈' }])
  const sDialogOnly = scorePrdSurfaces(dialogOnlyPred, dialogOnlyGold)
  check(sDialogOnly.exact, '没有字段决策时 membership 应真空通过（否则 dialog-only 永远不可能 exact）')
  check(sDialogOnly.membership.rate === null, '无决策时 rate 应为 null 而不是 0 或 1')
}

// ─── summarize discipline ───────────────────────────────────────────────────
{
  const perfect = scorePrdSurfaces(surf([f('a')], [f('a')]), surf([f('a')], [f('a')]))
  const wrong = scorePrdSurfaces({}, surf([f('a')], [f('a')]))
  const rows = [
    { file: 'a', error: null, compiles: true, score: perfect },
    { file: 'b', error: null, compiles: true, score: wrong },
    // 模型答错：在成绩里（记 0），不进编译分母
    { file: 'c', error: 'bad json', errorKind: 'model-failure', compiles: false, score: null },
    // 没测到：排除在成绩与编译分母外，但计数
    { file: 'd', error: 'empty turn', errorKind: 'no-answer', compiles: false, score: null },
  ]
  const s = summarizePrd(rows)
  eq(s.cases, 4, 'cases')
  eq(s.measured, 3, 'measured 含 model-failure、不含 no-answer')
  eq(s.notMeasured, 1, 'notMeasured 只数 no-answer/truncated')
  eq(s.exactRate, Number((1 / 3).toFixed(4)), 'exactRate 分母含 model-failure（答错是成绩）')
  eq(s.membershipTotal, 4, 'membership 微平均只聚合有 score 的行（2 行 × 2 决策）')
  eq(s.membershipRate, 0.5, 'membership 微平均 = 2/4')
  eq(s.compileMeasured, 2, '编译分母 = 有产物的行（模型答错、没测到都不进）')
  eq(s.compileRate, 1, '两行产物都编译过')
  eq(s.compileFailure, 0, '编译失败数')

  const noProducts = summarizePrd([rows[3]])
  eq(noProducts.measured, 0, '全未测到 → measured 0')
  eq(noProducts.compileMeasured, 0, '全未测到 → 编译分母 0')
  eq(noProducts.compileRate, null, '零分母时 compileRate 为 null，不是 1（否则红盲）')
}

// ─── real corpus fairness ───────────────────────────────────────────────────
{
  const { cases, errors } = loadPrdCases(PRD_DIR)
  check(errors.length === 0, `语料解析失败：\n      ${errors.join('\n      ')}`)
  check(cases.length >= PRD_MIN_CASES, `PRD 语料至少 ${PRD_MIN_CASES} 条，实际 ${cases.length}`)

  const ids = new Set()
  const seenSurfaces = new Set()
  let tableBearing = 0
  let noTable = 0
  let customDialogs = 0
  let readOnly = 0

  for (const c of cases) {
    check(!ids.has(c.id), `重复 id：${c.id}`)
    ids.add(c.id)
    check(c.file.replace(/\.json$/, '') === c.id, `${c.file}: 文件名必须等于 id（便于报告逐条对齐）`)

    const gold = deriveSurfaces(c.raw.config, (x) => x)
    const present = presentSurfaces(gold)
    check(present.length > 0, `${c.id}: gold 没有任何面`)
    present.forEach((k) => seenSurfaces.add(k))
    if (present.includes('table')) tableBearing++
    else noTable++
    if (Object.keys(c.raw.config.dialogs ?? {}).some((k) => !['add', 'edit', 'view'].includes(k))) {
      customDialogs++
    }
    if (!present.includes('form') && !present.includes('dialog')) readOnly++

    // 自评：gold 对 gold 必须 exact（否则 scorer 与语料不自洽）
    check(scorePrdSurfaces(gold, gold).exact, `${c.id}: gold 自评不 exact`)

    // 公平性：每个 gold 标签都必须真的出现在 spec 文本里
    const missing = []
    for (const key of ['query', 'table', 'form']) {
      for (const field of gold[key] ?? []) {
        const label = field.label ?? field.prop
        if (!c.spec.includes(label)) missing.push(`${key}:${label}`)
      }
    }
    for (const d of gold.dialog ?? []) {
      if (typeof d !== 'string' && d.formItems) {
        for (const field of d.formItems) {
          const label = field.label ?? field.prop
          if (!c.spec.includes(label)) missing.push(`dialog:${label}`)
        }
      }
    }
    check(missing.length === 0, `${c.id}: spec 未出现 gold 标签 ${missing.join(', ')}（模型无从得知）`)

    // 形状：每个字段必须有 label（评分身份）与 formtype
    const everyField = [
      ...(gold.query ?? []),
      ...(gold.table ?? []),
      ...(gold.form ?? []),
      ...(gold.dialog ?? []).flatMap((d) => (typeof d === 'string' ? [] : d.formItems ?? [])),
    ]
    const bad = everyField.filter((x) => !x.label || !x.formtype)
    check(bad.length === 0, `${c.id}: 字段缺 label/formtype — ${JSON.stringify(bad.slice(0, 3))}`)
  }

  check(cases.length >= 15 && tableBearing >= 15, `有表用例应 ≥15，实际 ${tableBearing}`)
  check(noTable >= 3, `无表（片段路由）用例应 ≥3，实际 ${noTable}`)
  check(customDialogs >= 3, `自定义弹窗用例应 ≥3，实际 ${customDialogs}`)
  check(readOnly >= 3, `只读（无 form/dialog）用例应 ≥3，实际 ${readOnly}`)
  eq([...seenSurfaces].sort(), [...SURFACE_KEYS].sort(), '四个面都必须被语料覆盖')

  console.log(
    `[prd] 语料 ${cases.length} 条：有表 ${tableBearing} / 无表 ${noTable} / 自定义弹窗 ${customDialogs} / 只读 ${readOnly}`
  )
}

// ─── prompt assembly ────────────────────────────────────────────────────────
{
  const zodString = { _def: { typeName: 'ZodString' } }
  const fieldObj = { _def: { typeName: 'ZodObject', shape: { prop: zodString } } }
  const queryArr = { _def: { typeName: 'ZodArray', type: fieldObj } }
  const surfacesObj = { _def: { typeName: 'ZodObject', shape: { query: queryArr } } }
  const tool = {
    name: 'generate_crud',
    description: 'FRONT DOOR — fill surfaces.',
    shape: { name: zodString, surfaces: surfacesObj },
  }
  const prompt = buildPrdSystemPrompt(tool, 'CONTRACT-MARKER: read esplus://design-extraction')
  check(prompt.includes('CONTRACT-MARKER'), 'system prompt 必须注入资源正文（与发布契约同源）')
  check(prompt.includes('Tool: generate_crud'), 'system prompt 必须包含真实工具名')
  check(prompt.includes('FRONT DOOR'), 'system prompt 必须包含真实工具描述')
  check(prompt.includes('surfaces.query'), 'shape 自省必须展开 surfaces 键')
  check(prompt.includes('NEVER emit `inQuery`'), 'system prompt 必须重申禁止 membership 旗标')
  const messages = buildPrdInitialMessages('用户管理 PRD', {
    name: 'UserManage',
    apiUrl: '/api/users',
    target: 'vue2',
    mode: 'sfc',
  })
  const text = messages[0].content
  check(text.includes('用户管理 PRD'), '初始消息必须包含 spec 原文')
  for (const line of ['name=UserManage', 'apiUrl=/api/users', 'target=vue2', 'mode=sfc']) {
    check(text.includes(line), `初始消息必须带 host-given ${line}`)
  }
}

if (failures) {
  console.error(`\nprd-leg FAILED: ${failures} 处断言未过`)
  process.exit(1)
}
console.log('\nprd-leg OK — 评分边界、测量纪律、语料公平性与 prompt 同源均成立。✔')
