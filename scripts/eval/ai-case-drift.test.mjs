#!/usr/bin/env node
/**
 * 漂移观测的**口径自测**（无需 API key，进 `check:consistency`）。
 *
 * ## 为什么值得单测
 *
 * 这份报告不进仓库、也不做门禁，于是它「算错」时**没有任何门会红** —— 读报告的人只会
 * 看到「无漂移」或「漂移很大」，然后据此决定要不要重生成案例。口径错得越安静，代价越高。
 * 这里把四条钉死：
 *
 *   1) 集合 F1：空 vs 空 = 1（都没写 = 没漂移）；不相交 = 0 且两侧独有项都对；
 *   2) 成员布尔缺省归一：冻结侧省略、候选侧显式 true 不算漂移（inQuery 默认值陷阱的镜像）；
 *   3) 旋钮只对**交集字段**取一致率（候选少一个字段由 membership 记，不在 knobs 里重复罚）；
 *   4) 选案：只有「有 NL + 有冻结配置」才进观测，其余逐条记跳过原因（不静默）。
 *
 * 用法：node scripts/eval/ai-case-drift.test.mjs
 * 退出码：0 = 口径全部成立；1 = 至少一条失效。
 */
import { knobOf, setDiff, structuralDistance, selectDriftCases } from './ai-case-drift.mjs'

let failures = 0
function check(cond, msg) {
  if (cond) return
  failures++
  console.error(`  ✗ ${msg}`)
}
const eq = (a, b, msg) => check(a === b, `${msg}（期望 ${JSON.stringify(b)}，实得 ${JSON.stringify(a)}）`)
const same = (a, b, msg) => eq(JSON.stringify(a), JSON.stringify(b), msg)

// ── 1) 集合 F1 ────────────────────────────────────────────────────────────────
{
  const empty = setDiff([], [])
  eq(empty.same, true, '空 vs 空 = 相同')
  eq(empty.f1, 1, '空 vs 空 F1 = 1')

  const disjoint = setDiff(['a', 'b'], ['c'])
  eq(disjoint.same, false, '不相交 = 不同')
  eq(disjoint.f1, 0, '不相交 F1 = 0')
  same(disjoint.onlyInFrozen, ['a', 'b'], '不相交：冻结侧独有项')
  same(disjoint.onlyInCandidate, ['c'], '不相交：候选侧独有项')

  const half = setDiff(['a', 'b', 'c'], ['b', 'c', 'd'])
  eq(half.same, false, '部分重合 = 不同')
  eq(half.f1, 0.667, '部分重合 F1 = 2·2/(3+3) 四舍五入到 3 位')
  same(half.onlyInFrozen, ['a'], '部分重合：冻结侧独有项')
  same(half.onlyInCandidate, ['d'], '部分重合：候选侧独有项')

  // 去重：同一个 prop 写两遍不该把规模放大
  eq(setDiff(['a', 'a'], ['a']).f1, 1, '重复项先去重再算 F1')
}

// ── 2) 成员布尔缺省归一 ────────────────────────────────────────────────────────
{
  same(knobOf({ prop: 'x', formtype: 'Input' }), { formtype: 'Input', inQuery: true, inTable: true, inForm: true }, '省略 = true')
  same(
    knobOf({ prop: 'x', formtype: 'Input', inQuery: false }),
    { formtype: 'Input', inQuery: false, inTable: true, inForm: true },
    '显式 false 保留',
  )
  const frozen = { fields: [{ prop: 'x', formtype: 'Input' }], actions: [], dialogs: {} }
  const candidate = {
    fields: [{ prop: 'x', formtype: 'Input', inQuery: true, inTable: true, inForm: true }],
    actions: [],
    dialogs: {},
  }
  const d = structuralDistance(frozen, candidate)
  eq(d.exact, true, '省略 vs 显式 true 不算漂移（归一后一致）')
  eq(d.knobs.inQuery, 1, 'inQuery 一致率 = 1')
}

// ── 2b) formtype 别名 ─────────────────────────────────────────────────────────
{
  same(
    knobOf({ prop: 'x', formtype: 'datePicker' }),
    { formtype: 'DatePicker', inQuery: true, inTable: true, inForm: true },
    '别名归一：datePicker → DatePicker（schema 承认的写法，不该报成漂移）',
  )
  const d = structuralDistance(
    { fields: [{ prop: 'hiredAt', formtype: 'DatePicker' }], actions: [], dialogs: {} },
    { fields: [{ prop: 'hiredAt', formtype: 'datePicker' }], actions: [], dialogs: {} },
  )
  eq(d.knobs.formtype, 1, '只在别名上不同的 formtype 视为一致')
  eq(d.exact, true, '别名不制造漂移（否则模型挑个词就被报成结构变化）')
}

// ── 3) 旋钮只对交集字段 ────────────────────────────────────────────────────────
{
  const frozen = {
    fields: [
      { prop: 'a', formtype: 'Input' },
      { prop: 'gone', formtype: 'Select', inQuery: false },
    ],
    actions: ['add'],
    dialogs: { add: {} },
  }
  const candidate = {
    fields: [
      { prop: 'a', formtype: 'Input' },
      { prop: 'new', formtype: 'Input' },
    ],
    actions: ['add', 'view'],
    dialogs: {},
  }
  const d = structuralDistance(frozen, candidate)
  eq(d.sharedFields, 1, '交集字段数 = 1')
  eq(d.props.same, false, '字段集合有差异')
  same(d.props.onlyInFrozen, ['gone'], '只冻结侧有 gone')
  same(d.props.onlyInCandidate, ['new'], '只候选侧有 new')
  eq(d.knobs.formtype, 1, '旋钮只在交集字段上算（a 的 formtype 一致）')
  eq(d.actions.same, false, '动作集合有差异')
  same(d.actions.onlyInCandidate, ['view'], '候选多出 view')
  eq(d.dialogKeys.same, false, '弹窗集合有差异')
  eq(d.exact, false, '任一维度不同 ⟹ 不是 exact')
}

{
  // 交集字段上真的改了旋钮：只罚这一项，并给出可读的差异项
  const d = structuralDistance(
    { fields: [{ prop: 'a', formtype: 'Input', inTable: false }], actions: [], dialogs: {} },
    { fields: [{ prop: 'a', formtype: 'Select', inTable: false }], actions: [], dialogs: {} },
  )
  eq(d.knobs.formtype, 0, 'formtype 全部不一致 ⟹ 一致率 0')
  eq(d.knobs.inTable, 1, '未改动的旋钮不受牵连')
  same(d.knobMismatches.formtype, [{ prop: 'a', frozen: 'Input', candidate: 'Select' }], '差异项可读')
  eq(d.exact, false, '旋钮不同 ⟹ 不是 exact')
}

{
  // 交集为空：没有字段可比时旋钮记 1（不是 0）—— 否则「字段全丢」会被罚两遍
  const d = structuralDistance({ fields: [], actions: [], dialogs: {} }, { fields: [{ prop: 'a' }], actions: [], dialogs: {} })
  eq(d.knobs.formtype, 1, '交集为空时旋钮记 1')
  eq(d.exact, false, '但 membership 仍然记差异')
}

// ── 4) 选案 ──────────────────────────────────────────────────────────────────
{
  const manifest = {
    cases: [
      { id: 'ai-frozen', artifacts: { config: 'x.config.json' }, provenance: { nl: '做一个页', model: 'm' }, targets: ['vue3'], mode: 'schema' },
      { id: 'ai-unavailable', artifacts: { schema: 'x.json' }, provenance: { nl: '做一个页', model: 'm' } },
      { id: 'config-no-nl', artifacts: { config: 'y.config.json' }, provenance: { nl: null } },
      { id: 'handcrafted', artifacts: { schema: 'z.json' }, provenance: { nl: '分析页' }, replay: { kind: 'handcrafted' } },
    ],
  }
  const { cases, skipped } = selectDriftCases(manifest)
  same(cases.map((c) => c.id), ['ai-frozen'], '只有「有 NL + 有冻结配置」进观测')
  eq(cases[0].target, 'vue3', 'target 取 targets[0]')
  eq(cases[0].mode, 'schema', 'mode 透传')
  eq(skipped.length, 3, '其余三例逐条记跳过')
  check(skipped.every((s) => s.id && s.reason), '跳过项都带 id 与原因（不静默）')

  eq(selectDriftCases(manifest, { limit: 1 }).cases.length, 1, '--limit 生效')
  eq(selectDriftCases(manifest, { only: 'ai-frozen' }).cases.length, 1, '--only 命中')
  eq(selectDriftCases(manifest, { only: 'nope' }).cases.length, 0, '--only 未命中返回空（由 main 报错）')
}

if (failures) {
  console.error(`\n❌ 漂移口径自测：${failures} 条失效`)
  process.exit(1)
}
console.log('✅ 漂移口径自测：集合 F1 / 缺省归一 / 别名归一 / 交集旋钮 / 选案 全部成立')
