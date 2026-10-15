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

const mentions = (list, label) => list.some((l) => l.includes(label) || label.includes(l))

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
      if (mentions(list, label)) continue // NL 明列了它 → 默认 true 正确
      out.push({ surface, prop: f.prop, label })
    }
  }
  return out
}
