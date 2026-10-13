#!/usr/bin/env node
/**
 * 记分卡自测（meta-eval，无需 API key，进 CI 的 check:consistency）。
 *
 * 记分卡自己也会错。这里钉两件事：
 *   1) gold-vs-gold：同一份 config 对自己打分，所有 applicable 维度必须全过、
 *      exactIntentCore / exactIntentFull 均为真——否则记分卡有假阴性，会把对的判错。
 *   2) 定向扰动「咬得住」：对每个维度做一处外科手术式改动，断言**该维度**翻红
 *      （且 exactIntentFull 随之翻红）——否则这个维度是睡着的，回归漏网。
 *
 * 另外对 25 个 golden case 做一次覆盖体检：报告哪些维度从未被语料触发（applicable=0），
 * 这类维度的 heldout rate 会恒为 n/a，是补语料的信号（不致命，仅提示）。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { StructuredCrudConfigSchema } from '@es-plus/shared'
import { CAPABILITY_SCORERS, scoreAll, isValidPinnedDim, parsePinnedDim, firstConvergedTurn, summarizeConvergence, meets95Definition, summarize95 } from './scorers.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CASES_DIR = join(__dirname, '..', '..', '__tests__', 'golden', 'cases')

let failures = 0
function check(cond, msg) {
  if (cond) return
  failures++
  console.error(`  ✗ ${msg}`)
}
const clone = (x) => JSON.parse(JSON.stringify(x))

// ── 覆盖全部维度的合成 base（仅需过 schema；scoreAll 不调用 generateFromConfig）──
const BASE_INPUT = {
  name: 'MetaEval',
  apiUrl: '/api/meta',
  target: 'vue2', //            → target 维度 applicable（非默认 vue3）
  mode: 'sfc', //              → mode 维度 applicable
  i18n: true, //               → i18n 维度 applicable
  typescript: true,
  tableOptions: { virtual: true }, // → virtualScroll 维度 applicable
  formLayout: { span: 12 }, //  → formLayout 维度 applicable
  permissions: { add: 'meta:write', edit: 'meta:write' }, // → permissions 维度
  fields: [
    { prop: 'name', label: '名称', formtype: 'Input' },
    { prop: 'status', label: '状态', formtype: 'Select', dataOptions: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] }, // → dataOptions 维度
    { prop: 'categoryId', label: '分类', formtype: 'Select', apiParams: { url: '/api/cat', labelField: 'name', valueField: 'id' } }, // → apiParams 维度
    { prop: 'amount', label: '金额', formtype: 'Input', inQuery: false, formatter: '(row) => row.amount.toFixed(2)' }, // → extPoints 维度
    { prop: 'createdAt', label: '创建时间', formtype: 'DatePicker', inForm: false },
  ],
  actions: ['add', 'edit', 'delete', 'view'],
  tableBtns: [
    { name: '批量导出', position: 'left', actionType: 'export' },
    { name: '新增', type: 'primary', position: 'right', actionType: 'add' },
  ], // → tableBtns 维度
  operationColumn: { label: '操作', btns: [{ name: '编辑', dialogKey: 'edit' }] }, // → operationColumn 维度
  dialogs: {
    add: { title: '新增', formItems: [{ prop: 'name', label: '名称', formtype: 'Input' }] },
    edit: { title: '编辑', formItems: [{ prop: 'name', label: '名称', formtype: 'Input' }, { prop: 'amount', label: '金额', formtype: 'Input' }] },
  }, // → dialogs 维度
}

const base = StructuredCrudConfigSchema.parse(BASE_INPUT)

// 1) gold-vs-gold：全维度满分
console.log('meta-eval: gold-vs-gold')
{
  const s = scoreAll(base, base)
  for (const { key } of CAPABILITY_SCORERS) {
    const c = s.byCapability[key]
    if (c.applicable) check(c.pass === true, `gold-vs-gold: 维度 ${key} 应 pass 却为 ${c.pass}`)
  }
  check(s.exactIntentCore === true, 'gold-vs-gold: exactIntentCore 应为 true')
  check(s.exactIntentFull === true, 'gold-vs-gold: exactIntentFull 应为 true')
  // base 必须真的触发了每个维度，否则下面的扰动测不到
  for (const { key } of CAPABILITY_SCORERS) {
    check(s.byCapability[key].applicable === true, `base 未触发维度 ${key}（扰动测试会落空）`)
  }
}

// 2) 定向扰动：每个维度一处改动，断言该维度翻红
console.log('meta-eval: perturbations bite')
const PERTURB = {
  propSet: (c) => { c.fields.pop() },
  formtype: (c) => { c.fields[0].formtype = 'Select' },
  membership: (c) => { c.fields[0].inQuery = !c.fields[0].inQuery },
  actions: (c) => { c.actions.pop() },
  tableBtns: (c) => { c.tableBtns[0].code = c.tableBtns[0].code === 1 ? 2 : 1 },
  dialogs: (c) => { delete c.dialogs.edit },
  operationColumn: (c) => { c.operationColumn = false },
  permissions: (c) => { c.permissions.add = 'meta:other' },
  apiParams: (c) => { c.fields[2].apiParams.url = '/api/other' },
  dataOptions: (c) => { delete c.fields[1].dataOptions },
  i18n: (c) => { c.i18n = false },
  formLayout: (c) => { c.formLayout.span = 24 },
  target: (c) => { c.target = 'vue3' },
  mode: (c) => { c.mode = 'schema' },
  virtualScroll: (c) => { c.tableOptions.virtual = false },
  extPoints: (c) => { delete c.fields[3].formatter },
}

for (const { key } of CAPABILITY_SCORERS) {
  const mutate = PERTURB[key]
  check(typeof mutate === 'function', `维度 ${key} 没有对应的扰动用例`)
  if (typeof mutate !== 'function') continue
  const pred = clone(base)
  mutate(pred)
  const s = scoreAll(base, pred)
  check(s.byCapability[key].pass === false, `扰动 ${key} 后该维度仍判 pass（咬不住）`)
  check(s.exactIntentFull === false, `扰动 ${key} 后 exactIntentFull 仍为 true`)
}

// 2b) operationColumn 库默认派生等价（锁定本次 scorer 修复）
//     组件 es-crud-page 在省略 operationColumn 时按 actions 自动派生行按钮（view→查看/edit→编辑/
//     delete→删除），故「显式 btns=[编辑,删除]」与「省略 operationColumn + actions 含 edit/delete」
//     渲染同一组行按钮，判定必须相等——否则会把正确的极简配置误罚为 miss（库默认→scorer，非 overfit）。
console.log('meta-eval: operationColumn 库默认派生等价')
{
  const flds = [{ prop: 'name', label: '名称', formtype: 'Input', inQuery: true, inTable: true, inForm: true }]
  const gold = { fields: flds, actions: ['add', 'edit', 'delete'], operationColumn: { label: '操作', btns: [{ name: '编辑' }, { name: '删除' }] } }
  // 模型省略 operationColumn，但 actions 含 edit/delete → 组件派生 [编辑,删除] == gold.btns
  check(scoreAll(gold, { fields: flds, actions: ['add', 'edit', 'delete'] }).byCapability.operationColumn.pass === true,
    'operationColumn: 省略但 actions 派生出同一行按钮集 → 应判等')
  // 守恒：actions 缺 delete → 派生只有 [编辑] ≠ gold[编辑,删除] → 仍判负（真漏不放过）
  check(scoreAll(gold, { fields: flds, actions: ['add', 'edit'] }).byCapability.operationColumn.pass === false,
    'operationColumn: 省略且 actions 派生不出 gold 行按钮（缺 delete）→ 应判负')
  // view→查看 也在派生表内：显式 [查看,编辑,删除] == 省略 + actions 含 view/edit/delete
  const goldV = { fields: flds, actions: ['add', 'view', 'edit', 'delete'], operationColumn: { btns: [{ name: '查看' }, { name: '编辑' }, { name: '删除' }] } }
  check(scoreAll(goldV, { fields: flds, actions: ['add', 'view', 'edit', 'delete'] }).byCapability.operationColumn.pass === true,
    'operationColumn: view→查看 也在派生表内 → 判等')
  // 自定义行按钮（如处理/关闭）不在 actions 派生范围 → 模型省略仍判负
  const goldCustom = { fields: flds, actions: ['edit'], operationColumn: { btns: [{ name: '处理' }, { name: '关闭' }] } }
  check(scoreAll(goldCustom, { fields: flds, actions: ['edit'] }).byCapability.operationColumn.pass === false,
    'operationColumn: 自定义行按钮(处理/关闭)不可由 actions 派生 → 省略应判负')
}

// 3) scoped 口径（B2）：掩码自洽 + 掩码内咬得住 + 掩码外免责 + 空掩码退化
console.log('meta-eval: scoped metric (pinnedDims)')
{
  // mask 钉：字段集 + 仅金额列 formtype + actions。NL「没锁」status/createdAt 的 formtype。
  const mask = { pinnedDims: ['propSet', 'formtype:amount', 'actions'] }

  // 自洽：gold-vs-gold 下 scoped 必真
  check(scoreAll(base, base, mask).exactIntentScoped === true, 'scoped: gold-vs-gold 应为 true')

  // 掩码内扰动咬得住：金额列 formtype 变 → scoped 掉
  {
    const pred = clone(base)
    pred.fields[3].formtype = 'DatePicker' // fields[3] = amount
    check(scoreAll(base, pred, mask).exactIntentScoped === false, 'scoped: 扰动金额列 formtype（掩码内）应翻红')
  }
  // 掩码内扰动咬得住：actions 变 → scoped 掉
  {
    const pred = clone(base)
    pred.actions.pop()
    check(scoreAll(base, pred, mask).exactIntentScoped === false, 'scoped: 扰动 actions（掩码内）应翻红')
  }
  // 掩码外免责（本 PR 的核心价值）：status 列 formtype 猜错 → scoped **不**掉
  {
    const pred = clone(base)
    pred.fields[1].formtype = 'Input' // fields[1] = status（Select→Input），NL 没锁它
    const s = scoreAll(base, pred, mask)
    check(s.exactIntentScoped === true, 'scoped: 扰动掩码外字段 formtype 应免责（仍 true）')
    check(s.exactIntentCore === false, 'scoped: 该扰动应让 core 翻红（证明 scoped 比 core 宽在正确的地方）')
  }

  // 空掩码退化为 core（向后兼容）：无 mask 与 mask 为空数组都应 ≡ exactIntentCore
  {
    const pred = clone(base)
    pred.fields[1].formtype = 'Input'
    const noMask = scoreAll(base, pred)
    const emptyMask = scoreAll(base, pred, { pinnedDims: [] })
    check(noMask.exactIntentScoped === noMask.exactIntentCore, 'scoped: 无掩码应 ≡ core')
    check(emptyMask.exactIntentScoped === emptyMask.exactIntentCore, 'scoped: 空掩码数组应 ≡ core')
  }

  // token 合法性校验器（防标注漂移，供 check:cases 用）
  check(isValidPinnedDim('propSet') === true, 'isValidPinnedDim: 整维度 propSet 合法')
  check(isValidPinnedDim('formtype:amount') === true, 'isValidPinnedDim: 字段级 formtype:amount 合法')
  check(isValidPinnedDim('bogus') === false, 'isValidPinnedDim: 未知维度 bogus 非法')
  check(isValidPinnedDim('target:amount') === false, 'isValidPinnedDim: target 不可字段细化')
  check(isValidPinnedDim('formtype:') === false, 'isValidPinnedDim: 空字段名非法')

  // membership 的三个分量（inQuery/inTable/inForm）：只锁其一时互不牵连
  check(isValidPinnedDim('inQuery:amount') === true, 'isValidPinnedDim: inQuery:amount 合法')
  check(isValidPinnedDim('inQuery') === false, 'isValidPinnedDim: 裸 inQuery（非字段级）非法')
  {
    const m = { pinnedDims: ['inQuery:amount'] } // base.amount.inQuery=false
    check(scoreAll(base, base, m).exactIntentScoped === true, 'scoped: inQuery:amount gold-vs-gold 应 true')
    const bitPred = clone(base)
    bitPred.fields[3].inQuery = true // 翻转 amount.inQuery（锁定分量）→ 掉
    check(scoreAll(base, bitPred, m).exactIntentScoped === false, 'scoped: 翻转 inQuery:amount 应翻红')
    const sibPred = clone(base)
    sibPred.fields[3].inTable = false // 翻转 inTable（未锁分量）→ 不掉
    check(scoreAll(base, sibPred, m).exactIntentScoped === true, 'scoped: 翻转同字段 inTable（未锁分量）应免责')
  }
}

// 4) 语料覆盖体检（提示，不致命）+ 规格掩码标注合法性（致命，防漂移）
console.log('meta-eval: golden-corpus capability coverage + mask legality')
{
  const files = readdirSync(CASES_DIR).filter((f) => f.endsWith('.json')).sort()
  const applicableCount = Object.fromEntries(CAPABILITY_SCORERS.map((s) => [s.key, 0]))
  for (const f of files) {
    const raw = JSON.parse(readFileSync(join(CASES_DIR, f), 'utf8'))
    const g = StructuredCrudConfigSchema.parse(raw.config)
    for (const s of CAPABILITY_SCORERS) if (s.applicable(g)) applicableCount[s.key]++

    // 掩码标注合法性（B2）：token 必须可记分；`维度:字段` 与 fixedFields 引用的 prop 必须真实存在。
    // 这把「NL 到底锁了什么」的标注钉死在 config 的真实字段上，杜绝 formtype:amuont 这类笔误静默免责。
    const props = new Set(g.fields.map((fd) => fd.prop))
    for (const token of raw.pinnedDims ?? []) {
      check(isValidPinnedDim(token), `${f}: pinnedDims token "${token}" 非法（维度名不可记分或字段级左半不可细化）`)
      const { field } = parsePinnedDim(token)
      if (field !== undefined) check(props.has(field), `${f}: pinnedDims "${token}" 引用的字段 "${field}" 不在 config.fields 中`)
    }
    for (const prop of raw.fixedFields ?? []) {
      check(props.has(prop), `${f}: fixedFields 的 "${prop}" 不在 config.fields 中（喂给模型的字段必须真实存在）`)
    }
  }
  const uncovered = Object.entries(applicableCount).filter(([, n]) => n === 0).map(([k]) => k)
  for (const { key } of CAPABILITY_SCORERS) {
    console.log(`    ${key.padEnd(16)} ${applicableCount[key]} case(s)`)
  }
  if (uncovered.length) {
    console.warn(`  ⚠ 未被 golden 语料触发的维度（heldout rate 恒为 n/a，考虑补语料）：${uncovered.join(', ')}`)
  }
}

// 5) B3 收敛判定（firstConvergedTurn / summarizeConvergence）：纯函数、无 API key
console.log('meta-eval: convergence (firstConvergedTurn / summarizeConvergence)')
{
  // firstConvergedTurn：首个 scoped 命中的 0-based 轮次；初稿即过 = 0；全程不过 = null
  check(firstConvergedTurn([{ exactIntentScoped: true }]) === 0, 'firstConvergedTurn: 初稿即收敛应为 0')
  check(
    firstConvergedTurn([{ exactIntentScoped: false }, { exactIntentScoped: false }, { exactIntentScoped: true }]) === 2,
    'firstConvergedTurn: 第 2 轮纠正后收敛应为 2'
  )
  check(
    firstConvergedTurn([{ exactIntentScoped: false }, { exactIntentScoped: false }]) === null,
    'firstConvergedTurn: 全程未收敛应为 null'
  )
  check(firstConvergedTurn([]) === null, 'firstConvergedTurn: 空序列应为 null')
  // 容忍布尔数组形态
  check(firstConvergedTurn([false, true]) === 1, 'firstConvergedTurn: 布尔数组形态可用')

  // summarizeConvergence：rateAtK / meanTurnsToConverge / converged / total
  const rows = [
    { firstTurn: 0 }, // zero-edit
    { firstTurn: 2 }, // 2 轮收敛
    { firstTurn: null }, // 未收敛
    { firstTurn: 4 }, // 4 轮才收敛（> K=3）
  ]
  const sum = summarizeConvergence(rows, 3)
  check(sum.total === 4, 'summarizeConvergence: total=4')
  check(sum.converged === 3, 'summarizeConvergence: converged=3（null 不计）')
  check(Math.abs(sum.rateAtK - 2 / 4) < 1e-9, 'summarizeConvergence: ≤3 轮内收敛 2/4') // turn 0 与 2，4 超 K、null 不算
  check(Math.abs(sum.meanTurnsToConverge - (0 + 2 + 4) / 3) < 1e-9, 'summarizeConvergence: 均值仅计已收敛 (0+2+4)/3')
  const empty = summarizeConvergence([], 3)
  check(empty.rateAtK === null && empty.meanTurnsToConverge === null && empty.total === 0, 'summarizeConvergence: 空语料回 null')
}

// 6) 「95% 定义」统一判定（meets95Definition / summarize95）：scoped zero-edit ∨ ≤K 轮收敛
console.log('meta-eval: 95% definition (meets95Definition / summarize95)')
{
  const K = 3
  // 无收敛语料的行 → 只看第一条腿 exactIntentScoped
  check(meets95Definition({ exactIntentScoped: true }, K) === true, 'meets95: 无收敛语料、scoped 命中 → 过')
  check(meets95Definition({ exactIntentScoped: false }, K) === false, 'meets95: 无收敛语料、scoped 未命中 → 不过')
  // 有收敛语料的行 → 看 firstTurn ≤ K（firstTurn=0 即 zero-edit，天然涵盖第一条腿）
  check(meets95Definition({ convergence: { firstTurn: 0 } }, K) === true, 'meets95: zero-edit 收敛(firstTurn=0) → 过')
  check(meets95Definition({ convergence: { firstTurn: 3 } }, K) === true, 'meets95: 第 3 轮收敛(=K) → 过')
  check(meets95Definition({ convergence: { firstTurn: 4 } }, K) === false, 'meets95: 第 4 轮收敛(>K) → 不过')
  check(meets95Definition({ convergence: { firstTurn: null } }, K) === false, 'meets95: 未收敛(null) → 不过')
  // convergence 优先于 exactIntentScoped：第二条腿恢复的行即便 turn-0 scoped=false 也算过
  check(
    meets95Definition({ exactIntentScoped: false, convergence: { firstTurn: 1 } }, K) === true,
    'meets95: 第 1 轮恢复（turn-0 scoped=false）→ 过（第二条腿接住）'
  )

  // summarize95：pass / total / rate
  const rows = [
    { exactIntentScoped: true }, // 第一条腿过
    { exactIntentScoped: false }, // 两条腿都没过
    { exactIntentScoped: false, convergence: { firstTurn: 1 } }, // 第二条腿接住
    { convergence: { firstTurn: null } }, // 有语料但未收敛
  ]
  const s95 = summarize95(rows, K)
  check(s95.total === 4, 'summarize95: total=4')
  check(s95.pass === 2, 'summarize95: pass=2（第一条腿 1 + 第二条腿 1）')
  check(Math.abs(s95.rate - 2 / 4) < 1e-9, 'summarize95: rate=2/4')
  const empty95 = summarize95([], K)
  check(empty95.rate === null && empty95.pass === 0 && empty95.total === 0, 'summarize95: 空集回 null')
}

if (failures) {
  console.error(`\nmeta-eval FAILED: ${failures} 处断言未过`)
  process.exit(1)
}
console.log('\nmeta-eval OK — 记分卡 gold-vs-gold 满分、每个维度扰动均咬得住。✔')
