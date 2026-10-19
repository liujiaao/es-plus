#!/usr/bin/env node
/**
 * 片段场景（`generate_table` / `generate_form` / `generate_dialog`）的按维度记分卡。
 *
 * ## 为什么需要它（AI-SCENE-COVERAGE-PLAN §1.2「仍未做」）
 *
 * 片段语料从 Wave 1.1 起就和 CRUD 同目录，但 `eval-llm.mjs` 只做了一件事：把非-crud
 * 用例**响亮跳过**（`notScored`）。原因是当时唯一一套 scorer 是 CRUD 形状的
 * （pageSchema/query/table/tableBtns），拿它量片段产物只会产出恒真的伪信号。
 * 结果是「片段有语料、有编译/运行时见证，但**准确率零度量**」—— 模型把
 * `tableOptions.height` 写成 `heightType`、把 `rowkey` 拼错，没有任何数字会动。
 *
 * 本模块补上这半边：把「片段配置对不对」拆成一组**条件打分**的维度（与
 * `scorers.mjs` 同一套 applicable-only 哲学），并且：
 *
 *   - **gold 驱动**：gold 声明了哪个键才比哪个键。NL 没锁的东西（`formatter` 源码串、
 *     `attrs.maxlength`、`apiUrl` 的具体地址、`composableName`…）不参与 scoped 口径，
 *     与 CRUD 的 `pinnedDims` 机制同源；
 *   - **归一化库默认值**：片段的产物里 `border/stripe/highlightCurrentRow/rowkey`
 *     是**无条件发射**的（`TABLE_BLOCK_ALWAYS`），缺省等价于 `true/true/true/'id'`；
 *     `form.context` 缺省 `form`、`buttons` 缺省 `none`、dialog `mode` 缺省
 *     `composable`、`pagination.pageSize` 缺省 `10`。让「省略」和「显式写默认」判等
 *     —— 否则模型做对了却被罚，正是本仓反复踩过的 inQuery 默认陷阱同构。
 *   - **不可静默 strip**：每个 gold 声明过的 `tableOptions` / `formLayout` / `options` /
 *     `pagination` 键各自成为一个维度（`tableOptions.height` 这种带点的名字），
 *     少写/写错/写反都定位到具体键，而不是一句「整个容器不对」。
 *
 * ## 为什么不做成一个总分
 *
 * 「片段 78%」无法定位回归。拆维度后可回答「是 `formtype` 掉了，还是容器级词汇掉了」。
 * 与 CRUD scorer 一样，只导出纯函数，供 `fragment-scorers.test.mjs` 无 key 自测。
 *
 * ## scoped 口径
 *
 * `mask.pinnedDims` 与 CRUD 完全同构：NL 真正锁定的维度/字段。pinned token 支持
 *   - 整维度：`propSet` / `rowButtonNames` / `tableOptions.height` / `formLayout.labelWidth` /
 *     `options.width` / `dialogMaskNonClosing` …；
 *   - 字段级：`formtype:status` / `fieldRequired:name` / `dataOptions:status` /
 *     `fieldAttrs:bio` / `fieldLayout:amount` / `extPoints:amount`。
 *
 * 未给 mask 时 scoped 退化为 `exactIntentCore`（片段版的硬诚实四维），向后兼容。
 */

/** 稳定序列化（键排序）—— 与 `scorers.mjs` 同实现。 */
function canon(v) {
  if (Array.isArray(v)) return v.map(canon)
  if (v && typeof v === 'object') {
    const out = {}
    for (const k of Object.keys(v).sort()) out[k] = canon(v[k])
    return out
  }
  return v
}
function eq(a, b) {
  return JSON.stringify(canon(a)) === JSON.stringify(canon(b))
}
function setEq(a, b) {
  if (a.size !== b.size) return false
  for (const x of a) if (!b.has(x)) return false
  return true
}
export function f1(goldSet, predSet) {
  const tp = [...goldSet].filter((x) => predSet.has(x)).length
  const fp = predSet.size - tp
  const fn = goldSet.size - tp
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp)
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn)
  const score = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall)
  return { precision, recall, f1: score }
}

/** 「给了非空文本」—— `emptyText`/`leftText` 只比 presence：NL 从不说具体文案。 */
const hasText = (v) => typeof v === 'string' && v.trim() !== ''
const fieldMap = (cfg) => new Map((cfg?.fields ?? []).map((f) => [f.prop, f]))
const sharedFields = (gold, pred) => {
  const pm = fieldMap(pred)
  return (gold?.fields ?? []).filter((f) => pm.has(f.prop)).map((f) => ({ g: f, p: pm.get(f.prop) }))
}

// ── 库默认值的归一化（见文件头注；与 fragment-generator.ts 的发射口径同源）────────
//
// 片段生成器**无条件**发射这几个键：`border: ${t.border !== false}`、
// `stripe: ${t.stripe !== false}`、`highlightCurrentRow: ${t.highlightCurrentRow !== false}`、
// `rowkey: ${q(t.rowkey || 'id')}`。所以 `tableOptions` 整段省略与显式写默认，
// 产物逐字节等价 —— 判定也必须等价。
function normTableOptions(t) {
  return {
    ...(t ?? {}),
    border: t?.border !== false,
    stripe: t?.stripe !== false,
    highlightCurrentRow: t?.highlightCurrentRow !== false,
    rowkey: t?.rowkey || 'id',
  }
}
function normPageSize(p) {
  return p?.pageSize ?? 10
}
function normTarget(cfg) {
  return cfg?.target ?? 'vue3'
}
function normContext(cfg) {
  return cfg?.context ?? 'form'
}
function normButtons(cfg) {
  return cfg?.buttons ?? 'none'
}
function normDialogMode(cfg) {
  return cfg?.mode ?? 'composable'
}

// ── 字段级判定 ────────────────────────────────────────────────────────────────

/**
 * formtype 别名归一化（`datePicker` ≡ `DatePicker`、`timePicker` ≡ `TimePicker`）。
 *
 * 这两个别名是**运行时合法且等价**的写法：三端 `use-form-inputs` 查组件表前都先过
 * core `normalizeFormType()`，权威 Zod 枚举也显式接受它们。gold 用规范写法，模型若写别名，
 * 生成产物逐字节等价 —— 判分必须等价，否则就是「做对了却被罚」。
 * 本地副本由 `fragment-scorers.test.mjs` 对照 `packages/shared/src/contract.ts` 逐键断言。
 */
export const FRAGMENT_FORMTYPE_ALIASES = Object.freeze({
  datePicker: 'DatePicker',
  timePicker: 'TimePicker',
})
const normFormtype = (t) => FRAGMENT_FORMTYPE_ALIASES[t] ?? t

const LAYOUT_KEYS = ['align', 'width', 'minWidth', 'fixed', 'ellipsis']
const hasLayout = (f) => LAYOUT_KEYS.some((k) => f?.[k] !== undefined)
const hasExtPoint = (f) => !!(f?.render || f?.formatter)

const fieldFormtypeEqual = (g, p) => normFormtype(g.formtype) === normFormtype(p.formtype)
const fieldRequiredEqual = (g, p) => (g.required ?? false) === (p.required ?? false)
const fieldOptionsPresenceEqual = (g, p) => !!(g.dataOptions ?? []).length === !!(p.dataOptions ?? []).length
const fieldAttrTypeEqual = (g, p) => (g.attrs?.type ?? null) === (p.attrs?.type ?? null)
const fieldLayoutEqual = (g, p) =>
  LAYOUT_KEYS.every((k) => eq(g?.[k] ?? null, p?.[k] ?? null))
const fieldExtPointsEqual = (g, p) => {
  for (const kind of ['render', 'formatter']) if (g?.[kind] && !p?.[kind]) return false
  return true
}

const FIELD_SCORERS = {
  formtype: fieldFormtypeEqual,
  fieldRequired: fieldRequiredEqual,
  dataOptions: fieldOptionsPresenceEqual,
  fieldAttrs: fieldAttrTypeEqual,
  fieldLayout: fieldLayoutEqual,
  extPoints: fieldExtPointsEqual,
}

// ── 整维度判定（gold 驱动）────────────────────────────────────────────────────

const propSetEqual = (g, p) =>
  f1(new Set((g?.fields ?? []).map((f) => f.prop)), new Set((p?.fields ?? []).map((f) => f.prop))).f1 === 1
const formtypeEqual = (g, p) => sharedFields(g, p).every(({ g: gf, p: pf }) => fieldFormtypeEqual(gf, pf))
const fieldRequiredAllEqual = (g, p) => {
  const pm = fieldMap(p)
  for (const f of g?.fields ?? []) {
    if (f.required === undefined) continue
    const pf = pm.get(f.prop)
    if (!pf || !fieldRequiredEqual(f, pf)) return false
  }
  return true
}
/** 与 CRUD `dataOptions` 同规：比「该挂静态 options 的 field」集合，不比 1/0 这类不可推断的值。 */
const dataOptionsEqual = (g, p) => {
  const propsWith = (c) => new Set((c?.fields ?? []).filter((f) => (f.dataOptions ?? []).length).map((f) => f.prop))
  return setEq(propsWith(g), propsWith(p))
}
const fieldAttrsEqual = (g, p) => {
  const pm = fieldMap(p)
  for (const f of g?.fields ?? []) {
    if (f.attrs?.type === undefined) continue
    const pf = pm.get(f.prop)
    if (!pf || !fieldAttrTypeEqual(f, pf)) return false
  }
  return true
}
const fieldLayoutEqualWhole = (g, p) => {
  const pm = fieldMap(p)
  for (const f of g?.fields ?? []) {
    if (!hasLayout(f)) continue
    const pf = pm.get(f.prop)
    if (!pf || !fieldLayoutEqual(f, pf)) return false
  }
  return true
}
const extPointsEqual = (g, p) => {
  const pm = fieldMap(p)
  for (const f of g?.fields ?? []) {
    if (!hasExtPoint(f)) continue
    const pf = pm.get(f.prop)
    if (!pf || !fieldExtPointsEqual(f, pf)) return false
  }
  return true
}

const rowButtonNames = (cfg) => (cfg?.rowButtons ?? []).map((b) => b.name).sort().join(',')
const rowButtonKeys = (cfg) =>
  (cfg?.rowButtons ?? []).map((b) => `${b.name}|${b.type ?? ''}|${b.key ?? ''}`).sort().join(',,,')
const maskNonClosing = (cfg) => cfg?.options?.modal === false || cfg?.options?.closeOnClickModal === false

/** 文本型容器键：只判 presence（NL 说「空数据文案」但不说文案内容）。 */
const TEXT_PRESENCE_KEYS = new Set(['emptyText', 'leftText'])

/**
 * 该 (scene, gold) 下**启用**的维度清单。dynamic 键（`tableOptions.height` 等）的
 * 存在性由 gold 决定 —— 这正是「gold 驱动」：gold 没声明就不进分母。
 */
function fragmentDimSpecs(scene, gold) {
  const specs = []
  const add = (key, applicable, pass) => specs.push({ key, applicable: !!applicable, pass })

  // ── 三场景共用 ──
  add('propSet', true, propSetEqual)
  add('formtype', (gold?.fields ?? []).length > 0, formtypeEqual)
  add('fieldRequired', (gold?.fields ?? []).some((f) => f.required !== undefined), fieldRequiredAllEqual)
  add('dataOptions', (gold?.fields ?? []).some((f) => (f.dataOptions ?? []).length), dataOptionsEqual)
  add('fieldAttrs', (gold?.fields ?? []).some((f) => f.attrs?.type !== undefined), fieldAttrsEqual)
  add('fieldLayout', (gold?.fields ?? []).some(hasLayout), fieldLayoutEqualWhole)
  add('extPoints', (gold?.fields ?? []).some(hasExtPoint), extPointsEqual)
  add('target', true, (g, p) => normTarget(g) === normTarget(p))

  if (scene === 'table') {
    add('apiUrl', gold?.apiUrl !== undefined, (g, p) => eq(g?.apiUrl ?? null, p?.apiUrl ?? null))
    add('rowButtons', (gold?.rowButtons ?? []).length > 0, (g, p) => rowButtonKeys(g) === rowButtonKeys(p))
    add('rowButtonNames', (gold?.rowButtons ?? []).length > 0, (g, p) => rowButtonNames(g) === rowButtonNames(p))

    for (const key of Object.keys(gold?.tableOptions ?? {})) {
      const presence = TEXT_PRESENCE_KEYS.has(key)
      add(`tableOptions.${key}`, true, (g, p) => {
        const gv = normTableOptions(g?.tableOptions)[key]
        const pv = normTableOptions(p?.tableOptions)[key]
        return presence ? hasText(gv) === hasText(pv) : eq(gv ?? null, pv ?? null)
      })
    }
    for (const key of Object.keys(gold?.pagination ?? {})) {
      add(`pagination.${key}`, true, (g, p) => {
        const gv = key === 'pageSize' ? normPageSize(g?.pagination) : g?.pagination?.[key]
        const pv = key === 'pageSize' ? normPageSize(p?.pagination) : p?.pagination?.[key]
        return eq(gv ?? null, pv ?? null)
      })
    }
  }

  if (scene === 'form') {
    add('context', true, (g, p) => normContext(g) === normContext(p))
    add('buttons', true, (g, p) => normButtons(g) === normButtons(p))
    for (const key of Object.keys(gold?.formLayout ?? {})) {
      add(`formLayout.${key}`, true, (g, p) => eq(g?.formLayout?.[key] ?? null, p?.formLayout?.[key] ?? null))
    }
  }

  if (scene === 'dialog') {
    add('apiUrl', gold?.apiUrl !== undefined, (g, p) => eq(g?.apiUrl ?? null, p?.apiUrl ?? null))
    add('rowkey', gold?.rowkey !== undefined, (g, p) => eq(g?.rowkey ?? null, p?.rowkey ?? null))
    add('mode', true, (g, p) => normDialogMode(g) === normDialogMode(p))
    add('composableName', gold?.composableName !== undefined, (g, p) => eq(g?.composableName ?? null, p?.composableName ?? null))
    add('defaultTitle', gold?.defaultTitle !== undefined, (g, p) => eq(g?.defaultTitle ?? null, p?.defaultTitle ?? null))
    // 「点遮罩不关」的两种正确落地：关掉遮罩（modal:false）**或**保留遮罩但不响应点击
    // （closeOnClickModal:false）。gold 取前者（它同时覆盖 falsy 发射分支），但只钉后者
    // 的模型同样正确 —— 故这是一个**语义维**，不是 `options.modal` 的键值比较。
    add('dialogMaskNonClosing', maskNonClosing(gold), (g, p) => maskNonClosing(g) === maskNonClosing(p))
    for (const key of Object.keys(gold?.options ?? {})) {
      // 「点遮罩不关」的 gold 落地是 `modal:false`，但语义维 `dialogMaskNonClosing` 已覆盖
      // **两种**等价实现（`modal:false` 或 `closeOnClickModal:false`）。若再单列
      // `options.modal`，同一意图会被数两遍，且「保留遮罩但不响应点击」这种正确落地会被判红。
      if (key === 'modal' && gold.options.modal === false) continue
      add(`options.${key}`, true, (g, p) => eq(g?.options?.[key] ?? null, p?.options?.[key] ?? null))
    }
  }

  return specs
}

/** 片段版「硬诚实」维度（无 pinnedDims 时的 scoped 退路；与 CRUD core 的定位一致）。 */
const CORE_DIMS = {
  table: ['propSet', 'formtype', 'fieldRequired', 'rowButtonNames'],
  form: ['propSet', 'formtype', 'fieldRequired', 'context', 'buttons'],
  dialog: ['propSet', 'formtype', 'fieldRequired', 'mode'],
}

/** 可按字段细化的维度名（`维度:字段` 的合法左半）。 */
export const FRAGMENT_FIELD_SCORABLE_DIMS = Object.keys(FIELD_SCORERS)

function parsePinnedDim(token) {
  const i = String(token).indexOf(':')
  return i === -1 ? { dim: token, field: undefined } : { dim: token.slice(0, i), field: token.slice(i + 1) }
}

/** 该 case 下所有可整维度钉定的名字（含动态 `tableOptions.*` / `options.*`）。 */
export function fragmentScorableDims(scene, gold) {
  return fragmentDimSpecs(scene, gold).map((s) => s.key)
}

/**
 * pinnedDims token 是否合法：字段级必须是可字段细化的维度且 gold 真有该字段；
 * 整维度必须是该 case 下**启用**的维度（钉一个 gold 没声明的键没有意义，且会掩盖笔误）。
 */
export function isValidFragmentPinnedDim(scene, gold, token) {
  const { dim, field } = parsePinnedDim(token)
  if (field !== undefined) {
    return FRAGMENT_FIELD_SCORABLE_DIMS.includes(dim) && fieldMap(gold).has(field)
  }
  return fragmentDimSpecs(scene, gold).some((s) => s.key === dim && s.applicable)
}

function scoreDimension(scene, gold, pred, token) {
  const { dim, field } = parsePinnedDim(token)
  if (field !== undefined) {
    const scorer = FIELD_SCORERS[dim]
    if (!scorer) {
      throw new Error(
        `pinnedDims: 片段维度 "${dim}" 不支持字段级细化（可用：${FRAGMENT_FIELD_SCORABLE_DIMS.join(', ')}）`
      )
    }
    const g = fieldMap(gold).get(field)
    const p = fieldMap(pred).get(field)
    return !!g && !!p && !!scorer(g, p)
  }
  const spec = fragmentDimSpecs(scene, gold).find((s) => s.key === dim)
  if (!spec) {
    throw new Error(`pinnedDims: 片段场景 ${scene} 没有维度 "${dim}"`)
  }
  return !!spec.pass(gold, pred)
}

/**
 * 对一对 (gold, pred) 打分。
 *
 * 返回：
 *   - `byDim`：`{ [dim]: { applicable, pass } }`，覆盖该 gold 启用的全部维度；
 *   - `exactIntentFull`：所有 applicable 维度都命中；
 *   - `exactIntentCore`：片段版硬诚实四维（见 CORE_DIMS）；
 *   - `exactIntentScoped`：只 AND `mask.pinnedDims`；无 mask 时退化为 core。
 */
export function scoreFragment(scene, gold, pred, mask) {
  if (!['table', 'form', 'dialog'].includes(scene)) {
    throw new Error(`scoreFragment: 未知片段场景 "${scene}"`)
  }
  const specs = fragmentDimSpecs(scene, gold)
  const byDim = {}
  for (const s of specs) {
    byDim[s.key] = s.applicable
      ? { applicable: true, pass: !!s.pass(gold, pred) }
      : { applicable: false, pass: null }
  }

  const exactIntentFull = Object.values(byDim).every((c) => (c.applicable ? c.pass : true))
  const exactIntentCore = CORE_DIMS[scene]
    .map((k) => byDim[k])
    .filter((c) => c && c.applicable)
    .every((c) => c.pass)

  const pinned = mask && Array.isArray(mask.pinnedDims) ? mask.pinnedDims : []
  const exactIntentScoped = pinned.length
    ? pinned.every((t) => scoreDimension(scene, gold, pred, t))
    : exactIntentCore

  return { byDim, exactIntentCore, exactIntentFull, exactIntentScoped }
}

/**
 * 供诊断输出：某个 dyn 维度「期望 vs 实得」。其余维度的差异已由 byDim.pass 表达。
 * 键名统一用 dot path（`tableOptions.height`），与 byDim 对齐。
 */
export function describeFragmentDimMiss(dim, gold, pred) {
  const parts = dim.split('.')
  if (parts.length !== 2) return null
  const [scope, key] = parts
  const read = (cfg) => {
    if (scope === 'tableOptions') return normTableOptions(cfg?.tableOptions)[key]
    if (scope === 'pagination') return key === 'pageSize' ? normPageSize(cfg?.pagination) : cfg?.pagination?.[key]
    if (scope === 'formLayout') return cfg?.formLayout?.[key]
    if (scope === 'options') return cfg?.options?.[key]
    return undefined
  }
  const show = (v) => (v === undefined ? '(未设置)' : JSON.stringify(v))
  return { want: show(read(gold)), got: show(read(pred)) }
}
