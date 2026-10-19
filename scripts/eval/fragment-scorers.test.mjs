#!/usr/bin/env node
/**
 * 片段记分卡自测（meta-eval，无需 API key，进 CI 的 `check:fragment-scorers`）。
 *
 * 记分卡自己也会错。这里钉五件事：
 *   1) **语料标注合法**：每条片段用例（2026-10-19 起 63 条，每场景 ≥20）都必须带
 *      `pinnedDims`、`nlStatedDims`、`fixedFields`，
 *      且每个 token 都是该 `(scene, gold)` 下真实启用、gold 真声明了的维度。标错/标到不存在的键 → 红。
 *      `pinnedDims ⊆ nlStatedDims`（scoped 不得惩罚 NL 未声明的意图）；`fixedFields` 必须与
 *      gold 的 prop 集完全一致（与 188 条 CRUD 同规矩：prop 由宿主给定，语义由模型推断）。
 *   2) **gold-vs-gold 满分**：同一份 config 对自己打分，所有 applicable 维度必须全过，
 *      `exactIntentFull` / `exactIntentScoped` / `exactIntentStated` 均为真（否则记分卡有假阴性）。
 *   3) **每个启用的维度都咬得住**：对每个维度做一处外科手术式改动，断言该维度翻红、
 *      `exactIntentFull` 翻红。没有扰动的维度 = 睡着的维度。
 *   4) **pinnedDims / nlStatedDims 真的在收窄**：pinned token 被扰动后 scoped 必须翻红，
 *      未钉的整维度被扰动后 scoped 仍为真；stated token 被扰动后 stated 必须翻红，
 *      未声明的整维度被扰动后 stated 仍为真。
 *   5) **等价实现归一化**：运行时已核实的等价写法（rowkey 缺省、labelWidth 数字/px、
 *      height↔tabHeight（含「maxHeight 下 height 是死键」）、virtual/engine、width 数字/px）
 *      必须判等；错值仍要红。
 *   6) **覆盖体检**：报告哪些维度从未被片段语料触发（补语料的信号，不致命）。
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
    stated: raw.nlStatedDims,
    fixedFields: raw.fixedFields,
    nl: raw.nl,
    target: raw.target,
  })
}
check(cases.length >= 60, `片段语料应 ≥60 条（每场景 ≥20），实得 ${cases.length}`)

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
    // 与维度适用条件对齐（AI-51）：整维度覆盖「声明了任意 attrs 键」的字段，
    // 扰 `placeholder`/`maxlength` 同样须咬住 —— 不止 `attrs.type`。
    const f = firstField((x) => x.attrs && Object.keys(x.attrs).length > 0)
    if (!f) return false
    const k = Object.keys(f.attrs)[0]
    f.attrs[k] = bump(f.attrs[k])
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
    const f = firstField((x) => x.render !== undefined || x.formatter !== undefined || x.permissionValue !== undefined)
    if (!f) return false
    delete f.render
    delete f.formatter
    delete f.permissionValue
    return true
  }
  if (dim === 'isHidden') {
    const f = firstField((x) => x.isHidden !== undefined)
    if (!f) return false
    f.isHidden = bump(f.isHidden)
    return true
  }
  if (dim === 'reactions') {
    const f = firstField((x) => Array.isArray(x.reactions))
    if (!f) return false
    // 追加一条空规则：单条数组经 bump 会原样保留（[v[0]]），无法证明咬合力。
    f.reactions = [...f.reactions, { dependencies: ['__probe'], fulfill: {} }]
    return true
  }
  if (dim === 'fieldSpan') {
    const f = firstField((x) => x.querySpan !== undefined || x.formSpan !== undefined)
    if (!f) return false
    const k = f.querySpan !== undefined ? 'querySpan' : 'formSpan'
    f[k] = bump(f[k])
    return true
  }
  if (dim === 'fieldRules') {
    const f = firstField((x) => (x.rules ?? []).some((r) => r.type || r.pattern || r.min !== undefined || r.max !== undefined || r.trigger))
    if (!f) return false
    const r = f.rules.find((x) => x.type || x.pattern || x.min !== undefined || x.max !== undefined || x.trigger)
    if (r.type !== undefined) r.type = r.type === 'email' ? 'url' : 'email'
    else if (r.pattern !== undefined) r.pattern = r.pattern + '-x'
    else if (r.min !== undefined) r.min = r.min + 1
    else r.max = r.max + 1
    return true
  }
  if (dim === 'apiParams') {
    const f = firstField((x) => x.apiParams !== undefined)
    if (!f) return false
    f.apiParams.url = f.apiParams.url + '-x'
    return true
  }
  if (dim === 'labelKey') {
    const f = firstField((x) => x.labelKey !== undefined)
    if (!f) return false
    f.labelKey = f.labelKey + '.x'
    return true
  }
  if (dim === 'i18n') {
    cfg.i18n = !(cfg.i18n ?? false)
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
  if (dim === 'noApiUrl') {
    cfg.apiUrl = '/api/__probe'
    return true
  }
  if (dim === 'rowButtons') {
    const b = (cfg.rowButtons ?? [])[0]
    if (!b) return false
    // 只改 type：`rowButtonNames` 是独立维度，改名会同时打红它 → 无法证明 rowButtons 自己的咬合力。
    // `key` 不再计分（它在 Zod/类型里可选、NL 从不提）——扰动它咬不住，改用 type。
    b.type = b.type ? b.type + '-x' : 'primary'
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
  if (dim === 'tableVirtualMode') {
    if (!cfg.tableOptions) cfg.tableOptions = {}
    const on = cfg.tableOptions.virtual === true || cfg.tableOptions.engine === 'virtual'
    cfg.tableOptions.virtual = !on
    if (on) delete cfg.tableOptions.engine
    else cfg.tableOptions.engine = 'virtual'
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
    const keys = Object.keys(f.attrs)
    if (!keys.length) {
      f.attrs = { type: 'textarea' }
      return true
    }
    const k = keys[0]
    f.attrs[k] = bump(f.attrs[k])
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
    delete f.permissionValue
    return true
  }
  if (dim === 'isHidden') {
    f.isHidden = bump(f.isHidden)
    return true
  }
  if (dim === 'reactions') {
    f.reactions = [...(f.reactions ?? []), { dependencies: ['__probe'], fulfill: {} }]
    return true
  }
  if (dim === 'fieldSpan') {
    const k = f.querySpan !== undefined ? 'querySpan' : 'formSpan'
    f[k] = bump(f[k])
    return true
  }
  if (dim === 'fieldRules') {
    const r = (f.rules ?? []).find((x) => x.type || x.pattern || x.min !== undefined || x.max !== undefined || x.trigger)
    if (!r) return false
    if (r.type !== undefined) r.type = r.type === 'email' ? 'url' : 'email'
    else if (r.pattern !== undefined) r.pattern = r.pattern + '-x'
    else if (r.min !== undefined) r.min = r.min + 1
    else r.max = r.max + 1
    return true
  }
  if (dim === 'apiParams') {
    if (!f.apiParams) return false
    f.apiParams.url = f.apiParams.url + '-x'
    return true
  }
  if (dim === 'labelKey') {
    f.labelKey = f.labelKey + '.x'
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
  // ── 公平口径的语料自证（AI-46）──
  // `nlStatedDims` = NL/宿主**确实说了**的维度。每个 token 必须合法，
  // 且 pinnedDims 必须是它的子集 —— 否则 scoped 会惩罚「从未要求」的东西。
  check(Array.isArray(c.stated) && c.stated.length > 0, `${c.file}: 缺 nlStatedDims（公平口径无从计算）`)
  if (Array.isArray(c.stated)) {
    for (const token of c.stated) {
      check(
        isValidFragmentPinnedDim(c.scene, c.gold, token),
        `${c.file}: nlStatedDims token "${token}" 在该 (scene, gold) 下不合法/未启用`
      )
    }
    if (Array.isArray(c.pins)) {
      for (const token of c.pins) {
        check(
          c.stated.includes(token),
          `${c.file}: pinnedDims token "${token}" 不在 nlStatedDims 里 —— scoped 会惩罚 NL 未声明的意图`
        )
      }
    }
  }
  // 固定字段必须与 gold 的 prop 集**完全一致**：少了 = 让模型猜，多了 = 给了不存在的字段。
  check(Array.isArray(c.fixedFields) && c.fixedFields.length > 0, `${c.file}: 缺 fixedFields`)
  if (Array.isArray(c.fixedFields)) {
    const goldProps = (c.gold.fields ?? []).map((f) => f.prop).sort()
    check(
      JSON.stringify([...c.fixedFields].sort()) === JSON.stringify(goldProps),
      `${c.file}: fixedFields (${c.fixedFields.join(',')}) 与 gold prop 集 (${goldProps.join(',')}) 不一致`
    )
    check(new Set(c.fixedFields).size === c.fixedFields.length, `${c.file}: fixedFields 有重复 prop`)
  }
}

// ── 2) gold-vs-gold ──────────────────────────────────────────────────────────
console.log('meta-eval: fragment gold-vs-gold')
for (const c of cases) {
  const s = scoreFragment(c.scene, c.gold, clone(c.gold), { pinnedDims: c.pins, statedDims: c.stated })
  for (const [dim, v] of Object.entries(s.byDim)) {
    if (v.applicable) check(v.pass === true, `${c.file}: gold-vs-gold 维度 ${dim} 应 pass 却为 ${v.pass}`)
  }
  check(s.exactIntentFull === true, `${c.file}: gold-vs-gold exactIntentFull 应为 true`)
  check(s.exactIntentScoped === true, `${c.file}: gold-vs-gold exactIntentScoped 应为 true`)
  check(s.exactIntentStated === true, `${c.file}: gold-vs-gold exactIntentStated 应为 true`)
  check(s.exactIntentCore === true, `${c.file}: gold-vs-gold exactIntentCore 应为 true`)
}

// ── 3) 每个启用的维度都咬得住；4) 未钉的维度不参与 scoped ─────────────────────
console.log('meta-eval: fragment perturbations bite / pinnedDims really scope')
const exercised = new Set()
for (const c of cases) {
  const specs = scoreFragment(c.scene, c.gold, clone(c.gold), { pinnedDims: c.pins, statedDims: c.stated }).byDim
  const pinnedWhole = new Set(c.pins.filter((t) => !t.includes(':')))
  // 字段级 pin 也算「该维度已被锁定」——扰动首字段会撞上它，不能用来证明「未钉不罚」。
  const hasFieldPin = (dim) => c.pins.some((t) => t.startsWith(`${dim}:`))
  const statedWhole = new Set(c.stated.filter((t) => !t.includes(':')))
  const hasStatedField = (dim) => c.stated.some((t) => t.startsWith(`${dim}:`))
  // 语义重叠：`options.modal` 的两种正确落地都被 `dialogMaskNonClosing` 覆盖，扰动 modal 必然撞上它；
  // `rowButtonNames` 是 `rowButtons`（name|type）的严格子集，钉了后者就必然钉住前者。
  const overlappedByPin = (dim) =>
    ((dim === 'options.modal' || dim === 'options.closeOnClickModal') && c.pins.includes('dialogMaskNonClosing')) ||
    (dim === 'rowButtonNames' && c.pins.includes('rowButtons'))
  for (const dim of Object.keys(specs)) {
    if (!specs[dim].applicable) continue // N/A 维度没有可扰动的值，不参与咬合验证
    exercised.add(dim)
    const pred = clone(c.gold)
    const ok = perturbWhole(c.scene, dim, c.gold, pred)
    check(ok, `${c.file}: 维度 ${dim} 没有扰动器（睡着的维度）`)
    if (!ok) continue
    const s = scoreFragment(c.scene, c.gold, pred, { pinnedDims: c.pins, statedDims: c.stated })
    check(s.byDim[dim].pass === false, `${c.file}: 扰动 ${dim} 后该维度仍判 pass（咬不住）`)
    check(s.exactIntentFull === false, `${c.file}: 扰动 ${dim} 后 exactIntentFull 仍为 true`)
    if (!pinnedWhole.has(dim) && !hasFieldPin(dim) && !overlappedByPin(dim)) {
      check(
        s.exactIntentScoped === true,
        `${c.file}: 未钉的维度 ${dim} 被扰动后 scoped 仍应 true（否则 pins 钉得太宽/漏了作用域）`
      )
    }
    // ── stated 口径的收窄证明（AI-46）──
    if (statedWhole.has(dim)) {
      check(s.exactIntentStated === false, `${c.file}: 声明的维度 ${dim} 被扰动后 stated 仍应为 false`)
    } else if (!hasStatedField(dim)) {
      check(
        s.exactIntentStated === true,
        `${c.file}: 未声明的维度 ${dim} 被扰动后 stated 仍应 true（否则 NL 没说的也在罚）`
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
  // 每个 stated token 必须真的咬住 stated（否则声明了却不计分 = 度量漏项）
  for (const token of c.stated) {
    const pred = clone(c.gold)
    if (!perturbToken(c.scene, token, c.gold, pred)) continue
    check(
      scoreFragment(c.scene, c.gold, pred, { pinnedDims: c.pins, statedDims: c.stated })
        .exactIntentStated === false,
      `${c.file}: 扰动声明维度 ${token} 后 stated 仍为 true`
    )
  }
}

// 未被任何用例触发的维度 = heldout rate 恒 n/a（补语料信号，不致命）
const ALL_KNOWN = new Set([
  'propSet', 'formtype', 'fieldRequired', 'dataOptions', 'fieldAttrs', 'fieldLayout', 'extPoints', 'target',
  'isHidden', 'reactions', 'fieldSpan', 'fieldRules', 'apiParams', 'labelKey', 'i18n',
  'apiUrl', 'noApiUrl', 'rowButtons', 'rowButtonNames', 'pagination.pageSize', 'pagination.pageSizes',
  'context', 'buttons', 'formLayout.labelWidth', 'formLayout.minFoldRows', 'tableVirtualMode',
  'rowkey', 'mode', 'composableName', 'defaultTitle', 'dialogMaskNonClosing',
])
const never = [...ALL_KNOWN].filter((d) => !exercised.has(d))
if (never.length) console.log(`  note: 以下维度未被任何片段语料触发（补语料信号）：${never.join(', ')}`)

// ── 诊断描述器 ───────────────────────────────────────────────────────────────
console.log('meta-eval: describeFragmentDimMiss')
{
  // height 诊断走「有效高度」：height 只在 heightType='height' 时生效（maxHeight/auto 下是死键）。
  const d = describeFragmentDimMiss(
    'tableOptions.height',
    { tableOptions: { heightType: 'height', height: 420 } },
    { tableOptions: {} }
  )
  check(d && d.want === '"420px"' && d.got === '(未设置)', 'describeFragmentDimMiss: tableOptions.height 诊断不符')
  const dead = describeFragmentDimMiss(
    'tableOptions.height',
    { tableOptions: { heightType: 'maxHeight', height: 420 } },
    { tableOptions: { heightType: 'maxHeight', height: 420 } }
  )
  check(dead && dead.want === '(未设置)', 'describeFragmentDimMiss: 死键 height 不应显示为有效高度')
  check(describeFragmentDimMiss('propSet', {}, {}) === null, 'describeFragmentDimMiss: 非 dyn 维度应返回 null')
}

// ── 5) scoped 收窄的正面用例：漏钉的维度不罚 ─────────────────────────────────
console.log('meta-eval: unpinned field-level dims are exempt')
{
  // table-02 的 fieldLayout / tableOptions.border 都只进 stated（nl 明说、但刻意不 pin）；
  // 扰动后 full 应红、scoped 不应罚 —— 这正是「pinnedDims 真的收窄」的正面用例。
  const gold = clone(cases.find((c) => c.file.startsWith('frag-table-02-vue3')).gold)
  const pins = cases.find((c) => c.file.startsWith('frag-table-02-vue3')).pins
  const pred = clone(gold)
  delete pred.fields.find((f) => f.prop === 'orderNo').width
  const s = scoreFragment('table', gold, pred, { pinnedDims: pins })
  check(s.byDim.fieldLayout.pass === false, 'unpinned: fieldLayout 扰动应翻红（full）')
  check(s.exactIntentFull === false, 'unpinned: fieldLayout 扰动后 full 应 false')
  check(s.exactIntentScoped === true, 'unpinned: fieldLayout 未被钉，scoped 不应罚')

  // 未钉的 tableOptions.border 同理
  const pred2 = clone(gold)
  pred2.tableOptions.border = false
  check(scoreFragment('table', gold, pred2, { pinnedDims: pins }).exactIntentScoped === true,
    'unpinned: tableOptions.border 未钉，scoped 不应罚')
}

// ── 表格场景不启用表单专属字段维（AI-51：产物里的零消费者键）──────────────────
console.log('meta-eval: table scene ignores form-only field dims')
{
  const c = cases.find((x) => x.file.startsWith('frag-table-05-vue3'))
  const gold = clone(c.gold)
  // 扰动 formtype / dataOptions：独立表格产物（buildTableColumnSFC）不读这两个键，生成的
  // SFC 逐字节相同，故 full 也**不应**翻红，维度应当是 N/A。
  const pred = clone(gold)
  for (const f of pred.fields) f.formtype = f.formtype === 'Input' ? 'InputNumber' : 'Input'
  pred.fields[0].dataOptions = [{ label: 'x', value: 'x' }]
  const s = scoreFragment('table', gold, pred, {})
  check(s.byDim.formtype.applicable === false, 'table: formtype 在独立表格场景应为 N/A')
  check(s.byDim.dataOptions.applicable === false, 'table: dataOptions 在独立表格场景应为 N/A')
  check(s.exactIntentFull === true, 'table: 扰动零消费者键不应让 full 翻红')
  // pin 不能绕过场景口径：字段级 token 也必须是该场景启用的维度。
  check(isValidFragmentPinnedDim('table', gold, 'formtype:id') === false,
    'table: formtype:id 不应是合法 pin（整维在该场景不适用）')
  // 表单场景照常启用（对照，防止把 gating 写过头）。
  const fc = cases.find((x) => x.file.startsWith('frag-form-04-vue3'))
  check(scoreFragment('form', fc.gold, fc.gold, {}).byDim.formtype.applicable === true,
    'form: formtype 仍应适用（控制组）')
  check(isValidFragmentPinnedDim('form', fc.gold, 'formtype:email') === true,
    'form: formtype:email 仍应是合法 pin')
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

// ── 等价实现归一化（AI-46）────────────────────────────────────────────────────
// 每条都对应一处**运行时已核实**的等价实现：按字面比较 = 做对了却被罚。
console.log('meta-eval: equivalent implementations are accepted')
{
  const maskOf = (c) => ({ pinnedDims: c.pins, statedDims: c.stated })
  const find = (prefix) => cases.find((x) => x.file.startsWith(prefix))

  // dialog rowkey：生成器 `input.rowkey || 'id'` ⟹ 省略 ≡ 显式 'id'；错值仍要红。
  {
    const c = find('frag-dialog-01-vue3')
    const omit = clone(c.gold); delete omit.rowkey
    check(scoreFragment('dialog', c.gold, omit, maskOf(c)).byDim.rowkey.pass === true,
      'rowkey 省略应等价于 "id"（生成器缺省）')
    const wrong = clone(c.gold); wrong.rowkey = 'uuid'
    check(scoreFragment('dialog', c.gold, wrong, maskOf(c)).byDim.rowkey.pass === false,
      'rowkey 错值仍应判红')
  }

  // labelWidth：vue2 本次补齐 number→px 归一，三端等价。
  {
    const c = find('frag-form-02-vue3')
    const num = clone(c.gold); num.formLayout.labelWidth = 110
    const s = scoreFragment('form', c.gold, num, maskOf(c))
    check(s.byDim['formLayout.labelWidth'].pass === true, 'labelWidth 数字 110 应等价于 "110px"')
    check(s.exactIntentStated === true, 'labelWidth 数字写法不应打红 stated')
    const wrong = clone(c.gold); wrong.formLayout.labelWidth = '120px'
    check(scoreFragment('form', c.gold, wrong, maskOf(c)).byDim['formLayout.labelWidth'].pass === false,
      'labelWidth 错值仍应判红')
  }

  // 表格高度：`height` / `tabHeight` 是**同一个**运行时旋钮（三端 es-table 的 tabHeight
  // computed：tabHeight 优先，height 只在 heightType='height' 时生效）。
  {
    const c = find('frag-table-02-vue3') // gold: heightType='height', height=420
    const str = clone(c.gold)
    str.tableOptions.height = '420px'
    const s = scoreFragment('table', c.gold, str, maskOf(c))
    check(s.byDim['tableOptions.height'].pass === true, 'height "420px" 应等价于 420')
    check(s.exactIntentStated === true, '尺寸字符串写法不应打红 stated')

    // 等价落地：把固定高度写进 tabHeight（运行期优先键）也应判等。
    const viaTab = clone(c.gold)
    delete viaTab.tableOptions.height
    viaTab.tableOptions.tabHeight = 420
    check(scoreFragment('table', c.gold, viaTab, maskOf(c)).byDim['tableOptions.height'].pass === true,
      'tabHeight:420 与 heightType=height + height:420 运行期等价')

    // 死键：heightType='maxHeight' 时 `height` 完全不生效，不能等价于 tabHeight。
    const c6 = find('frag-table-06-vue3') // gold: heightType='maxHeight', tabHeight=520
    const dead = clone(c6.gold)
    delete dead.tableOptions.tabHeight
    dead.tableOptions.height = 520
    check(scoreFragment('table', c6.gold, dead, maskOf(c6)).byDim['tableOptions.tabHeight'].pass === false,
      "heightType='maxHeight' 时 height 是死键，不能等价于 tabHeight")

    const wrong = clone(c6.gold)
    wrong.tableOptions.tabHeight = 521
    check(scoreFragment('table', c6.gold, wrong, maskOf(c6)).byDim['tableOptions.tabHeight'].pass === false,
      'tabHeight 错值仍应判红')
  }

  // 虚拟滚动是语义维：virtual:true ≡ engine:'virtual'，两个都不给才红。
  {
    const c = find('frag-table-02-vue3')
    const viaEngine = clone(c.gold)
    delete viaEngine.tableOptions.virtual // engine:'virtual' 仍在
    check(scoreFragment('table', c.gold, viaEngine, maskOf(c)).byDim.tableVirtualMode.pass === true,
      "engine:'virtual' 应等价于 virtual:true")
    const none = clone(c.gold)
    delete none.tableOptions.virtual
    delete none.tableOptions.engine
    check(scoreFragment('table', c.gold, none, maskOf(c)).byDim.tableVirtualMode.pass === false,
      '两个键都不给应判红')
  }

  // 弹窗 width：三端 es-dialog 都把 number 转 px。
  {
    const c = find('frag-dialog-02-component-vue3')
    const str = clone(c.gold); str.options.width = '720px'
    check(scoreFragment('dialog', c.gold, str, maskOf(c)).byDim['options.width'].pass === true,
      'width "720px" 应等价于 720')
  }

  // headerCellStyle：三端都把对象原样作为 CSS style 绑定，纯色背景的简写/长写渲染等价；
  // 渐变/错色仍要红（否则会把「背景写法不同」当成通行证）。
  {
    const c = find('frag-table-05-vue3') // gold: { background:'#eef2f7', color:'#333333' }
    const long = clone(c.gold)
    long.tableOptions.headerCellStyle = { backgroundColor: '#eef2f7', color: '#333333' }
    check(scoreFragment('table', c.gold, long, maskOf(c)).byDim['tableOptions.headerCellStyle'].pass === true,
      'headerCellStyle 纯色 background 与 backgroundColor 应判等')

    const grad = clone(c.gold)
    grad.tableOptions.headerCellStyle = { background: 'linear-gradient(#fff,#000)', color: '#333333' }
    check(scoreFragment('table', c.gold, grad, maskOf(c)).byDim['tableOptions.headerCellStyle'].pass === false,
      '渐变 background 不能判等（简写含更多语义）')

    const wrongColor = clone(c.gold)
    wrongColor.tableOptions.headerCellStyle = { backgroundColor: '#ffffff', color: '#333333' }
    check(scoreFragment('table', c.gold, wrongColor, maskOf(c)).byDim['tableOptions.headerCellStyle'].pass === false,
      '背景色写错仍应判红')
  }

  // fieldAttrs 现在比 gold 声明的全部键（NL 明写「最多 200 字」）—— 漏写 maxlength 要红。
  {
    const c = find('frag-form-01-vue3')
    const miss = clone(c.gold)
    delete miss.fields.find((f) => f.prop === 'bio').attrs.maxlength
    check(scoreFragment('form', c.gold, miss, maskOf(c)).byDim.fieldAttrs.pass === false,
      'fieldAttrs 漏掉 gold 声明的 maxlength 应判红')
  }

  // 适用性一致（AI-51）：gold 只有 placeholder/maxlength（没有 attrs.type）时，整维
  // `fieldAttrs` 仍须适用 —— 否则 full 口径恒绿，而 `fieldAttrs:<prop>` 又能钉住它。
  {
    const c = find('frag-form-04-vue3')
    const miss = clone(c.gold)
    delete miss.fields.find((f) => f.prop === 'name').attrs.maxlength
    const s = scoreFragment('form', c.gold, miss, maskOf(c))
    check(s.byDim.fieldAttrs.applicable === true, 'fieldAttrs：无 attrs.type 也应适用（与字段 token 对齐）')
    check(s.byDim.fieldAttrs.pass === false, 'fieldAttrs：漏写 maxlength 在整维口径也应判红')
  }

  // fieldRules：message 是文案（中文措辞不可推断）→ 忽略；校验行为键仍要咬。
  {
    const c = find('frag-form-04-vue3')
    const alt = clone(c.gold)
    alt.fields.find((f) => f.prop === 'email').rules[0].message = '另一种错误提示'
    const s = scoreFragment('form', c.gold, alt, maskOf(c))
    check(s.byDim.fieldRules.pass === true, 'rules 的 message 文案差异不应判红')
    check(s.exactIntentFull === true, 'rules message 差异不应打红 full')
    const wrong = clone(c.gold)
    delete wrong.fields.find((f) => f.prop === 'phone').rules
    check(scoreFragment('form', c.gold, wrong, maskOf(c)).byDim.fieldRules.pass === false,
      '漏掉 phone 的 pattern 规则应判红')
    const typo = clone(c.gold)
    typo.fields.find((f) => f.prop === 'age').rules[0].min = 16
    check(scoreFragment('form', c.gold, typo, maskOf(c)).byDim.fieldRules.pass === false,
      'min 写错应判红')

    // 等价编码：把 required 单列一条规则（带 trigger）—— 剥离 required/message 后只剩
    // trigger 的空规则无校验行为，不得因此判红（gold 把 required 写在字段键上）。
    const split = clone(c.gold)
    const email = split.fields.find((f) => f.prop === 'email')
    email.rules = [{ required: true, message: '邮箱必填', trigger: 'blur' }, ...email.rules]
    const ss = scoreFragment('form', c.gold, split, maskOf(c))
    check(ss.byDim.fieldRules.pass === true, 'required 单列一条规则（仅 trigger）应判等')
    check(ss.exactIntentStated === true, '等价规则拆分不应打红 stated')
  }

  // apiParams：method 缺省 ≡ GET；url 与 gold 声明的 labelField/valueField 仍要咬。
  {
    const c = find('frag-form-07-vue3')
    const noMethod = clone(c.gold)
    delete noMethod.fields.find((f) => f.prop === 'dept').apiParams.method
    check(scoreFragment('form', c.gold, noMethod, maskOf(c)).byDim.apiParams.pass === true,
      'apiParams.method 缺省应等价于 GET')
    const wrongUrl = clone(c.gold)
    wrongUrl.fields.find((f) => f.prop === 'dept').apiParams.url = '/api/other'
    check(scoreFragment('form', c.gold, wrongUrl, maskOf(c)).byDim.apiParams.pass === false,
      'apiParams.url 写错应判红')
    const wrongField = clone(c.gold)
    wrongField.fields.find((f) => f.prop === 'role').apiParams.labelField = 'title'
    check(scoreFragment('form', c.gold, wrongField, maskOf(c)).byDim.apiParams.pass === false,
      'gold 声明的 labelField 写错应判红')
  }

  // 引擎语义：vxe ≠ 默认引擎（旧实现把两者都折算成布尔 false —— 修掉的度量 bug）。
  {
    const c = find('frag-table-06-vue3')
    check(scoreFragment('table', c.gold, clone(c.gold), maskOf(c)).byDim.tableVirtualMode.pass === true,
      'gold-vs-gold engine vxe 应 pass')
    const none = clone(c.gold)
    delete none.tableOptions.engine
    check(scoreFragment('table', c.gold, none, maskOf(c)).byDim.tableVirtualMode.pass === false,
      '把 vxe 省略成默认引擎应判红')
    const virt = clone(c.gold)
    virt.tableOptions.virtual = true
    check(scoreFragment('table', c.gold, virt, maskOf(c)).byDim.tableVirtualMode.pass === false,
      '把 vxe 换成虚拟引擎应判红（两者运行时行为不同）')
  }

  // rowButtons 只认 name|type：`key` 在 Zod/类型里可选、NL 从不提 —— 省略不该判红。
  {
    const c = find('frag-table-03-vue3')
    const noKey = clone(c.gold)
    for (const b of noKey.rowButtons) delete b.key
    const s = scoreFragment('table', c.gold, noKey, maskOf(c))
    check(s.byDim.rowButtons.pass === true, '省略 rowButtons.key 应判等（key 可选且 NL 从不提）')
    check(s.exactIntentStated === true, '省略 key 不应打红 stated/pinned 口径')
    const wrongType = clone(c.gold)
    wrongType.rowButtons[1].type = 'danger'
    check(scoreFragment('table', c.gold, wrongType, maskOf(c)).byDim.rowButtons.pass === false,
      'rowButtons.type 写错仍应判红')
  }

  // isHidden：旧条件 / 等价 JSONLogic 二元节点 / 条件数组 vs `and` —— 三种写法运行时等价。
  {
    const c = find('frag-form-05-vue3')
    const asExpr = clone(c.gold)
    // gold: { field: 'refundType', op: 'ne', value: '全额' } ⟺ { '!=': [{ var: 'refundType' }, '全额'] }
    asExpr.fields.find((f) => f.prop === 'reason').isHidden = { '!=': [{ var: 'refundType' }, '全额'] }
    const asAnd = clone(c.gold)
    // gold: 条件数组（AND）⟺ JSONLogic { and: [...] }（同为 AND，顺序无语义）
    const arr = asAnd.fields.find((f) => f.prop === 'voucher').isHidden
    asAnd.fields.find((f) => f.prop === 'voucher').isHidden = { and: [...arr].reverse() }
    for (const [name, pred] of [['表达式节点', asExpr], ['and 节点+逆序', asAnd]]) {
      const s = scoreFragment('form', c.gold, pred, maskOf(c))
      check(s.byDim.isHidden.pass === true, `isHidden ${name}写法应判等（运行时语义相同）`)
      check(s.exactIntentStated === true, `isHidden ${name}写法不应打红 stated`)
    }
    // 表达式算子塞进旧条件是**真实错误**（运行时未知算子 fail-open）—— 必须判红。
    const invalidLegacy = clone(c.gold)
    invalidLegacy.fields.find((f) => f.prop === 'reason').isHidden = { field: 'refundType', op: '!=', value: '全额' }
    check(scoreFragment('form', c.gold, invalidLegacy, maskOf(c)).byDim.isHidden.pass === false,
      '旧条件里用表达式算子（op:!=）应判红 —— 运行时会被忽略')
    // 选项 value 不可推断：条件取值按各自 dataOptions 的 value→label 归一后再比。
    const slugValues = clone(c.gold)
    const opt = slugValues.fields.find((f) => f.prop === 'refundType')
    opt.dataOptions = [{ label: '全额', value: 'full' }, { label: '部分', value: 'partial' }]
    slugValues.fields.find((f) => f.prop === 'reason').isHidden.value = 'full'
    slugValues.fields.find((f) => f.prop === 'voucher').isHidden[0].value = 'partial'
    const s = scoreFragment('form', c.gold, slugValues, maskOf(c))
    check(s.byDim.isHidden.pass === true, '条件取值经各自 options 映射后相同应判等（slug vs label）')
  }

  // reactions：`when`/`required` 只接受表达式节点；旧条件形态在运行时非法，必须判红。
  {
    const c = find('frag-form-06-vue3')
    const good = clone(c.gold)
    good.fields.find((f) => f.prop === 'city').reactions[0].fulfill.required = {
      '==': [{ var: 'country' }, 'us'],
    }
    check(scoreFragment('form', c.gold, good, maskOf(c)).byDim.reactions.pass === true,
      'reactions.required 用等价表达式节点应判等')
    const legacyWhen = clone(c.gold)
    legacyWhen.fields.find((f) => f.prop === 'province').reactions[0].when = {
      field: 'country', op: 'eq', value: 'cn',
    }
    check(scoreFragment('form', c.gold, legacyWhen, maskOf(c)).byDim.reactions.pass === false,
      'reactions.when 用旧条件形态应判红（该位置只接受表达式节点）')
    const bareBool = clone(c.gold)
    bareBool.fields.find((f) => f.prop === 'city').reactions[0].fulfill.required = true
    check(scoreFragment('form', c.gold, bareBool, maskOf(c)).byDim.reactions.pass === false,
      'reactions.required 用裸 boolean 应判红（Zod 只接受表达式节点）')

    // 等价编码：无 `when`、`fulfill.required` 用同一表达式。core `ruleActive` 缺省生效、
    // required 又按表达式求值 ⟹ 两者运行期等价；模型省掉 when 不得罚（AI-51）。
    const noWhen = clone(c.gold)
    delete noWhen.fields.find((f) => f.prop === 'city').reactions[0].when
    const sn = scoreFragment('form', c.gold, noWhen, maskOf(c))
    check(sn.byDim.reactions.pass === true, 'reactions 省略 when、required 用同一表达式应判等（运行时等价）')
    check(sn.exactIntentStated === true, '等价编码不应打红 stated')
  }

  // 对象型 tableOptions：gold 声明过的子键要咬，pred 多出的 schema 合法默认（enabled）不罚。
  {
    const c = find('frag-table-06-vue3')
    const withEnabled = clone(c.gold)
    withEnabled.tableOptions.editConfig.enabled = true
    check(scoreFragment('table', c.gold, withEnabled, maskOf(c)).byDim['tableOptions.editConfig'].pass === true,
      'editConfig 多写 enabled:true（Zod 合法默认）不应判红')
    const wrongSub = clone(c.gold)
    wrongSub.tableOptions.editConfig.autoClear = false
    check(scoreFragment('table', c.gold, wrongSub, maskOf(c)).byDim['tableOptions.editConfig'].pass === false,
      'editConfig 声明子键写错仍应判红')
  }
}

// ── 收尾 ─────────────────────────────────────────────────────────────────────
if (failures) {
  console.error(`\nfragment-scorers meta-eval FAILED — ${failures} 处`)
  process.exit(1)
}
console.log(`\nfragment-scorers meta-eval OK — ${cases.length} 条片段用例，${exercised.size} 个维度被扰动验证`)
