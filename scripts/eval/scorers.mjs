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
 *
 * 字段身份（Ruler v3 / R2，2026-10-23 拍板）：默认按**归一化 label** 对齐后再判等，
 * 见 `scripts/eval/align.mjs`。`prop` 降为观测量（`propNameMatch`）。en 腿用
 * `scoreAll(..., { identity: 'prop' })` —— 标签是「中文 gold vs 英文 pred」，不可比。
 */
import { normalizePredForCompare, propNameMatch } from './align.mjs'

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

function cloneDeep(v) {
  if (Array.isArray(v)) return v.map(cloneDeep)
  if (v && typeof v === 'object') {
    const out = {}
    for (const k of Object.keys(v)) out[k] = cloneDeep(v[k])
    return out
  }
  return v
}

// ── 条件 DSL 规范化（`isHidden` 的两套合法写法 → 一个范式）─────────────────────
//
// schema 对 `isHidden` 明确接受两套写法（`structured-config.schema.ts` 的 field.isHidden 说明）：
//   (1) 旧条件 `{ field, op, value }`，op ∈ eq|ne|in|nIn|empty|notEmpty|truthy|falsy；
//   (2) JSONLogic 形态表达式节点 `{ '==': [{ var:'x' }, 1] }`；
//   外加「条件数组 = AND，可与两种写法混用」。
// 换句话说，**同一个需求有多个都对的写法**。按原文深比较等于把「选了另一种合法写法」
// 算成理解失败 —— C 阶段 dump 里 115（`nin[a,b]` vs `!=a 且 !=b`）、121（数组 AND vs `{and}`）
// 两行就是这么被判负的，而两条 NL 都是被正确理解的。
//
// 范式（只做**等价变形**，不放宽任何语义）：
//   · 旧条件 → 表达式节点（`eq`→`==`、`ne`→`!=`、`nIn`→`nin`…）；单目算子只取操作数；
//   · 数组 → `{and:[…]}`；单元素 AND/OR 折回元素本身；嵌套 and/or 展平；
//   · `in`/`nin` 的字面量数组展开为 `or`/`and` 的 `==`/`!=`（`nin[x,[a,b]]` ≡ `!=a 且 !=b`）。
// 刻意**不**做：操作数排序（AND 虽可交换，但接受任意顺序会把「顺序写反」也放掉，
// 而现在没有任何证据表明模型会这么做——不放宽没有证据支持的东西）。
const LEGACY_OP_TO_EXPR = Object.freeze({
  eq: '==',
  ne: '!=',
  in: 'in',
  nIn: 'nin',
  empty: 'empty',
  notEmpty: 'notEmpty',
  truthy: 'truthy',
  falsy: 'falsy',
})
const UNARY_COND_OPS = new Set(['var', 'empty', 'notEmpty', 'truthy', 'falsy'])
const CONJUNCTION_OPS = new Set(['and', 'or'])

/** 旧条件形态：含字符串 `field`，其余键 ⊆ {field, op, value}。 */
const isLegacyCondition = (n) =>
  n &&
  typeof n === 'object' &&
  !Array.isArray(n) &&
  typeof n.field === 'string' &&
  Object.keys(n).every((k) => k === 'field' || k === 'op' || k === 'value')

const legacyToExpr = (n) => {
  const op = LEGACY_OP_TO_EXPR[n.op ?? 'eq']
  if (!op) return n // 未知算子：原样交给判负（不在尺子里发明语义）
  return UNARY_COND_OPS.has(op) ? { [op]: [{ var: n.field }] } : { [op]: [{ var: n.field }, n.value] }
}

/** 合取/析取的规范形：展平同类嵌套；单元素折回元素本身。 */
const combineFlat = (op, list) => {
  const flat = []
  for (const n of list) {
    const isSameOp = n && typeof n === 'object' && !Array.isArray(n) && Object.keys(n).length === 1 && n[op]
    if (isSameOp) flat.push(...n[op])
    else flat.push(n)
  }
  return flat.length === 1 ? flat[0] : { [op]: flat }
}

/** `canonCondition` 的纯表达式分支（数组在这里是**字面量数组**，不是 AND）。 */
function canonExpr(node) {
  if (Array.isArray(node)) return node.map(canonExpr)
  if (!node || typeof node !== 'object') return node
  if (isLegacyCondition(node)) return canonExpr(legacyToExpr(node))
  const keys = Object.keys(node)
  if (keys.length !== 1) {
    const out = {}
    for (const k of keys) out[k] = canonExpr(node[k])
    return out
  }
  const op = keys[0]
  if (op === 'var') return { var: node.var } // `{var}` 的取值是字符串（可含 `a.b` 路径），不是操作数数组
  const operands = Array.isArray(node[op]) ? node[op] : [node[op]]
  if (CONJUNCTION_OPS.has(op)) return combineFlat(op, operands.map(canonCondition))
  const args = operands.map(canonExpr)
  // `in`/`nin` 的右操作数字面量数组 → 展开成 ==/!= 的 or/and（等价，且是与「手写两条 !=」对齐的唯一办法）
  if ((op === 'in' || op === 'nin') && args.length === 2 && Array.isArray(args[1])) {
    const [subject, list] = args
    return combineFlat(op === 'in' ? 'or' : 'and', list.map((v) => ({ [op === 'in' ? '==' : '!=']: [subject, v] })))
  }
  return { [op]: args }
}

/**
 * 条件位置的规范化（根 / 条件数组元素 / and·or 的操作数）。
 * 这里数组语义是 **AND**（schema：条件数组全部成立才隐藏）。
 */
export function canonCondition(node) {
  if (Array.isArray(node)) return combineFlat('and', node.map(canonCondition))
  if (isLegacyCondition(node)) return canonCondition(legacyToExpr(node))
  return canonExpr(node)
}

// ── 条件字面量的身份（2026-10-29）─────────────────────────────────────────────
//
// 问题的形态与 AN-01（dataOptions）、`editRender.options/defaultValue`（2026-10-29）**完全同构**：
// 条件的右操作数是**某个字段的选项值**（`{ field: 'contractType', op: 'ne', value: 'framework' }`），
// 而 value 是后端数据模型的约定，NL 只给标签（「框架/普通」）。那三处早已改成按标签比，
// 条件 DSL 却还把码值字面比较 —— 模型写 `frame`、gold 写 `framework`（两边标签都是「框架」）
// 被判成「不理解需求」。2026-10-29 的 dump 里 112 / 39 / 46 / 134 / 42 五行全是这一种。
//
// 判据（与 dataOptions 同一条）：字面量先按**本侧自己的** dataOptions 解析成标签再比；
// 解析不到就保持原样（不是选项的裸值照常严格比较，`scorers.test.mjs` 钉住）。
//
// 布尔字段的 `truthy`/`falsy` 与 `== true`/`== false` 归一到 `==`：值的全集只有 true/false，
// 语义完全相同（116 gold=truthy/pred==true、117 反之）。**非布尔字段不归一** —— 那里
// `falsy` 还含 0/''/null，把 `== false` 当成等值是真正的误绿。

/** 某个 config 的条件比较上下文：字段 prop → (value→标签) / 标签集 / 是否布尔字段。 */
function conditionContext(config) {
  const labels = new Map()
  const labelSet = new Map()
  const bools = new Set()
  for (const f of config?.fields ?? []) {
    const opts = f.dataOptions ?? []
    if (opts.length) {
      const byValue = new Map()
      const set = new Set()
      for (const o of flatOptions(opts)) {
        if (o.label === undefined) continue
        byValue.set(String(o.value), o.label)
        set.add(String(o.label))
      }
      if (byValue.size) {
        labels.set(f.prop, byValue)
        labelSet.set(f.prop, set)
      }
      const vals = optionValues(opts)
      if (vals.length && vals.every((v) => v === true || v === false)) bools.add(f.prop)
    }
    if (f.formtype === 'Switch') bools.add(f.prop)
  }
  return { labels, labelSet, bools }
}

/** 字面量 → 标签身份；不是该字段的选项值/标签则返回 null（保持原样参与比较）。 */
function labelLiteral(lit, ctx, field) {
  if (typeof lit !== 'string' && typeof lit !== 'number') return null
  const byValue = ctx.labels.get(field)
  if (!byValue) return null
  const key = String(lit)
  if (byValue.has(key)) return { label: byValue.get(key) }
  // 模型直接写了标签（`value: '框架'`）：同样是「指向这个选项」，一并归一。
  if (ctx.labelSet.get(field)?.has(key)) return { label: key }
  return null
}

/**
 * 两侧**都**声明了 dataOptions 的字段。只有这些字段的字面量才归一成标签身份 ——
 * 与装饰键「任一侧没写就不比较」同一条纪律：若只有一侧有选项表，另一侧的字面量就是
 * 裸码（模型无从知道该字段承载选项），此时把一侧映射成标签、另一侧保持裸值，
 * 比较就变成**必然不等**，等于凭空判负。两侧都没有/只有一侧有时，照旧字面比较。
 *
 * 136 就是这个形状：gold 的 `region` 是纯 Input（值来自 province 的 `zj`/`gd`），
 * 模型给 region 声明了 华东/华南 选项并在条件里写码值 —— 两侧的码值域根本不同，
 * 该判的是「级联设计错了」，不是「码值写法不同」。
 */
function sharedOptionFields(gc, pc) {
  const out = new Set()
  for (const prop of gc.labels.keys()) if (pc.labels.has(prop)) out.add(prop)
  return out
}

/** 一次算出两侧上下文 + 可归一的共享字段集（所有比较点共用，避免各自算错）。 */
function conditionPair(gold, pred) {
  const g = conditionContext(gold)
  const p = conditionContext(pred)
  return { g, p, shared: sharedOptionFields(g, p) }
}

/** 已规范化的条件树再走一遍：布尔字段 truthy/falsy → `==`，右字面量 → 标签身份。 */
function conditionRewrite(node, ctx, shared) {
  if (Array.isArray(node)) return node.map((n) => conditionRewrite(n, ctx, shared))
  if (!node || typeof node !== 'object') return node
  const keys = Object.keys(node)
  if (keys.length !== 1) {
    const out = {}
    for (const k of keys) out[k] = conditionRewrite(node[k], ctx, shared)
    return out
  }
  const op = keys[0]
  if (op === 'var') return { var: node.var }
  const args = Array.isArray(node[op]) ? node[op] : [node[op]]
  const subject = args[0]
  const field =
    subject && typeof subject === 'object' && !Array.isArray(subject) && typeof subject.var === 'string'
      ? subject.var
      : null
  if (field !== null && (op === 'truthy' || op === 'falsy') && args.length === 1 && ctx.bools.has(field)) {
    return { '==': [{ var: field }, op === 'truthy'] }
  }
  return {
    [op]: args.map((a, i) => {
      if (i === 0 || field === null || !shared.has(field)) return conditionRewrite(a, ctx, shared)
      return labelLiteral(a, ctx, field) ?? conditionRewrite(a, ctx, shared)
    }),
  }
}

/**
 * 条件比较的**唯一**视图：规范化（`canonCondition`）+ 字面量身份（本函数）。
 * 四类判据（isHiddenEqual / FIELD_SCORERS.isHidden / reactionsView / describeDimMiss）共用它。
 * `shared` 为两侧都有选项表的字段集（默认空 ⟹ 只做规范化，不做身份归一）。
 */
export function conditionView(node, ctx, shared = new Set()) {
  return conditionRewrite(canonCondition(node), ctx, shared)
}

// ── 装饰键投影（A2 / D15）─────────────────────────────────────────────────────
//
// 问题：`columns` / `expandConfig` 是**整体深等值**判定，而这两处承载了大量
// 「NL 没写、作者自选」的常量（列宽 100/120/180、`fixed`、`align`、展开区标题串）。
// 模型再完美也推不出 `width: 120` ⟹ 这些行在现有尺子下恒不可过（heldout 32 行，
// 把门禁上限定死在 83.5%，实证见 docs/internal/ai-95-gap-review-2026-10-27.md §9 D15）。
//
// 规则（`gold 有而 pred 无 ⟹ 不判负；两边都有 ⟹ 比值`，并**对称**到 `pred 有而 gold 无`）：
// 同一位置的装饰键，只要**任一侧没写**，两侧都不参与比较；两侧都写了就照常深比较
// （写错仍然判负）。这样「猜不到」不再等于「做错」，而「写错」照样扣分。
//
// 分类判据：**只影响布局呈现、NL 极少陈述**的键算装饰。`permissionValue`（无权限不出列）、
// `dataOptions`（码值→文案映射）、`btns`（行内按钮）、`editRender.name/type/options/props/
// defaultValue`（编辑器语义）都是行为契约，**不投影**。
// `ellipsis` / `showOverflowTooltip` 今天在语料里 0 处，暂列结构键（保守：宁可暂严，不可误绿），
// 将来若出现「超出省略」类语料再议；`scorers.test.mjs` 的列键白名单会强制为新键做分类。
//
// 第三种分类 `unmeasured`：**两侧都会写、但 NL 从不陈述**的键（当前只有 expandConfig.title）。
// 装饰键的豁免条件是「任一侧没写」，对这类键不成立 —— 两侧都写，于是永远被比值。
// 它们无条件不参与比较，理由见 projectExpandNode 上方注释。
/**
 * 键分类表 —— 投影规则与 meta-eval 白名单的**同一个源**。
 * 语料里出现表外的键 ⟹ `scorers.test.mjs` 直接红，逼开发者先做分类（结构/装饰），
 * 防止「新装饰键悄悄把一个维度钉成不可过」（D15 的成因正是没有人给 `width` 分类）。
 */
export const COLUMN_KEY_CLASS = Object.freeze({
  prop: 'structural',
  label: 'structural',
  labelKey: 'structural',
  type: 'structural',
  permissionValue: 'structural',
  dataOptions: 'structural',
  groups: 'structural',
  btns: 'structural',
  editRender: 'structural',
  expandConfig: 'structural',
  ellipsis: 'structural',
  showOverflowTooltip: 'structural',
  width: 'decoration',
  minWidth: 'decoration',
  align: 'decoration',
  fixed: 'decoration',
  sortable: 'decoration',
})
export const EDIT_RENDER_KEY_CLASS = Object.freeze({
  name: 'structural',
  type: 'structural',
  options: 'structural',
  props: 'structural',
  defaultValue: 'structural',
  autofocus: 'decoration',
})
// `title` 是**不可测量键**（第三种分类，见下方 projectExpandNode 的说明）：
// 它是散文标题，NL 从不陈述，而两侧又总会各自写一个 —— 投影规则「任一侧没写才豁免」
// 对它永不触发。实测 2026-10-27 全量 dump 里 expandConfig 维度 9 条失败**全部**只差 title。
export const EXPAND_KEY_CLASS = Object.freeze({ fields: 'structural', title: 'unmeasured' })

const keysOf = (m, cls) => Object.keys(m).filter((k) => m[k] === cls)
const COLUMN_DECORATION_KEYS = keysOf(COLUMN_KEY_CLASS, 'decoration')
const EDIT_RENDER_DECORATION_KEYS = keysOf(EDIT_RENDER_KEY_CLASS, 'decoration')
const EXPAND_DECORATION_KEYS = keysOf(EXPAND_KEY_CLASS, 'decoration')
const EXPAND_UNMEASURED_KEYS = keysOf(EXPAND_KEY_CLASS, 'unmeasured')

const dropIfEitherSideMissing = (a, b, keys) => {
  for (const k of keys) {
    if (!(k in a) || !(k in b)) {
      delete a[k]
      delete b[k]
    }
  }
}

// 展开区节点。两类键两种处理：
//   - `fields` 结构键，照常深等值（顺序、label 都是渲染契约）；
//   - `title` **不可测量**：它是散文标题，NL 从不陈述（全语料 1 条含「标题」二字的用例
//     指的是表格列「工单标题」，不是展开区标题）。装饰键的「任一侧没写才豁免」对它无效——
//     两侧总会各写一个标题，于是每次都被比值，把 9 行钉成不可过。
//     所以这里**无条件**从两侧删除：模型不可能「写错」一个 NL 没说的串。
//     代价是这行不再测量标题；若将来真有语料陈述标题（如「展开区标题写处理信息」），
//     `scorers.test.mjs` 的语料扫描会红，那时再把它升回 structural 并走正式口径。
const projectExpandNode = (g, p) => {
  if (!g || !p || typeof g !== 'object' || typeof p !== 'object') return
  for (const k of EXPAND_UNMEASURED_KEYS) {
    delete g[k]
    delete p[k]
  }
  dropIfEitherSideMissing(g, p, EXPAND_DECORATION_KEYS)
}

/**
 * 编辑器选项的投影：`options` 按**标签树 + 数量 + 唯一性**比（value 是后端约定，
 * NL 只给标签），`defaultValue` 先按各自的 options 解析回标签再比。
 *
 * 为什么必须同规：`$select` 的 `options` 与字段级 `dataOptions` 是同一件事的两种落点
 * （一个给单元格编辑器、一个给表单下拉），`value` 的猜中率完全一样。原文对 `dataOptions`
 * 早已改按标签树比（AN-01），却把 `editRender.options` 留在整数组深等值 ——
 * 2026-10-27 的 dump 里 106 就是这么被判负的：模型写 `mid`，gold 写 `medium`，
 * 两边的标签都是「中」。`defaultValue` 同理，它指向的是**选项**，不是 value 字面量。
 */
const editRenderOptionView = (opts) => {
  const vals = optionValues(opts)
  return {
    labels: optionLabelTree(opts),
    count: vals.length,
    unique: new Set(vals.map(String)).size === vals.length,
  }
}
const editRenderDefaultView = (er) => {
  if (er.defaultValue === undefined || !Array.isArray(er.options)) return er.defaultValue
  const hit = flatOptions(er.options).find((o) => String(o.value) === String(er.defaultValue))
  // 命中选项 ⟹ 用标签代表（value 不可推断）；否则保持原值（可能本就是字面量默认值）。
  return hit ? { label: hit.label } : er.defaultValue
}
const projectEditRender = (g, p) => {
  // 先解析 defaultValue（依赖原始 options），再替换 options 视图。
  const gd = editRenderDefaultView(g)
  const pd = editRenderDefaultView(p)
  if (Array.isArray(g.options)) g.options = editRenderOptionView(g.options)
  if (Array.isArray(p.options)) p.options = editRenderOptionView(p.options)
  if (gd !== undefined) g.defaultValue = gd
  if (pd !== undefined) p.defaultValue = pd
}

const projectColumnNode = (g, p) => {
  if (!g || !p || typeof g !== 'object' || typeof p !== 'object') return
  dropIfEitherSideMissing(g, p, COLUMN_DECORATION_KEYS)
  if (g.editRender && p.editRender) {
    dropIfEitherSideMissing(g.editRender, p.editRender, EDIT_RENDER_DECORATION_KEYS)
    projectEditRender(g.editRender, p.editRender)
  }
  if (g.expandConfig && p.expandConfig) projectExpandNode(g.expandConfig, p.expandConfig)
  // groups 递归：只有两侧元素个数一致时才逐位投影；个数不同是结构差异，原样交给深等值判负。
  if (Array.isArray(g.groups) && Array.isArray(p.groups) && g.groups.length === p.groups.length) {
    for (let i = 0; i < g.groups.length; i++) projectColumnNode(g.groups[i], p.groups[i])
  }
}

/** columns 数组的投影副本（不改入参）。长度不一致时原样返回，交由深等值判负。 */
export function projectColumns(gold, pred) {
  if (!Array.isArray(gold) || !Array.isArray(pred) || gold.length !== pred.length) return { gold, pred }
  const g = cloneDeep(gold)
  const p = cloneDeep(pred)
  for (let i = 0; i < g.length; i++) projectColumnNode(g[i], p[i])
  return { gold: g, pred: p }
}

// ── columns：省略即派生 + 展开列位置不测量 ────────────────────────────────────
//
// 两处「模型选了另一种合法写法」被原文判负，都写在 schema / prompt 里，不是模型错：
//
// 1. **省略 columns 就是派生列**。schema 原文：`Omit to keep the derived
//    one-field-one-column behavior.` 生成器 `buildTableColumn` 把 `inTable !== false`
//    的字段逐个变成列（label/labelKey、width/align/fixed、ellipsis、permissionValue、
//    dataOptions）。于是「gold 写 columns、pred 省略」与「两侧都写」是同一张表 ——
//    原文按「数组 vs null」判负，把 61 钉成不可过。
//
// 2. **展开列的位置不是契约**。schema 与 prompt 都写明：有顶层 `expandConfig` 而没有
//    `{type:'expand'}` 列时，生成器会**前置**注入一列（`you do NOT need to add the
//    expander column yourself`）；显式声明时位置由作者自选（64/74 的 gold 就放在末列）。
//    ⟹ 展开列**在不在**是契约，**排第几**不是（非数据的前置列本身还受引擎
//    `LEADING_COLUMN_ORDER` = 选择→序号→展开 约束，作者并不能任意摆）。
//
// 派生只复刻 `buildTableColumn` 的**结构键**；装饰键（width/minWidth/align/fixed）照样
// 带出但投影阶段本来就单侧豁免，带出来只为「两侧都写」时仍比值。
const LEADING_FLAGS = [
  ['selection', 'multiSelect'],
  ['index', 'snIndex'],
  ['expand', 'expand'],
]

function derivedColumnOf(field, i18n) {
  const col = { prop: field.prop }
  if (field.labelKey) col.labelKey = field.labelKey
  else if (i18n) col.labelKey = `field.${field.prop}`
  else col.label = field.label
  for (const k of ['width', 'minWidth', 'align', 'fixed']) if (field[k] !== undefined) col[k] = field[k]
  // AN-10：契约键是 `ellipsis`；`showOverflowTooltip` 只是存量写法，派生路径不发。
  if (field.ellipsis) col.ellipsis = true
  if (field.permissionValue) col.permissionValue = field.permissionValue
  if (Array.isArray(field.dataOptions) && field.dataOptions.length) col.dataOptions = field.dataOptions
  return col
}

/**
 * 某一侧的**有效列数组**（与生成器同源）：
 *   - 声明了非空 `columns` ⟹ 它就是整表列（override 非 merge）；
 *   - 省略 ⟹ 按 `inTable !== false` 派生，再按 `LEADING_COLUMN_ORDER` 前置缺的非数据列。
 * 顶层 `expandConfig` 存在而列里没有展开列时，生成器无论走哪条路都会补一列。
 */
export function resolveColumns(config) {
  const cfg = config ?? {}
  const cols = Array.isArray(cfg.columns) && cfg.columns.length
    ? cloneDeep(cfg.columns)
    : (cfg.fields ?? []).filter((f) => f.inTable !== false).map((f) => derivedColumnOf(f, cfg.i18n === true))
  const declared = new Set(cols.filter((c) => c && LEADING_FLAGS.some(([t]) => t === c.type)).map((c) => c.type))
  const opts = cfg.tableOptions ?? {}
  const leading = []
  for (const [type, flag] of LEADING_FLAGS) {
    if (opts[flag] !== true || declared.has(type)) continue
    leading.push({ type })
  }
  const out = [...leading, ...cols]
  if (cfg.expandConfig && !out.some((c) => c && c.type === 'expand')) out.unshift({ type: 'expand' })
  return out
}

/**
 * 顶层 `treeConfig`（跨端窄子集）的投影：**省略即默认值** + 别名归一。
 *
 * schema 明写 `childrenField` 默认 `'children'`、`expandAll` 默认 `false`，运行时还把
 * 弃用别名 `children` 归一成 `childrenField`。于是 `{}`、`{childrenField:'children'}` 与
 * `{children:'children'}` 是**同一份配置**，原文深比较把它们判成不同写法
 * （2026-10-27 的 89：NL 就是「子文档放在默认的 children 字段里」，模型写 `{}` 被判负）。
 * 其余键（vxe 那张宽表里的 transform/rowField/…）原样保留、照常深比较。
 */
export function projectTreeConfig(conf) {
  if (!conf || typeof conf !== 'object') return conf ?? null
  const out = { ...conf }
  const childrenField = out.childrenField ?? out.children ?? 'children'
  delete out.children
  out.childrenField = childrenField
  if (out.expandAll === undefined) out.expandAll = false
  return out
}

const splitExpandColumn = (cols) => {
  const rest = []
  let expand = null
  for (const c of cols ?? []) {
    if (c && c.type === 'expand') {
      if (!expand) expand = c
      continue // 重复的展开列没有信息量：一处声明即可
    }
    rest.push(c)
  }
  return { rest, expand }
}

/**
 * `columns` 维度的**唯一判定视图**：`{columns: 投影后的数据列, expand: 投影后的展开列|null}`。
 * pass 与 `describeDimMiss` 都取它 —— `want === got` 当且仅当该维度 pass。
 */
export function projectColumnSet(gold, pred) {
  const gs = splitExpandColumn(resolveColumns(gold))
  const ps = splitExpandColumn(resolveColumns(pred))
  const arrow = projectColumns(gs.rest, ps.rest)
  if (gs.expand && ps.expand) projectColumnNode(gs.expand, ps.expand)
  return {
    gold: { columns: arrow.gold, expand: gs.expand ?? null },
    pred: { columns: arrow.pred, expand: ps.expand ?? null },
  }
}

/** expandConfig 的投影副本（不改入参）。只有一侧声明时原样返回，交由深等值判负。 */
export function projectExpandConfig(gold, pred) {
  if (!gold || !pred || typeof gold !== 'object' || typeof pred !== 'object') return { gold, pred }
  const g = cloneDeep(gold)
  const p = cloneDeep(pred)
  projectExpandNode(g, p)
  return { gold: g, pred: p }
}

// ── editConfig：省略即默认值 + 展示开关不测量（A2 的同族问题）────────────────
//
// 两层公平问题，都是「模型与 gold 都对，写法不同」：
//   1. **省略即默认**。schema 与系统 prompt 都写明 `trigger` 缺省 `click`、`mode` 缺省 `cell`，
//      vxe 的 `isEnableConf(conf)` 是 `conf && conf.enabled !== false` ⟹ `enabled` 缺省为真。
//      于是 gold `{mode:'cell'}` 与 pred `{trigger:'click',mode:'cell'}` 是**同一份配置**，
//      原文深比较却判负（不是模型写错，是它把默认值写了出来）。
//      这与 `inQuery` 默认 `true` 的陷阱同构 —— 都是「省略」与「显式默认值」被当成不同东西。
//   2. **展示开关不该被测量**。`showStatus/showUpdateStatus/showInsertStatus/autoClear` 只控制
//      vxe 的状态标记与重编辑时清值，NL 从不陈述（C 阶段 102 行 gold 写了 `showStatus:true`，
//      NL 一个字没提）⟹ 按装饰键处理：任一侧没写就不比。
//
// 判据表与投影单一源；`scorers.test.mjs` 的键白名单会强制为新键做分类。
export const EDIT_CONFIG_KEY_CLASS = Object.freeze({
  trigger: 'structural',
  mode: 'structural',
  enabled: 'structural',
  showStatus: 'decoration',
  showUpdateStatus: 'decoration',
  showInsertStatus: 'decoration',
  autoClear: 'decoration',
})
const EDIT_CONFIG_DEFAULTS = Object.freeze({ trigger: 'click', mode: 'cell', enabled: true })
const EDIT_CONFIG_DECORATION_KEYS = keysOf(EDIT_CONFIG_KEY_CLASS, 'decoration')

/** editConfig 的投影副本（不改入参）：两侧都填默认值，再按装饰键规则豁免。 */
export function projectEditConfig(gold, pred) {
  const fill = (c) => {
    if (!c || typeof c !== 'object' || Array.isArray(c)) return c ?? null
    const out = { ...c }
    for (const [k, v] of Object.entries(EDIT_CONFIG_DEFAULTS)) if (out[k] === undefined) out[k] = v
    return out
  }
  const g = fill(gold)
  const p = fill(pred)
  if (g && p) dropIfEitherSideMissing(g, p, EDIT_CONFIG_DECORATION_KEYS)
  return { gold: g, pred: p }
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

/**
 * 为什么空交集必须判负（AN-01 修正）
 *
 * `[].every(...)` 恒为 true。旧写法让「模型把 prop 全写错 / 一个都没对上」的行在
 * formtype / membership 两个维度上白拿 pass —— 维度率被系统性抬高，且与 propSet 的
 * 判定自相矛盾（同一行 propSet 已经判负）。这不是保守宽松，是**真空真**。
 * 维度仍然 applicable（gold 确实用了它），只是这一行**一个都没命中** = 未命中。
 */
function formtypeEqual(gold, pred) {
  const shared = sharedFields(gold, pred)
  return shared.length > 0 && shared.every(({ g, p }) => g.formtype === p.formtype)
}

function membershipEqual(gold, pred) {
  const shared = sharedFields(gold, pred)
  return (
    shared.length > 0 &&
    shared.every(({ g, p }) => g.inQuery === p.inQuery && g.inTable === p.inTable && g.inForm === p.inForm)
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

/**
 * AI-27 收进 AI 契约、并逐键转发到弹窗的**底座数据键**（`dialogsEqual` 只比这批）。
 * 见 `dialogsEqual` 头注：前 AI-27 时代的 `width`/`isDraggable`/… 刻意不在列。
 */
const DIALOG_BASE_KEYS = [
  'showClose', 'destroyOnClose', 'modal', 'closeOnClickModal',
  'closeOnPressEscape', 'hiddenFullBtn', 'appendTo', 'cacheKey',
]

/**
 * 声明式底栏按钮的可比投影：`name|type|action|permissionValue`。
 * 不比 `click` —— 它是函数值，AI 契约里根本不存在（运行时按 `action` 现场装配），
 */
function normDialogBtns(btns) {
  return (btns ?? [])
    .map((b) => `${b?.name ?? ''}|${b?.type ?? ''}|${b?.action ?? ''}|${b?.permissionValue ?? ''}`)
    .join(',,')
}

/**
 * dialog key 是**作者自选的标识符**，不是 NL 能推断的内容 —— 与字段 `prop` 同理，
 * 身份应该由「谁打开它」决定：同一个按钮（按 `name`）在 gold 指向 `detail`、在 pred 指向
 * `view`，是**同一个弹窗**（191 就是这么被判负的）。这里把这层身份对齐补上。
 *
 * 三个来源的按钮都算：
 *   - `toolbarBtns` / `tableBtns` / `operationColumn.btns` 的 `{name, dialogKey}`；
 *   - 从 `actions` **派生**的内置行/表头按钮（add/edit/view）—— 它们的 dialogKey 就是动作键。
 *
 * 只在「双向都不冲突」时重映射：pred 的键若在 gold 里已被占用、或 gold 的键在 pred 里已存在，
 * 说明不是同一件事，宁可不动（把猜测失败留给判定去判负）。
 */
function dialogKeyByButtonName(config) {
  const m = new Map()
  const btns = [
    ...(config?.toolbarBtns ?? []),
    ...(config?.tableBtns ?? []),
    ...(config?.operationColumn?.btns ?? []),
  ]
  for (const b of btns) {
    if (!b || typeof b.name !== 'string') continue
    const key = typeof b.dialogKey === 'string' ? b.dialogKey : b.name
    if (!m.has(b.name)) m.set(b.name, key)
  }
  return m
}

const DERIVED_DIALOG_KEYS = new Set(['add', 'edit', 'view'])

/**
 * pred 的 dialogs 在 gold 命名空间下的**有效视图**：
 *   1. 按按钮名重映射 pred 自选的 dialog key（见上）；
 *   2. gold 声明了 add/edit/view 而 pred 没声明 ⟹ 视为**派生弹窗**（省略即默认值：
 *      `dialogs` 只提供「这个弹窗自己的底座/表单项」，不声明就等于用派生出来的那份）。
 *      派生弹窗的表单项 = pred 的 `inForm !== false` 字段，无底座键、无声明式底栏。
 */
function predDialogsView(gold, pred) {
  const gd = gold.dialogs ?? {}
  const gKeys = new Set(Object.keys(gd))
  const pRaw = pred.dialogs ?? {}
  const pKeys = new Set(Object.keys(pRaw))
  const remap = new Map()
  const gNames = dialogKeyByButtonName(gold)
  const pNames = dialogKeyByButtonName(pred)
  for (const [name, gKey] of gNames) {
    const pKey = pNames.get(name)
    if (pKey === undefined || pKey === gKey) continue
    if (gKeys.has(pKey) || pKeys.has(gKey)) continue
    remap.set(pKey, gKey)
  }
  const out = {}
  for (const [k, v] of Object.entries(pRaw)) out[remap.get(k) ?? k] = v
  for (const k of gKeys) {
    if (out[k] !== undefined) continue
    if (!DERIVED_DIALOG_KEYS.has(k)) continue
    out[k] = { formItems: (pred.fields ?? []).filter((f) => f.inForm !== false).map((f) => ({ prop: f.prop })) }
  }
  return out
}

/**
 * 每个 gold 声明的 dialog：formItems prop 集合相等 ∧ **AI-27 的底座数据键/声明式底栏**相等。
 *
 * 为什么把底座键并进本维度而不是新开一个维度：新维度会改 applicable 分母与 `byDimension`
 * 基线键（须等一次夜间跑批才能重定基线，本地无法验证），而 AI-27 收的这批键**语义上就是
 * 「这个 dialog 配置对了没有」的一部分** —— 同一个 `dialogs` 意图，两半判据。故并进来：
 * 分母不变、既有基线键不变、既有语料（无一例声明这批键）判据不变。
 *
 * 比法（gold 驱动，与 isHidden/reactions/fieldSpan 同规）：gold 声明了哪个键就比哪个，
 * gold 没锁的键 pred 多写/少写不追责。**key 集合不再要求双向相等**（2026-10-27 修正）：
 * 那段相等检查与本函数自己的注释（「pred 多写不追责」）自相矛盾，且把「key 名自选」
 * （191 的 detail vs view）与「派生弹窗」（187 省略 dialogs.edit）两件都不是模型错的事
 * 判成 miss。`width` 等**前 AI-27 时代**的键**刻意不在此列** —— 它们本就由硬编码转发
 * （不属本次收缩范围），收进来会顺手改掉 `12-role-form-layout` 的判定并动到既有维度基线，
 * 把两件事混成一件。这条边界是**故意的**，不是遗漏。
 */
function dialogsEqual(gold, pred) {
  const gd = gold.dialogs ?? {}
  const pd = predDialogsView(gold, pred)
  for (const k of Object.keys(gd)) {
    const g = gd[k] ?? {}
    const p = pd[k]
    if (p === undefined) return false
    const gi = (g.formItems ?? []).map((f) => f.prop).sort()
    const pi = (p.formItems ?? []).map((f) => f.prop).sort()
    if (gi.join(',') !== pi.join(',')) return false
    for (const key of DIALOG_BASE_KEYS) {
      if (g[key] === undefined) continue
      if (!eq(g[key], p[key])) return false
    }
    if (g.configBtn) {
      if (normDialogBtns(g.configBtn) !== normDialogBtns(p.configBtn)) return false
    }
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
 * 深等值维度（columns / treeConfig / editConfig）的投影 —— 与 `eq()` **同源**：
 * 直接印 `canon()` 规范化后的 JSON，故两侧字符串相等 ⟺ `eq()` 为真，不存在
 * 「打印器只取子集、日志说两侧相同却报 miss」的空隙。
 *
 * 为什么不再手写可读摘要：这三个维度的判据是**整对象深等值**，任何手写摘要都必然漏键，
 * 一漏就在日志里制造「want === got 却是 miss」的矛盾（2026-10-22 全量跑批实测，
 * `101-schedule-date-edit-vue3` 的 editConfig 就是这样）。可读性让位于忠实性：
 * 诊断的价值在于**能定位**，不在于短。
 */
const canonicalView = (v) => (v === undefined || v === null ? '（未配置）' : JSON.stringify(canon(v)))

/**
 * `dialogs` 维度的投影 —— 与 `dialogsEqual` **逐半同源**：dialog key 集合、每个 dialog 的
 * formItems prop 集合、gold 声明的底座键（`DIALOG_BASE_KEYS`）、gold 声明了 `configBtn` 时的
 * 声明式底栏投影（`normDialogBtns`）。
 *
 * 底座键与底栏都按 **gold 门控**打印（gold 没锁的键 pred 多写不追责），因此
 * `want === got` 当且仅当 `dialogsEqual` 为真；同时也把「模型把 showClose 写反 / 把
 * confirm 写成 cancel」这类真实 miss 从「一行无声的维度名」变成可读证据。
 */
function dialogsView(gold, cfg) {
  const gd = gold.dialogs ?? {}
  // 与 dialogsEqual 同源：key 对齐 + 派生弹窗回填后的视图才是判定依据。
  const cd = predDialogsView(gold, cfg)
  const keys = [...new Set([...Object.keys(gd), ...Object.keys(cd)])].sort()
  if (!keys.length) return '（未配置）'
  const one = (d, k) => {
    if (!(k in d)) return `${k}:（缺）`
    const it = d[k] ?? {}
    const g = gd[k] ?? {}
    const props = (it.formItems ?? []).map((f) => f.prop).sort().join(',')
    const base = DIALOG_BASE_KEYS.filter((key) => g[key] !== undefined)
      .map((key) => `${key}=${JSON.stringify(canon(it[key]))}`)
      .join(',')
    const btns = g.configBtn !== undefined ? ` btn[${normDialogBtns(it.configBtn)}]` : ''
    return `${k}:[${props}]${base ? `{${base}}` : ''}${btns}`
  }
  return keys.map((k) => one(cd, k)).join(' ; ')
}

/**
 * 结构化维度（tableBtns / operationColumn / dialogs / treeConfig / editConfig / columns /
 * expandConfig）的「期望 vs 实得」键 —— 供 eval 诊断输出。
 *
 * **不变量：`want === got` 当且仅当该维度 pass。** 每个分支都必须与对应 pass() 同源
 * （复用同一套键函数，或直接印 `canon()` 的深等值投影）；`scripts/eval/scorers.test.mjs`
 * 里有一整节双向断言钉住它 —— 这条不变量是诊断可信度的全部依据，破一次就有 60+ 条
 * 真实 miss 不可定位。
 */
export function describeDimMiss(dim, gold, pred, opts = {}) {
  // 与 scoreAll 同源：先按 label 身份把 pred 的命名空间改写成 gold 的，再投影。
  // 否则 label 身份下 pass 了、日志却打出两边不同的 prop，不变量当场失效。
  pred = normalizePredForCompare(gold, pred, opts).pred
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
    return { want: dialogsView(gold, gold), got: dialogsView(gold, pred) }
  }
  if (dim === 'treeConfig') {
    return { want: canonicalView(projectTreeConfig(gold.treeConfig)), got: canonicalView(projectTreeConfig(pred.treeConfig)) }
  }
  if (dim === 'editConfig') {
    // 与 editConfig 维度同源：填默认值 + 装饰键豁免后的副本才是判定依据。
    const proj = projectEditConfig(gold.tableOptions?.editConfig, pred.tableOptions?.editConfig)
    return { want: canonicalView(proj.gold), got: canonicalView(proj.pred) }
  }
  if (dim === 'columns') {
    // 与 columns 维度同源：省略即派生、展开列位置不测量、装饰键豁免后的视图才是判定依据。
    const proj = projectColumnSet(gold, pred)
    return { want: canonicalView(proj.gold), got: canonicalView(proj.pred) }
  }
  if (dim === 'expandConfig') {
    const proj = projectExpandConfig(gold.expandConfig, pred.expandConfig)
    return { want: canonicalView(proj.gold), got: canonicalView(proj.pred) }
  }
  if (dim === 'isHidden' || dim === 'reactions') {
    // 与 isHiddenEqual / reactionsEqual 同源：显示**规范化后 + 字面量身份归一后**的条件，
    // 否则「两套等价写法」或「两种码值指向同一选项」会让判正的行打出不同的 want/got。
    // 必须 gold 驱动（维度判据只对 gold 声明过的字段负责）——否则 pred 多挂一个 isHidden
    // 就会让判正的行 want≠got，不变量当场失效。
    const pm = fieldMap(pred)
    const { g: gc, p: pc, shared } = conditionPair(gold, pred)
    const want = {}
    const got = {}
    for (const f of gold.fields) {
      if (f[dim] === undefined) continue
      const pf = pm.get(f.prop)
      want[f.prop] = dim === 'isHidden' ? conditionView(f[dim], gc, shared) : reactionsView(f[dim], gc, shared)
      got[f.prop] =
        pf && pf[dim] !== undefined
          ? dim === 'isHidden'
            ? conditionView(pf[dim], pc, shared)
            : reactionsView(pf[dim], pc, shared)
          : '（无）'
    }
    return { want: canonicalView(want), got: canonicalView(got) }
  }
  if (dim === 'defaultSort') {
    return {
      want: canonicalView(gold.tableOptions?.defaultSort),
      got: canonicalView(pred.tableOptions?.defaultSort),
    }
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

/**
 * 选项**标签树**（AN-01）：只取 label/children，丢弃 value。
 *
 * 为什么不像 isHidden/reactions 那样整数组深等值：`value` 是**后端数据模型的约定**
 * （`draft` / `1` / `unpaid`…），NL 在中文语料里只给标签（「草稿/已发布」），
 * 让模型猜中 value 等于要求它读心；拿它判负会把「语义正确」的产物系统性打成 miss。
 * 但**只比 presence**又太弱（标签写错、漏项、层级拍平都能过）。
 *
 * 故取中间判据：标签树（含层级与顺序）必须一致；value 只校验**数量与唯一性**
 * （漏项/重复值是真错，具体取值不计）。这是本仓「可推断的才计分」的一贯边界。
 */
function optionLabelTree(opts) {
  return (opts ?? []).map((o) => [
    o.label,
    (o.children ?? []).length ? optionLabelTree(o.children) : null,
  ])
}

/** 展平后的 value 列表（含 children），仅用于计数与唯一性。 */
function optionValues(opts) {
  const out = []
  for (const o of opts ?? []) {
    out.push(o.value)
    if ((o.children ?? []).length) out.push(...optionValues(o.children))
  }
  return out
}

/** 展平后的选项对象（含 children），用于「value → 标签」的回查。 */
function flatOptions(opts) {
  const out = []
  for (const o of opts ?? []) {
    out.push(o)
    if ((o.children ?? []).length) out.push(...flatOptions(o.children))
  }
  return out
}

/** gold 每个挂 dataOptions 的字段，pred 同名字段必须有同标签树 + 同选项数的选项。 */
function dataOptionsEqual(gold, pred) {
  const pm = fieldMap(pred)
  let any = false
  for (const f of gold.fields) {
    if (!(f.dataOptions ?? []).length) continue
    any = true
    const pf = pm.get(f.prop)
    if (!pf || !(pf.dataOptions ?? []).length) return false
    if (!eq(optionLabelTree(f.dataOptions), optionLabelTree(pf.dataOptions))) return false
    const gv = optionValues(f.dataOptions)
    const pv = optionValues(pf.dataOptions)
    if (gv.length !== pv.length) return false
    if (new Set(pv.map(String)).size !== pv.length) return false
  }
  return any
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
 * 声明式条件显隐：gold 每个带 `isHidden` 的 field，pred 同名 field 必须存在**且条件等值**。
 *
 * 「等值」= 先规范化到同一个范式（`canonCondition`，见其头注），再深比较。
 * 为什么不能直接深比较原始对象：schema 明确接受**两套等价写法** ——
 *   · 单条件 `{field,op,value}` 与表达式节点 `{op:[{var},value]}`；
 *   · 条件数组（语义 = AND）与 `{and:[…]}`。
 * 同一份需求，模型写哪一套都对；直接比原文会把「选了另一种合法写法」判成理解失败
 * （C 阶段 dump 里 115、121 两行正是如此）。
 *
 * 规范化**不**放宽行为契约：算子、取值、先后次序都照旧比 —— `eq` 写成 `ne`、
 * `value` 类型/顺序不符仍然判负（`scorers.test.mjs` 2c 的扰动逐条钉住这一点）。
 */
function isHiddenEqual(gold, pred) {
  const pm = fieldMap(pred)
  const { g: gc, p: pc, shared } = conditionPair(gold, pred)
  for (const f of gold.fields) {
    if (!f.isHidden) continue
    const pf = pm.get(f.prop)
    if (!pf || !pf.isHidden || !eq(conditionView(f.isHidden, gc, shared), conditionView(pf.isHidden, pc, shared))) return false
  }
  return true
}

/**
 * 字段联动（AI-07）：gold 每个带 `reactions` 的 field，pred 同名 field 必须存在**且联动规则等值**。
 *
 * 「等值」= 把 `fulfill.dataOptions` 换成与 `dataOptionsEqual` **同一条判据**再深比较：
 * 标签树（含层级与顺序）必须一致，value 只校验数量与唯一性。
 *
 * 为什么：`reactions` 里的 dataOptions 与字段级 dataOptions 是**同一种东西**（选项数组），
 * NL 只给标签（「登录失败/密码重置」），value 是后端数据模型的约定。125 行 gold 写
 * `loginFail`/`resetPwd`、模型写 `login_fail`/`password_reset`，语义一模一样，却被
 * 整数组深等值判负 —— 与字段级 dataOptions 曾经的问题完全同构（AN-01 已修，这一处漏了）。
 * `dependencies` / `when` / `required` / `disabled` / `value` 仍是行为契约：写错照旧判负
 * （`value`↔`dataOptions` 互换、`dependencies` 顺序错、`when` 谓词错都算未命中）。
 */
function reactionsEqual(gold, pred) {
  const pm = fieldMap(pred)
  const { g: gc, p: pc, shared } = conditionPair(gold, pred)
  for (const f of gold.fields) {
    if (!f.reactions) continue
    const pf = pm.get(f.prop)
    if (!pf || !pf.reactions) return false
    if (!eq(reactionsView(f.reactions, gc, shared), reactionsView(pf.reactions, pc, shared))) return false
  }
  return true
}

/**
 * reactions 的比较视图：`fulfill.dataOptions` → { 标签树, 选项数, 值是否互异 }，其余键原样。
 * 判据与 `dataOptionsEqual` 逐字一致（含「重复 value 判负」）。
 *
 * 2026-10-29：`when` / `fulfill.required` / `fulfill.disabled` / `fulfill.value` 四个表达式节点
 * 走 `conditionView`（与 isHidden 同一条视图）—— 它们的右操作数同样指向选项值，
 * 也同样是「options 与 dataOptions 是同一件事」的落点。134 行 gold `{== insuranceType "auto"}`、
 * 模型 `"car"`（两边标签都是「车险」）就是在这里被判负的。
 */
function reactionsView(reactions, ctx, shared) {
  return (reactions ?? []).map((r) => {
    const out = cloneDeep(r)
    const opts = out.fulfill?.dataOptions
    if (Array.isArray(opts)) {
      const vals = optionValues(opts)
      out.fulfill.dataOptions = {
        labels: optionLabelTree(opts),
        count: vals.length,
        unique: new Set(vals.map(String)).size === vals.length,
      }
    }
    // 表达式节点（与 isHidden 同一条视图）：规范化 + 字面量按标签身份。
    for (const k of REACTION_EXPR_KEYS) {
      if (out[k] !== undefined) out[k] = conditionView(out[k], ctx, shared)
      if (out.fulfill?.[k] !== undefined) out.fulfill[k] = conditionView(out.fulfill[k], ctx, shared)
    }
    return out
  })
}

/** reactions 里的表达式节点键：`when` 在外层，其余三个在 `fulfill` 里。 */
const REACTION_EXPR_KEYS = ['when', 'required', 'disabled', 'value']

const hasExtPoint = (f) => !!(f.render || f.formatter || f.permissionValue)

/** 该字段是否声明了列宽（查询面 querySpan 或表单面 formSpan）。 */
const hasFieldSpan = (f) => f.querySpan !== undefined || f.formSpan !== undefined

/**
 * 字段级列宽（AI-31③）：gold 每个声明了 `querySpan`/`formSpan` 的字段，pred 同名 field 必须
 * **完全等值**（含「gold 给了 pred 没给」= 未命中）。与 reactionsEqual/isHiddenEqual 同规：
 * gold 驱动——gold 未声明的字段，pred 多加/漏加 span 不追责（NL 没锁它）。
 */
function fieldSpanEqual(gold, pred) {
  const pm = fieldMap(pred)
  for (const f of gold.fields) {
    if (!hasFieldSpan(f)) continue
    const pf = pm.get(f.prop)
    if (!pf) return false
    if ((f.querySpan ?? null) !== (pf.querySpan ?? null)) return false
    if ((f.formSpan ?? null) !== (pf.formSpan ?? null)) return false
  }
  return true
}

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
  { key: 'dataOptions', applicable: (g) => g.fields.some((f) => (f.dataOptions ?? []).length), pass: dataOptionsEqual },
  { key: 'i18n', applicable: (g) => g.i18n === true, pass: (g, p) => g.i18n === p.i18n },
  { key: 'formLayout', applicable: (g) => g.formLayout !== undefined, pass: (g, p) => eq(g.formLayout ?? null, p.formLayout ?? null) },
  {
    // 字段级列宽（AI-31③）：查询面 `querySpan` / 表单面 `formSpan` 的按字段等值。
    //
    // 为何单列一维：`formLayout.span` 曾是**幽灵键**（core 从不读，AI-31③ 已删），
    // 真正的列宽/列数由**字段**决定（生成器 buildFormItem 消费 querySpan/formSpan）。
    // 故 NL 里的「查询表单分 2 列 / 表单分 2 列」只能在字段级度量；若只删幽灵键而
    // 不立此维，那句 NL 需求会**无维度可量**（能力静默丢失，与「mark, never drop」相悖）。
    // 语义与 reactions/isHidden 同规：gold 驱动的**按字段等值**（gold 声明了 span 的字段，
    // pred 同名必须同值；gold 未声明的字段，pred 猜错免责）——仅当 gold 有任一字段声明时才 applicable。
    key: 'fieldSpan',
    applicable: (g) => g.fields.some(hasFieldSpan),
    pass: fieldSpanEqual,
  },
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
  {
    // 字段联动（AI-07）：整数组深等值。选项联动/必填/禁用/值回写都是行为契约，
    // 「写了 reactions 但 fulfillment 内容不对」不算命中。仅当 gold 声明时才 applicable。
    key: 'reactions',
    applicable: (g) => g.fields.some((f) => f.reactions !== undefined),
    pass: reactionsEqual,
  },
  {
    // 显式列逃生数组（AI-09 子项①）：投影后的整数组深等值。列序/多级表头/非字段列/
    // 权限码/单元格码值映射都是行为契约；纯布局常量（宽/对齐/固定/排序）按装饰键投影
    // ——**任一侧没写就不比较**，两侧都写才比值（见 projectColumns 的注释与 D15）。
    // 仅当 gold 声明非空 columns 时 applicable。
    key: 'columns',
    applicable: (g) => !!(g.columns && g.columns.length),
    pass: (g, p) => {
      const proj = projectColumnSet(g, p)
      return eq(proj.gold, proj.pred)
    },
  },
  {
    // 声明式行展开内容（AI-09 子项②）：投影后的整体深等值。字段序/字段标签是渲染契约；
    // 标题串属装饰键（与 columns 同规）。仅当 gold 声明时才 applicable。
    key: 'expandConfig',
    applicable: (g) => !!g.expandConfig,
    pass: (g, p) => {
      const proj = projectExpandConfig(g.expandConfig ?? null, p.expandConfig ?? null)
      return eq(proj.gold, proj.pred)
    },
  },
  {
    // 声明式树表（AI-09 子项③）：整体深等值。childrenField / expandAll 都是行为契约，
    // 「给了 treeConfig 但子键名或默认展开状态不对」不算命中。仅当 gold 声明时才 applicable。
    key: 'treeConfig',
    applicable: (g) => !!g.treeConfig,
    pass: (g, p) => eq(projectTreeConfig(g.treeConfig), projectTreeConfig(p.treeConfig)),
  },
  {
    // vxe 行内编辑开关（AI-09 子项④）：tableOptions.editConfig 按**投影**后等值。
    // trigger/mode/enabled 的**省略**等价于默认值（schema 与 prompt 都写明 click / cell；
    // vxe 的 isEnableConf 是 `enabled !== false`），show*/autoClear 是 NL 从不陈述的展示开关。
    // 其余键、以及 trigger/mode 的**取值**仍是行为契约：写错照旧判负。
    // （列级 editRender 已由 columns 维度整体深等覆盖。）仅当 gold 声明时才 applicable。
    key: 'editConfig',
    applicable: (g) => g.tableOptions?.editConfig != null,
    pass: (g, p) => {
      const proj = projectEditConfig(g.tableOptions?.editConfig, p.tableOptions?.editConfig)
      return eq(proj.gold ?? null, proj.pred ?? null)
    },
  },
  {
    // 声明式合并单元格（AI-23）：顶层 mergeConfig 整体深等值。rowsBy 的**列集合与顺序**都是
    // 渲染契约（前者决定哪几列合并、后者决定分组主轴），「给了 mergeConfig 但列不对/顺序反了」
    // 不算命中。仅当 gold 声明时才 applicable。
    key: 'mergeConfig',
    applicable: (g) => !!g.mergeConfig,
    pass: (g, p) => eq(g.mergeConfig ?? null, p.mergeConfig ?? null),
  },
  {
    // 首屏默认排序（AI-10/AN-10）：`tableOptions.defaultSort` 整体深等值。
    //
    // 为什么必须单列一维：它是**服务端排序契约**的种子（core 的 table-sort 由它播种首屏，
    // 并把 prop 译成请求参数 sortField/sortOrder），NL 里常被明说（「默认按发布时间倒序」，
    // 见 166）。此前它**没有任何维度**覆盖 —— 166 的头号需求模型漏写也照判满分，属
    // 「mark, never drop」缺口（本维在写 Ruler v3 测试矩阵时补上）。
    // 装饰键豁免不适用：`sortable`（列级可点）是 UI 能力，而 defaultSort 是行为契约。
    // 仅当 gold 声明时才 applicable（与 expandConfig/treeConfig/mergeConfig 同规）。
    key: 'defaultSort',
    applicable: (g) => !!g.tableOptions?.defaultSort,
    pass: (g, p) => eq(g.tableOptions?.defaultSort ?? null, p.tableOptions?.defaultSort ?? null),
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
    const g = fieldMap(gold).get(prop)
    const p = fieldMap(pred).get(prop)
    if (!g || !(g.dataOptions ?? []).length) return true // 该字段本就不要求静态选项 → 空钉即过
    if (!p || !(p.dataOptions ?? []).length) return false
    // 与 dataOptionsEqual 同源判据：标签树 + 选项数量/唯一性（value 字面值不判，理由见函数头注）。
    if (!eq(optionLabelTree(g.dataOptions), optionLabelTree(p.dataOptions))) return false
    const gv = optionValues(g.dataOptions)
    const pv = optionValues(p.dataOptions)
    return gv.length === pv.length && new Set(pv.map(String)).size === pv.length
  },
  isHidden: (gold, pred, prop) => {
    const g = fieldMap(gold).get(prop)
    const p = fieldMap(pred).get(prop)
    if (!g || !g.isHidden) return true // 该字段本就不要求条件显隐 → 空钉即过
    if (!p || !p.isHidden) return false
    // 与 isHiddenEqual 同源判据：规范化 + 字面量身份（两套合法写法 / 两种码值等价）
    const { g: gc, p: pc, shared } = conditionPair(gold, pred)
    return eq(conditionView(g.isHidden, gc, shared), conditionView(p.isHidden, pc, shared))
  },
  reactions: (gold, pred, prop) => {
    const g = fieldMap(gold).get(prop)
    const p = fieldMap(pred).get(prop)
    if (!g || !g.reactions) return true // 该字段本就不要求联动 → 空钉即过
    if (!p || !p.reactions) return false
    // 与 reactionsEqual 同源：dataOptions 按「标签树 + 数量 + 唯一性」比，表达式节点走 conditionView
    const { g: gc, p: pc, shared } = conditionPair(gold, pred)
    return eq(reactionsView(g.reactions, gc, shared), reactionsView(p.reactions, pc, shared))
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
export function scoreAll(gold, pred, mask, opts = {}) {
  // Ruler v3 / R2：先按 label 身份把 pred 的字段命名空间改写成 gold 的，再走既有判定。
  // 单一改造点 —— 所有维度（含 fieldMap/sharedFields/深等值）都经这一份 pred。
  // `opts.identity === 'prop'` 供 en 腿（标签不可比）与历史复算使用。
  const { pred: alignedPred, align } = normalizePredForCompare(gold, pred, opts)

  const byCapability = {}
  for (const s of CAPABILITY_SCORERS) {
    const applicable = !!s.applicable(gold)
    byCapability[s.key] = applicable
      ? { applicable: true, pass: !!s.pass(gold, alignedPred) }
      : { applicable: false, pass: null }
  }

  // ── 向后兼容的明细分（控制台与历史 record 字段沿用）────────────────────────
  const goldFields = fieldMap(gold)
  const predFields = fieldMap(alignedPred)
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
  // 属性准确率**只在有共享字段时才有定义**。旧写法在零共享字段时返回 1（"没有可错的"），
  // 于是一个 prop 全写错的行把诊断均值抬到 98.9%。返回 null = 该行不适用；
  // eval 聚合时只对 numeric 行取均值，并单独报出「属性可测行数」。
  const attrAcc = attrTotal === 0 ? null : attrHits / attrTotal

  const actionsF1 = f1(new Set(gold.actions), new Set(alignedPred.actions))

  // 与 `tableBtns` 维度同源（name|归一化 code|actionType），不再只比 code。
  // 旧口径下「按钮文案/作用写错、code 写对」仍算 core 命中 —— 与维度判定自相矛盾。
  const tableBtnsMatch = tableBtnsEqual(gold, alignedPred)

  // 历史门禁口径（prop + 4 属性 + actions + tableBtns）。attrTotal=0 时属性无可测项，
  // 不能算命中（否则「prop 全错」会被 attrAcc 的真空真放行）。
  const exactIntentCore =
    propF1.f1 === 1 && attrTotal > 0 && attrHits === attrTotal && actionsF1.f1 === 1 && tableBtnsMatch

  // 更严：该 case 所有 applicable 维度都命中。只观测，不门禁。
  const exactIntentFull = Object.values(byCapability).every((c) => (c.applicable ? c.pass : true))

  // scoped 口径（B2）：只 AND 掩码里 NL 真正锁定的 token。无掩码 → 退化为 core（向后兼容）。
  const pinned = mask && Array.isArray(mask.pinnedDims) ? mask.pinnedDims : []
  const exactIntentScoped = pinned.length ? pinned.every((t) => scoreDimension(gold, alignedPred, t)) : exactIntentCore

  return {
    byCapability,
    propF1,
    // 观测量（不进门禁）：被对齐到的字段里，**prop 写法也相同**的占比。它把「猜命名」
    // 与「懂不懂 NL」解耦 —— label 身份放宽后，命名能力靠这个数才看得见。
    propNameMatch: propNameMatch(gold, pred, opts),
    alignMode: align.mode,
    alignUnmatchedGold: align.unmatchedGold,
    alignUnmatchedPred: align.unmatchedPred,
    alignAmbiguous: align.ambiguous,
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
 *   - turn0 / scripted  : **两条腿拆开**（AN-02）。turn0 = 初稿即 scoped 命中（零编辑）；
 *     scripted = 脚本化纠正后（firstTurn 1..k）才收敛。二者混算会把「宿主/脚本把答案说出来了」
 *     记成「模型一次就做对」—— 95% 定义里它们是 OR 的两条腿，但报告必须能分开看。
 * @param {Array<{ firstTurn: number|null }>} rows
 * @param {number} k
 */
export function summarizeConvergence(rows, k) {
  const total = Array.isArray(rows) ? rows.length : 0
  if (!total) return { rateAtK: null, meanTurnsToConverge: null, converged: 0, total: 0, turn0: 0, scripted: 0, withinK: 0 }
  const convergedAny = rows.filter((r) => r.firstTurn !== null && r.firstTurn !== undefined)
  const withinK = convergedAny.filter((r) => r.firstTurn <= k)
  const turn0 = rows.filter((r) => r.firstTurn === 0).length
  const meanTurns = convergedAny.length
    ? convergedAny.reduce((a, r) => a + r.firstTurn, 0) / convergedAny.length
    : null
  return {
    rateAtK: withinK.length / total,
    meanTurnsToConverge: meanTurns,
    converged: convergedAny.length,
    total,
    turn0,
    // ≤K 内、但需要纠正才收敛的样本 = 第二条腿真实贡献的部分。
    scripted: withinK.filter((r) => r.firstTurn > 0).length,
    withinK: withinK.length,
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
