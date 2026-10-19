#!/usr/bin/env node
/**
 * 片段记分卡自测（meta-eval，无需 API key，进 CI 的 `check:fragment-scorers`）。
 *
 * 记分卡自己也会错。这里钉五件事：
 *   1) **语料标注合法**：18 条片段用例都必须带 `pinnedDims`，且每个 token 都是该
 *      `(scene, gold)` 下真实启用、gold 真声明了的维度。标错/标到不存在的键 → 红。
 *   2) **gold-vs-gold 满分**：同一份 config 对自己打分，所有 applicable 维度必须全过，
 *      `exactIntentFull` / `exactIntentScoped` 均为真（否则记分卡有假阴性）。
 *   3) **每个启用的维度都咬得住**：对每个维度做一处外科手术式改动，断言该维度翻红、
 *      `exactIntentFull` 翻红。没有扰动的维度 = 睡着的维度。
 *   4) **pinnedDims 真的在收窄**：每个 pinned token 被扰动后 `exactIntentScoped` 必须翻红；
 *      每个**未钉**的整维度被扰动后 scoped 必须**仍然为真**（钉太宽 = 欠定惩罚回来了）。
 *   5) **覆盖体检**：报告哪些维度从未被片段语料触发（补语料的信号，不致命）。
 */

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  scoreFragment,
  isValidFragmentPinnedDim,
  describeFragmentDimMiss,
  FRAGMENT_FORMTYPE_ALIASES,
} from './fragment-scorers.mjs'
import { sceneOf, isCrudCase } from './scenes.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CASES_DIR = join(__dirname, '..', '..', '__tests__', 'golden', 'cases')

let failures = 0
function check(cond, msg) {
  if (cond) return
  failures++
  console.error(`  ✗ ${msg}`)
}
const clone = (x) => JSON.parse(JSON.stringify(x))

// ── 读片段语料 ────────────────────────────────────────────────────────────────
const cases = []
for (const file of readdirSync(CASES_DIR).filter((f) => f.endsWith('.json')).sort()) {
  const raw = JSON.parse(readFileSync(join(CASES_DIR, file), 'utf8'))
  if (isCrudCase(raw)) continue
  // `target` 在片段用例里是**顶层**键（工具入参与 golden 的契约），不在 config 内；
  // 与 `fragmentInput()` 同口径合并，否则 target 维对 vue2/antdv 用例会静默按 vue3 判。
  cases.push({
    file,
    scene: sceneOf(raw),
    gold: { ...raw.config, target: raw.target },
    pins: raw.pinnedDims,
    nl: raw.nl,
    target: raw.target,
  })
}
check(cases.length === 18, `片段语料应为 18 条，实得 ${cases.length}`)

// ── 扰动原语 ──────────────────────────────────────────────────────────────────
const FORMTYPES = ['Input', 'Select', 'DatePicker', 'Switch', 'InputNumber', 'Radio', 'Checkbox']
function bump(v) {
  if (typeof v === 'boolean') return !v
  if (typeof v === 'number') return v + 1
  if (typeof v === 'string') return v + '-x'
  if (Array.isArray(v)) return v.length ? [v[0]] : ['x']
  if (v && typeof v === 'object') {
    const k = Object.keys(v)[0]
    return k === undefined ? { x: 1 } : { ...v, [k]: bump(v[k]) }
  }
  return 'x'
}
const TEXT_PRESENCE_KEYS = new Set(['emptyText', 'leftText'])

/**
 * 对某个**整维度**做一处扰动（就地修改 pred）。返回 false 表示该维度没有扰动器
 * （测试会把它记为失败——「没有扰动的维度 = 睡着的维度」）。
 */
function perturbWhole(scene, dim, gold, pred) {
  const cfg = pred
  const firstField = (predicate) => (cfg.fields ?? []).find(predicate)
  if (dim === 'propSet') return (cfg.fields.pop(), true)
  if (dim === 'formtype') {
    const f = firstField((x) => x.formtype)
    if (!f) return false
    f.formtype = FORMTYPES.find((t) => t !== f.formtype) ?? 'Select'
    return true
  }
  if (dim === 'fieldRequired') {
    const f = firstField((x) => x.required !== undefined)
    if (!f) return false
    f.required = !f.required
    return true
  }
  if (dim === 'dataOptions') {
    const f = firstField((x) => (x.dataOptions ?? []).length)
    if (!f) return false
    delete f.dataOptions
    return true
  }
  if (dim === 'fieldAttrs') {
    const f = firstField((x) => x.attrs?.type !== undefined)
    if (!f) return false
    f.attrs.type = f.attrs.type === 'textarea' ? 'password' : 'textarea'
    return true
  }
  if (dim === 'fieldLayout') {
    const f = firstField((x) => ['align', 'width', 'minWidth', 'fixed', 'ellipsis'].some((k) => x[k] !== undefined))
    if (!f) return false
    const k = ['align', 'width', 'minWidth', 'fixed', 'ellipsis'].find((x) => f[x] !== undefined)
    f[k] = bump(f[k])
    return true
  }
  if (dim === 'extPoints') {
    const f = firstField((x) => x.render || x.formatter)
    if (!f) return false
    delete f.render
    delete f.formatter
    return true
  }
  if (dim === 'target') {
    cfg.target = cfg.target === 'vue2' ? 'vue3' : 'vue2'
    return true
  }
  if (dim === 'apiUrl') {
    if (cfg.apiUrl === undefined) return false
    cfg.apiUrl = cfg.apiUrl + '-x'
    return true
  }
  if (dim === 'rowButtons') {
    const b = (cfg.rowButtons ?? [])[0]
    if (!b) return false
    // 只改 type/key：`rowButtonNames` 是独立维度，改名会同时打红它 → 无法证明 rowButtons 自己的咬合力
    if (b.type) b.type = b.type + '-x'
    else if (b.key) b.key = b.key + '-x'
    else b.type = 'primary'
    return true
  }
  if (dim === 'rowButtonNames') {
    const b = (cfg.rowButtons ?? [])[0]
    if (!b) return false
    b.name = b.name + 'X'
    return true
  }
  if (dim === 'context') {
    cfg.context = (cfg.context ?? 'form') === 'form' ? 'query' : 'form'
    return true
  }
  if (dim === 'buttons') {
    const cur = cfg.buttons ?? 'none'
    cfg.buttons = cur === 'submit' ? 'query' : 'submit'
    return true
  }
  if (dim === 'mode') {
    cfg.mode = (cfg.mode ?? 'composable') === 'composable' ? 'component' : 'composable'
    return true
  }
  if (dim === 'rowkey') {
    if (cfg.rowkey === undefined) return false
    cfg.rowkey = cfg.rowkey + '-x'
    return true
  }
  if (dim === 'composableName') {
    if (cfg.composableName === undefined) return false
    cfg.composableName = cfg.composableName + 'X'
    return true
  }
  if (dim === 'defaultTitle') {
    if (cfg.defaultTitle === undefined) return false
    cfg.defaultTitle = cfg.defaultTitle + 'X'
    return true
  }
  if (dim === 'dialogMaskNonClosing') {
    if (!cfg.options) cfg.options = {}
    cfg.options.modal = true
    delete cfg.options.closeOnClickModal
    return true
  }
  const dot = dim.indexOf('.')
  if (dot !== -1) {
    const scope = dim.slice(0, dot)
    const key = dim.slice(dot + 1)
    if (scope === 'tableOptions') {
      if (!cfg.tableOptions) cfg.tableOptions = {}
      if (TEXT_PRESENCE_KEYS.has(key)) delete cfg.tableOptions[key]
      else cfg.tableOptions[key] = bump(cfg.tableOptions[key])
      return true
    }
    if (scope === 'pagination') {
      if (!cfg.pagination) cfg.pagination = {}
      cfg.pagination[key] = bump(cfg.pagination[key])
      return true
    }
    if (scope === 'formLayout') {
      if (!cfg.formLayout) cfg.formLayout = {}
      cfg.formLayout[key] = bump(cfg.formLayout[key])
      return true
    }
    if (scope === 'options') {
      if (!cfg.options) cfg.options = {}
      cfg.options[key] = bump(cfg.options[key])
      return true
    }
  }
  return false
}

/** 对某个**字段级** pinned token（`dim:prop`）做一处扰动。 */
function perturbField(dim, prop, gold, pred) {
  const f = (pred.fields ?? []).find((x) => x.prop === prop)
  if (!f) return false
  if (dim === 'formtype') {
    f.formtype = FORMTYPES.find((t) => t !== f.formtype) ?? 'Select'
    return true
  }
  if (dim === 'fieldRequired') {
    f.required = !f.required
    return true
  }
  if (dim === 'dataOptions') {
    if ((f.dataOptions ?? []).length) delete f.dataOptions
    else f.dataOptions = [{ label: 'x', value: 'x' }]
    return true
  }
  if (dim === 'fieldAttrs') {
    if (!f.attrs) f.attrs = {}
    f.attrs.type = f.attrs.type === 'textarea' ? 'password' : 'textarea'
    return true
  }
  if (dim === 'fieldLayout') {
    const k = ['align', 'width', 'minWidth', 'fixed', 'ellipsis'].find((x) => f[x] !== undefined) ?? 'align'
    f[k] = bump(f[k] ?? 'left')
    return true
  }
  if (dim === 'extPoints') {
    delete f.render
    delete f.formatter
    return true
  }
  return false
}

function perturbToken(scene, token, gold, pred) {
  const i = token.indexOf(':')
  if (i === -1) return perturbWhole(scene, token, gold, pred)
  return perturbField(token.slice(0, i), token.slice(i + 1), gold, pred)
}

// ── 1) 语料标注 ───────────────────────────────────────────────────────────────
console.log('meta-eval: fragment pinnedDims are legal')
for (const c of cases) {
  check(typeof c.nl === 'string' && c.nl.trim() !== '', `${c.file}: 缺 nl —— eval 无从驱动模型`)
  check(['vue3', 'vue2', 'antdv'].includes(c.target), `${c.file}: target 缺失或未知（${c.target}）`)
  check(Array.isArray(c.pins) && c.pins.length > 0, `${c.file}: 缺 pinnedDims（scoped 会退化为 core）`)
  if (!Array.isArray(c.pins)) continue
  for (const token of c.pins) {
    check(
      isValidFragmentPinnedDim(c.scene, c.gold, token),
      `${c.file}: pinnedDims token "${token}" 在该 (scene, gold) 下不合法/未启用`
    )
  }
}

// ── 2) gold-vs-gold ──────────────────────────────────────────────────────────
console.log('meta-eval: fragment gold-vs-gold')
for (const c of cases) {
  const s = scoreFragment(c.scene, c.gold, clone(c.gold), { pinnedDims: c.pins })
  for (const [dim, v] of Object.entries(s.byDim)) {
    if (v.applicable) check(v.pass === true, `${c.file}: gold-vs-gold 维度 ${dim} 应 pass 却为 ${v.pass}`)
  }
  check(s.exactIntentFull === true, `${c.file}: gold-vs-gold exactIntentFull 应为 true`)
  check(s.exactIntentScoped === true, `${c.file}: gold-vs-gold exactIntentScoped 应为 true`)
  check(s.exactIntentCore === true, `${c.file}: gold-vs-gold exactIntentCore 应为 true`)
}

// ── 3) 每个启用的维度都咬得住；4) 未钉的维度不参与 scoped ─────────────────────
console.log('meta-eval: fragment perturbations bite / pinnedDims really scope')
const exercised = new Set()
for (const c of cases) {
  const specs = scoreFragment(c.scene, c.gold, clone(c.gold), { pinnedDims: c.pins }).byDim
  const pinnedWhole = new Set(c.pins.filter((t) => !t.includes(':')))
  // 字段级 pin 也算「该维度已被锁定」——扰动首字段会撞上它，不能用来证明「未钉不罚」。
  const hasFieldPin = (dim) => c.pins.some((t) => t.startsWith(`${dim}:`))
  // 语义重叠：`options.modal` 的两种正确落地都被 `dialogMaskNonClosing` 覆盖，扰动 modal 必然撞上它。
  const overlappedByPin = (dim) =>
    (dim === 'options.modal' || dim === 'options.closeOnClickModal') && c.pins.includes('dialogMaskNonClosing')
  for (const dim of Object.keys(specs)) {
    if (!specs[dim].applicable) continue // N/A 维度没有可扰动的值，不参与咬合验证
    exercised.add(dim)
    const pred = clone(c.gold)
    const ok = perturbWhole(c.scene, dim, c.gold, pred)
    check(ok, `${c.file}: 维度 ${dim} 没有扰动器（睡着的维度）`)
    if (!ok) continue
    const s = scoreFragment(c.scene, c.gold, pred, { pinnedDims: c.pins })
    check(s.byDim[dim].pass === false, `${c.file}: 扰动 ${dim} 后该维度仍判 pass（咬不住）`)
    check(s.exactIntentFull === false, `${c.file}: 扰动 ${dim} 后 exactIntentFull 仍为 true`)
    if (!pinnedWhole.has(dim) && !hasFieldPin(dim) && !overlappedByPin(dim)) {
      check(
        s.exactIntentScoped === true,
        `${c.file}: 未钉的维度 ${dim} 被扰动后 scoped 仍应 true（否则 pins 钉得太宽/漏了作用域）`
      )
    }
  }
  // 每个 pinned **字段级** token 必须真的咬住 scoped
  for (const token of c.pins) {
    if (!token.includes(':')) {
      // 整维度：上面已按 dim 循环验过；再单独验一次 scoped（防止某个整维度被其它 pin 掩盖）
      const pred = clone(c.gold)
      if (!perturbWhole(c.scene, token, c.gold, pred)) continue
      check(
        scoreFragment(c.scene, c.gold, pred, { pinnedDims: c.pins }).exactIntentScoped === false,
        `${c.file}: 扰动 pinned 维度 ${token} 后 scoped 仍为 true`
      )
      continue
    }
    const pred = clone(c.gold)
    check(perturbToken(c.scene, token, c.gold, pred), `${c.file}: 字段级 pin ${token} 没有扰动器`)
    check(
      scoreFragment(c.scene, c.gold, pred, { pinnedDims: c.pins }).exactIntentScoped === false,
      `${c.file}: 扰动字段级 pin ${token} 后 scoped 仍为 true`
    )
  }
}

// 未被任何用例触发的维度 = heldout rate 恒 n/a（补语料信号，不致命）
const ALL_KNOWN = new Set([
  'propSet', 'formtype', 'fieldRequired', 'dataOptions', 'fieldAttrs', 'fieldLayout', 'extPoints', 'target',
  'apiUrl', 'rowButtons', 'rowButtonNames', 'pagination.pageSize', 'pagination.pageSizes',
  'context', 'buttons', 'formLayout.labelWidth', 'formLayout.minFoldRows',
  'rowkey', 'mode', 'composableName', 'defaultTitle', 'dialogMaskNonClosing',
])
const never = [...ALL_KNOWN].filter((d) => !exercised.has(d))
if (never.length) console.log(`  note: 以下维度未被任何片段语料触发（补语料信号）：${never.join(', ')}`)

// ── 诊断描述器 ───────────────────────────────────────────────────────────────
console.log('meta-eval: describeFragmentDimMiss')
{
  const d = describeFragmentDimMiss('tableOptions.height', { tableOptions: { height: 420 } }, { tableOptions: {} })
  check(d && d.want === '420' && d.got === '(未设置)', 'describeFragmentDimMiss: tableOptions.height 诊断不符')
  check(describeFragmentDimMiss('propSet', {}, {}) === null, 'describeFragmentDimMiss: 非 dyn 维度应返回 null')
}

// ── 5) scoped 收窄的正面用例：漏钉的维度不罚 ─────────────────────────────────
console.log('meta-eval: unpinned field-level dims are exempt')
{
  const gold = clone(cases.find((c) => c.file.startsWith('frag-table-01-vue3')).gold)
  const pins = cases.find((c) => c.file.startsWith('frag-table-01-vue3')).pins
  const pred = clone(gold)
  // extPoints:amount 未钉；删掉 formatter 后 scoped 仍应 true（full 应 false）
  delete pred.fields.find((f) => f.prop === 'amount').formatter
  const s = scoreFragment('table', gold, pred, { pinnedDims: pins })
  check(s.byDim.extPoints.pass === false, 'unpinned: extPoints 扰动应翻红（full）')
  check(s.exactIntentFull === false, 'unpinned: extPoints 扰动后 full 应 false')
  check(s.exactIntentScoped === true, 'unpinned: extPoints 未被钉，scoped 不应罚')

  // 未钉的 tableOptions.border 同理
  const pred2 = clone(gold)
  pred2.tableOptions.border = false
  check(scoreFragment('table', gold, pred2, { pinnedDims: pins }).exactIntentScoped === true,
    'unpinned: tableOptions.border 未钉，scoped 不应罚')
}

// ── 语义维：两种「点遮罩不关」的正确落地都必须判对，且不得被重复计数 ─────────
console.log('meta-eval: dialogMaskNonClosing accepts equivalent implementations')
{
  const c = cases.find((x) => x.file.startsWith('frag-dialog-02-component-vue3'))
  const alt = clone(c.gold)
  delete alt.options.modal
  alt.options.closeOnClickModal = false
  const s = scoreFragment('dialog', c.gold, alt, { pinnedDims: c.pins })
  check(s.byDim.dialogMaskNonClosing.pass === true, 'dialogMaskNonClosing: closeOnClickModal:false 应判对')
  check(s.exactIntentFull === true, '等价落地（closeOnClickModal:false）不应在 full 口径被判红（options.modal 已并入语义维）')
  check(s.exactIntentScoped === true, '等价落地应通过 scoped')

  const wrong = clone(c.gold)
  wrong.options.modal = true
  const sw = scoreFragment('dialog', c.gold, wrong, { pinnedDims: c.pins })
  check(sw.byDim.dialogMaskNonClosing.pass === false, '把遮罩改成可点击关闭应判错')
  check(sw.exactIntentScoped === false, '把遮罩改成可点击关闭应打红 scoped')
}

// ── formtype 别名：归一化映射不得与权威源码漂移 ─────────────────────────────
// `datePicker`/`timePicker` 在运行时与规范写法等价（core `normalizeFormType`）。记分卡
// 若按字面比较，模型写别名（**合法**）会被判错 —— 正是 inQuery 默认陷阱的同构。
console.log('meta-eval: formtype alias normalization')
{
  const src = readFileSync(join(__dirname, '..', '..', 'packages', 'shared', 'src', 'contract.ts'), 'utf8')
  const block = src.match(/export const FORM_TYPE_ALIASES[^{]*\{([\s\S]*?)\}/)
  check(!!block, '未能在 shared/src/contract.ts 定位 FORM_TYPE_ALIASES')
  const auth = {}
  for (const line of (block?.[1] ?? '').split('\n')) {
    const kv = line.match(/^\s*([A-Za-z_$][\w$]*)\s*:\s*'([^']+)'/)
    if (kv) auth[kv[1]] = kv[2]
  }
  check(
    JSON.stringify(auth) === JSON.stringify(FRAGMENT_FORMTYPE_ALIASES),
    `formtype 别名映射与 contract.ts 漂移：权威 ${JSON.stringify(auth)} vs 本地 ${JSON.stringify(FRAGMENT_FORMTYPE_ALIASES)}`
  )
  // 行为断言：gold 规范写法 vs pred 别名必须判等
  const gold = { fields: [{ prop: 'd', label: '日期', formtype: 'DatePicker' }] }
  const pred = { fields: [{ prop: 'd', label: '日期', formtype: 'datePicker' }] }
  const s = scoreFragment('form', gold, pred, { pinnedDims: ['formtype:d'] })
  check(s.exactIntentScoped === true, 'formtype 别名（datePicker）应判等 —— 否则模型做对了却被罚')
  check(s.exactIntentFull === true, 'formtype 别名应在 full 口径也判等')
}

// ── 收尾 ─────────────────────────────────────────────────────────────────────
if (failures) {
  console.error(`\nfragment-scorers meta-eval FAILED — ${failures} 处`)
  process.exit(1)
}
console.log(`\nfragment-scorers meta-eval OK — ${cases.length} 条片段用例，${exercised.size} 个维度被扰动验证`)
