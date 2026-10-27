#!/usr/bin/env node
/**
 * 「NL 穷举列举 ⟷ gold 界面归属」矛盾的检测器（纯函数，无 I/O）。
 *
 * 单一出处：`scripts/check-membership-trap.mjs`（长期守卫）与一次性迁移脚本都从这里取，
 * 避免「守卫以为修好了、迁移却按另一套谓词改」的分裂。
 *
 * 背景见 check-membership-trap.mjs 头注：`inQuery`/`inTable`/`inForm` 的 schema 默认值是
 * **true**，故字段省略该键 ⟹ 「该字段在这个界面上」。若 NL 用了**穷举式**列举
 * （「查询条件有 A、B、C」）而 gold 漏给 D 写 `false`，gold 就与自己的 NL 矛盾，
 * 模型按 NL 正确排除反被判错。
 *
 * 判定是**保守下界**：只在穷举式表述下判定；「支持按 X 查询」这类非穷举表述一律不判
 * （没有声明「只有这些」，据此断言排除必误伤）。
 */

/**
 * 穷举式列举的引导词。只认「有 / 为 / 包括 / ：」—— 它们蕴含「就是这些」。
 * 「按…查询」「可以按…筛选」不认：那是**附加**能力，不是枚举全集。
 */
const LEADS = {
  inQuery: /查询(?:条件|项|字段|参数)?\s*[有为包括：:]\s*/,
  inTable: /表格(?:展示|显示|列出|列|有|包含)\s*[：:]?\s*/,
}

/** 列表右边界：句末标点，或下一个界面/动作词前的位置（`，表格展示…` 的列表到此为止）。 */
const STOPS = {
  inQuery: /[。；;]|(?:，|,)?(?:表格|列表|表单|支持|可|并|同时|另)/,
  inTable: /[。；;]|(?:支持|表单|随后|并|另)/,
}

/** `inForm` 不判：语料的 NL 从不穷举表单字段集（穷举的是隐藏/必填/禁用规则），
 *  而 gold 的 `inForm:false` 承载 NL 未言明的领域知识（如「注册时间是系统字段」）——
 *  那不是矛盾，是 few-shot #1/#6 教过的语义推断。查了必误红，故不查。 */
export const SURFACES = ['inQuery', 'inTable']

const stripParens = (s) => s.replace(/（[^）]*）|\([^)]*\)/g, '').replace(/[（(][^）)]*$/, '')
const splitList = (s) =>
  s
    .split(/[、，,]|\s*和\s*|\s*及\s*/)
    .map((x) => x.trim())
    .filter(Boolean)

/**
 * 抽出 NL 对某界面的**穷举**字段列举；非穷举表述返回 null（= 不作判定）。
 * @returns {string[]|null}
 */
export function extractSurfaceList(nl, surface) {
  const m = String(nl ?? '').match(LEADS[surface])
  if (!m) return null
  let rest = String(nl).slice(m.index + m[0].length)
  const stop = rest.search(STOPS[surface])
  if (stop >= 0) rest = rest.slice(0, stop)
  const parts = splitList(stripParens(rest))
  return parts.length ? parts : null
}

/**
 * 列举项与 label 的归一化：去空白/引号、去「范围 / 区间」后缀。
 * 「查询有…操作时间范围」↔ 字段 `操作时间` 必须能对上，否则**正向**判定会把一个
 * 已被 NL 点名的字段当成漏写（09-audit-readonly 的假红就是这么来的）。
 */
const normToken = (s) =>
  String(s ?? '')
    .replace(/[\s「」『』"'“”]/g, '')
    .replace(/(范围|区间)$/, '')

/** 双向包含匹配：「公告标题」↔「标题」、带后缀的列举项 ↔ 裸 label。 */
export const listMentions = (list, label) => {
  const L = normToken(label)
  return list.some((t) => {
    const T = normToken(t)
    return T.length > 0 && (T.includes(L) || L.includes(T))
  })
}

/**
 * 严格匹配（**只用于反向判定**）：归一后精确相等，或列举项包含 label。
 *
 * 为什么不许反方向的「label 包含列举项」：`66-student-expand-antdv` 的表格列举是
 * 「姓名、班级、总分」，而展开区字段 label 是「家长姓名」——`家长姓名.includes(姓名)`
 * 会把一个**根本不在表格里**的字段判成「NL 点名进表格」。正向判定用宽松匹配是安全的
 * （漏判只会少红），反向判定用宽松匹配就是**误红**。
 */
export const listMentionsStrict = (list, label) => {
  const L = normToken(label)
  return list.some((t) => {
    const T = normToken(t)
    return T.length > 0 && (T === L || T.includes(L))
  })
}

/** 「完全没有这个界面」的全否表述（如「不提供查询条件」）。穷举列举为空集时只能这样说。 */
const NO_SURFACE = {
  inQuery: /(?:不提供|没有|无)\s*查询/,
}

/**
 * NL 是否**可判定地**声明了某界面的归属：要么穷举列举，要么「不提供查询」这类全否表述。
 * 这是 `membership` pin 的机器下界 —— 自报的 `nlStatedDims` 无法证明自己诚实，这条可以。
 */
export function statesSurface(nl, surface) {
  if (extractSurfaceList(nl, surface)) return true
  return !!(NO_SURFACE[surface] && NO_SURFACE[surface].test(String(nl ?? '')))
}

/**
 * 反向矛盾：NL 的穷举列举**点了名**，gold 却写了显式 `false`。
 *
 * 与 `findTrapFields` 互为镜像：那边抓「NL 没列、gold 省略（默认 true）」，这边抓
 * 「NL 列了、gold 显式排除」。两者都是 gold 与自己的 NL 打架 —— 模型照 NL 写就必错。
 * 旧守卫只查一个方向，于是 59/153/154/155/157/159 六例长期带着「NL 说可查、gold 写不可查」
 * 的矛盾通过检查（2026-10-27 0c 补上）。
 */
export function findReverseContradictions(raw) {
  const fields = raw?.config?.fields
  if (!Array.isArray(fields)) return []
  const out = []
  for (const surface of SURFACES) {
    const list = extractSurfaceList(raw.nl, surface)
    if (!list) continue
    for (const f of fields) {
      if (f[surface] !== false) continue
      const label = f.label ?? f.prop
      if (listMentionsStrict(list, label)) out.push({ surface, prop: f.prop, label })
    }
  }
  return out
}

/**
 * 找出一条用例里与自身 NL 矛盾的省略项。
 * @param {{nl?:string, config?:{fields?:Array<{prop:string,label?:string}>}}} raw 语料原文（**未过 zod**）
 * @returns {{surface:string, prop:string, label:string}[]}
 */
export function findTrapFields(raw) {
  const fields = raw?.config?.fields
  if (!Array.isArray(fields)) return []
  const out = []
  for (const surface of SURFACES) {
    const list = extractSurfaceList(raw.nl, surface)
    if (!list) continue
    for (const f of fields) {
      if (f[surface] !== undefined) continue // 已显式声明，无歧义
      const label = f.label ?? f.prop
      if (listMentions(list, label)) continue // NL 明列了它 → 默认 true 正确
      out.push({ surface, prop: f.prop, label })
    }
  }
  return out
}
