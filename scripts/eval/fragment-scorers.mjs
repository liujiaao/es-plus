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
 *   - **AI-47 扩充**：字段级 `isHidden` / `reactions` / `fieldSpan` / `apiParams` /
 *     `fieldRules` / `labelKey` 与容器级 `i18n` 各自成维；`extPoints` 纳入
 *     `permissionValue`（CRUD scorer 早已如此，片段面此前漏项）。这些键都有真实
 *     运行时消费者（`buildFormItem` / `buildTableColumn` 发射 → core 归一动词），
 *     此前语料为零 ⟹ 写错也没有数字会动。
 *   - **AI-51 场景作用域**：独立表格片段的 `fields` 只进 `buildTableColumn(SFC)`，
 *     表单专属键（formtype/required/dataOptions/attrs/rules/isHidden/reactions/span/
 *     apiParams）在产物里零消费者 ⟹ 表格场景**不启用**这些维度；`isValidFragmentPinnedDim`
 *     同步要求字段级 pin 的整维在该场景适用（否则 pin 能绕过场景口径）。
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
 *     `fieldAttrs:bio` / `fieldLayout:amount` / `extPoints:amount`
 *     （仅当该维在当前场景启用；独立表格的 fields 不消费表单专属键 —— 见上方 AI-51）。
 *
 * 未给 mask 时 scoped 退化为 `exactIntentCore`（片段版的硬诚实四维），向后兼容。
 *
 * ## stated 口径（AI-46）
 *
 * `mask.statedDims`（语料字段 `nlStatedDims`）= NL/宿主**确实说了**的维度，语法与
 * pinnedDims 相同。`exactIntentStated` 只 AND 这一组 —— 它回答「说了的做到了吗」。
 * 为什么需要它：片段 gold 同时充当**运行时 fixture**，会声明 NL 从未要求的键
 * （`rowClassName` / `cachePageSelection` / `formatter`…）。`exactIntentFull` 把它们
 * 全部计入，数字会被语料构造方式污染；stated 把「没说的」排除在分母外，同时保留
 * 「说了的漏做」的惩罚。`pinnedDims ⊆ nlStatedDims` 由 meta-eval 强制。
 */

/** 字段身份（Ruler v3 / R2）：与 CRUD 同一把尺子 —— 按归一化 label 对齐，详见 `align.mjs`。 */
import { normalizePredForCompare, propNameMatch } from './align.mjs'

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
/**
 * CSS 长度归一：`number` / 纯数字字符串 ≡ `'Npx'`，其余字符串原样。
 *
 * 三端运行时已统一走 core `toCssSize`（表格 height/tabHeight、表单 labelWidth、
 * 弹窗 width）：`420`、`'420'`、`'420px'` 渲染结果相同。记分卡若按字面比较，
 * 模型用任一合法写法都会被判错 —— inQuery 默认陷阱的同构。
 */
function normCssSize(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? `${v}px` : v
  if (typeof v === 'string') {
    const t = v.trim()
    return /^-?\d+(?:\.\d+)?$/.test(t) ? `${t}px` : t
  }
  return v
}
const cssEq = (a, b) => eq(normCssSize(a) ?? null, normCssSize(b) ?? null)
/**
 * 表格「引擎」是**语义维**：三端消费口径都是
 * `options.virtual === true || options.engine === 'virtual'`
 * （vue3/vue2/antdv 的 es-table 逐字同实现）。gold 同时写 `virtual:true` + `engine:'virtual'`
 * 只是运行时 fixture 的双保险；若按两个键分别计分，一次意图会被数两遍。
 *
 * AI-47 修正：旧实现返回**布尔**（`virtual || engine==='virtual'`），于是
 * `engine:'vxe'` 与「省略」判等 —— `vxe` 与默认引擎是两种不同运行时，必须分开。
 * 现在比较**有效引擎**：`virtual:true` 优先（三端运行时口径），否则取 `engine`，
 * 缺省为 `'default'`。
 */
const tableEngine = (cfg) => {
  const t = cfg?.tableOptions ?? {}
  if (t.virtual === true) return 'virtual'
  return t.engine ?? 'default'
}
/**
 * 表格「容器高度」也是**语义维**：三端 `es-table` 的 `tabHeight` computed 逐字同实现 ——
 * `tabHeight` 优先，`height` **只在 `heightType === 'height'` 时**生效，其余高度类型
 * 直接忽略（`useTableResize` 的 `resizeTabHeight` 同口径）。
 *
 * 逐键字面比较会同时犯两个错：`{heightType:'height', height:420}` 与模型写的
 * `tabHeight:420` 运行期等价却判错；`{heightType:'maxHeight', height:520}` 的 `height`
 * 是**死键**（不生效）却判对。故 `height` / `tabHeight` 两个维度都按这个有效高度比较。
 * `heightType` 本身仍由它自己的维度比较（固定 vs 封顶是两种运行时行为）。
 */
const effectiveTableHeight = (cfg) => {
  const t = cfg?.tableOptions ?? {}
  if (t.tabHeight !== undefined && t.tabHeight !== null && t.tabHeight !== '') {
    return normCssSize(t.tabHeight) ?? null
  }
  if ((t.heightType ?? 'auto') === 'height' && t.height !== undefined && t.height !== null && t.height !== '') {
    return normCssSize(t.height) ?? null
  }
  return null
}
/** dialog 的 rowkey：生成器 `input.rowkey || 'id'` —— 省略与显式 `'id'` 等价。 */
const normDialogRowkey = (cfg) => cfg?.rowkey || 'id'
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
/** 扩展点 = 「模型必须写一段声明式/JS 源码串」的键集合（含字段级权限编码，与 CRUD 同规）。 */
const EXT_POINT_KEYS = ['render', 'formatter', 'permissionValue']
const hasExtPoint = (f) => EXT_POINT_KEYS.some((k) => f?.[k] !== undefined)

const fieldFormtypeEqual = (g, p) => normFormtype(g.formtype) === normFormtype(p.formtype)
const fieldRequiredEqual = (g, p) => (g.required ?? false) === (p.required ?? false)
const fieldOptionsPresenceEqual = (g, p) => !!(g.dataOptions ?? []).length === !!(p.dataOptions ?? []).length
/**
 * 字段 attrs：gold 声明过的每个键都必须原样命中（pred 多出的键不罚）。
 * 旧版只比 `attrs.type`，于是 NL 明说的 `maxlength` 写不写都一样 —— 与「gold 驱动」口径不符。
 */
const fieldAttrTypeEqual = (g, p) => {
  const ga = g.attrs ?? {}
  return Object.keys(ga).every((k) => eq(ga[k], p.attrs?.[k] ?? null))
}
const fieldLayoutEqual = (g, p) =>
  LAYOUT_KEYS.every((k) => eq(g?.[k] ?? null, p?.[k] ?? null))
const fieldExtPointsEqual = (g, p) => {
  for (const kind of EXT_POINT_KEYS) {
    if (g?.[kind] !== undefined && p?.[kind] === undefined) return false
  }
  return true
}

// ── AI-47：此前无维度的字段声明式键（均有真实运行时消费者）────────────────────

/**
 * 旧条件（`{field, op, value}`）的合法算子集 —— 与 core `matchHiddenCondition` /
 * 权威 Zod `HIDDEN_OPS` 同一份闭集。
 */
const LEGACY_HIDDEN_OPS = new Set(['eq', 'ne', 'in', 'nIn', 'empty', 'notEmpty', 'truthy', 'falsy'])
/** 与旧条件**语义等价**的 JSONLogic 二元算子（其余算子只能以表达式形态出现）。 */
const EXPR_TO_LEGACY_OP = { '==': 'eq', '!=': 'ne', in: 'in', nin: 'nIn' }

/**
 * 条件里引用的取值按**该配置自己的** `dataOptions` 归一到 label。
 *
 * 语料已定「选项 value 不可推断、不计分」（`dataOptions` 维度只比挂载集合），
 * 但 `isHidden` 天然引用了 value：模型给 `{label:'全额', value:'full'}` 后写
 * `value:'full'` 是自洽的，gold 写 `value:'全额'`（label 即 value）同样自洽。
 * 直接比原值 = 因不可推断的选择判错（inQuery 默认陷阱同构）。按各自 options 的
 * value→label 映射后再比，语义相同就判等；映射不到的原样返回。
 */
function resolveOptionValue(cfg, field, value) {
  const f = fieldMap(cfg).get(field)
  const opts = Array.isArray(f?.dataOptions) ? f.dataOptions : []
  if (Array.isArray(value)) return value.map((v) => resolveOptionValue(cfg, field, v))
  const hit = opts.find((o) => o && eq(o.value, value))
  return hit && typeof hit.label === 'string' ? hit.label : value
}

const cmpKey = (a, b) => {
  const x = JSON.stringify(canon(a))
  const y = JSON.stringify(canon(b))
  return x < y ? -1 : x > y ? 1 : 0
}

/**
 * 该字段是不是**布尔字段**（`Switch`，或 `dataOptions` 全是布尔值）。
 *
 * 只有布尔字段上 `truthy`/`falsy` 才与 `== true`/`== false` 等价：非布尔字段的
 * `falsy` 把 `0` / `''` / `null` 也算作假，折成 `== false` 是**放宽判据**（会把
 * 真实写错判成对）。判定口径与 CRUD 腿 `scorers.mjs` 的 `conditionContext` 一致。
 */
function booleanField(cfg, field) {
  const f = fieldMap(cfg).get(field)
  if (!f) return false
  if (f.formtype === 'Switch') return true
  const opts = Array.isArray(f.dataOptions) ? f.dataOptions : []
  const vals = []
  for (const o of opts) if (o && typeof o === 'object' && 'value' in o) vals.push(o.value)
  return vals.length > 0 && vals.every((v) => v === true || v === false)
}

/**
 * 布尔字段上的 `truthy`/`falsy` 折成 `eq true`/`eq false`（与 CRUD 腿
 * `+condition-value-identity-v1` 的第二条规则同一口径）。
 *
 * 为什么必须有：schema 允许两套等价写法 —— 旧条件 `{field, op:'truthy'}` 与表达式
 * `{'==': [{var:field}, true]}`。不折的话两者归一成不同的 (`op`, value)，语法正确、
 * 语义相同的产物被判负。此前两条腿不对称：CRUD 腿已折，片段腿没折，同一份模型输出
 * 在两个场景里得不同结论 —— 尺子内部不一致比尺子严格更糟。
 */
function foldBoolCondition(cfg, field, op, value) {
  if (!booleanField(cfg, field)) return [op, value]
  if (op === 'truthy') return ['eq', true]
  if (op === 'falsy') return ['eq', false]
  return [op, value]
}

/** 表达式节点归一：键排序 + `and`/`or` 操作数排序（交换律）。 */
function canonExprNode(node) {
  if (Array.isArray(node)) return node.map(canonExprNode)
  if (node && typeof node === 'object') {
    const keys = Object.keys(node)
    if (keys.length === 1 && (keys[0] === 'and' || keys[0] === 'or')) {
      const op = keys[0]
      const args = (Array.isArray(node[op]) ? node[op] : [node[op]]).map(canonExprNode).sort(cmpKey)
      return { [op]: args }
    }
    const out = {}
    for (const k of keys.sort()) out[k] = canonExprNode(node[k])
    return out
  }
  return node
}

/**
 * `isHidden` 归一：旧条件、等价的 JSONLogic 二元节点、以及「条件数组 vs `and`」
 * 三种写法归一为同一形态后再比较。
 *
 * 三种写法在运行时**都合法且语义相同**（core `compileHiddenCondition` 对数组逐项
 * 求值、对表达式节点走 `isHiddenExpr`）。模型用任一写法都算做对 —— 若按结构全等
 * 判分，合法的等价表述会被罚，正是 formtype 别名归一要解决的同一条边界。
 * 表达式算子塞进旧条件（如 `{field, op:'!='}`）**不归一**：运行时未知算子 fail-open，
 * 是真实错误，必须判错。
 */
function canonHidden(node, cfg) {
  if (Array.isArray(node)) {
    return { and: node.map((n) => canonHidden(n, cfg)).sort(cmpKey) }
  }
  if (node && typeof node === 'object' && typeof node.field === 'string') {
    const op = node.op ?? 'eq'
    if (!LEGACY_HIDDEN_OPS.has(op)) return { invalidLegacy: canon(node) }
    const [foldedOp, foldedValue] = foldBoolCondition(
      cfg,
      node.field,
      op,
      resolveOptionValue(cfg, node.field, node.value),
    )
    return { cond: [node.field, foldedOp, foldedValue] }
  }
  if (node && typeof node === 'object') {
    const keys = Object.keys(node)
    if (keys.length === 1 && keys[0] === 'and') {
      const args = (Array.isArray(node.and) ? node.and : [node.and]).map((n) => canonHidden(n, cfg)).sort(cmpKey)
      return { and: args }
    }
    if (keys.length === 1 && EXPR_TO_LEGACY_OP[keys[0]]) {
      const op = keys[0]
      const args = Array.isArray(node[op]) ? node[op] : [node[op]]
      if (args.length === 2 && args[0] && typeof args[0] === 'object' && typeof args[0].var === 'string') {
        const [foldedOp, foldedValue] = foldBoolCondition(
          cfg,
          args[0].var,
          EXPR_TO_LEGACY_OP[op],
          resolveOptionValue(cfg, args[0].var, args[1]),
        )
        return { cond: [args[0].var, foldedOp, foldedValue] }
      }
    }
    return { expr: canonExprNode(node) }
  }
  return { literal: node }
}

/** 声明式显隐：上面三种等价写法归一后比较。 */
const fieldIsHiddenEqual = (g, p, goldCfg, predCfg) =>
  eq(canonHidden(g?.isHidden ?? null, goldCfg), canonHidden(p?.isHidden ?? null, predCfg))

/**
 * 字段联动：`{dependencies?, when?, fulfill}` 规则数组。
 *
 * 与 `isHidden` 不同，`when`/`fulfill.required|disabled|value` **只接受表达式节点**
 * （权威 Zod 同款），旧条件形态在此是真实非法输入 —— 故这里只做表达式归一
 * （`and`/`or` 交换律、键序），不把旧条件折算成等价表达式。
 * `dependencies` 只表示「哪些路径触发重算」，顺序无语义，排序后比。
 *
 * **等价编码（AI-51，源码核实）**：core `resolveReactionOverlay` 对无 `when` 的规则
 * 直接生效（`ruleActive` 缺省 true），再把 `fulfill.required|disabled` 当表达式求值。
 * 因此 `{required: E}` 与 `{when: E, required: E}` **运行时完全等价**：
 *   E 为真 → 两者都写 true；E 为假 → 前者写 false，后者不生效、保留静态值
 *   （静态值缺省即 false）。模型省掉 `when` 是合法写法，按字面比会把它罚掉
 *   （与 `dialogMaskNonClosing` 的两种等价落地同族）。只在「无 when + fulfill 只含
 *   布尔键 + 这些键的表达式彼此相同」时归一；`required: true`（常量）仍不折成门控。
 */
function canonReactionRule(rule) {
  const BOOL_KEYS = ['required', 'disabled']
  const out = {}
  if (rule?.dependencies !== undefined) out.dependencies = [...rule.dependencies].sort()
  const f = rule?.fulfill ?? {}
  const fulfill = {}
  if (f.dataOptions !== undefined) fulfill.dataOptions = canonExprNode(f.dataOptions)
  for (const k of [...BOOL_KEYS, 'value']) {
    if (f[k] !== undefined) fulfill[k] = canonExprNode(f[k])
  }
  let when = rule?.when !== undefined ? canonExprNode(rule.when) : undefined
  if (when === undefined && Object.keys(f).length > 0 && Object.keys(f).every((k) => BOOL_KEYS.includes(k))) {
    const nodes = BOOL_KEYS.filter((k) => f[k] !== undefined).map((k) => JSON.stringify(fulfill[k]))
    if (nodes.length > 0 && nodes.every((n) => n === nodes[0])) when = JSON.parse(nodes[0])
  }
  if (when !== undefined) out.when = when
  out.fulfill = fulfill
  return out
}
const fieldReactionsEqual = (g, p) =>
  eq((g?.reactions ?? []).map(canonReactionRule), (p?.reactions ?? []).map(canonReactionRule))

/**
 * 栅格跨度：`querySpan`/`formSpan` 的**有效值**比较。
 *
 * `buildFormItem` 的发射口径是
 *   query: `querySpan || (DatePicker|TimePicker ? 8 : 6)`；form: `formSpan || 24`。
 * 因此「省略」与「显式写默认值」产物等价 —— 与 rowkey/labelWidth 同一类归一。
 */
const DEFAULT_QUERY_SPAN = (f) => (f?.formtype === 'DatePicker' || f?.formtype === 'TimePicker' ? 8 : 6)
const effQuerySpan = (f) => f?.querySpan ?? DEFAULT_QUERY_SPAN(f)
const effFormSpan = (f) => f?.formSpan ?? 24
/**
 * 只比 gold **声明过的**那一侧：form 场景里 `querySpan` 没有消费者，gold 没写就不该
 * 因为模型顺手补了一个 querySpan 而判红（gold 驱动的同一条边界）。
 */
const fieldSpanEqual = (g, p) =>
  (g?.querySpan === undefined || effQuerySpan(g) === effQuerySpan(p)) &&
  (g?.formSpan === undefined || effFormSpan(g) === effFormSpan(p))
const declaresSpan = (f) => f?.querySpan !== undefined || f?.formSpan !== undefined

/**
 * 非必填校验规则：按五元组结构比较，**忽略 `message` 与 `required`**。
 *
 * - `message` 是文案（中文措辞无从推断，gold 写死会变成命名彩票）；
 * - `required` 已由 `fieldRequired` 维度计分，重复计入 = 一次意图数两遍。
 * 只比较真正改变校验行为的键（pattern/min/max/type/trigger）。
 *
 * **等价编码（AI-51）**：模型常把 `required: true` 单列成一条规则
 * （`{required:true, message, trigger:'blur'}`）—— 剥离后没有校验项的空规则在
 * Element/antdv 校验器里是**无行为的**，不能因此判红（否则「required 写在字段键上」
 * 与「required 单列一条规则」两种正确写法只有一种得分）。
 *
 * 再把规则集展开成「运行时**实际执行**的约束集合」：
 *
 * async-validator 的 `getValidationMethod` 按 `rule.type` 分派到**一个**校验器，各校验器
 * 执行的键不同（见 `dist-node/index.js`）：
 *   - 无 type / type:'string' → `string` 校验器：pattern + min/max；
 *   - type:'integer' | 'number' | 'float' → 编号校验器：min/max（**不跑 pattern**）；
 *   - type:'email' | 'url' | 'hex' → 只做类型判断（min/max/pattern 全是死键）。
 * 所以「一条规则写全」与「同 trigger 下拆成多条规则」在运行时等价（约束集合相同），
 * 而 `{pattern, type:'email'}` 合在一条里会**丢掉 pattern** —— 两者不能混为一谈。
 * 按约束集合（而非规则分组）比较，既接受合法的拆分/合并，又咬住 dispatch 造成的死键。
 */
const RANGE_TYPES = new Set(['integer', 'float', 'number'])
const normRules = (f) => {
  const out = new Set()
  for (const r of f?.rules ?? []) {
    const trigger = r?.trigger
    const t = r?.type
    const push = (k, v) => out.add(JSON.stringify(canon({ k, v, trigger })))
    // `type:'string'` 与省略 type 走同一个校验器（getType 缺省 string）—— 运行时等价。
    const isString = t === undefined || t === 'string'
    if (isString || RANGE_TYPES.has(t)) {
      if (r?.min !== undefined) push('min', r.min)
      if (r?.max !== undefined) push('max', r.max)
    }
    if (isString && r?.pattern !== undefined) push('pattern', r.pattern)
    if (t !== undefined && t !== 'string') push('type', t)
  }
  return [...out].sort()
}
const hasNonRequiredRule = (f) => normRules(f).length > 0
const fieldRulesEqual = (g, p) => eq(normRules(g), normRules(p))

/**
 * 远程选项源：`url` 必比；`method` 缺省 `GET`（core 请求默认）等价；`labelField`/`valueField`
 * 只在 gold 显式声明时比（运行时对它们有默认映射，模型省略不算错）。
 */
const apiMethod = (a) => a?.method ?? 'GET'
const fieldApiParamsEqual = (g, p) => {
  const ga = g?.apiParams
  const pa = p?.apiParams
  if (!ga) return !pa
  if (!pa) return false
  if (!eq(ga.url, pa.url) || apiMethod(ga) !== apiMethod(pa)) return false
  for (const k of ['labelField', 'valueField']) {
    if (ga[k] !== undefined && !eq(ga[k], pa[k] ?? null)) return false
  }
  return true
}

/** i18n 标签键：显式覆盖才计分（`i18n:true` 派生的 `field.<prop>` 由 `i18n` 维度覆盖）。 */
const fieldLabelKeyEqual = (g, p) => (g?.labelKey ?? null) === (p?.labelKey ?? null)

const FIELD_SCORERS = {
  formtype: fieldFormtypeEqual,
  fieldRequired: fieldRequiredEqual,
  dataOptions: fieldOptionsPresenceEqual,
  fieldAttrs: fieldAttrTypeEqual,
  fieldLayout: fieldLayoutEqual,
  extPoints: fieldExtPointsEqual,
  isHidden: fieldIsHiddenEqual,
  reactions: fieldReactionsEqual,
  fieldSpan: fieldSpanEqual,
  fieldRules: fieldRulesEqual,
  apiParams: fieldApiParamsEqual,
  labelKey: fieldLabelKeyEqual,
}

/**
 * 字段级 token 的 gold 前置条件：钉 `dim:prop` 时 gold 的该字段**必须真的声明了**该键。
 * 否则语料标注可以把「NL 说了、gold 没写」伪装成被度量（gold-vs-gold 恒真，模型凭空
 * 写对/写错都测不到）。
 */
const FIELD_TOKEN_REQUIRES = {
  formtype: (f) => f?.formtype !== undefined,
  fieldRequired: (f) => f?.required !== undefined,
  dataOptions: (f) => (f?.dataOptions ?? []).length > 0,
  fieldAttrs: (f) => !!f?.attrs && Object.keys(f.attrs).length > 0,
  fieldLayout: hasLayout,
  extPoints: hasExtPoint,
  isHidden: (f) => f?.isHidden !== undefined,
  reactions: (f) => f?.reactions !== undefined,
  fieldSpan: declaresSpan,
  fieldRules: hasNonRequiredRule,
  apiParams: (f) => f?.apiParams !== undefined,
  labelKey: (f) => f?.labelKey !== undefined,
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
  // AI-51：此前只判「声明了 `attrs.type` 的字段」，与 `fieldAttrTypeEqual`（比 gold 声明的
  // **全部** attrs 键）及 `FIELD_TOKEN_REQUIRES.fieldAttrs` 不一致 ⇒ NL 明写的
  // `placeholder`/`maxlength` 在整维口径下无人守望，只有字段级 pin 才测得到。
  for (const f of g?.fields ?? []) {
    if (!f?.attrs || Object.keys(f.attrs).length === 0) continue
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
/** gold 里「声明了某键的字段」逐字段全等（pred 多出的键/字段不罚 —— gold 驱动）。 */
const perDeclaredField = (declares, cmp) => (g, p) => {
  const pm = fieldMap(p)
  for (const f of g?.fields ?? []) {
    if (!declares(f)) continue
    const pf = pm.get(f.prop)
    // 判定器可接收整份 config（`isHidden` 的选项取值归一需要两侧各自的 dataOptions）。
    if (!pf || !cmp(f, pf, g, p)) return false
  }
  return true
}
const isHiddenEqual = perDeclaredField((f) => f?.isHidden !== undefined, fieldIsHiddenEqual)
const reactionsEqual = perDeclaredField((f) => f?.reactions !== undefined, fieldReactionsEqual)
const fieldSpanEqualWhole = perDeclaredField(declaresSpan, fieldSpanEqual)
const fieldRulesEqualWhole = perDeclaredField(hasNonRequiredRule, fieldRulesEqual)
const apiParamsEqual = perDeclaredField((f) => f?.apiParams !== undefined, fieldApiParamsEqual)
const labelKeyEqual = perDeclaredField((f) => f?.labelKey !== undefined, fieldLabelKeyEqual)

/** 普通对象（排除 null / 数组）—— 声明式容器键的判定入口。 */
const isPlainObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/**
 * gold 驱动的对象比较：**gold 声明过的子键**逐键命中，pred 多出的子键不罚。
 *
 * 与 `fieldAttrs` 同一条边界：`tableOptions.editConfig` 的 `enabled` 等键在 Zod 里
 * 是可选旋钮，NL 只说「双击进入、按单元格、显示状态、自动清空」。模型顺手写
 * `enabled: true`（语义默认）与省略在运行时等价；按整对象全等判分会把做对的答案罚掉。
 * 漏写/写错 gold 声明过的子键仍然判红（`defaultSort.prop`、`configTableOut.total` …）。
 */
const objDeclaredEqual = (g, p, leafEq) => {
  if (!isPlainObj(g)) return leafEq(g, p)
  if (!isPlainObj(p)) return false
  return Object.keys(g).every((k) => objDeclaredEqual(g[k], p[k], leafEq))
}

/** CSS 颜色字面量（`#hex` / `rgb(a)` / `hsl(a)`）—— 只有这类值在简写/长写间语义相等。 */
const isColorLiteral = (v) =>
  typeof v === 'string' && /^(?:#[0-9a-f]{3,8}|(?:rgb|hsl)a?\([^)]*\))$/i.test(v.trim())

/**
 * 表头样式对象是**原样作为 CSS style 绑定**的（vue3/antdv `:style`、vue2
 * `header-cell-style`、三端 vxe `headerCellStyle`），组件不做键名映射。于是「纯色背景」
 * 写成简写 `background` 还是长写 `backgroundColor`，渲染结果一致 —— 按字面键名判分
 * 会把做对的答案罚掉（CSS 尺寸 / 有效引擎同族的等价陷阱）。
 *
 * 只在值是**颜色字面量**时归一：`background: 'linear-gradient(...)'`、多值简写等与
 * `backgroundColor` 不等价，仍按字面比较。
 */
const normHeaderCellStyle = (v) => {
  if (!isPlainObj(v)) return v
  if (v.backgroundColor !== undefined) return v
  if (!isColorLiteral(v.background)) return v
  const { background, ...rest } = v
  return { ...rest, backgroundColor: background }
}

const rowButtonNames = (cfg) => (cfg?.rowButtons ?? []).map((b) => b.name).sort().join(',')

/**
 * 行按钮身份 = `name|type`。
 *
 * `key` 刻意**不计分**：它在 `generate_table` 的 Zod 与 `TableRowButton` 里都是可选，
 * NL 从不提它（「详情」「取消（warning）」只说名字与类型），生成器缺省不发射。
 * 计分会让「完全按 NL 写对」的答案因少一个不可推断的标识符判错 —— inQuery 陷阱同构。
 */
const rowButtonKeys = (cfg) =>
  (cfg?.rowButtons ?? []).map((b) => `${b.name}|${b.type ?? ''}`).sort().join(',,,')
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

  // AI-51：独立表格片段的 `fields` **只进 `buildTableColumn(SFC)`**（prop/label/labelKey/
  // width/minWidth/align/fixed/ellipsis/render/formatter/permissionValue），表单专属键
  // （formtype/required/dataOptions/attrs/rules/isHidden/reactions/span/apiParams）在该
  // 产物里**零消费者**：模型写什么，生成的 SFC 都逐字节相同。给它们计分等于测试模型
  // 猜「ID 是 Input 还是 InputNumber」——与 AI-46 的「中文 label→prop 命名彩票」同构，
  // 正是 inQuery 默认陷阱那一类幻影度量。故表格场景**不启用**这些维度（form/dialog
  // 的 fields 进 buildFormItem，照常计分）。对应 pin 由 meta-eval 当场咬。
  const isTable = scene === 'table'

  // ── 三场景共用（表格列真正消费的键）──
  add('propSet', true, propSetEqual)
  add('formtype', !isTable && (gold?.fields ?? []).length > 0, formtypeEqual)
  add('fieldRequired', !isTable && (gold?.fields ?? []).some((f) => f.required !== undefined), fieldRequiredAllEqual)
  add('dataOptions', !isTable && (gold?.fields ?? []).some((f) => (f.dataOptions ?? []).length), dataOptionsEqual)
  // AI-51：适用性判据曾只认 `attrs.type`，而 `fieldAttrsEqual` 实际比较 gold 声明的
  // **全部** attrs 键（`placeholder`/`maxlength` …）。二者不一致会让「无 type 的 attrs」
  // 在整维口径下不适用（full 恒绿），却能被 `fieldAttrs:<prop>` 钉住 —— 同一份 gold
  // 对同一维度给出两种适用性。现与 `FIELD_TOKEN_REQUIRES.fieldAttrs` 对齐。
  add('fieldAttrs', !isTable && (gold?.fields ?? []).some((f) => f?.attrs && Object.keys(f.attrs).length > 0), fieldAttrsEqual)
  add('fieldLayout', (gold?.fields ?? []).some(hasLayout), fieldLayoutEqualWhole)
  add('extPoints', (gold?.fields ?? []).some(hasExtPoint), extPointsEqual)
  // AI-47：此前无度量的声明式字段键（同样只有表单/弹窗体消费）。
  add('isHidden', !isTable && (gold?.fields ?? []).some((f) => f?.isHidden !== undefined), isHiddenEqual)
  add('reactions', !isTable && (gold?.fields ?? []).some((f) => f?.reactions !== undefined), reactionsEqual)
  add('fieldSpan', !isTable && (gold?.fields ?? []).some(declaresSpan), fieldSpanEqualWhole)
  add('fieldRules', !isTable && (gold?.fields ?? []).some(hasNonRequiredRule), fieldRulesEqualWhole)
  add('apiParams', !isTable && (gold?.fields ?? []).some((f) => f?.apiParams !== undefined), apiParamsEqual)
  add('labelKey', (gold?.fields ?? []).some((f) => f?.labelKey !== undefined), labelKeyEqual)
  add('i18n', gold?.i18n === true, (g, p) => (g?.i18n ?? false) === (p?.i18n ?? false))
  add('target', true, (g, p) => normTarget(g) === normTarget(p))

  if (scene === 'table') {
    add('apiUrl', gold?.apiUrl !== undefined, (g, p) => eq(g?.apiUrl ?? null, p?.apiUrl ?? null))
    // 「不接接口、数据手动接入」也是声明式意图（生成器会告警并留 tableData ref）：
    // gold 不声明 apiUrl 时，多写一个接口地址是真实偏差，不能因为「没有维度」而免罚。
    add('noApiUrl', gold?.apiUrl === undefined, (g, p) => p?.apiUrl === undefined)
    add('rowButtons', (gold?.rowButtons ?? []).length > 0, (g, p) => rowButtonKeys(g) === rowButtonKeys(p))
    add('rowButtonNames', (gold?.rowButtons ?? []).length > 0, (g, p) => rowButtonNames(g) === rowButtonNames(p))

    const goldTableOptions = gold?.tableOptions ?? {}
    // `virtual` / `engine` 并入语义维 `tableVirtualMode`（三端消费口径一致），不再逐键计分。
    const VIRTUAL_KEYS = new Set(['virtual', 'engine'])
    // 声明为 `number | string` 且运行时经 core `toCssSize` 归一的高度键。两者是**同一个**
    // 运行时旋钮（`tabHeight` 优先、`height` 仅在 heightType='height' 生效），故都按
    // `effectiveTableHeight` 比较，而不是逐键字面相等。
    const HEIGHT_KEYS = new Set(['height', 'tabHeight'])
    for (const key of Object.keys(goldTableOptions)) {
      if (VIRTUAL_KEYS.has(key)) continue
      const presence = TEXT_PRESENCE_KEYS.has(key)
      add(`tableOptions.${key}`, true, (g, p) => {
        const gv = normTableOptions(g?.tableOptions)[key]
        const pv = normTableOptions(p?.tableOptions)[key]
        if (presence) return hasText(gv) === hasText(pv)
        if (HEIGHT_KEYS.has(key)) return eq(effectiveTableHeight(g), effectiveTableHeight(p))
        // 纯色背景的 CSS 简写/长写渲染等价（见 `normHeaderCellStyle`）。
        if (key === 'headerCellStyle') return objDeclaredEqual(normHeaderCellStyle(gv), normHeaderCellStyle(pv), eq)
        return objDeclaredEqual(gv ?? null, pv ?? null, eq)
      })
    }
    if ('virtual' in goldTableOptions || 'engine' in goldTableOptions) {
      add('tableVirtualMode', true, (g, p) => tableEngine(g) === tableEngine(p))
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
      add(`formLayout.${key}`, true, (g, p) => {
        const gv = g?.formLayout?.[key]
        const pv = p?.formLayout?.[key]
        // labelWidth 契约是 `number | string`，三端运行时归一（vue2 本次补齐）→ 数字与 px 等价。
        return key === 'labelWidth' ? cssEq(gv, pv) : eq(gv ?? null, pv ?? null)
      })
    }
  }

  if (scene === 'dialog') {
    add('apiUrl', gold?.apiUrl !== undefined, (g, p) => eq(g?.apiUrl ?? null, p?.apiUrl ?? null))
    // 无 apiUrl = 「只校验并回调成功」的显式落地（工具契约原文）：多写接口同样判红。
    add('noApiUrl', gold?.apiUrl === undefined, (g, p) => p?.apiUrl === undefined)
    add('rowkey', gold?.rowkey !== undefined, (g, p) => eq(normDialogRowkey(g), normDialogRowkey(p)))
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
      add(`options.${key}`, true, (g, p) => {
        const gv = g?.options?.[key]
        const pv = p?.options?.[key]
        // width / maxHeight 契约都是 `number | string`，三端 es-dialog 按 CSS 尺寸消费 ——
        // `480`、`'480'`、`'480px'` 等价；`'60vh'` 这类带单位串原样比较。
        return key === 'width' || key === 'maxHeight' ? cssEq(gv, pv) : eq(gv ?? null, pv ?? null)
      })
    }
  }

  return specs
}

/** 片段版「硬诚实」维度（无 pinnedDims 时的 scoped 退路；与 CRUD core 的定位一致）。 */
const CORE_DIMS = {
  // AI-51：表格场景的 `formtype`/`fieldRequired` 在独立表格产物里零消费者（见
  // `fragmentDimSpecs`），放进 core 只会被适用性过滤掉 → core 退化成「只剩 propSet」。
  // 换成表格真正消费且 NL 通常明说的列属性：列布局、接口地址、行按钮名。
  table: ['propSet', 'fieldLayout', 'apiUrl', 'rowButtonNames'],
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
  // AI-51：整维不适用 ⇒ 字段级 pin 也非法。否则「表格场景不启用 formtype」这些键仍能
  // 被 `formtype:id` 绕过场景口径计分（`scoreDimension` 的字段分支不查适用性）。
  if (!fragmentDimSpecs(scene, gold).some((s) => s.key === dim && s.applicable)) return false
  if (field !== undefined) {
    if (!FRAGMENT_FIELD_SCORABLE_DIMS.includes(dim)) return false
    const gf = fieldMap(gold).get(field)
    if (!gf) return false
    // AI-47：gold 必须真的声明了该键，否则 token 恒真（标了却没度量）。
    const requires = FIELD_TOKEN_REQUIRES[dim]
    return requires ? !!requires(gf) : true
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
    // 第 3/4 参是整份 config：`isHidden` 的选项取值归一需要两侧各自的 dataOptions。
    return !!g && !!p && !!scorer(g, p, gold, pred)
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
 *   - `exactIntentFull`：所有 applicable 维度都命中（**诊断**口径：含 gold 为运行时
 *     fixture 声明、NL 从未要求的键）；
 *   - `exactIntentCore`：片段版硬诚实四维（见 CORE_DIMS）；
 *   - `exactIntentScoped`：只 AND `mask.pinnedDims`；无 mask 时退化为 core；
 *   - `exactIntentStated`：只 AND `mask.statedDims`（语料自证的「NL/宿主确实说了」）。
 *     这是公平口径 —— gold 驱动保证「说了的」都有维度，stated 保证「没说的」不罚。
 */
export function scoreFragment(scene, gold, pred, mask, opts = {}) {
  if (!['table', 'form', 'dialog'].includes(scene)) {
    throw new Error(`scoreFragment: 未知片段场景 "${scene}"`)
  }
  // Ruler v3 / R2：与 CRUD 同源 —— 先按 label 身份把 pred 的字段命名空间重写成 gold 的，
  // 再走既有判定（`fieldMap`/`sharedFields`/`columns`/`defaultSort.prop` 全部经这一份 pred）。
  // 片段语料没有 en 腿（无 `nlEn`），故默认 label 身份；`opts.identity` 留给离线复算。
  const { pred: alignedPred } = normalizePredForCompare(gold, pred, opts)
  const specs = fragmentDimSpecs(scene, gold)
  const byDim = {}
  for (const s of specs) {
    byDim[s.key] = s.applicable
      ? { applicable: true, pass: !!s.pass(gold, alignedPred) }
      : { applicable: false, pass: null }
  }

  const exactIntentFull = Object.values(byDim).every((c) => (c.applicable ? c.pass : true))
  const exactIntentCore = CORE_DIMS[scene]
    .map((k) => byDim[k])
    .filter((c) => c && c.applicable)
    .every((c) => c.pass)

  const pinned = mask && Array.isArray(mask.pinnedDims) ? mask.pinnedDims : []
  const exactIntentScoped = pinned.length
    ? pinned.every((t) => scoreDimension(scene, gold, alignedPred, t))
    : exactIntentCore

  const stated = mask && Array.isArray(mask.statedDims) ? mask.statedDims : []
  const exactIntentStated = stated.length
    ? stated.every((t) => scoreDimension(scene, gold, alignedPred, t))
    : exactIntentCore

  return {
    byDim,
    exactIntentCore,
    exactIntentFull,
    exactIntentScoped,
    exactIntentStated,
    // 观测量（不进门禁）：命名能力与「懂不懂 NL」解耦 —— 与 CRUD scoreAll 同源。
    propNameMatch: propNameMatch(gold, pred, opts),
  }
}

/**
 * 供诊断输出：某个 dyn 维度「期望 vs 实得」。其余维度的差异已由 byDim.pass 表达。
 * 键名统一用 dot path（`tableOptions.height`），与 byDim 对齐。
 */
export function describeFragmentDimMiss(dim, gold, pred, opts = {}) {
  // 与 scoreFragment 同源：诊断必须看对齐后的 pred，否则判正了却打出两边不同的 prop。
  pred = normalizePredForCompare(gold, pred, opts).pred
  const parts = dim.split('.')
  if (parts.length !== 2) return null
  const [scope, key] = parts
  const read = (cfg) => {
    if (scope === 'tableOptions') {
      // height / tabHeight 是同一个运行时旋钮（见 effectiveTableHeight）：诊断里也显示
      // 有效高度，否则「gold 写 tabHeight、pred 写 height」会显示成两个不同的键值。
      if (key === 'height' || key === 'tabHeight') return effectiveTableHeight(cfg)
      return normTableOptions(cfg?.tableOptions)[key]
    }
    if (scope === 'pagination') return key === 'pageSize' ? normPageSize(cfg?.pagination) : cfg?.pagination?.[key]
    if (scope === 'formLayout') return cfg?.formLayout?.[key]
    if (scope === 'options') return cfg?.options?.[key]
    return undefined
  }
  // null（有效高度不存在）与 undefined（未设置）都按「未设置」显示 —— 否则诊断里
  // maxHeight 下的死键 `height` 会显示成字符串 "null"。
  const show = (v) => (v == null ? '(未设置)' : JSON.stringify(v))
  return { want: show(read(gold)), got: show(read(pred)) }
}
