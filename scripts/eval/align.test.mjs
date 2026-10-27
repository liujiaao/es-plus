#!/usr/bin/env node
/**
 * 字段对齐（Ruler v3 / R2）自测 —— 无需 API key，进 CI 的 check:consistency。
 *
 * 测试矩阵取自 docs/internal/accuracy-95-ruler-v3-design.md §8.4（逐条一一对应）：
 * 放宽尺子最怕两件事 —— ①放宽到「什么都能过」（假绿）；②该放的地方没放（白改）。
 * 所以每条断言都成对：改名必须过、改错必须红。
 */
import { alignFields, normalizePredForCompare, normalizeLabel, propNameMatch } from './align.mjs'
import { scoreAll, describeDimMiss } from './scorers.mjs'

let failures = 0
const check = (cond, msg) => {
  if (!cond) {
    failures++
    console.error(`  ✗ ${msg}`)
  }
}
const clone = (x) => JSON.parse(JSON.stringify(x))

// 一个覆盖多个维度的小配置（不依赖 schema 解析：scorer 是纯函数）
const GOLD = {
  fields: [
    { prop: 'userName', label: '用户名', formtype: 'Input' },
    { prop: 'status', label: '状态', formtype: 'Select', dataOptions: [{ label: '启用', value: 1 }] },
    { prop: 'amount', label: '金额', formtype: 'InputNumber', formSpan: 12 },
  ],
  actions: ['add', 'edit'],
  columns: [
    { type: 'index', label: '序号', width: 60 },
    { prop: 'userName', label: '用户名' },
    { label: '金额信息', groups: [{ prop: 'amount', label: '金额' }] },
  ],
  dialogs: {
    add: { title: '新增', formItems: [{ prop: 'userName', label: '用户名', formtype: 'Input' }] },
  },
  expandConfig: { title: '详情', fields: [{ prop: 'amount', label: '金额' }] },
  mergeConfig: { rowsBy: ['status'] },
  tableOptions: { defaultSort: { prop: 'amount', order: 'descending' } },
  isHidden: undefined,
}

// 1) normalizeLabel：只归一排版差异，不做语义归一
console.log('align: normalizeLabel')
{
  check(normalizeLabel(' 金 额 ') === '金额', 'normalizeLabel: 去空白')
  check(normalizeLabel('金额（元）') === '金额元', 'normalizeLabel: 去全角括号')
  check(normalizeLabel('Amount') === 'amount', 'normalizeLabel: 小写')
  check(normalizeLabel('金额') !== normalizeLabel('价格'), 'normalizeLabel: 不做同义归一')
}

// 2) alignFields：单射 / 兜底 / 未匹配
console.log('align: alignFields')
{
  const p = clone(GOLD)
  p.fields = [{ prop: 'a', label: '用户名' }, { prop: 'b', label: '状态' }, { prop: 'c', label: '金额' }]
  const a = alignFields(GOLD, p)
  check(a.mode === 'label', 'alignFields: 默认 label 模式')
  check(a.map.get('userName').prop === 'a', 'alignFields: 按 label 对齐到改名后的 prop')
  check(a.unmatchedGold.length === 0 && a.unmatchedPred.length === 0, 'alignFields: 一一对应时无未匹配')

  const dup = { fields: [{ prop: 'x', label: '状态' }, { prop: 'y', label: '状态' }] }
  const a2 = alignFields({ fields: [{ prop: 's', label: '状态' }] }, dup)
  check(a2.map.get('s').prop === 'x', 'alignFields: 重复 label 认领第一个')
  check(a2.unmatchedPred.includes('y'), 'alignFields: 重复 label 的其余进 unmatchedPred（propSet 判负）')
  check(a2.ambiguous.length === 1, 'alignFields: 重复 label 记入 ambiguous')

  // 模型没写 label → prop 兜底
  const a3 = alignFields({ fields: [{ prop: 'status', label: '状态' }] }, { fields: [{ prop: 'status' }] })
  check(a3.map.get('status')?.prop === 'status', 'alignFields: 无 label 时 prop 兜底')

  // 漏字段 / 多字段
  const a4 = alignFields(GOLD, { fields: [{ prop: 'a', label: '用户名' }] })
  check(a4.unmatchedGold.includes('status') && a4.unmatchedGold.includes('amount'), 'alignFields: 漏字段进 unmatchedGold')
  const a5 = alignFields(GOLD, { fields: [...clone(GOLD.fields), { prop: 'z', label: '多余' }] })
  check(a5.unmatchedPred.includes('z'), 'alignFields: 多字段进 unmatchedPred')

  // en 腿：prop 身份（标签不可比）
  const a6 = alignFields(GOLD, { fields: [{ prop: 'userName' }, { prop: 'status' }, { prop: 'amount' }] }, { identity: 'prop' })
  check(a6.mode === 'prop' && a6.map.size === 3, 'alignFields: prop 身份直接按 prop 对齐')
}

// 3) 定义级断言（设计 §8.4 第一行）：pred 全部改名、label 不变 ⟹ 全维度 pass
console.log('align: 改名不改 label → 全维度 pass')
{
  const p = clone(GOLD)
  p.fields = [
    { prop: 'zhName', label: '用户名', formtype: 'Input' },
    { prop: 'zhStatus', label: '状态', formtype: 'Select', dataOptions: [{ label: '启用', value: 1 }] },
    { prop: 'zhAmount', label: '金额', formtype: 'InputNumber', formSpan: 12 },
  ]
  p.columns[1].prop = 'zhName'
  p.columns[2].groups[0].prop = 'zhAmount'
  p.dialogs.add.formItems[0].prop = 'zhName'
  p.expandConfig.fields[0].prop = 'zhAmount'
  p.mergeConfig.rowsBy = ['zhStatus']
  p.tableOptions.defaultSort.prop = 'zhAmount'

  const s = scoreAll(GOLD, p)
  for (const [k, v] of Object.entries(s.byCapability)) {
    if (v.applicable) check(v.pass === true, `改名后维度 ${k} 应 pass`)
  }
  check(s.exactIntentCore === true, '改名后 exactIntentCore 应 true')
  check(s.exactIntentFull === true, '改名后 exactIntentFull 应 true（columns/dialogs/mergeConfig/defaultSort 全部对齐）')
  check(s.propNameMatch === 0, '改名后 propNameMatch 应为 0（命名全不同，但理解全对）')

  // 诊断投影同源：判正时两侧相同
  for (const dim of ['columns', 'expandConfig', 'dialogs']) {
    const d = describeDimMiss(dim, GOLD, p)
    check(d && d.want === d.got, `改名后 ${dim} 的诊断投影两侧必须相同`)
  }
}

// 4) 改错仍然红（放宽的边界）
console.log('align: 改错仍红')
{
  const cases = [
    ['label 改错且 prop 对不上', (p) => { p.fields[0] = { prop: 'account', label: '账号', formtype: 'Input' } }, 'propSet'],
    ['漏一个字段', (p) => { p.fields.pop() }, 'propSet'],
    ['多一个字段', (p) => { p.fields.push({ prop: 'z', label: '多余' }) }, 'propSet'],
    ['formtype 改错', (p) => { p.fields[0].formtype = 'Select' }, 'formtype'],
    ['inQuery 改错', (p) => { p.fields[0].inQuery = false }, 'membership'],
    ['columns 结构变', (p) => { p.columns[2].groups[0].label = '别的' }, 'columns'],
    ['mergeConfig 列变', (p) => { p.mergeConfig.rowsBy = ['amount'] }, 'mergeConfig'],
    ['defaultSort 顺序变', (p) => { p.tableOptions.defaultSort.order = 'ascending' }, 'defaultSort'],
    ['defaultSort 漏写', (p) => { delete p.tableOptions.defaultSort }, 'defaultSort'],
  ]
  for (const [label, mutate, dim] of cases) {
    const p = clone(GOLD)
    p.fields = clone(GOLD.fields)
    mutate(p)
    const s = scoreAll(GOLD, p)
    check(s.byCapability[dim].pass === false, `${label} → 维度 ${dim} 应判负`)
  }

  // formtype/dataOptions 等字段级判定必须落到**对齐后**的 pred 字段上
  const renamedWrongFormtype = clone(GOLD)
  renamedWrongFormtype.fields = [
    { prop: 'a', label: '用户名', formtype: 'Select' },
    { prop: 'b', label: '状态', formtype: 'Select', dataOptions: [{ label: '启用', value: 1 }] },
    { prop: 'c', label: '金额', formtype: 'InputNumber', formSpan: 12 },
  ]
  check(scoreAll(GOLD, renamedWrongFormtype).byCapability.formtype.pass === false, '改名 + formtype 写错 → formtype 判负')

  // 字段级 pin 经对齐生效：`formtype:amount`（gold prop）必须命中改名后的 pred 字段
  const renamedOk = clone(GOLD)
  renamedOk.fields = [
    { prop: 'a', label: '用户名', formtype: 'Input' },
    { prop: 'b', label: '状态', formtype: 'Select', dataOptions: [{ label: '启用', value: 1 }] },
    { prop: 'c', label: '金额', formtype: 'InputNumber', formSpan: 12 },
  ]
  const scoped = scoreAll(GOLD, renamedOk, { pinnedDims: ['formtype:amount', 'propSet'] })
  check(scoped.exactIntentScoped === true, '字段级 pin 应经对齐命中改名后的字段')

  // 刻意的边界：prop 对上、label 写错 ⟹ 走 ② 兜底命中（与 R2 之前的尺子等价，不放宽也不收紧）。
  // 若哪天要收紧成「label 必须相等」，改这里的同时必须重跑全语料 —— 见 design §8.5。
  const wrongLabelSameProp = clone(GOLD)
  wrongLabelSameProp.fields = clone(GOLD.fields)
  wrongLabelSameProp.fields[0].label = '账号'
  check(scoreAll(GOLD, wrongLabelSameProp).byCapability.propSet.pass === true, 'prop 兜底：prop 对上时 label 差异仍判正（与旧尺子等价）')
}

// 5) 白名单：不该改的不能改
console.log('align: 白名单')
{
  const g = { fields: [{ prop: 'status', label: '状态' }], treeConfig: { childrenField: 'children' } }
  const p = { fields: [{ prop: 's', label: '状态' }], treeConfig: { childrenField: 'status' } }
  const { pred } = normalizePredForCompare(g, p)
  check(pred.treeConfig.childrenField === 'status', 'treeConfig.childrenField 是行数据键，不得被改写')

  // isHidden 的 field / 表达式 {var} 要改写
  const g2 = {
    fields: [
      { prop: 'status', label: '状态' },
      { prop: 'reason', label: '原因', isHidden: { field: 'status', op: 'eq', value: 1 } },
    ],
  }
  const p2 = {
    fields: [
      { prop: 's', label: '状态' },
      { prop: 'r', label: '原因', isHidden: { field: 's', op: 'eq', value: 1 } },
    ],
  }
  check(scoreAll(g2, p2).exactIntentFull === true, 'isHidden.field 改写后应判正')
  const p3 = clone(p2)
  p3.fields[1].isHidden.op = 'ne'
  check(scoreAll(g2, p3).exactIntentFull === false, 'isHidden.op 写错仍应判负')

  // 裸表达式形态（`frag-form-05` 的「金额大于 100」）：没有 field/expr 键，整棵就是表达式树；
  // 旧实现只认 field/expr/when，`{var}` 会漏改 —— 正确配置被判红。
  const g4 = {
    fields: [
      { prop: 'amount', label: '金额' },
      { prop: 'voucher', label: '凭证', isHidden: [{ field: 'amount', op: 'eq', value: 0 }, { '>': [{ var: 'amount' }, 100] }] },
    ],
  }
  const p5 = {
    fields: [
      { prop: 'a', label: '金额' },
      { prop: 'v', label: '凭证', isHidden: [{ field: 'a', op: 'eq', value: 0 }, { '>': [{ var: 'a' }, 100] }] },
    ],
  }
  check(scoreAll(g4, p5).exactIntentFull === true, '裸表达式形态的 {var} 改写后应判正')
  const p6 = clone(p5)
  p6.fields[1].isHidden[1] = { '>': [{ var: 'a' }, 200] }
  check(scoreAll(g4, p6).exactIntentFull === false, '裸表达式里的字面量改掉仍应判负')

  // reactions 的 dependencies / {var}
  const g3 = {
    fields: [
      { prop: 'status', label: '状态' },
      {
        prop: 'city',
        label: '城市',
        reactions: [{ dependencies: ['status'], when: { '==': [{ var: 'status' }, 1] }, fulfill: { required: { truthy: [{ var: 'city' }] } } }],
      },
    ],
  }
  const p4 = {
    fields: [
      { prop: 's', label: '状态' },
      {
        prop: 'c',
        label: '城市',
        reactions: [{ dependencies: ['s'], when: { '==': [{ var: 's' }, 1] }, fulfill: { required: { truthy: [{ var: 'c' }] } } }],
      },
    ],
  }
  check(scoreAll(g3, p4).exactIntentFull === true, 'reactions 的 dependencies/{var} 改写后应判正')
}

// 6) en 腿：prop 身份，历史数字不受影响
console.log('align: prop 身份（en 腿）')
{
  const p = clone(GOLD)
  const s = scoreAll(GOLD, p, undefined, { identity: 'prop' })
  check(s.alignMode === 'prop', 'identity=prop 应走 prop 模式')
  const renamed = clone(GOLD)
  renamed.fields = GOLD.fields.map((f) => ({ ...f, prop: 'x' + f.prop }))
  const s2 = scoreAll(GOLD, renamed, undefined, { identity: 'prop' })
  check(s2.byCapability.propSet.pass === false, 'prop 身份下改名应判负（en 腿口径不变）')
  check(propNameMatch(GOLD, p) === 1, 'propNameMatch: 全同应为 1')
}

if (failures) {
  console.error(`\nalign meta-eval FAILED: ${failures} 处`)
  process.exit(1)
}
console.log('\nalign meta-eval OK — 按 label 对齐、单射、白名单与「改错仍红」全部成立 ✔')
