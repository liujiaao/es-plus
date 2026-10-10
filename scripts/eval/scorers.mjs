#!/usr/bin/env node
/**
 * 按能力维度的记分卡（纯函数、无 SDK 依赖 —— 可在无 API key 下单测）。
 *
 * 背景：`scripts/eval-llm.mjs` 原来的 `exactIntent` 只 AND 了 prop 集合 + 4 个属性
 * (formtype/inQuery/inTable/inForm) + actions + tableBtn 的 code，**忽略** dialogs /
 * operationColumn / permissions / apiParams / dataOptions / render / formatter /
 * permissionValue / i18n / formLayout / target / mode / virtualScroll。合成单分无法
 * 定位回归（「总分掉了」vs「dialog 维度掉了」是两件事）。
 *
 * 这里把打分拆成一组**条件打分**的维度 scorer：每个维度只在 gold 真正用到它的 case 上
 * 计分（applicable-only），避免把一个特性在没用它的 case 上也算「通过」而灌水。
 *
 * gold 与 pred 都是 `StructuredCrudConfigSchema.parse()` 之后的值 —— 默认已解析
 * (inQuery/inTable/inForm=true, mode='schema', target='vue3', typescript=true,
 * i18n=false)，所以这里按解析后的具体值比较。
 *
 * 门禁策略（见 docs/internal/wave-1-eval-trust-design.md 决策 B）：
 *   - `exactIntentCore` = 历史 4 维（prop/attr/actions/tableBtn-code），门禁继续落在它；
 *   - `exactIntentFull` = 该 case 所有 applicable 维度的 AND，**只观测不门禁**，待基线后 ratchet。
 */

/** 稳定序列化（键排序）——用于结构深等值比较。undefined 键在两侧都会被 JSON 丢弃，一致。 */
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

function fieldMap(config) {
  const m = new Map()
  for (const f of config.fields) m.set(f.prop, f)
  return m
}

function sharedFields(gold, pred) {
  const pm = fieldMap(pred)
  return gold.fields.filter((f) => pm.has(f.prop)).map((f) => ({ g: f, p: pm.get(f.prop) }))
}

// ── 维度判定（pass: (gold, pred) => boolean）─────────────────────────────────

function formtypeEqual(gold, pred) {
  return sharedFields(gold, pred).every(({ g, p }) => g.formtype === p.formtype)
}

function membershipEqual(gold, pred) {
  return sharedFields(gold, pred).every(
    ({ g, p }) => g.inQuery === p.inQuery && g.inTable === p.inTable && g.inForm === p.inForm
  )
}

/** 不止比 code：name + 归一化后 code（左右）+ actionType 的多重集相等。 */
function tableBtnsEqual(gold, pred) {
  const key = (c) =>
    (c.tableBtns || [])
      .map((b) => `${b.name}|${b.code ?? 1}|${b.actionType ?? ''}`)
      .sort()
      .join(',,')
  return key(gold) === key(pred)
}

/** dialog key 集合相等 ∧ 每个 dialog 的 formItems prop 集合相等。 */
function dialogsEqual(gold, pred) {
  const gk = Object.keys(gold.dialogs ?? {}).sort()
  const pk = Object.keys(pred.dialogs ?? {}).sort()
  if (gk.join(',') !== pk.join(',')) return false
  for (const k of gk) {
    const gi = (gold.dialogs[k].formItems ?? []).map((f) => f.prop).sort()
    const pi = (pred.dialogs[k]?.formItems ?? []).map((f) => f.prop).sort()
    if (gi.join(',') !== pi.join(',')) return false
  }
  return true
}

/** false 必须对 false；对象对对象时比行按钮 name 集合（结构意图，不逐一比样式）。 */
function operationColumnEqual(gold, pred) {
  const go = gold.operationColumn
  const po = pred.operationColumn
  if (go === false || po === false) return go === po
  if (!go || !po) return false
  const names = (o) => (o.btns ?? []).map((b) => b.name).sort().join(',')
  return names(go) === names(po)
}

function permissionsEqual(gold, pred) {
  return eq(gold.permissions ?? {}, pred.permissions ?? {})
}

/** gold 每个带 apiParams 的 field，pred 同名 field 必须有等值的 apiParams。 */
function apiParamsEqual(gold, pred) {
  const pm = fieldMap(pred)
  for (const f of gold.fields) {
    if (!f.apiParams) continue
    const pf = pm.get(f.prop)
    if (!pf || !pf.apiParams || !eq(f.apiParams, pf.apiParams)) return false
  }
  return true
}

/** 比「该挂静态 options 的 field 挂了没」——presence 集合相等，不逐一比 options 内容。 */
function dataOptionsPresenceEqual(gold, pred) {
  const propsWith = (c) => new Set(c.fields.filter((f) => (f.dataOptions ?? []).length).map((f) => f.prop))
  return setEq(propsWith(gold), propsWith(pred))
}

function virtualScrollEqual(gold, pred) {
  const virt = (c) => c.tableOptions?.virtual === true
  const engine = (c) => c.tableOptions?.engine ?? 'default'
  return virt(gold) === virt(pred) && engine(gold) === engine(pred)
}

const hasExtPoint = (f) => !!(f.render || f.formatter || f.permissionValue)

/** mark-never-drop 的 LLM 侧对偶：gold 每个扩展点在 pred 同名 field 上必须也存在（不比内容）。 */
function extPointsEqual(gold, pred) {
  const pm = fieldMap(pred)
  for (const f of gold.fields) {
    for (const kind of ['render', 'formatter', 'permissionValue']) {
      if (f[kind]) {
        const pf = pm.get(f.prop)
        if (!pf || !pf[kind]) return false
      }
    }
  }
  return true
}

/**
 * 维度注册表。`applicable(gold)`=该 case 是否用到此维度；`pass(gold,pred)`=是否命中。
 * 恒 applicable 的维度（prop/formtype/membership/actions）承担基础 CRUD，其余按 gold 是否声明。
 */
export const CAPABILITY_SCORERS = [
  { key: 'propSet', applicable: () => true, pass: (g, p) => f1(new Set(g.fields.map((f) => f.prop)), new Set(p.fields.map((f) => f.prop))).f1 === 1 },
  { key: 'formtype', applicable: () => true, pass: formtypeEqual },
  { key: 'membership', applicable: () => true, pass: membershipEqual },
  { key: 'actions', applicable: () => true, pass: (g, p) => f1(new Set(g.actions), new Set(p.actions)).f1 === 1 },
  { key: 'tableBtns', applicable: (g) => !!(g.tableBtns && g.tableBtns.length), pass: tableBtnsEqual },
  { key: 'dialogs', applicable: (g) => !!(g.dialogs && Object.keys(g.dialogs).length), pass: dialogsEqual },
  { key: 'operationColumn', applicable: (g) => g.operationColumn !== undefined, pass: operationColumnEqual },
  { key: 'permissions', applicable: (g) => !!(g.permissions && Object.keys(g.permissions).length), pass: permissionsEqual },
  { key: 'apiParams', applicable: (g) => g.fields.some((f) => f.apiParams), pass: apiParamsEqual },
  { key: 'dataOptions', applicable: (g) => g.fields.some((f) => (f.dataOptions ?? []).length), pass: dataOptionsPresenceEqual },
  { key: 'i18n', applicable: (g) => g.i18n === true, pass: (g, p) => g.i18n === p.i18n },
  { key: 'formLayout', applicable: (g) => g.formLayout !== undefined, pass: (g, p) => eq(g.formLayout ?? null, p.formLayout ?? null) },
  { key: 'target', applicable: (g) => g.target !== 'vue3', pass: (g, p) => g.target === p.target },
  { key: 'mode', applicable: (g) => g.mode === 'sfc', pass: (g, p) => g.mode === p.mode },
  { key: 'virtualScroll', applicable: (g) => g.tableOptions?.virtual === true || ['virtual', 'vxe'].includes(g.tableOptions?.engine), pass: virtualScrollEqual },
  { key: 'extPoints', applicable: (g) => g.fields.some(hasExtPoint), pass: extPointsEqual },
]

/**
 * 对一对 (gold, pred) 打分。返回 byCapability（条件打分）+ 向后兼容的明细分
 * （propF1 / attrAcc / attrMisses / actionsF1 / tableBtnsMatch）+ 两个合成分。
 */
export function scoreAll(gold, pred) {
  const byCapability = {}
  for (const s of CAPABILITY_SCORERS) {
    const applicable = !!s.applicable(gold)
    byCapability[s.key] = applicable
      ? { applicable: true, pass: !!s.pass(gold, pred) }
      : { applicable: false, pass: null }
  }

  // ── 向后兼容的明细分（控制台与历史 record 字段沿用）────────────────────────
  const goldFields = fieldMap(gold)
  const predFields = fieldMap(pred)
  const propF1 = f1(new Set(goldFields.keys()), new Set(predFields.keys()))

  const shared = [...goldFields.keys()].filter((p) => predFields.has(p))
  const attrs = ['formtype', 'inQuery', 'inTable', 'inForm']
  let attrHits = 0
  let attrTotal = 0
  const attrMisses = []
  for (const prop of shared) {
    const g = goldFields.get(prop)
    const p = predFields.get(prop)
    for (const a of attrs) {
      attrTotal++
      if (g[a] === p[a]) attrHits++
      else attrMisses.push(`${prop}.${a} (want ${g[a]}, got ${p[a]})`)
    }
  }
  const attrAcc = attrTotal === 0 ? 1 : attrHits / attrTotal

  const actionsF1 = f1(new Set(gold.actions), new Set(pred.actions))

  const codes = (c) => (c.tableBtns || []).map((b) => b.code ?? 1).sort().join(',')
  const tableBtnsMatch = codes(gold) === codes(pred)

  // 历史门禁口径（prop + 4 属性 + actions + tableBtn-code），保持数值连续性。
  const exactIntentCore = propF1.f1 === 1 && attrAcc === 1 && actionsF1.f1 === 1 && tableBtnsMatch

  // 更严：该 case 所有 applicable 维度都命中。只观测，不门禁。
  const exactIntentFull = Object.values(byCapability).every((c) => (c.applicable ? c.pass : true))

  return {
    byCapability,
    propF1,
    attrAcc,
    attrMisses,
    actionsF1,
    tableBtnsMatch,
    exactIntentCore,
    exactIntentFull,
  }
}
