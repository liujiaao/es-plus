#!/usr/bin/env node
/**
 * 弹窗记分卡定义级自测（AN-16，无需 API key，进 CI 的 `check:dialog-scorers`）。
 *
 * 与 `fragment-scorers.test.mjs` 的分工：那份管**全部片段场景**的通用不变量
 * （gold-vs-gold、pin 收窄、每个维度可扰动）；本文件只盯 **dialog 合约**，
 * 因为弹窗的几条关键行为（POST/PUT/view 只读）**不是配置字段**，通用记分卡
 * 结构上无法覆盖，只能在这里把「派生规则 ↔ 生成器源码 ↔ 语料标注」钉在一起。
 *
 * 钉七件事：
 *   1) **语料覆盖**：每端 ≥6 例、两形态各至少 1 例、三端齐全（计划 AN-16 规模）。
 *   2) **标注健康**：`dialogGoldProblems()` 为空 —— 不出现无消费者的键（component+cacheKey、
 *      component+composableName、拼错的 options.*）。
 *   3) **gold-vs-gold 满分**：同一份配置对自己 full/scoped/stated 全绿（防假阴性）。
 *   4) **每个 dialog 专属维度都咬得住**：对 `apiUrl` / `noApiUrl` / `rowkey` / `mode` /
 *      `composableName` / `defaultTitle` / `dialogMaskNonClosing` / `options.*`
 *      逐个做外科手术式扰动，断言该维度与 `exactIntentFull` 同时翻红。
 *   5) **等价写法判等**：width 数字/px、rowkey 省略/id、`modal:false` vs
 *      `closeOnClickModal:false` —— 运行时已核实的等价落地不得判错。
 *   6) **派生规则与生成器源码一致**：`READ_ONLY_TITLE` / `NEW_TITLE` / 选项键全集
 *      必须仍出现在 `fragment-generator.ts` 里。改了源码忘了改这里 → 红。
 *   7) **三端语料同源**：同一编号的三端用例除 `target` 外逐字节相同（否则端间差异
 *      会被误当成模型能力差异）。
 */

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  DIALOG_OPTION_KEYS,
  DIALOG_BLOCK_MODES,
  READ_ONLY_TITLE,
  NEW_TITLE,
  dialogGoldProblems,
  dialogModeOf,
  dialogShapeForTitle,
  dialogSubmitContract,
  isValidDialogDim,
  scoreDialog,
} from './dialog-scorers.mjs'
import { sceneOf } from './scenes.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const CASES_DIR = join(ROOT, '__tests__', 'golden', 'cases')

let failures = 0
function check(cond, msg) {
  if (cond) return
  failures++
  console.error(`  ✗ ${msg}`)
}
const clone = (x) => JSON.parse(JSON.stringify(x))

// ── 读 dialog 语料 ────────────────────────────────────────────────────────────
const cases = []
for (const file of readdirSync(CASES_DIR).filter((f) => f.endsWith('.json')).sort()) {
  const raw = JSON.parse(readFileSync(join(CASES_DIR, file), 'utf8'))
  if (sceneOf(raw) !== 'dialog') continue
  cases.push({
    file,
    // 与 eval-llm / fragment meta-eval 同口径：片段用例的 target 在顶层，不在 config 内。
    gold: { ...raw.config, target: raw.target },
    pins: Array.isArray(raw.pinnedDims) ? raw.pinnedDims : [],
    stated: Array.isArray(raw.nlStatedDims) ? raw.nlStatedDims : [],
    nl: raw.nl,
    target: raw.target,
  })
}

// ── 1) 覆盖 ───────────────────────────────────────────────────────────────────
check(cases.length >= 18, `dialog 语料应 ≥18 例（每端 ≥6），实得 ${cases.length}`)
for (const target of ['vue3', 'vue2', 'antdv']) {
  const of = cases.filter((c) => c.target === target)
  check(of.length >= 6, `${target} 的 dialog 语料应 ≥6 例，实得 ${of.length}`)
  for (const mode of DIALOG_BLOCK_MODES) {
    check(
      of.some((c) => dialogModeOf(c.gold) === mode),
      `${target} 缺少 mode=${mode} 的 dialog 语料`
    )
  }
}

// ── 2) 标注健康 ───────────────────────────────────────────────────────────────
for (const c of cases) {
  for (const p of dialogGoldProblems(c.gold)) check(false, `${c.file}: ${p}`)
  check(typeof c.nl === 'string' && c.nl.trim() !== '', `${c.file}: 缺 nl`)
  for (const token of c.pins) {
    check(isValidDialogDim(c.gold, token), `${c.file}: pinnedDims 非法/未声明 —— ${token}`)
  }
  for (const token of c.stated) {
    check(isValidDialogDim(c.gold, token), `${c.file}: nlStatedDims 非法/未声明 —— ${token}`)
  }
  check(
    c.pins.every((t) => c.stated.includes(t)),
    `${c.file}: pinnedDims ⊄ nlStatedDims（scoped 会惩罚 NL 未声明的意图）`
  )
}

// ── 3) gold-vs-gold 满分 ─────────────────────────────────────────────────────
for (const c of cases) {
  const s = scoreDialog(c.gold, clone(c.gold), { pinnedDims: c.pins, statedDims: c.stated })
  check(s.exactIntentFull, `${c.file}: gold-vs-gold full 不绿`)
  check(s.exactIntentScoped, `${c.file}: gold-vs-gold scoped 不绿`)
  check(s.exactIntentStated, `${c.file}: gold-vs-gold stated 不绿`)
}

// ── 4) dialog 专属维度逐个咬 ──────────────────────────────────────────────────
function bump(v) {
  if (typeof v === 'boolean') return !v
  if (typeof v === 'number') return v + 1
  if (typeof v === 'string') return `${v}-x`
  return 'x'
}

/** 返回 false = 该 (case, dim) 没有扰动器（测试记为失败）。 */
function perturb(dim, pred) {
  if (dim === 'apiUrl') {
    pred.apiUrl = bump(pred.apiUrl)
    return true
  }
  if (dim === 'noApiUrl') {
    pred.apiUrl = '/api/__perturbed__'
    return true
  }
  if (dim === 'rowkey') {
    pred.rowkey = bump(pred.rowkey || 'id')
    return true
  }
  if (dim === 'mode') {
    pred.mode = dialogModeOf(pred) === 'composable' ? 'component' : 'composable'
    return true
  }
  if (dim === 'composableName') {
    pred.composableName = bump(pred.composableName || 'useFormDialog')
    return true
  }
  if (dim === 'defaultTitle') {
    pred.defaultTitle = bump(pred.defaultTitle || '')
    return true
  }
  if (dim === 'dialogMaskNonClosing') {
    if (pred.options?.modal === false) pred.options.modal = true
    else if (pred.options?.closeOnClickModal === false) pred.options.closeOnClickModal = true
    else {
      pred.options = { ...(pred.options ?? {}), modal: false }
      if (pred.options.closeOnClickModal === false) pred.options.closeOnClickModal = true
    }
    return true
  }
  if (dim.startsWith('options.')) {
    const key = dim.slice('options.'.length)
    pred.options = { ...(pred.options ?? {}), [key]: bump(pred.options?.[key]) }
    return true
  }
  return false
}

const DIALOG_SPECIFIC = (dim) =>
  ['apiUrl', 'noApiUrl', 'rowkey', 'mode', 'composableName', 'defaultTitle', 'dialogMaskNonClosing'].includes(dim) ||
  dim.startsWith('options.')

const seen = new Set()
for (const c of cases) {
  // 只扰**该 gold 真正启用**的维度 —— `fragmentScorableDims` 返回全部 spec（含
  // applicable:false 的键，如「没有 apiUrl 的用例仍有 noApiUrl 这个键名」）。
  // 扰一个不适用的维度必然「仍判过」，那不是睡着的维度，是测试自己找错了对象。
  const baseline = scoreDialog(c.gold, clone(c.gold), {}).byDim
  for (const [dim] of Object.entries(baseline)) {
    if (!baseline[dim].applicable) continue
    if (!DIALOG_SPECIFIC(dim)) continue
    seen.add(dim)
    const pred = clone(c.gold)
    if (!perturb(dim, pred)) {
      check(false, `${c.file}: dialog 维度 "${dim}" 没有扰动器（睡着的维度）`)
      continue
    }
    const s = scoreDialog(c.gold, pred, { pinnedDims: c.pins, statedDims: c.stated })
    check(s.byDim[dim]?.pass === false, `${c.file}: 扰动 "${dim}" 后该维度仍判过`)
    check(s.exactIntentFull === false, `${c.file}: 扰动 "${dim}" 后 exactIntentFull 仍为真`)
    if (c.pins.includes(dim)) check(s.exactIntentScoped === false, `${c.file}: 钉住的 "${dim}" 被扰动后 scoped 仍为真`)
    if (c.stated.includes(dim)) check(s.exactIntentStated === false, `${c.file}: 声明的 "${dim}" 被扰动后 stated 仍为真`)
  }
}

// 语料没触发的维度 = 补语料的信号（不致命，但要看得见 —— 与 fragment meta-eval 同口径）。
const expectedDims = [
  'apiUrl',
  'noApiUrl',
  'rowkey',
  'mode',
  'composableName',
  'defaultTitle',
  'dialogMaskNonClosing',
  // `modal` / `closeOnClickModal` 刻意不各自成维：它们是「点遮罩不关」这一**语义维**的
  // 两种等价落地，单列会一次意图数两遍（见 fragment-scorers 的 dialogMaskNonClosing）。
  ...DIALOG_OPTION_KEYS.filter((k) => k !== 'modal' && k !== 'closeOnClickModal').map((k) => `options.${k}`),
]
const untriggered = expectedDims.filter((d) => !seen.has(d))
if (untriggered.length) {
  console.log(`  ⚠ 语料未触发的 dialog 维度：${untriggered.join(', ')}（补语料信号，不判失败）`)
}

// ── 5) 等价写法判等 ──────────────────────────────────────────────────────────
{
  const base = cases.find((c) => c.gold.apiUrl && c.gold.options?.width !== undefined)
  check(!!base, '找不到可做等价归一化的 dialog 用例（需 apiUrl + options.width）')
  if (base) {
    const widthNumber = clone(base.gold)
    widthNumber.options.width = 480
    const widthPx = clone(base.gold)
    widthPx.options.width = '480px'
    check(
      scoreDialog(widthNumber, widthPx, { pinnedDims: ['options.width'] }).exactIntentScoped,
      "options.width 的 480 与 '480px' 应判等（运行时经 core toCssSize 归一）"
    )

    const noRowkey = clone(base.gold)
    delete noRowkey.rowkey
    const withId = clone(base.gold)
    withId.rowkey = 'id'
    check(
      scoreDialog(noRowkey, withId, { pinnedDims: ['rowkey'] }).exactIntentScoped,
      "rowkey 省略与显式 'id' 应判等（生成器 `rowkey || 'id'`）"
    )

    const byModal = clone(base.gold)
    byModal.options = { ...(byModal.options ?? {}), modal: false }
    delete byModal.options.closeOnClickModal
    const byClick = clone(base.gold)
    byClick.options = { ...(byClick.options ?? {}), closeOnClickModal: false }
    delete byClick.options.modal
    check(
      scoreDialog(byModal, byClick, { pinnedDims: ['dialogMaskNonClosing'] }).exactIntentScoped,
      '「点遮罩不关」的两种落地（modal:false / closeOnClickModal:false）应判等'
    )
  }
}

// ── 6) 派生规则与生成器源码一致 ──────────────────────────────────────────────
{
  const src = readFileSync(join(ROOT, 'packages', 'shared', 'src', 'fragment-generator.ts'), 'utf8')
  const readOnly = src.match(/title(?:\.value)? === '查看'/g) ?? []
  const newTitle = src.match(/title(?:\.value)? === '新增'/g) ?? []
  check(
    readOnly.length >= 2,
    `生成器应有两支（composable / component）的 title === '查看' 判断，实得 ${readOnly.length} 处 —— READ_ONLY_TITLE 已漂移`
  )
  check(
    newTitle.length >= 2,
    `生成器应有两支的 title === '新增' 判断，实得 ${newTitle.length} 处 —— NEW_TITLE 已漂移`
  )
  // 无 apiUrl 时不得出现「先发请求再判 view」的旁路：两支的提交分支都必须以 apiUrl 为闸门。
  for (const [name, re] of [
    ['composable', /if \(input\.apiUrl\) \{[\s\S]*?httpRequest\(\{ url, method, data: formData \}\)/],
    ['component', /if \(apiUrl\) \{[\s\S]*?httpRequest\(\{ url, method, data: formData \}\)/],
  ]) {
    check(re.test(src), `${name} 支的提交分支不再以 apiUrl 为闸门（callback-only 契约被破坏）`)
  }
}

// ── 6b) 选项键全集与源码接口一致 ─────────────────────────────────────────────
{
  const src = readFileSync(join(ROOT, 'packages', 'shared', 'src', 'fragment-generator.ts'), 'utf8')
  const body = src.match(/export interface DialogBlockOptions \{([\s\S]*?)\n\}/)
  check(!!body, 'fragment-generator.ts 里找不到 DialogBlockOptions 接口')
  if (body) {
    const keys = [...body[1].matchAll(/^\s{2}([A-Za-z_$][\w$]*)\??:/gm)].map((m) => m[1])
    check(
      JSON.stringify([...keys].sort()) === JSON.stringify([...DIALOG_OPTION_KEYS].sort()),
      `DIALOG_OPTION_KEYS 与 DialogBlockOptions 不一致：源码 ${keys.join(',')} vs 清单 ${DIALOG_OPTION_KEYS.join(',')}`
    )
  }
}

// ── 7) 三端语料同源 ──────────────────────────────────────────────────────────
{
  const groups = new Map()
  for (const c of cases) {
    // 文件名：frag-dialog-<编号>[-component]-<target>.json —— 去掉 target 后缀即同源组。
    const id = c.file.replace(/-vue3\.json$|-vue2\.json$|-antdv\.json$/, '')
    if (!groups.has(id)) groups.set(id, [])
    groups.get(id).push(c)
  }
  for (const [id, group] of groups) {
    if (group.length < 2) continue
    const bare = group.map((c) => {
      const g = clone(c.gold)
      delete g.target
      return JSON.stringify(g)
    })
    check(new Set(bare).size === 1, `${id}: 三端语料的配置不一致（只应差 target）`)
    check(new Set(group.map((c) => c.nl)).size === 1, `${id}: 三端语料的 nl 不一致`)
    check(new Set(group.map((c) => c.pins.join(','))).size === 1, `${id}: 三端语料的 pinnedDims 不一致`)
  }
}

// ── 8) 提交合约派生 ──────────────────────────────────────────────────────────
{
  const httpCase = cases.find((c) => c.gold.apiUrl)
  const cbCase = cases.find((c) => !c.gold.apiUrl)
  check(!!httpCase && !!cbCase, 'dialog 语料必须同时覆盖「有接口」与「只回调」两种情况')

  const http = dialogSubmitContract(httpCase.gold)
  check(http.kind === 'http', '有 apiUrl 时提交合约应为 http')
  check(http.methodNew === 'POST' && http.methodEdit === 'PUT', 'POST/PUT 方法映射错误')
  check(http.editUrlFor({ [http.rowkey]: 7 }) === `${http.url}/7`, '编辑 URL 应按 rowkey 拼接')

  const cb = dialogSubmitContract(cbCase.gold)
  check(cb.kind === 'callback' && cb.methodNew === null, '无 apiUrl 时提交合约应为 callback（不发请求）')

  check(dialogSubmitContract({}).rowkey === null, 'callback-only 不应有 rowkey')
  check(dialogSubmitContract({ apiUrl: '/x' }).rowkey === 'id', 'rowkey 缺省应为 id')
}

// ── 9) 标题 → 形态派生 ──────────────────────────────────────────────────────
{
  check(dialogShapeForTitle(READ_ONLY_TITLE) === 'read-only', '「查看」应为只读形态')
  check(dialogShapeForTitle(NEW_TITLE) === 'editable', '「新增」应为可编辑形态')
  check(dialogShapeForTitle('编辑') === 'editable', '其余标题一律可编辑')
  check(dialogShapeForTitle('查看详情') === 'editable', '只读判定是精确等值 —— 「查看详情」不等于「查看」')
}

if (failures) {
  console.error(`\n❌ check:dialog-scorers FAILED（${failures} 处）`)
  process.exit(1)
}
const byMode = DIALOG_BLOCK_MODES.map((m) => `${m}=${cases.filter((c) => dialogModeOf(c.gold) === m).length}`).join(' / ')
console.log(`✅ check:dialog-scorers：${cases.length} 例（${byMode}），dialog 合约维度全部咬得住。`)
