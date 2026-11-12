#!/usr/bin/env node
/**
 * 动作面的 NL 证据（纯函数，无 I/O）。
 *
 * ## 为什么需要它
 *
 * 语料是尺子的地标：gold 里声明了某个动作/按钮，而 NL 从头到尾没点名它，模型照 NL
 * 写反而会被判负 —— 这类「死按钮」和「inQuery 默认 true」是同一类语料缺陷
 * （2026-11-12 全量跑批的 137/141/146/190/193 是它的镜像：NL 点名了导出、gold 的
 * `actions` 却没写 export，模型写对了反而红的）。
 *
 * 判据刻意**保守**：只认明确的动作词；认不出就红，人去补 NL 或摘下该动作，而不是
 * 放宽正则。单一出处：`scripts/check-gold-self-score.mjs`（进 CI 的门禁）与
 * `scripts/eval/audit-actions.mjs`（一次性人工审计）都从这里取。
 *
 * 纠正轮也算说过：收敛语料故意把铰链留到 turn 1（conv-24 的 export / conv-25 的 import）。
 */

/** 动作 → NL 措辞。`增删改查` 是四字的整体说法，四个动作各自单列一份。 */
export const ACTION_CUES = {
  add: /新增|添加|新建|创建|录入|增删改查/,
  edit: /编辑|修改|改动|增删改查/,
  delete: /删除|移除|增删改查/,
  view: /查看|详情|只读|增删改查/,
  export: /导出/,
  import: /导入/,
}

/** 语料里「确实说过」的文本：初版 NL + 每一轮纠正。 */
export function statedTextOf(raw) {
  const parts = [raw?.nl]
  for (const r of raw?.refinements ?? []) parts.push(r.correction, r.nl, r.text)
  return parts.filter((x) => typeof x === 'string' && x).join('\n')
}

/** 这段文本里出现了哪些动作词（审计用；判据只认 ACTION_CUES）。 */
export function detectVerbs(text) {
  return Object.entries(ACTION_CUES)
    .filter(([, re]) => re.test(text))
    .map(([k]) => k)
}

/**
 * 「**授予**」语境里的动作词（审计专用，比 `detectVerbs` 严）。
 *
 * 为什么需要两层：`detectVerbs` 认的是词面，会命中「每行可展开**查看**联系人」
 * （展开明细，不是行内查看动作）、「编码由系统生成」附近的「导入」这类非授予语境。
 * 语料门禁（`actionEvidenceProblems`）问的是「gold 里的这一项有没有被说过」，
 * 词面命中就够了（宽松方向安全：不会误红）。反过来「NL 点名但 gold 漏」这条诊断
 * 问的是「这句是在**要求**一个动作吗」，必须在授予/按钮语境里才算数，否则一次审计
 * 会喷出 20 条假阳性（2026-11-12 实测）。
 */
export function grantedVerbs(text) {
  const CLAUSE = String(text).split(/[。；;\n]/)
  // 授予语境的标记。刻意**不收**裸「可」「能」「操作」「需要」：语料里
  // 「可编辑字段」「操作人」「需要权限码」都不是动作授予，收进来会制造假阳性。
  const GRANT = /支持|按钮|行内|每行|工具栏|上方|左侧|右侧|还要|再加|加上|提供|允许|只读|操作列|操作按钮/
  // 否定标记：出现在动作词**之前**时，该动作不是被要求的（「只读，没有任何可编辑字段」）。
  const NEG = /不支持|不允许|不能|不可|不显示|不用|无需|没有任何|只读/
  const NEG_SKIP = new Set(['add', 'edit', 'delete', 'import', 'export'])
  // 查看的特殊性：「查看联系人」「展开查看」是看内容，不是「查看」这个 CRUD 动作。
  // 只认「查看按钮 / 查看操作 / 支持查看 / 只读」，以及行内语境里**位于句末或枚举位**
  // 的「查看」（「每行有查看、删除操作」，但「每行可展开查看联系人」不算）。
  const VIEW = /查看(?:按钮|操作)|详情按钮|支持查看|可查看|只读|(?:行内|每行|操作列)[^，,。；]*(?:查看|详情)(?=[、，,。；]|$)/
  const lastNeg = (c) => {
    let last = -1
    for (const m of c.matchAll(new RegExp(NEG.source, 'g'))) last = m.index
    return last
  }
  const out = new Set()
  for (const c of CLAUSE) {
    if (!GRANT.test(c)) continue
    const neg = lastNeg(c)
    for (const [k, re] of Object.entries(ACTION_CUES)) {
      const m = (k === 'view' ? VIEW : re).exec(c)
      if (!m) continue
      if (NEG_SKIP.has(k) && neg >= 0 && m.index > neg) continue
      out.add(k)
    }
  }
  return [...out]
}

const normName = (s) => String(s ?? '').replace(/[\s"'“”‘’「」]/g, '')

/**
 * 审计一条用例的动作面，返回问题清单（空 = 通过）。
 *
 * - `actions`：每个动作必须能在 NL 找到对应动作词；
 * - `tableBtns`：每个按钮的 name 必须出现在 NL 里，或者它的 `actionType`/`dialogKey`
 *   能在 NL 找到动作词（自定义文案可换，但动作本身得说过）。
 */
export function actionEvidenceProblems(raw, { file = 'fixture' } = {}) {
  const cfg = raw?.config ?? {}
  const text = statedTextOf(raw)
  const flat = normName(text)
  const problems = []
  for (const a of cfg.actions ?? []) {
    const cue = ACTION_CUES[a]
    if (!cue) {
      problems.push(`${file}: actions 含未知动作 ${JSON.stringify(a)}（VALID_CRUD_ACTIONS 之外）`)
      continue
    }
    if (!cue.test(text)) problems.push(`${file}: actions 的 ${a} 在 NL/纠正轮里没有动作词依据（死按钮）`)
  }
  for (const b of cfg.tableBtns ?? []) {
    const name = b?.name
    if (!name) {
      problems.push(`${file}: tableBtns 有按钮缺 name`)
      continue
    }
    const byName = flat.includes(normName(name))
    const action = b.actionType ?? b.dialogKey
    const byAction = action ? !!ACTION_CUES[action]?.test(text) : false
    if (!byName && !byAction) {
      problems.push(`${file}: tableBtns 的「${name}」在 NL 里没有名称或动作依据（死按钮）`)
    }
  }
  return problems
}
