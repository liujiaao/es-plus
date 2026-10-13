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

/** tableBtns 的比较键元素（排序多重集）：name + 归一化 code（左右）+ actionType。
 *  抽成单源，判定（tableBtnsEqual）与诊断输出（describeDimMiss）复用同一套键，不会漂移。 */
const tableBtnKeyParts = (c) =>
  (c.tableBtns || []).map((b) => `${b.name}|${b.code ?? 1}|${b.actionType ?? ''}`).sort()

/** 不止比 code：name + 归一化后 code（左右）+ actionType 的多重集相等。 */
function tableBtnsEqual(gold, pred) {
  return tableBtnKeyParts(gold).join(',,') === tableBtnKeyParts(pred).join(',,')
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

/** 行操作列的行按钮 name（排序）—— 判定与诊断同源。 */
const rowBtnNames = (o) => (o?.btns ?? []).map((b) => b.name).sort()

/**
 * 组件 es-crud-page `normalizedOperationColumn` 的判定镜像。
 *
 * 关键：配置**省略** operationColumn 时，组件并非「无操作列」，而是按 actions 自动派生行按钮
 * （view→查看 / edit→编辑 / delete→删除；无任何行动作则整列关闭 false）。所以「省略 operationColumn
 * + actions=[add,edit,delete]」与「显式 operationColumn.btns=[编辑,删除]」渲染出**同一组行按钮**。
 * 旧 operationColumnEqual 把 `undefined` 当空集，会把前者（正确的极简配置）误判为 miss —— 这是库默认
 * 未被判定建模的老问题，与 inQuery 默认陷阱同构。这里改为比较**有效行按钮集**（库默认→scorer，非 overfit）。
 * 自定义行按钮（如示例 TicketManage 的「处理/关闭」）不在 actions 派生范围内，模型省略它们仍会正确判负。
 */
const ROW_ACTION_LABEL = { view: '查看', edit: '编辑', delete: '删除' }
function effectiveRowBtns(cfg) {
  const oc = cfg.operationColumn
  if (oc === false) return { disabled: true, names: [] }
  if (oc !== undefined) return { disabled: false, names: rowBtnNames(oc) }
  // 省略 → 镜像组件按 actions 派生（无行动作时组件返回 false=整列关闭）。
  const actions = cfg.actions ?? ['add', 'edit', 'delete']
  const names = ['view', 'edit', 'delete'].filter((a) => actions.includes(a)).map((a) => ROW_ACTION_LABEL[a])
  return names.length ? { disabled: false, names: names.sort() } : { disabled: true, names: [] }
}

/** 比较**有效**行按钮集：关闭态须一致，行按钮 name 集须相等（结构意图，不逐一比样式）。 */
function operationColumnEqual(gold, pred) {
  const g = effectiveRowBtns(gold)
  const p = effectiveRowBtns(pred)
  return g.disabled === p.disabled && g.names.join(',') === p.names.join(',')
}

/**
 * 结构化维度（tableBtns / operationColumn / dialogs）的「期望 vs 实得」可读键 —— 供 eval 诊断输出。
 * 与各维度 pass() **同源**（复用同一套键函数），所以 `want === got` 当且仅当该维度 pass；
 * 这正是定位「模型究竟把按钮 name/actionType/行按钮 写成了什么」的那一行。
 * 其余维度返回 null（它们的差异已由 attrMisses / propF1 等既有输出覆盖）。
 */
export function describeDimMiss(dim, gold, pred) {
  if (dim === 'tableBtns') {
    const show = (c) => tableBtnKeyParts(c).join(' · ') || '（无）'
    return { want: show(gold), got: show(pred) }
  }
  if (dim === 'operationColumn') {
    // 显示**有效**行按钮集（镜像组件派生），与 operationColumnEqual 同源 → want===got 当且仅当 pass。
    const show = (c) => {
      const e = effectiveRowBtns(c)
      if (e.disabled) return 'false（关闭操作列）'
      return e.names.join(' · ') || '（无行按钮）'
    }
    return { want: show(gold), got: show(pred) }
  }
  if (dim === 'dialogs') {
    const show = (c) => {
      const d = c.dialogs ?? {}
      const keys = Object.keys(d).sort()
      if (!keys.length) return '（未配置）'
      return keys.map((k) => `${k}:[${(d[k].formItems ?? []).map((f) => f.prop).sort().join(',')}]`).join(' ; ')
    }
    return { want: show(gold), got: show(pred) }
  }
  return null
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

/** 后端响应字段映射：整对象等值（未声明 ≡ null）。仅当 gold 声明了非空映射时才 applicable。 */
function configTableOutEqual(gold, pred) {
  const g = gold.tableOptions?.configTableOut ?? null
  const p = pred.tableOptions?.configTableOut ?? null
  return eq(g, p)
}

/**
 * 声明式条件显隐：gold 每个带 `isHidden` 的 field，pred 同名 field 必须存在**且整对象等值**。
 *
 * 深度等值（`eq`）而非 presence：条件的算子写错（`eq` 写成 `ne`）、`value` 的类型或数组
 * 顺序不符都算未命中 —— 条件显隐是「行为契约」不是「扩展点兜底」，照着比内容才有意义
 * （与 `configTableOut` 同为整对象等值；`extPoints` 那种只比 presence 的是因为其内容
 * 是不可静态校验的 JS 源码串）。
 */
function isHiddenEqual(gold, pred) {
  const pm = fieldMap(pred)
  for (const f of gold.fields) {
    if (!f.isHidden) continue
    const pf = pm.get(f.prop)
    if (!pf || !pf.isHidden || !eq(f.isHidden, pf.isHidden)) return false
  }
  return true
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
  {
    key: 'configTableOut',
    applicable: (g) => !!(g.tableOptions?.configTableOut && Object.keys(g.tableOptions.configTableOut).length),
    pass: configTableOutEqual,
  },
  {
    key: 'isHidden',
    applicable: (g) => g.fields.some((f) => f.isHidden !== undefined),
    pass: isHiddenEqual,
  },
  { key: 'extPoints', applicable: (g) => g.fields.some(hasExtPoint), pass: extPointsEqual },
]

// ── 字段级 scorer（供 scoped 口径的 `维度:字段` token 使用）─────────────────────
// B2 的承重点：NL 常常只锁定「某一列」的某个属性（如「金额列用数值类型」），而不是
// 全表所有字段。粗粒度维度会把 NL 没提的字段也拖进 AND，又把欠定惩罚带回来。于是
// 对可按字段细化的维度，提供「只看这一个 prop」的判定；`pinnedDims` 里写 `formtype:amount`
// 即只记金额列的 formtype，status/createdAt 猜错不扣分（因为 NL 没锁它们）。
const memberAttrEqual = (attr, gold, pred, prop) => {
  const g = fieldMap(gold).get(prop)
  const p = fieldMap(pred).get(prop)
  return !!g && !!p && g[attr] === p[attr]
}
const FIELD_SCORERS = {
  formtype: (gold, pred, prop) => {
    const g = fieldMap(gold).get(prop)
    const p = fieldMap(pred).get(prop)
    return !!g && !!p && g.formtype === p.formtype
  },
  membership: (gold, pred, prop) => {
    const g = fieldMap(gold).get(prop)
    const p = fieldMap(pred).get(prop)
    return !!g && !!p && g.inQuery === p.inQuery && g.inTable === p.inTable && g.inForm === p.inForm
  },
  // membership 的三个分量，供「NL 只锁其一」的更细标注（如「查询条件不含头像」→ inQuery:avatar）。
  inQuery: (gold, pred, prop) => memberAttrEqual('inQuery', gold, pred, prop),
  inTable: (gold, pred, prop) => memberAttrEqual('inTable', gold, pred, prop),
  inForm: (gold, pred, prop) => memberAttrEqual('inForm', gold, pred, prop),
  extPoints: (gold, pred, prop) => {
    const g = fieldMap(gold).get(prop)
    const p = fieldMap(pred).get(prop)
    if (!g || !p) return false
    for (const kind of ['render', 'formatter', 'permissionValue']) if (g[kind] && !p[kind]) return false
    return true
  },
  apiParams: (gold, pred, prop) => {
    const g = fieldMap(gold).get(prop)
    const p = fieldMap(pred).get(prop)
    if (!g || !g.apiParams) return true // 该字段本就不要求 apiParams → 空钉即过
    return !!p && !!p.apiParams && eq(g.apiParams, p.apiParams)
  },
  dataOptions: (gold, pred, prop) => {
    const has = (c) => !!((fieldMap(c).get(prop)?.dataOptions ?? []).length)
    return has(gold) === has(pred)
  },
  isHidden: (gold, pred, prop) => {
    const g = fieldMap(gold).get(prop)
    const p = fieldMap(pred).get(prop)
    if (!g || !g.isHidden) return true // 该字段本就不要求条件显隐 → 空钉即过
    return !!p && !!p.isHidden && eq(g.isHidden, p.isHidden)
  },
}

/** 可按字段细化的维度名（`维度:字段` 的合法左半），供 check 校验标注合法性。 */
export const FIELD_SCORABLE_DIMS = Object.keys(FIELD_SCORERS)
/** 可整维度钉定的名（`维度` 的合法形态），供 check 校验标注合法性。 */
export const WHOLE_SCORABLE_DIMS = CAPABILITY_SCORERS.map((s) => s.key)

/** 解析一个 pinnedDims token：`formtype:amount` → {dim,field}；`actions` → {dim}。 */
export function parsePinnedDim(token) {
  const i = String(token).indexOf(':')
  return i === -1 ? { dim: token, field: undefined } : { dim: token.slice(0, i), field: token.slice(i + 1) }
}

/** 一个 pinnedDims token 是否合法：整维度须是 capability key；`维度:字段` 的维度须可字段细化。 */
export function isValidPinnedDim(token) {
  const { dim, field } = parsePinnedDim(token)
  return field === undefined ? WHOLE_SCORABLE_DIMS.includes(dim) : FIELD_SCORABLE_DIMS.includes(dim) && !!field
}

/** 对单个 pinnedDims token 判定命中（整维度走 CAPABILITY_SCORERS.pass；`维度:字段` 走 FIELD_SCORERS）。 */
function scoreDimension(gold, pred, token) {
  const { dim, field } = parsePinnedDim(token)
  if (field !== undefined) {
    const scorer = FIELD_SCORERS[dim]
    if (!scorer) throw new Error(`pinnedDims: 维度 "${dim}" 不支持字段级细化（可用：${FIELD_SCORABLE_DIMS.join(', ')}）`)
    return !!scorer(gold, pred, field)
  }
  const s = CAPABILITY_SCORERS.find((s) => s.key === dim)
  if (!s) throw new Error(`pinnedDims: 未知维度 "${dim}"（可用：${WHOLE_SCORABLE_DIMS.join(', ')}）`)
  return !!s.pass(gold, pred)
}

/**
 * 对一对 (gold, pred) 打分。返回 byCapability（条件打分）+ 向后兼容的明细分
 * （propF1 / attrAcc / attrMisses / actionsF1 / tableBtnsMatch）+ 三个合成分。
 *
 * `mask`（可选）= 该 case 的规格掩码 `{ pinnedDims?: string[] }`——NL 真正锁定的维度/字段
 * 清单。给了就只对这些 token 记 `exactIntentScoped`；没给则 scoped ≡ core（向后兼容）。
 * `fixedFields` 不在此参与打分（它只用于喂模型，见 eval-llm.mjs）。
 */
export function scoreAll(gold, pred, mask) {
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

  // scoped 口径（B2）：只 AND 掩码里 NL 真正锁定的 token。无掩码 → 退化为 core（向后兼容）。
  const pinned = mask && Array.isArray(mask.pinnedDims) ? mask.pinnedDims : []
  const exactIntentScoped = pinned.length ? pinned.every((t) => scoreDimension(gold, pred, t)) : exactIntentCore

  return {
    byCapability,
    propF1,
    attrAcc,
    attrMisses,
    actionsF1,
    tableBtnsMatch,
    exactIntentCore,
    exactIntentFull,
    exactIntentScoped,
  }
}

// ── B3 收敛（refinement loop）：多轮精修里「第几轮收敛」的纯判定 ───────────────────
//
// 判定口径复用 scoped（exactIntentScoped）——与「95% = scoped zero-edit ∨ ≤K 轮收敛」的
// 良定义一致。初稿 = 第 0 轮（0 次纠正即过 = zero-edit）；每喂一条纠正 +1 轮。

/**
 * 给定按轮次排列的 scoreAll 结果数组（index 0 = 初稿，1 = 第 1 轮纠正后…），返回首个
 * `exactIntentScoped===true` 的 0-based 轮次号；全程未收敛返回 null。
 * @param {Array<{ exactIntentScoped?: boolean } | boolean>} scores
 * @returns {number | null}
 */
export function firstConvergedTurn(scores) {
  if (!Array.isArray(scores)) return null
  for (let i = 0; i < scores.length; i++) {
    const s = scores[i]
    const converged = typeof s === 'boolean' ? s : !!(s && s.exactIntentScoped)
    if (converged) return i
  }
  return null
}

/**
 * 收敛语料聚合（只观测、不门禁）。rows 每项 `{ firstTurn: number|null }`（见 firstConvergedTurn）。
 *   - rateAtK           : firstTurn !== null && firstTurn <= k 的占比（≤K 轮内收敛率）
 *   - meanTurnsToConverge: 已收敛案例 firstTurn 的均值（未收敛不计入；null 若无一收敛）
 *   - converged / total : 旁证——高均值+极少收敛不至于被误读为「平均很快」
 * @param {Array<{ firstTurn: number|null }>} rows
 * @param {number} k
 */
export function summarizeConvergence(rows, k) {
  const total = Array.isArray(rows) ? rows.length : 0
  if (!total) return { rateAtK: null, meanTurnsToConverge: null, converged: 0, total: 0 }
  const convergedAny = rows.filter((r) => r.firstTurn !== null && r.firstTurn !== undefined)
  const withinK = convergedAny.filter((r) => r.firstTurn <= k)
  const meanTurns = convergedAny.length
    ? convergedAny.reduce((a, r) => a + r.firstTurn, 0) / convergedAny.length
    : null
  return {
    rateAtK: withinK.length / total,
    meanTurnsToConverge: meanTurns,
    converged: convergedAny.length,
    total,
  }
}

// ── 「95% 定义」统一判定：scoped zero-edit ∨ ≤K 轮收敛 ───────────────────────────
//
// 两条腿的 OR——「95% = scoped zero-edit ∨ ≤K 轮收敛」的真实单一数字。此前 eval 只分开
// 报 scoped-zero-edit 与 convergence@K，无人把它们按 case OR 起来；而定义里的 95% 恰恰是这个
// per-case 的 OR。只观测、不门禁（沿用 B2/B3 先例），但第一次把「95」落成可读的一个数。

/**
 * 单行是否满足「95% 定义」：scoped zero-edit ∨ ≤k 轮收敛。
 *   - 有收敛语料的行（带 convergence）：firstTurn !== null && firstTurn <= k。
 *     firstTurn=0 即 zero-edit（天然涵盖第一条腿）；1..k 即第二条腿的精修恢复。
 *   - 无收敛语料的行：只有第一条腿可判 → exactIntentScoped（即 turn-0 scoped 命中）。
 * @param {{ exactIntentScoped?: boolean, convergence?: { firstTurn: number|null } | null }} row
 * @param {number} k
 * @returns {boolean}
 */
export function meets95Definition(row, k) {
  if (row && row.convergence) {
    const ft = row.convergence.firstTurn
    return ft !== null && ft !== undefined && ft <= k
  }
  return !!(row && row.exactIntentScoped)
}

/**
 * 「95% 定义」聚合（只观测、不门禁）：rows 按 meets95Definition 判，返回占比 + 旁证计数。
 * @param {Array<{ exactIntentScoped?: boolean, convergence?: { firstTurn: number|null } | null }>} rows
 * @param {number} k
 */
export function summarize95(rows, k) {
  const total = Array.isArray(rows) ? rows.length : 0
  if (!total) return { rate: null, pass: 0, total: 0 }
  const pass = rows.filter((r) => meets95Definition(r, k)).length
  return { rate: pass / total, pass, total }
}
