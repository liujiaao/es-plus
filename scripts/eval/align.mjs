#!/usr/bin/env node
/**
 * 字段对齐（Ruler v3 / R2：以 `label` 为评分身份，`prop` 降为观测量）。
 *
 * ## 为什么需要它
 *
 * NL 里写的是**中文标签**（「创建时间」），gold 的 `prop` 是作者起的 camelCase 名
 * （`createdAt`）。模型只能看见 NL ⟹ 它猜的 `prop` 与 gold 的写法对不上是**必然**的，
 * 不是能力缺口：实测 `prop` 在 NL 中只出现 2.1%（严格匹配 22/1041），`label` 出现 98.4%。
 * 按 `prop` 判等等于把「命名彩票」算成「理解失败」。
 *
 * ## 做法（见 docs/internal/accuracy-95-ruler-v3-design.md §8）
 *
 *   identity = label（zh 腿）/ prop（en 腿）
 *     en 腿标签是「中文 gold vs 英文 pred」，结构性不可比，且 en 只观测不门禁
 *     （ratchet 门禁全走 zhRows）⟹ en 腿退回 prop 身份，保证历史数字不受本次改动影响。
 *
 *   匹配顺序：① 归一化 label 精确相等 → ② prop 精确相等（兜底：非中文字段 / 模型没写 label）
 *   约束：**单射** —— 一个 pred 字段只能被一个 gold 字段认领。pred 出现重复 label 时
 *         只认领第一个，其余进 `unmatchedPred`（字段集判负，不允许蒙混）。
 *
 *   `normalizePredForCompare` 把 pred 里所有**引用字段 prop 的位置**改写成 gold 的写法
 *   （白名单，宁可漏改不可误改；`treeConfig.childrenField` 是行数据键、不动）。
 *
 * ## 不做的事
 *
 * 不做模糊匹配（拼音/同义/编辑距离）—— 先只做归一化精确匹配，配合近失诊断；
 * 是否放宽由数据决定（设计 §8.5）。
 */

/**
 * label 归一化：NFKC → 去空白（含全角空格）→ 去标点 → 小写。
 * 只做「排版差异」归一，不做语义归一（「金额」≠「价格」）。
 */
const PUNCT_RE = /[\s　·・.,，。、;；:：!！?？"'“”‘’`()（）\[\]【】{}｛｝<>《》〈〉\-—_/\\|~～@#$%^&*+=]/g
export function normalizeLabel(s) {
  return String(s ?? '')
    .normalize('NFKC')
    .replace(PUNCT_RE, '')
    .toLowerCase()
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/**
 * 建立 gold ↔ pred 的字段对应。
 * @param {{fields?:Array}} gold
 * @param {{fields?:Array}} pred
 * @param {{identity?: 'label'|'prop'}} [opts]
 * @returns {{
 *   mode:'label'|'prop',
 *   map: Map<string, object>,        // goldProp → pred field
 *   reverse: Map<string, string>,    // predProp → goldProp
 *   ambiguous: Array<{label:string, kept:string, dropped:string[]}>,
 *   unmatchedGold: string[],
 *   unmatchedPred: string[],
 * }}
 */
export function alignFields(gold, pred, opts = {}) {
  const mode = opts.identity === 'prop' ? 'prop' : 'label'
  const gFields = Array.isArray(gold?.fields) ? gold.fields : []
  const pFields = Array.isArray(pred?.fields) ? pred.fields : []

  const keyOf =
    mode === 'label'
      ? (f) => {
          const k = normalizeLabel(f?.label)
          return k || null
        }
      : (f) => (f?.prop ? String(f.prop) : null)

  const map = new Map()
  const reverse = new Map()
  const claimed = new Set() // pred index 已被认领
  const ambiguous = []

  // ① identity 键精确匹配（label 模式下先按 label）
  if (mode === 'label') {
    const byKey = new Map() // 归一 label → pred 下标列表
    pFields.forEach((f, i) => {
      const k = keyOf(f)
      if (!k) return
      if (!byKey.has(k)) byKey.set(k, [])
      byKey.get(k).push(i)
    })
    for (const g of gFields) {
      const k = keyOf(g)
      if (!k || !byKey.has(k)) continue
      const candidates = byKey.get(k)
      const idx = candidates.find((i) => !claimed.has(i))
      if (idx === undefined) continue
      claimed.add(idx)
      map.set(g.prop, pFields[idx])
      reverse.set(pFields[idx].prop, g.prop)
      if (candidates.length > 1) {
        // 重复 label：只认第一个，其余留给 ②/未匹配（propSet 会判负）
        ambiguous.push({ label: g.label, kept: pFields[idx].prop, dropped: candidates.slice(1).map((i) => pFields[i].prop) })
      }
    }
  }

  // ② prop 精确匹配（兜底）：label 模式下列表里剩下的、以及 prop 模式的全部
  for (const g of gFields) {
    if (map.has(g.prop)) continue
    const idx = pFields.findIndex((f, i) => !claimed.has(i) && f.prop === g.prop)
    if (idx === -1) continue
    claimed.add(idx)
    map.set(g.prop, pFields[idx])
    reverse.set(pFields[idx].prop, g.prop)
  }

  const unmatchedGold = gFields.filter((g) => !map.has(g.prop)).map((g) => g.prop)
  const unmatchedPred = pFields.filter((_, i) => !claimed.has(i)).map((f) => f.prop)
  return { mode, map, reverse, ambiguous, unmatchedGold, unmatchedPred }
}

/** 把表达式里对字段的引用（`{var:'x'}` / `x.y`）改写为 gold 命名空间。 */
function renameExpr(node, reverse) {
  if (Array.isArray(node)) return node.map((x) => renameExpr(x, reverse))
  if (isObj(node)) {
    const out = {}
    for (const [k, v] of Object.entries(node)) out[k] = renameExpr(v, reverse)
    if (typeof out.var === 'string') out.var = renameVar(out.var, reverse)
    return out
  }
  return node
}

/** 只改**首段**（`a.b` 是 `a` 的路径访问；整段等值时才改全串）。 */
function renameVar(name, reverse) {
  if (typeof name !== 'string') return name
  if (reverse.has(name)) return reverse.get(name)
  const dot = name.indexOf('.')
  if (dot > 0) {
    const head = name.slice(0, dot)
    if (reverse.has(head)) return reverse.get(head) + name.slice(dot)
  }
  return name
}

const renamePropList = (list, reverse) => (Array.isArray(list) ? list.map((x) => renameVar(x, reverse)) : list)

/**
 * 把 pred 的字段命名词典改写成 gold 的，供既有 scorer 直接比较。
 *
 * 白名单（设计 §8.2）：
 *   fields[].prop / dialogs[*].formItems[].prop / columns[].prop（递归 groups）/
 *   expandConfig.fields[].prop（顶层与列级）/ mergeConfig.rowsBy[] /
 *   tableOptions.defaultSort.prop / isHidden({field} 与表达式 {var}) /
 *   reactions[].dependencies[] 与 when/fulfill 表达式
 * **不动**：treeConfig.childrenField（行数据键）、extPoints 源码串、apiParams/dataOptions…
 *
 * @returns {{pred: object, align: ReturnType<typeof alignFields>}}
 */
export function normalizePredForCompare(gold, pred, opts = {}) {
  const align = alignFields(gold, pred, opts)
  if (align.mode === 'prop') return { pred, align } // prop 身份：命名空间本就相同形态，无需改写
  const reverse = align.reverse
  if (!reverse.size) return { pred, align }

  const out = JSON.parse(JSON.stringify(pred ?? {}))

  for (const f of out.fields ?? []) {
    if (!f || typeof f !== 'object') continue
    if (reverse.has(f.prop)) f.prop = reverse.get(f.prop)
    if (f.isHidden !== undefined) f.isHidden = renameIsHidden(f.isHidden, reverse)
    if (Array.isArray(f.reactions)) f.reactions = f.reactions.map((r) => renameReaction(r, reverse))
  }

  for (const d of Object.values(out.dialogs ?? {})) {
    if (!d || typeof d !== 'object') continue
    for (const fi of d.formItems ?? []) if (fi && reverse.has(fi.prop)) fi.prop = reverse.get(fi.prop)
  }

  const renameExpand = (ec) => {
    for (const fi of ec?.fields ?? []) if (fi && reverse.has(fi.prop)) fi.prop = reverse.get(fi.prop)
  }
  const walkColumns = (cols) => {
    for (const c of cols ?? []) {
      if (!c || typeof c !== 'object') continue
      if (c.prop && reverse.has(c.prop)) c.prop = reverse.get(c.prop)
      if (Array.isArray(c.groups)) walkColumns(c.groups)
      if (c.expandConfig) renameExpand(c.expandConfig)
    }
  }
  walkColumns(out.columns)
  if (out.expandConfig) renameExpand(out.expandConfig)

  if (out.mergeConfig && Array.isArray(out.mergeConfig.rowsBy)) {
    out.mergeConfig.rowsBy = renamePropList(out.mergeConfig.rowsBy, reverse)
  }
  if (out.tableOptions?.defaultSort?.prop && reverse.has(out.tableOptions.defaultSort.prop)) {
    out.tableOptions.defaultSort.prop = reverse.get(out.tableOptions.defaultSort.prop)
  }

  return { pred: out, align }
}

/**
 * `isHidden` / 条件表达式的统一改写。
 *
 * 认「三种形态，同一棵树」：
 *   · 简写条件 `{field:'status', op:'eq', value:1}` —— field 是 **prop**
 *   · 表达式外套 `{field:'status', expr:{...}}` / `{field, when}` —— field 可能只是给人看的
 *     标签，真正的引用在表达式里（故 express/when 交给 renameExpr）
 *   · 裸表达式 `{'>': [{var:'amount'}, 100]}` / `{and: [...]}` —— 整体就是表达式树
 *     （`frag-form-05` 的「金额大于 100」就是这形态；旧实现只认 field/expr/when，
 *     于是 `{var}` 漏改、改名后的正确配置被判红）
 *
 * 递归的 `else` 分支是必要的：`and/or` 的操作数数组里仍可能出现简写条件。
 */
function renameCondition(node, reverse) {
  if (Array.isArray(node)) return node.map((x) => renameCondition(x, reverse))
  if (!isObj(node)) return node
  const out = {}
  for (const [k, v] of Object.entries(node)) {
    if (k === 'field' && typeof v === 'string') out[k] = renameVar(v, reverse)
    else if (k === 'expr' || k === 'when') out[k] = renameExpr(v, reverse)
    else out[k] = renameCondition(v, reverse)
  }
  if (typeof out.var === 'string') out.var = renameVar(out.var, reverse)
  return out
}
const renameIsHidden = renameCondition

function renameReaction(r, reverse) {
  if (!isObj(r)) return r
  const out = { ...r }
  if (Array.isArray(out.dependencies)) out.dependencies = out.dependencies.map((x) => renameVar(x, reverse))
  if (out.when !== undefined) out.when = renameExpr(out.when, reverse)
  if (isObj(out.fulfill)) {
    const f = { ...out.fulfill }
    for (const k of ['required', 'disabled', 'value', 'dataOptions', 'isHidden']) {
      if (f[k] !== undefined && k !== 'dataOptions') f[k] = renameExpr(f[k], reverse)
    }
    out.fulfill = f
  }
  return out
}

/**
 * 语言 → 字段身份。（单源：`eval-llm.mjs` 与 `rescore.mjs` 都从这里取，避免一边走 label
 * 一边走 prop，让「复算与产物对不上」重新长出来。）
 *
 *   zh ⟹ label（门禁语言；NL 写的是中文标签，「命名彩票」不算理解失败）
 *   en ⟹ prop（gold 标签是中文、pred 是英文 ⟹ 结构性不可比；且 en 只观测不门禁）
 */
export const scoreOptsForLang = (lang) => (lang === 'en' ? { identity: 'prop' } : {})

/**
 * `propNameMatch`（观测量，不进门禁）：gold 字段里，被对齐到的 pred 字段**prop 写法也相同**的占比。
 * 回答「模型猜命名的准确率」，与「懂不懂 NL」解耦。无 gold 字段时返回 null。
 */
export function propNameMatch(gold, pred, opts = {}) {
  const align = alignFields(gold, pred, opts)
  const gFields = Array.isArray(gold?.fields) ? gold.fields : []
  if (!gFields.length) return null
  let hit = 0
  for (const g of gFields) {
    const p = align.map.get(g.prop)
    if (p && p.prop === g.prop) hit++
  }
  return hit / gFields.length
}
