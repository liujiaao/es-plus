#!/usr/bin/env node
/**
 * 记分卡自测（meta-eval，无需 API key，进 CI 的 check:consistency）。
 *
 * 记分卡自己也会错。这里钉两件事：
 *   1) gold-vs-gold：同一份 config 对自己打分，所有 applicable 维度必须全过、
 *      exactIntentCore / exactIntentFull 均为真——否则记分卡有假阴性，会把对的判错。
 *   2) 定向扰动「咬得住」：对每个维度做一处外科手术式改动，断言**该维度**翻红
 *      （且 exactIntentFull 随之翻红）——否则这个维度是睡着的，回归漏网。
 *
 * 另外对 25 个 golden case 做一次覆盖体检：报告哪些维度从未被语料触发（applicable=0），
 * 这类维度的 heldout rate 会恒为 n/a，是补语料的信号（不致命，仅提示）。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { StructuredCrudConfigSchema } from '@es-plus/shared'
import { CAPABILITY_SCORERS, scoreAll, describeDimMiss, isValidPinnedDim, parsePinnedDim, firstConvergedTurn, summarizeConvergence, meets95Definition, summarize95, COLUMN_KEY_CLASS, EDIT_RENDER_KEY_CLASS, EXPAND_KEY_CLASS } from './scorers.mjs'
import { isCrudCase } from './scenes.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CASES_DIR = join(__dirname, '..', '..', '__tests__', 'golden', 'cases')

let failures = 0
function check(cond, msg) {
  if (cond) return
  failures++
  console.error(`  ✗ ${msg}`)
}
const clone = (x) => JSON.parse(JSON.stringify(x))

// ── 覆盖全部维度的合成 base（仅需过 schema；scoreAll 不调用 generateFromConfig）──
const BASE_INPUT = {
  name: 'MetaEval',
  apiUrl: '/api/meta',
  target: 'vue2', //            → target 维度 applicable（非默认 vue3）
  mode: 'sfc', //              → mode 维度 applicable
  i18n: true, //               → i18n 维度 applicable
  typescript: true,
  tableOptions: { virtual: true, configTableOut: { tableData: 'rows', total: 'records' }, editConfig: { trigger: 'click', mode: 'cell' } }, // → virtualScroll + configTableOut + editConfig 维度 applicable
  formLayout: { labelWidth: '100px' }, //  → formLayout 维度 applicable（AI-31③：span 是幽灵键已删，只剩 labelWidth/minFoldRows）
  permissions: { add: 'meta:write', edit: 'meta:write' }, // → permissions 维度
  fields: [
    // isHidden：条件显隐（条件成立即隐藏；base.status 是 Select，value 取数字码）
    { prop: 'name', label: '名称', formtype: 'Input', querySpan: 12, isHidden: { field: 'status', op: 'eq', value: 1 } }, // → isHidden 维度 + fieldSpan 维度（查询面）
    { prop: 'status', label: '状态', formtype: 'Select', formSpan: 12, dataOptions: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] }, // → dataOptions 维度 + fieldSpan 维度（表单面）
    { prop: 'categoryId', label: '分类', formtype: 'Select', apiParams: { url: '/api/cat', labelField: 'name', valueField: 'id' } }, // → apiParams 维度
    { prop: 'amount', label: '金额', formtype: 'Input', inQuery: false, formatter: '(row) => row.amount.toFixed(2)' }, // → extPoints 维度
    { prop: 'createdAt', label: '创建时间', formtype: 'DatePicker', inForm: false },
    // reactions：字段联动（选项随 status 变化 + 必填随 name）→ reactions 维度
    { prop: 'city', label: '城市', formtype: 'Select', reactions: [{ dependencies: ['status'], when: { '==': [{ var: 'status' }, 1] }, fulfill: { dataOptions: [{ label: '杭州', value: 'hz' }], required: { truthy: [{ var: 'name' }] } } }] },
  ],
  actions: ['add', 'edit', 'delete', 'view'],
  tableBtns: [
    { name: '批量导出', position: 'left', actionType: 'export' },
    { name: '新增', type: 'primary', position: 'right', actionType: 'add' },
  ], // → tableBtns 维度
  operationColumn: { label: '操作', btns: [{ name: '编辑', dialogKey: 'edit' }] }, // → operationColumn 维度
  dialogs: {
    add: {
      title: '新增',
      // AI-27 底座数据键 + 声明式底栏：dialogs 维度的扰动/语义测试需要它们在场
      showClose: false,
      destroyOnClose: true,
      closeOnClickModal: false,
      appendTo: '#app-dialogs',
      formItems: [{ prop: 'name', label: '名称', formtype: 'Input' }],
      configBtn: [
        { name: '提交审批', type: 'primary', action: 'confirm' },
        { name: '取消', action: 'cancel' },
      ],
    },
    edit: { title: '编辑', formItems: [{ prop: 'name', label: '名称', formtype: 'Input' }, { prop: 'amount', label: '金额', formtype: 'Input' }] },
  }, // → dialogs 维度
  columns: [
    { type: 'selection' },
    { prop: 'name', label: '名称' },
    { label: '金额信息', groups: [{ prop: 'amount', label: '金额' }] },
  ], // → columns 维度（显式列逃生数组：非字段列 + 多级表头）
  expandConfig: { title: '详情', fields: [{ prop: 'createdAt', label: '创建时间' }] }, // → expandConfig 维度（声明式行展开内容）
  treeConfig: { childrenField: 'children', expandAll: true }, // → treeConfig 维度（声明式树表）
  mergeConfig: { rowsBy: ['status', 'name'] }, // → mergeConfig 维度（声明式合并单元格）
}

const base = StructuredCrudConfigSchema.parse(BASE_INPUT)

// 1) gold-vs-gold：全维度满分
console.log('meta-eval: gold-vs-gold')
{
  const s = scoreAll(base, base)
  for (const { key } of CAPABILITY_SCORERS) {
    const c = s.byCapability[key]
    if (c.applicable) check(c.pass === true, `gold-vs-gold: 维度 ${key} 应 pass 却为 ${c.pass}`)
  }
  check(s.exactIntentCore === true, 'gold-vs-gold: exactIntentCore 应为 true')
  check(s.exactIntentFull === true, 'gold-vs-gold: exactIntentFull 应为 true')
  // base 必须真的触发了每个维度，否则下面的扰动测不到
  for (const { key } of CAPABILITY_SCORERS) {
    check(s.byCapability[key].applicable === true, `base 未触发维度 ${key}（扰动测试会落空）`)
  }
}

// 2) 定向扰动：每个维度一处改动，断言该维度翻红
console.log('meta-eval: perturbations bite')
const PERTURB = {
  propSet: (c) => { c.fields.pop() },
  formtype: (c) => { c.fields[0].formtype = 'Select' },
  membership: (c) => { c.fields[0].inQuery = !c.fields[0].inQuery },
  actions: (c) => { c.actions.pop() },
  tableBtns: (c) => { c.tableBtns[0].code = c.tableBtns[0].code === 1 ? 2 : 1 },
  dialogs: (c) => { delete c.dialogs.edit },
  operationColumn: (c) => { c.operationColumn = false },
  permissions: (c) => { c.permissions.add = 'meta:other' },
  apiParams: (c) => { c.fields[2].apiParams.url = '/api/other' },
  dataOptions: (c) => { delete c.fields[1].dataOptions },
  i18n: (c) => { c.i18n = false },
  formLayout: (c) => { c.formLayout.labelWidth = '120px' },
  fieldSpan: (c) => { c.fields[0].querySpan = 24 },
  target: (c) => { c.target = 'vue3' },
  mode: (c) => { c.mode = 'schema' },
  virtualScroll: (c) => { c.tableOptions.virtual = false },
  configTableOut: (c) => { c.tableOptions.configTableOut.tableData = 'changed' },
  isHidden: (c) => { c.fields[0].isHidden.op = 'ne' },
  columns: (c) => { c.columns[0].type = 'index' },
  expandConfig: (c) => { c.expandConfig.title = '别的' },
  treeConfig: (c) => { c.treeConfig.expandAll = false },
  mergeConfig: (c) => { c.mergeConfig.rowsBy = ['name'] },
  editConfig: (c) => { c.tableOptions.editConfig.trigger = 'dblclick' },
  extPoints: (c) => { delete c.fields[3].formatter },
  reactions: (c) => { c.fields[5].reactions[0].fulfill.dataOptions = [{ label: '别的', value: 'x' }] },
}

for (const { key } of CAPABILITY_SCORERS) {
  const mutate = PERTURB[key]
  check(typeof mutate === 'function', `维度 ${key} 没有对应的扰动用例`)
  if (typeof mutate !== 'function') continue
  const pred = clone(base)
  mutate(pred)
  const s = scoreAll(base, pred)
  check(s.byCapability[key].pass === false, `扰动 ${key} 后该维度仍判 pass（咬不住）`)
  check(s.exactIntentFull === false, `扰动 ${key} 后 exactIntentFull 仍为 true`)
}

// 2a) dialogs 维度的 AI-27 半：底座数据键 + 声明式底栏
//     为什么单列：这批键是**本次新收进契约**的，若只靠「扰动删 dialogs.edit」，
//     删掉 showClose 比较也不会有任何用例变红 —— 判据会睡着（`check:scorers` 的价值就在这）。
console.log('meta-eval: dialogs 底座数据键 + configBtn (AI-27)')
{
  const dlgGold = {
    fields: [{ prop: 'a', label: 'A', formtype: 'Input' }],
    actions: ['add'],
    dialogs: {
      add: {
        title: '新增',
        showClose: false,
        destroyOnClose: true,
        appendTo: '#app-dialogs',
        formItems: [{ prop: 'a', label: 'A', formtype: 'Input' }],
        configBtn: [{ name: '提交', type: 'primary', action: 'confirm' }, { name: '取消', action: 'cancel' }],
      },
    },
  }
  const dialogsPass = (pred) => scoreAll(dlgGold, pred).byCapability.dialogs.pass
  check(dialogsPass(clone(dlgGold)) === true, 'dialogs(AI-27): gold-vs-gold 应判正')

  // 底座键：漏写 / 写反 / 值不同 都算未命中（gold 锁了就必须一模一样）
  const dropShowClose = clone(dlgGold)
  delete dropShowClose.dialogs.add.showClose
  check(dialogsPass(dropShowClose) === false, 'dialogs(AI-27): 漏写 showClose 应判负')
  const flipShowClose = clone(dlgGold)
  flipShowClose.dialogs.add.showClose = true
  check(dialogsPass(flipShowClose) === false, 'dialogs(AI-27): showClose 写反（false→true）应判负')
  const wrongAppendTo = clone(dlgGold)
  wrongAppendTo.dialogs.add.appendTo = '#other'
  check(dialogsPass(wrongAppendTo) === false, 'dialogs(AI-27): appendTo 选择器不同应判负')

  // configBtn：整数组按 name|type|action|permissionValue 比对 —— 少一个、改 action、改文案都算未命中
  const dropBtn = clone(dlgGold)
  dropBtn.dialogs.add.configBtn.pop()
  check(dialogsPass(dropBtn) === false, 'dialogs(AI-27): configBtn 少一个按钮应判负')
  const wrongAction = clone(dlgGold)
  wrongAction.dialogs.add.configBtn[0].action = 'custom'
  check(dialogsPass(wrongAction) === false, 'dialogs(AI-27): configBtn action 不同应判负')
  const wrongName = clone(dlgGold)
  wrongName.dialogs.add.configBtn[0].name = '保存'
  check(dialogsPass(wrongName) === false, 'dialogs(AI-27): configBtn 文案不同应判负')

  // gold 驱动：gold 没锁的键，pred 多写不追责（NL 没要求的东西不该罚）
  const plainGold = {
    fields: [{ prop: 'a', label: 'A', formtype: 'Input' }],
    actions: ['add'],
    dialogs: { add: { title: '新增', formItems: [{ prop: 'a', label: 'A', formtype: 'Input' }] } },
  }
  const extraKeys = clone(plainGold)
  extraKeys.dialogs.add.showClose = false
  extraKeys.dialogs.add.configBtn = [{ name: '随便', action: 'cancel' }]
  check(scoreAll(plainGold, extraKeys).byCapability.dialogs.pass === true,
    'dialogs(AI-27): gold 未声明的底座键/configBtn，pred 多写应免责')

  // **边界（故意的）**：前 AI-27 时代的键（width/isDraggable/maxHeight/fullscreen/isHiddenFooter）
  // 不进本半判据 —— 它们本就由硬编码转发，收进来会顺手改掉 `12-role-form-layout`（gold 声明
  // width:720）的判定并动到既有维度基线。这条用例钉住「刻意不在列」，防止后人顺手扩大。
  const widthGold = clone(plainGold)
  widthGold.dialogs.add.width = 720
  const widthDropped = clone(widthGold)
  check(scoreAll(widthGold, widthDropped).byCapability.dialogs.pass === true,
    'dialogs(AI-27): width 等前时代键刻意不参与本半判据（改了会动既有基线）')
}

// 2b) operationColumn 库默认派生等价（锁定本次 scorer 修复）
//     组件 es-crud-page 在省略 operationColumn 时按 actions 自动派生行按钮（view→查看/edit→编辑/
//     delete→删除），故「显式 btns=[编辑,删除]」与「省略 operationColumn + actions 含 edit/delete」
//     渲染同一组行按钮，判定必须相等——否则会把正确的极简配置误罚为 miss（库默认→scorer，非 overfit）。
console.log('meta-eval: operationColumn 库默认派生等价')
{
  const flds = [{ prop: 'name', label: '名称', formtype: 'Input', inQuery: true, inTable: true, inForm: true }]
  const gold = { fields: flds, actions: ['add', 'edit', 'delete'], operationColumn: { label: '操作', btns: [{ name: '编辑' }, { name: '删除' }] } }
  // 模型省略 operationColumn，但 actions 含 edit/delete → 组件派生 [编辑,删除] == gold.btns
  check(scoreAll(gold, { fields: flds, actions: ['add', 'edit', 'delete'] }).byCapability.operationColumn.pass === true,
    'operationColumn: 省略但 actions 派生出同一行按钮集 → 应判等')
  // 守恒：actions 缺 delete → 派生只有 [编辑] ≠ gold[编辑,删除] → 仍判负（真漏不放过）
  check(scoreAll(gold, { fields: flds, actions: ['add', 'edit'] }).byCapability.operationColumn.pass === false,
    'operationColumn: 省略且 actions 派生不出 gold 行按钮（缺 delete）→ 应判负')
  // view→查看 也在派生表内：显式 [查看,编辑,删除] == 省略 + actions 含 view/edit/delete
  const goldV = { fields: flds, actions: ['add', 'view', 'edit', 'delete'], operationColumn: { btns: [{ name: '查看' }, { name: '编辑' }, { name: '删除' }] } }
  check(scoreAll(goldV, { fields: flds, actions: ['add', 'view', 'edit', 'delete'] }).byCapability.operationColumn.pass === true,
    'operationColumn: view→查看 也在派生表内 → 判等')
  // 自定义行按钮（如处理/关闭）不在 actions 派生范围 → 模型省略仍判负
  const goldCustom = { fields: flds, actions: ['edit'], operationColumn: { btns: [{ name: '处理' }, { name: '关闭' }] } }
  check(scoreAll(goldCustom, { fields: flds, actions: ['edit'] }).byCapability.operationColumn.pass === false,
    'operationColumn: 自定义行按钮(处理/关闭)不可由 actions 派生 → 省略应判负')
}

// 2c) isHidden 维度的语义（整对象等值 / 数组形态 / 字段级细化）
//     条件显隐是行为契约而非扩展点兜底，故比**内容**（算子、value、数组顺序都算数），
//     与 configTableOut 同策略；extPoints 那种只比 presence 的是因为它比的是不可静态校验的源码串。
console.log('meta-eval: isHidden (declarative condition)')
{
  const cond = { field: 'b', op: 'eq', value: 'x' }
  const gold = { fields: [{ prop: 'a', label: 'A', formtype: 'Input', isHidden: cond }], actions: ['add'] }
  const wrongValue = clone(gold)
  wrongValue.fields[0].isHidden.value = 'y'
  check(scoreAll(gold, clone(gold)).byCapability.isHidden.pass === true, 'isHidden: 整对象一致应判正')
  check(scoreAll(gold, wrongValue).byCapability.isHidden.pass === false, 'isHidden: value 不符应判负')

  // 数组形态（AND）也按整对象等值 —— 顺序敏感
  const goldArr = { fields: [{ prop: 'a', label: 'A', formtype: 'Input', isHidden: [{ field: 'b', op: 'empty' }, { field: 'c', op: 'truthy' }] }], actions: ['add'] }
  check(scoreAll(goldArr, clone(goldArr)).byCapability.isHidden.pass === true, 'isHidden: 数组形态一致应判正')
  check(scoreAll(goldArr, gold).byCapability.isHidden.pass === false, 'isHidden: 数组→单条件应判负')

  // gold 没有任何 isHidden → 维度不 applicable（不参与记分）
  const plain = { fields: [{ prop: 'a', label: 'A', formtype: 'Input' }], actions: ['add'] }
  check(scoreAll(plain, plain).byCapability.isHidden.applicable === false, 'isHidden: gold 未声明时维度不 applicable')

  // 字段级细化：只钉该字段；未锁字段的 isHidden 猜错免责
  check(isValidPinnedDim('isHidden:a') === true, 'isValidPinnedDim: isHidden:a 合法')
  const m = { pinnedDims: ['isHidden:a'] }
  check(scoreAll(gold, clone(gold), m).exactIntentScoped === true, 'scoped: isHidden:a gold-vs-gold 应 true')
  check(scoreAll(gold, wrongValue, m).exactIntentScoped === false, 'scoped: 扰动 isHidden:a 应翻红')
  const twoField = {
    fields: [clone(gold.fields[0]), { prop: 'z', label: 'Z', formtype: 'Input', isHidden: { field: 'b', op: 'eq', value: 'q' } }],
    actions: ['add'],
  }
  const zChanged = clone(twoField)
  zChanged.fields[1].isHidden.value = 'zzz'
  check(scoreAll(twoField, zChanged, m).exactIntentScoped === true, 'scoped: 未锁字段 z 的 isHidden 应免责')

  // AI-16：表达式形态的 isHidden 复用同一条深等值路径 —— 形态无关（键排序后逐层比较），
  // 故无需为表达式新增维度：同一谓词不该被计两次。这里钉住「表达式确实被覆盖且判负正确」。
  const expr = { or: [{ '==': [{ var: 'status' }, 'pending'] }, { '>': [{ var: 'amount' }, 100] }] }
  const goldExpr = { fields: [{ prop: 'a', label: 'A', formtype: 'Input', isHidden: expr }], actions: ['add'] }
  check(scoreAll(goldExpr, clone(goldExpr)).byCapability.isHidden.pass === true, 'isHidden(expr): 表达式一致应判正')
  const exprWrongOp = clone(goldExpr)
  exprWrongOp.fields[0].isHidden.or[1] = { '>=': [{ var: 'amount' }, 100] }
  check(scoreAll(goldExpr, exprWrongOp).byCapability.isHidden.pass === false, 'isHidden(expr): 算子变（> → >=）应判负')
  const exprWrongVal = clone(goldExpr)
  exprWrongVal.fields[0].isHidden.or[0]['=='][1] = 'done'
  check(scoreAll(goldExpr, exprWrongVal).byCapability.isHidden.pass === false, 'isHidden(expr): 值变应判负')
  // 表达式与旧条件互不相等（形态不同即判负，不做「逻辑等价」推断）
  check(scoreAll(goldExpr, gold).byCapability.isHidden.pass === false, 'isHidden(expr): 表达式 vs 旧条件应判负')
  // gold 无 isHidden 时仍不 applicable（表达式不改变这一点）
  check(scoreAll(plain, plain).byCapability.isHidden.applicable === false, 'isHidden(expr): gold 未声明时维度不 applicable')
  // 字段级细化对表达式同样生效
  check(scoreAll(goldExpr, clone(goldExpr), { pinnedDims: ['isHidden:a'] }).exactIntentScoped === true, 'scoped: isHidden:a 表达式 gold-vs-gold 应 true')
  check(scoreAll(goldExpr, exprWrongVal, { pinnedDims: ['isHidden:a'] }).exactIntentScoped === false, 'scoped: 扰动表达式 isHidden:a 应翻红')
}

// 2c-bis) reactions 维度的语义（AI-07 字段联动）：整数组深等值 —— value↔dataOptions 互换、
//         dependencies 顺序、when 谓词错都算负；字段级细化只钉该字段。
console.log('meta-eval: reactions (field linkage)')
{
  const rule = { dependencies: ['province'], when: { '==': [{ var: 'province' }, 'zj'] }, fulfill: { dataOptions: [{ label: '杭州', value: 'hz' }] } }
  const gold = { fields: [{ prop: 'city', label: '城市', formtype: 'Select', reactions: [rule] }], actions: ['add'] }
  check(scoreAll(gold, clone(gold)).byCapability.reactions.pass === true, 'reactions: 整数组一致应判正')

  // dataOptions 内容改 → 负
  const wrongOpts = clone(gold)
  wrongOpts.fields[0].reactions[0].fulfill.dataOptions = [{ label: '南京', value: 'nj' }]
  check(scoreAll(gold, wrongOpts).byCapability.reactions.pass === false, 'reactions: dataOptions 内容不符应判负')

  // dependencies 序敏感
  const two = { dependencies: ['province', 'city'], fulfill: { required: { truthy: [{ var: 'a' }] } } }
  const goldDeps = { fields: [{ prop: 'a', label: 'A', formtype: 'Input', reactions: [two] }], actions: ['add'] }
  const depsSwapped = clone(goldDeps)
  depsSwapped.fields[0].reactions[0].dependencies = ['city', 'province']
  check(scoreAll(goldDeps, depsSwapped).byCapability.reactions.pass === false, 'reactions: dependencies 顺序不符应判负')

  // fulfill 键互换（value ↔ dataOptions）应判负
  const goldVal = { fields: [{ prop: 'mirror', label: '镜像', formtype: 'Input', reactions: [{ dependencies: ['province'], fulfill: { value: { var: 'province' } } }] }], actions: ['add'] }
  const asOpts = clone(goldVal)
  asOpts.fields[0].reactions[0].fulfill = { dataOptions: [{ label: 'x', value: 'y' }] }
  check(scoreAll(goldVal, asOpts).byCapability.reactions.pass === false, 'reactions: value↔dataOptions 互换应判负')

  // gold 无 reactions → 维度不 applicable
  const plain = { fields: [{ prop: 'a', label: 'A', formtype: 'Input' }], actions: ['add'] }
  check(scoreAll(plain, plain).byCapability.reactions.applicable === false, 'reactions: gold 未声明时维度不 applicable')

  // 字段级细化：只钉该字段；未锁字段的 reactions 猜错免责
  check(isValidPinnedDim('reactions:city') === true, 'isValidPinnedDim: reactions:city 合法')
  const m = { pinnedDims: ['reactions:city'] }
  check(scoreAll(gold, clone(gold), m).exactIntentScoped === true, 'scoped: reactions:city gold-vs-gold 应 true')
  check(scoreAll(gold, wrongOpts, m).exactIntentScoped === false, 'scoped: 扰动 reactions:city 应翻红')
  const twoField = {
    fields: [clone(gold.fields[0]), { prop: 'z', label: 'Z', formtype: 'Select', reactions: [clone(rule)] }],
    actions: ['add'],
  }
  const zChanged = clone(twoField)
  zChanged.fields[1].reactions[0].fulfill.dataOptions = [{ label: '别的', value: 'x' }]
  check(scoreAll(twoField, zChanged, m).exactIntentScoped === true, 'scoped: 未锁字段 z 的 reactions 应免责')
}

// 2d) columns（显式列逃生数组，AI-09 子项①）维度的语义：整数组深等值（列序 / 层级 / 非字段列都算数）
console.log('meta-eval: columns (explicit column array)')
{
  const cols = [
    { type: 'selection' },
    { prop: 'name', label: '名称' },
    { label: '组', groups: [{ prop: 'amount', label: '金额' }] },
  ]
  const gold = { fields: [{ prop: 'name', label: '名称', formtype: 'Input' }], actions: ['add'], columns: cols }
  check(scoreAll(gold, clone(gold)).byCapability.columns.pass === true, 'columns: 整数组一致应判正')

  const orderChanged = clone(gold)
  orderChanged.columns.reverse()
  check(scoreAll(gold, orderChanged).byCapability.columns.pass === false, 'columns: 列序变化应判负（顺序是契约）')

  const typeChanged = clone(gold)
  typeChanged.columns[0].type = 'index'
  check(scoreAll(gold, typeChanged).byCapability.columns.pass === false, 'columns: 非字段列 type 变化应判负')

  const groupsFlattened = clone(gold)
  delete groupsFlattened.columns[2].groups
  check(scoreAll(gold, groupsFlattened).byCapability.columns.pass === false, 'columns: 多级表头被拍平应判负')

  const predMissing = { fields: gold.fields, actions: gold.actions }
  check(scoreAll(gold, predMissing).byCapability.columns.pass === false, 'columns: pred 漏发整段 columns 应判负')

  // 装饰键投影（A2 / D15）：只影响布局呈现的键，**任一侧没写就不比较**，两侧都写才比值。
  // 语义：NL 没说的列宽/对齐/固定/排序，模型写了别的值不算做错；但两边都写了还写错，照样扣。
  const widthOnGold = clone(gold)
  widthOnGold.columns[1].width = 120
  check(scoreAll(widthOnGold, gold).byCapability.columns.pass === true, 'columns: gold 写 width、pred 未写应判正（猜不到≠做错）')
  check(scoreAll(gold, widthOnGold).byCapability.columns.pass === true, 'columns: pred 写 width、gold 未写应判正（对称豁免）')
  const widthBothWrong = clone(widthOnGold)
  widthBothWrong.columns[1].width = 180
  check(scoreAll(widthOnGold, widthBothWrong).byCapability.columns.pass === false, 'columns: 两侧都写 width 且不同应判负（写错仍扣）')
  const widthBothRight = clone(widthOnGold)
  check(scoreAll(widthOnGold, widthBothRight).byCapability.columns.pass === true, 'columns: 两侧都写 width 且相同应判正')

  const layoutOnly = clone(gold)
  Object.assign(layoutOnly.columns[1], { fixed: 'left', align: 'center', sortable: true, minWidth: 90 })
  check(scoreAll(layoutOnly, gold).byCapability.columns.pass === true, 'columns: fixed/align/sortable/minWidth 单侧声明应豁免')

  // 非字段列（index/selection）的惯用宽度同规；groups 递归里同样生效
  const selWidth = clone(gold)
  selWidth.columns[0].width = 50
  check(scoreAll(selWidth, gold).byCapability.columns.pass === true, 'columns: 非字段列（selection）width 单侧声明应豁免')
  const groupWidth = clone(gold)
  groupWidth.columns[2].groups[0].width = 100
  check(scoreAll(groupWidth, gold).byCapability.columns.pass === true, 'columns: groups 内层 width 单侧声明应豁免（递归投影）')
  const groupWidthBoth = clone(groupWidth)
  groupWidthBoth.columns[2].groups[0].width = 160
  check(scoreAll(groupWidth, groupWidthBoth).byCapability.columns.pass === false, 'columns: groups 内层两侧都写 width 且不同应判负')

  // editRender：autofocus 是装饰键；name/type/options/props/defaultValue 是编辑器契约，不豁免
  const erGold = clone(gold)
  erGold.columns[1].editRender = { name: '$input', autofocus: true }
  const erNoFocus = clone(gold)
  erNoFocus.columns[1].editRender = { name: '$input' }
  check(scoreAll(erGold, erNoFocus).byCapability.columns.pass === true, 'columns: editRender.autofocus 单侧声明应豁免')
  const erWrongName = clone(gold)
  erWrongName.columns[1].editRender = { name: '$select' }
  check(scoreAll(erGold, erWrongName).byCapability.columns.pass === false, 'columns: editRender.name 不同应判负（编辑器语义是契约）')
  const erMissingEditor = { fields: gold.fields, actions: gold.actions }
  check(scoreAll(erGold, erMissingEditor).byCapability.columns.pass === false, 'columns: pred 漏发整个 editRender 应判负（不是装饰）')

  // 行为键不豁免：permissionValue（无权限不出列）/ dataOptions（码值→文案）仍是契约
  const permChanged = clone(gold)
  permChanged.columns[1].permissionValue = 'meta:view'
  check(scoreAll(gold, permChanged).byCapability.columns.pass === false, 'columns: 单侧声明 permissionValue 应判负（行为契约不投影）')
  const cellOptions = clone(gold)
  cellOptions.columns[1].dataOptions = [{ label: '启用', value: 1 }]
  check(scoreAll(gold, cellOptions).byCapability.columns.pass === false, 'columns: 单侧声明 dataOptions 应判负（行为契约不投影）')

  // gold 无 columns → 维度不 applicable（派生路径，不参与记分）
  const plain = { fields: [{ prop: 'a', label: 'A', formtype: 'Input' }], actions: ['add'] }
  check(scoreAll(plain, plain).byCapability.columns.applicable === false, 'columns: gold 未声明时维度不 applicable')
}

// 2e) expandConfig（声明式行展开内容，AI-09 子项②）维度的语义：投影后的整体深等值
//（字段序 / 字段标签是渲染契约；标题串是装饰键 —— 单侧声明豁免，两侧都写才比值）
console.log('meta-eval: expandConfig (declarative row-expand content)')
{
  const ec = { title: '详情', fields: [{ prop: 'remark', label: '备注' }, { prop: 'createdAt', label: '创建时间' }] }
  const gold = { fields: [{ prop: 'name', label: '名称', formtype: 'Input' }], actions: ['add'], expandConfig: ec }
  check(scoreAll(gold, clone(gold)).byCapability.expandConfig.pass === true, 'expandConfig: 整体一致应判正')

  const fieldOrder = clone(gold)
  fieldOrder.expandConfig.fields.reverse()
  check(scoreAll(gold, fieldOrder).byCapability.expandConfig.pass === false, 'expandConfig: 字段序变化应判负（顺序是契约）')

  const titleChanged = clone(gold)
  titleChanged.expandConfig.title = '别的标题'
  check(scoreAll(gold, titleChanged).byCapability.expandConfig.pass === false, 'expandConfig: 两侧都写标题且不同应判负（写错仍扣）')

  // 装饰键投影：标题串单侧声明不判负（NL 极少陈述「展开区标题叫详情」）
  const titleOmitted = clone(gold)
  delete titleOmitted.expandConfig.title
  check(scoreAll(gold, titleOmitted).byCapability.expandConfig.pass === true, 'expandConfig: gold 写 title、pred 未写应判正')
  check(scoreAll(titleOmitted, gold).byCapability.expandConfig.pass === true, 'expandConfig: pred 写 title、gold 未写应判正（对称豁免）')

  // 字段标签不是装饰（标签是语义身份，阶段 A 的 label 身份要靠它）
  const labelChanged = clone(gold)
  labelChanged.expandConfig.fields[0].label = '别的标签'
  check(scoreAll(gold, labelChanged).byCapability.expandConfig.pass === false, 'expandConfig: 字段 label 变化应判负（标签是渲染契约）')

  const predMissing = { fields: gold.fields, actions: gold.actions }
  check(scoreAll(gold, predMissing).byCapability.expandConfig.pass === false, 'expandConfig: pred 漏发整段应判负')

  // gold 无 expandConfig → 维度不 applicable（无行展开，不参与记分）
  const plain = { fields: [{ prop: 'a', label: 'A', formtype: 'Input' }], actions: ['add'] }
  check(scoreAll(plain, plain).byCapability.expandConfig.applicable === false, 'expandConfig: gold 未声明时维度不 applicable')
}

// 2f) treeConfig（声明式树表，AI-09 子项③）维度的语义：整体深等值
console.log('meta-eval: treeConfig (declarative tree table)')
{
  const tc = { childrenField: 'subItems', expandAll: true }
  const gold = { fields: [{ prop: 'name', label: '名称', formtype: 'Input' }], actions: ['add'], treeConfig: tc }
  check(scoreAll(gold, clone(gold)).byCapability.treeConfig.pass === true, 'treeConfig: 整体一致应判正')

  const fieldChanged = clone(gold)
  fieldChanged.treeConfig.childrenField = 'children'
  check(scoreAll(gold, fieldChanged).byCapability.treeConfig.pass === false, 'treeConfig: childrenField 变化应判负（子键名是契约）')

  const expandChanged = clone(gold)
  expandChanged.treeConfig.expandAll = false
  check(scoreAll(gold, expandChanged).byCapability.treeConfig.pass === false, 'treeConfig: expandAll 变化应判负（默认展开状态是契约）')

  const predMissing = { fields: gold.fields, actions: gold.actions }
  check(scoreAll(gold, predMissing).byCapability.treeConfig.pass === false, 'treeConfig: pred 漏发整段应判负')

  // gold 无 treeConfig → 维度不 applicable（无树表，不参与记分）
  const flat = { fields: [{ prop: 'a', label: 'A', formtype: 'Input' }], actions: ['add'] }
  check(scoreAll(flat, flat).byCapability.treeConfig.applicable === false, 'treeConfig: gold 未声明时维度不 applicable')
}

// 2g) editConfig（vxe 行内编辑，AI-09 子项④）维度的语义：tableOptions.editConfig 整体深等值
console.log('meta-eval: editConfig (vxe inline editing)')
{
  const ec = { trigger: 'dblclick', mode: 'row', showStatus: true }
  const gold = { fields: [{ prop: 'name', label: '名称', formtype: 'Input' }], actions: ['add'], tableOptions: { editConfig: ec } }
  check(scoreAll(gold, clone(gold)).byCapability.editConfig.pass === true, 'editConfig: 整体一致应判正')

  const triggerChanged = clone(gold)
  triggerChanged.tableOptions.editConfig.trigger = 'click'
  check(scoreAll(gold, triggerChanged).byCapability.editConfig.pass === false, 'editConfig: trigger 变化应判负（进入编辑的方式是契约）')

  const modeChanged = clone(gold)
  modeChanged.tableOptions.editConfig.mode = 'cell'
  check(scoreAll(gold, modeChanged).byCapability.editConfig.pass === false, 'editConfig: mode 变化应判负（cell/row 是契约）')

  const predMissing = { fields: gold.fields, actions: gold.actions }
  check(scoreAll(gold, predMissing).byCapability.editConfig.pass === false, 'editConfig: pred 漏发整段应判负')

  // gold 无 editConfig → 维度不 applicable（无行内编辑，不参与记分）
  const plain = { fields: [{ prop: 'a', label: 'A', formtype: 'Input' }], actions: ['add'] }
  check(scoreAll(plain, plain).byCapability.editConfig.applicable === false, 'editConfig: gold 未声明时维度不 applicable')
}

// 2h) mergeConfig（声明式合并单元格，AI-23）维度的语义：顶层 mergeConfig 整体深等值
console.log('meta-eval: mergeConfig (declarative row merge)')
{
  const mc = { rowsBy: ['dept', 'team'] }
  const gold = { fields: [{ prop: 'dept', label: '部门', formtype: 'Input' }], actions: ['add'], mergeConfig: mc }
  check(scoreAll(gold, clone(gold)).byCapability.mergeConfig.pass === true, 'mergeConfig: 整体一致应判正')

  const colDropped = clone(gold)
  colDropped.mergeConfig.rowsBy = ['dept']
  check(scoreAll(gold, colDropped).byCapability.mergeConfig.pass === false, 'mergeConfig: 少一列应判负（哪几列合并是契约）')

  const orderSwapped = clone(gold)
  orderSwapped.mergeConfig.rowsBy = ['team', 'dept']
  check(scoreAll(gold, orderSwapped).byCapability.mergeConfig.pass === false, 'mergeConfig: 列序变化应判负（列序是契约）')

  const predMissing = { fields: gold.fields, actions: gold.actions }
  check(scoreAll(gold, predMissing).byCapability.mergeConfig.pass === false, 'mergeConfig: pred 漏发整段应判负')

  // gold 无 mergeConfig → 维度不 applicable（无合并，不参与记分）
  const flat = { fields: [{ prop: 'a', label: 'A', formtype: 'Input' }], actions: ['add'] }
  check(scoreAll(flat, flat).byCapability.mergeConfig.applicable === false, 'mergeConfig: gold 未声明时维度不 applicable')
}

// 3) scoped 口径（B2）：掩码自洽 + 掩码内咬得住 + 掩码外免责 + 空掩码退化
console.log('meta-eval: scoped metric (pinnedDims)')
{
  // mask 钉：字段集 + 仅金额列 formtype + actions。NL「没锁」status/createdAt 的 formtype。
  const mask = { pinnedDims: ['propSet', 'formtype:amount', 'actions'] }

  // 自洽：gold-vs-gold 下 scoped 必真
  check(scoreAll(base, base, mask).exactIntentScoped === true, 'scoped: gold-vs-gold 应为 true')

  // 掩码内扰动咬得住：金额列 formtype 变 → scoped 掉
  {
    const pred = clone(base)
    pred.fields[3].formtype = 'DatePicker' // fields[3] = amount
    check(scoreAll(base, pred, mask).exactIntentScoped === false, 'scoped: 扰动金额列 formtype（掩码内）应翻红')
  }
  // 掩码内扰动咬得住：actions 变 → scoped 掉
  {
    const pred = clone(base)
    pred.actions.pop()
    check(scoreAll(base, pred, mask).exactIntentScoped === false, 'scoped: 扰动 actions（掩码内）应翻红')
  }
  // 掩码外免责（本 PR 的核心价值）：status 列 formtype 猜错 → scoped **不**掉
  {
    const pred = clone(base)
    pred.fields[1].formtype = 'Input' // fields[1] = status（Select→Input），NL 没锁它
    const s = scoreAll(base, pred, mask)
    check(s.exactIntentScoped === true, 'scoped: 扰动掩码外字段 formtype 应免责（仍 true）')
    check(s.exactIntentCore === false, 'scoped: 该扰动应让 core 翻红（证明 scoped 比 core 宽在正确的地方）')
  }

  // 空掩码退化为 core（向后兼容）：无 mask 与 mask 为空数组都应 ≡ exactIntentCore
  {
    const pred = clone(base)
    pred.fields[1].formtype = 'Input'
    const noMask = scoreAll(base, pred)
    const emptyMask = scoreAll(base, pred, { pinnedDims: [] })
    check(noMask.exactIntentScoped === noMask.exactIntentCore, 'scoped: 无掩码应 ≡ core')
    check(emptyMask.exactIntentScoped === emptyMask.exactIntentCore, 'scoped: 空掩码数组应 ≡ core')
  }

  // token 合法性校验器（防标注漂移，供 check:cases 用）
  check(isValidPinnedDim('propSet') === true, 'isValidPinnedDim: 整维度 propSet 合法')
  check(isValidPinnedDim('formtype:amount') === true, 'isValidPinnedDim: 字段级 formtype:amount 合法')
  check(isValidPinnedDim('bogus') === false, 'isValidPinnedDim: 未知维度 bogus 非法')
  check(isValidPinnedDim('target:amount') === false, 'isValidPinnedDim: target 不可字段细化')
  check(isValidPinnedDim('formtype:') === false, 'isValidPinnedDim: 空字段名非法')

  // membership 的三个分量（inQuery/inTable/inForm）：只锁其一时互不牵连
  check(isValidPinnedDim('inQuery:amount') === true, 'isValidPinnedDim: inQuery:amount 合法')
  check(isValidPinnedDim('inQuery') === false, 'isValidPinnedDim: 裸 inQuery（非字段级）非法')
  {
    const m = { pinnedDims: ['inQuery:amount'] } // base.amount.inQuery=false
    check(scoreAll(base, base, m).exactIntentScoped === true, 'scoped: inQuery:amount gold-vs-gold 应 true')
    const bitPred = clone(base)
    bitPred.fields[3].inQuery = true // 翻转 amount.inQuery（锁定分量）→ 掉
    check(scoreAll(base, bitPred, m).exactIntentScoped === false, 'scoped: 翻转 inQuery:amount 应翻红')
    const sibPred = clone(base)
    sibPred.fields[3].inTable = false // 翻转 inTable（未锁分量）→ 不掉
    check(scoreAll(base, sibPred, m).exactIntentScoped === true, 'scoped: 翻转同字段 inTable（未锁分量）应免责')
  }
}

// 4) 语料覆盖体检（提示，不致命）+ 规格掩码标注合法性（致命，防漂移）
console.log('meta-eval: golden-corpus capability coverage + mask legality')
{
  const files = readdirSync(CASES_DIR).filter((f) => f.endsWith('.json')).sort()
  const applicableCount = Object.fromEntries(CAPABILITY_SCORERS.map((s) => [s.key, 0]))
  let convergenceCases = 0
  for (const f of files) {
    const raw = JSON.parse(readFileSync(join(CASES_DIR, f), 'utf8'))
    // 只体检 CRUD 场景：CAPABILITY_SCORERS 与掩码 token 全是 CRUD 形状的，片段用例
    // 的 config 过不了 StructuredCrudConfigSchema（Wave 1.1 起四场景同目录）。
    if (!isCrudCase(raw)) continue
    const g = StructuredCrudConfigSchema.parse(raw.config)
    for (const s of CAPABILITY_SCORERS) if (s.applicable(g)) applicableCount[s.key]++
    if (Array.isArray(raw.refinements) && raw.refinements.length) convergenceCases++

    // 掩码标注合法性（B2）：token 必须可记分；`维度:字段` 与 fixedFields 引用的 prop 必须真实存在。
    // 这把「NL 到底锁了什么」的标注钉死在 config 的真实字段上，杜绝 formtype:amuont 这类笔误静默免责。
    const props = new Set(g.fields.map((fd) => fd.prop))
    for (const token of raw.pinnedDims ?? []) {
      check(isValidPinnedDim(token), `${f}: pinnedDims token "${token}" 非法（维度名不可记分或字段级左半不可细化）`)
      const { field } = parsePinnedDim(token)
      if (field !== undefined) check(props.has(field), `${f}: pinnedDims "${token}" 引用的字段 "${field}" 不在 config.fields 中`)
    }
    for (const prop of raw.fixedFields ?? []) {
      check(props.has(prop), `${f}: fixedFields 的 "${prop}" 不在 config.fields 中（喂给模型的字段必须真实存在）`)
    }

    // 列键分类白名单（A2 / D15）：columns 里出现未分类的键就红 —— 逼新键先落分类。
    // 这不是洁癖：D15 的成因正是没人在意 `width` 属于哪一类，于是它把 11 个 heldout 行
    // 钉成不可过。新键（尤其来自 schema 扩充）必须在这里被显式判为结构键或装饰键。
    const walkCols = (arr, cb) => {
      for (const col of arr ?? []) {
        cb(col)
        walkCols(col.groups, cb)
      }
    }
    walkCols(g.columns, (col) => {
      for (const k of Object.keys(col)) {
        check(
          COLUMN_KEY_CLASS[k] !== undefined,
          `${f}: columns 出现未分类的键 "${k}"（请在 scorers.mjs 的 COLUMN_KEY_CLASS 里定为 structural/decoration）`
        )
      }
      if (col.editRender) {
        for (const k of Object.keys(col.editRender)) {
          check(
            EDIT_RENDER_KEY_CLASS[k] !== undefined,
            `${f}: columns[].editRender 出现未分类的键 "${k}"（请在 EDIT_RENDER_KEY_CLASS 里分类）`
          )
        }
      }
      if (col.expandConfig) {
        for (const k of Object.keys(col.expandConfig)) {
          check(EXPAND_KEY_CLASS[k] !== undefined, `${f}: columns[].expandConfig 出现未分类的键 "${k}"（请在 EXPAND_KEY_CLASS 里分类）`)
        }
      }
    })
    for (const k of Object.keys(g.expandConfig ?? {})) {
      check(EXPAND_KEY_CLASS[k] !== undefined, `${f}: expandConfig 出现未分类的键 "${k}"（请在 EXPAND_KEY_CLASS 里分类）`)
    }

    // 投影生效自检（A2 验收的镜像）：把 gold 的装饰键**全部删掉**，维度必须仍判正。
    // 等价于「只改/删 gold 的 width/title、NL 不动 ⟹ 仍 pass」；红了就是投影有漏（某个装饰键没进分类表）。
    const noDeco = clone(g)
    walkCols(noDeco.columns, (col) => {
      for (const k of Object.keys(col)) if (COLUMN_KEY_CLASS[k] === 'decoration') delete col[k]
      if (col.editRender) for (const k of Object.keys(col.editRender)) if (EDIT_RENDER_KEY_CLASS[k] === 'decoration') delete col.editRender[k]
      if (col.expandConfig) for (const k of Object.keys(col.expandConfig)) if (EXPAND_KEY_CLASS[k] === 'decoration') delete col.expandConfig[k]
    })
    for (const k of Object.keys(noDeco.expandConfig ?? {})) if (EXPAND_KEY_CLASS[k] === 'decoration') delete noDeco.expandConfig[k]
    const stripped = StructuredCrudConfigSchema.parse(noDeco)
    const projScore = scoreAll(g, stripped)
    if (g.columns && g.columns.length) {
      check(projScore.byCapability.columns.pass === true, `${f}: 删掉装饰键后 columns 维度未判正（投影有漏）`)
    }
    if (g.expandConfig) {
      check(projScore.byCapability.expandConfig.pass === true, `${f}: 删掉装饰键后 expandConfig 维度未判正（投影有漏）`)
    }
  }
  const uncovered = Object.entries(applicableCount).filter(([, n]) => n === 0).map(([k]) => k)
  for (const { key } of CAPABILITY_SCORERS) {
    console.log(`    ${key.padEnd(16)} ${applicableCount[key]} case(s)`)
  }
  if (uncovered.length) {
    console.warn(`  ⚠ 未被 golden 语料触发的维度（heldout rate 恒为 n/a，考虑补语料）：${uncovered.join(', ')}`)
  }
  // AN-02：收敛腿样本数。5 条时删一条摆动 20pp，不构成能力结论；30 是「可当结论」的门槛。
  console.log(`    收敛语料（refinements） ${convergenceCases} 条（地板 30）`)
  check(convergenceCases >= 30, `收敛语料仅 ${convergenceCases} 条，低于地板 30（AN-02）`)
}

// 5) B3 收敛判定（firstConvergedTurn / summarizeConvergence）：纯函数、无 API key
console.log('meta-eval: convergence (firstConvergedTurn / summarizeConvergence)')
{
  // firstConvergedTurn：首个 scoped 命中的 0-based 轮次；初稿即过 = 0；全程不过 = null
  check(firstConvergedTurn([{ exactIntentScoped: true }]) === 0, 'firstConvergedTurn: 初稿即收敛应为 0')
  check(
    firstConvergedTurn([{ exactIntentScoped: false }, { exactIntentScoped: false }, { exactIntentScoped: true }]) === 2,
    'firstConvergedTurn: 第 2 轮纠正后收敛应为 2'
  )
  check(
    firstConvergedTurn([{ exactIntentScoped: false }, { exactIntentScoped: false }]) === null,
    'firstConvergedTurn: 全程未收敛应为 null'
  )
  check(firstConvergedTurn([]) === null, 'firstConvergedTurn: 空序列应为 null')
  // 容忍布尔数组形态
  check(firstConvergedTurn([false, true]) === 1, 'firstConvergedTurn: 布尔数组形态可用')

  // summarizeConvergence：rateAtK / meanTurnsToConverge / converged / total
  const rows = [
    { firstTurn: 0 }, // zero-edit
    { firstTurn: 2 }, // 2 轮收敛
    { firstTurn: null }, // 未收敛
    { firstTurn: 4 }, // 4 轮才收敛（> K=3）
  ]
  const sum = summarizeConvergence(rows, 3)
  check(sum.total === 4, 'summarizeConvergence: total=4')
  check(sum.converged === 3, 'summarizeConvergence: converged=3（null 不计）')
  check(Math.abs(sum.rateAtK - 2 / 4) < 1e-9, 'summarizeConvergence: ≤3 轮内收敛 2/4') // turn 0 与 2，4 超 K、null 不算
  check(Math.abs(sum.meanTurnsToConverge - (0 + 2 + 4) / 3) < 1e-9, 'summarizeConvergence: 均值仅计已收敛 (0+2+4)/3')
  // AN-02 拆腿：turn0（零编辑）与 scripted（纠正后 ≤K）必须分开，二者之和 = withinK。
  check(sum.turn0 === 1, 'summarizeConvergence: turn0=1（只有 firstTurn 0）')
  check(sum.scripted === 1, 'summarizeConvergence: scripted=1（firstTurn 2；4 超 K 不计）')
  check(sum.withinK === 2, 'summarizeConvergence: withinK = turn0 + scripted')
  const empty = summarizeConvergence([], 3)
  check(
    empty.rateAtK === null && empty.meanTurnsToConverge === null && empty.total === 0 &&
      empty.turn0 === 0 && empty.scripted === 0 && empty.withinK === 0,
    'summarizeConvergence: 空语料回 null/0'
  )
}

// 6) 「95% 定义」统一判定（meets95Definition / summarize95）：scoped zero-edit ∨ ≤K 轮收敛
console.log('meta-eval: 95% definition (meets95Definition / summarize95)')
{
  const K = 3
  // 无收敛语料的行 → 只看第一条腿 exactIntentScoped
  check(meets95Definition({ exactIntentScoped: true }, K) === true, 'meets95: 无收敛语料、scoped 命中 → 过')
  check(meets95Definition({ exactIntentScoped: false }, K) === false, 'meets95: 无收敛语料、scoped 未命中 → 不过')
  // 有收敛语料的行 → 看 firstTurn ≤ K（firstTurn=0 即 zero-edit，天然涵盖第一条腿）
  check(meets95Definition({ convergence: { firstTurn: 0 } }, K) === true, 'meets95: zero-edit 收敛(firstTurn=0) → 过')
  check(meets95Definition({ convergence: { firstTurn: 3 } }, K) === true, 'meets95: 第 3 轮收敛(=K) → 过')
  check(meets95Definition({ convergence: { firstTurn: 4 } }, K) === false, 'meets95: 第 4 轮收敛(>K) → 不过')
  check(meets95Definition({ convergence: { firstTurn: null } }, K) === false, 'meets95: 未收敛(null) → 不过')
  // convergence 优先于 exactIntentScoped：第二条腿恢复的行即便 turn-0 scoped=false 也算过
  check(
    meets95Definition({ exactIntentScoped: false, convergence: { firstTurn: 1 } }, K) === true,
    'meets95: 第 1 轮恢复（turn-0 scoped=false）→ 过（第二条腿接住）'
  )

  // summarize95：pass / total / rate
  const rows = [
    { exactIntentScoped: true }, // 第一条腿过
    { exactIntentScoped: false }, // 两条腿都没过
    { exactIntentScoped: false, convergence: { firstTurn: 1 } }, // 第二条腿接住
    { convergence: { firstTurn: null } }, // 有语料但未收敛
  ]
  const s95 = summarize95(rows, K)
  check(s95.total === 4, 'summarize95: total=4')
  check(s95.pass === 2, 'summarize95: pass=2（第一条腿 1 + 第二条腿 1）')
  check(Math.abs(s95.rate - 2 / 4) < 1e-9, 'summarize95: rate=2/4')
  const empty95 = summarize95([], K)
  check(empty95.rate === null && empty95.pass === 0 && empty95.total === 0, 'summarize95: 空集回 null')
}

// ── 特征化：membership 的「裸 === 」语义（AI-33 · inQuery 陷阱的 ③）──────────
//
// 这里**不改** scorer 语义，只把现状钉住，让将来任何「归一化/宽容化」重构都成为一次
// **有意识的决定**而不是顺手改。上下文：schema 里三个开关默认 true，且 eval 对
// gold/pred **都先过 zod**，所以到 scorer 手里时「省略」已经不存在了 —— 它已经变成 `true`。
//
//   gold 省略  ──zod──▶  true   ┐
//                                ├─▶ 裸 === 比较 ⟹ 与 pred 的显式 false **不等**
//   pred 显式 false             ┘
//
// 这正是陷阱的机件。本仓的处置是**修语料 / 修 few-shot**（让 gold 忠实于自己的 NL，
// 见 scripts/check-membership-trap.mjs），**不是**让 scorer 把省略当「未表态」放过 ——
// 那种宽容化会让「NL 明说排除、模型却漏标」也白过，度量就成橡皮尺了。
{
  const parse = (b) =>
    StructuredCrudConfigSchema.parse({
      name: 'TrapProbe',
      apiUrl: '/api/trap',
      fields: [{ prop: 'a', label: 'A', formtype: 'Input' }, b],
      actions: ['add', 'edit', 'delete'],
    })
  const explicit = (flag) => parse({ prop: 'b', label: 'B', formtype: 'Input', inQuery: flag })
  const omitted = () => parse({ prop: 'b', label: 'B', formtype: 'Input' }) // 不写 inQuery
  const member = (g, p) => CAPABILITY_SCORERS.find((s) => s.key === 'membership').pass(g, p)

  check(member(explicit(false), explicit(false)), '陷阱特征化：两边都显式 false → 相等')
  check(member(explicit(true), explicit(true)), '陷阱特征化：两边都显式 true → 相等')
  check(member(explicit(true), explicit(false)) === false, '陷阱特征化：gold true vs pred false → 不等')
  check(member(explicit(false), explicit(true)) === false, '陷阱特征化：gold false vs pred true → 不等')
  // 承重的一条：**scorer 看不见「省略」** —— 省略过的 gold 与显式 true 的 gold，
  // 对同一个 pred 判定必然一致。故陷阱不可能在 scorer 层被「识别」并原谅，只能在上游
  // （语料/提示词）消除。「让 scorer 忽略省略」在物理上不成立，这条把该事实钉住。
  check(
    member(omitted(), explicit(false)) === member(explicit(true), explicit(false)),
    '陷阱特征化：省略过的 gold 与显式 true 的 gold 对同一 pred 判定必须一致（scorer 看不见省略）'
  )
  check(
    member(omitted(), explicit(true)) === true,
    '陷阱特征化：省略过的 gold 对 pred 的显式 true → 相等（省略 = true，不是「未表态」）'
  )
}

// ── 7) AN-01：真空真、dataOptions 公平判据、core 与维度同源 ─────────────────────
//
// 这一节钉的是「数字为什么可信」而不是某个维度的业务语义。三条都是**曾经真实抬高过
// 准确率**的机件，改回去任何一条，95% 就会重新变成橡皮尺。
console.log('meta-eval: AN-01 真空维度 / dataOptions / core 同源')
{
  const gold = { fields: [{ prop: 'a', label: 'A', formtype: 'Input' }], actions: ['add'] }
  // 模型一个 prop 都没猜对（或干脆没给字段）。
  const noShared = { fields: [{ prop: 'zzz', label: 'Z', formtype: 'Select' }], actions: ['add'] }
  const s = scoreAll(gold, noShared)
  check(s.byCapability.formtype.applicable === true, 'formtype: gold 用了它 → 仍 applicable（不能靠置不适用逃出分母）')
  check(s.byCapability.formtype.pass === false, 'formtype: 零共享字段 → 必须判负（`[].every` 恒真的真空真已修）')
  check(s.byCapability.membership.pass === false, 'membership: 零共享字段 → 必须判负')
  check(s.attrAcc === null, 'attrAcc: 零共享字段 → null（无定义，不得置 1）')
  check(s.exactIntentCore === false, 'core: 零共享字段 → false')
  const emptyPred = scoreAll(gold, { fields: [], actions: ['add'] })
  check(emptyPred.byCapability.formtype.pass === false, 'formtype: pred.fields 为空 → 判负')
  check(emptyPred.attrAcc === null, 'attrAcc: pred.fields 为空 → null')
  check(emptyPred.exactIntentCore === false, 'core: pred.fields 为空 → false')

  // dataOptions：标签树是「可推断的」（NL 说了分类名），value 码是后端约定（NL 没说）。
  const optGold = {
    fields: [
      {
        prop: 'status',
        label: '状态',
        formtype: 'Select',
        dataOptions: [
          { label: '草稿', value: 'draft' },
          { label: '已发布', value: 'published' },
        ],
      },
    ],
    actions: ['add'],
  }
  const dv = (pred) => scoreAll(optGold, pred).byCapability.dataOptions.pass
  check(dv(clone(optGold)) === true, 'dataOptions: gold-vs-gold 应判正')

  // value 码不同但标签正确 → **免责**（要求猜中 value 等于读心）
  const diffValues = clone(optGold)
  diffValues.fields[0].dataOptions[0].value = 'DRAFT'
  diffValues.fields[0].dataOptions[1].value = 2
  check(dv(diffValues) === true, 'dataOptions: 标签一致、value 码不同 → 应免责（后端约定不可推断）')

  // 标签写错 → 判负（这正是旧「只测 presence」放过的东西）
  const wrongLabel = clone(optGold)
  wrongLabel.fields[0].dataOptions[0].label = '暂存'
  check(dv(wrongLabel) === false, 'dataOptions: 标签不同 → 判负')

  // 漏一项 → 判负
  const fewer = clone(optGold)
  fewer.fields[0].dataOptions.pop()
  check(dv(fewer) === false, 'dataOptions: 少一个选项 → 判负')

  // 重复的 value → 判负（下拉会出现两个同值项，是真实缺陷）
  const dupValue = clone(optGold)
  dupValue.fields[0].dataOptions[1].value = 'draft'
  check(dv(dupValue) === false, 'dataOptions: 重复 value → 判负')

  // 层级被拍平（cascader 子项变平级）→ 标签树不同 → 判负
  const cascGold = {
    fields: [
      {
        prop: 'region',
        label: '地区',
        formtype: 'Cascader',
        dataOptions: [{ label: '浙江', value: 'zj', children: [{ label: '杭州', value: 'hz' }] }],
      },
    ],
    actions: ['add'],
  }
  const flat = { fields: [{ prop: 'region', label: '地区', formtype: 'Cascader', dataOptions: [{ label: '浙江', value: 'zj' }, { label: '杭州', value: 'hz' }] }], actions: ['add'] }
  check(scoreAll(cascGold, flat).byCapability.dataOptions.pass === false, 'dataOptions: 层级拍平 → 判负')

  // core 的 tableBtns 必须与维度同源（旧 core 只比 code，会把「名字完全不同」判过）
  const tbGold = { fields: gold.fields, actions: ['add'], tableBtns: [{ name: '导出', actionType: 'export' }] }
  const renamed = clone(tbGold)
  renamed.tableBtns[0].name = '导出数据'
  const ts = scoreAll(tbGold, renamed)
  check(ts.byCapability.tableBtns.applicable === true, 'tableBtns: gold 声明了 → applicable')
  check(ts.byCapability.tableBtns.pass === false, 'tableBtns: 名称不同 → 维度判负')
  check(ts.exactIntentCore === false, 'core: tableBtns 名称不同 → core 必须一起判负（同源）')
}

// ── describeDimMiss 与 pass 同源（`want === got` 当且仅当该维度 pass）──────────
/**
 * 这个不变量写在 `describeDimMiss` 的头注里，却一直没有测试 —— 2026-10-22 全量跑批
 * 的日志里就出现了它被违反的铁证：`101-schedule-date-edit-vue3` 打的是
 * `editConfig: want trigger=click · mode=cell | got trigger=click · mode=cell`
 * （两侧一模一样）却同时标成 miss。读日志的人只能得出「记分卡坏了」。
 *
 * 打印器是诊断的**唯一**出口：它说谎时，一次跑批里 60+ 条真实 miss 全部不可定位，
 * 而 `dialogs` 的底座键/声明式底栏、`treeConfig`、`columns` 三个维度**根本没有打印器**
 * （返回 null），对应 miss 在日志里就是一行无声的维度名。
 * （2026-10-27 A2/D15：这三个都已补齐；`expandConfig` 一并补上。）
 *
 * 判据取双向：相等必须 pass，pass 必须相等。反方向也要钉，否则「永远打印随机串」
 * 也能让 want≠got 恒成立 —— 那是把日志变成一个更吵的骗局。
 */
{
  const scorerOf = (key) => CAPABILITY_SCORERS.find((s) => s.key === key)
  /** 断言：该维度在 (g,p) 上判负，且诊断投影必须能把它讲出来。 */
  const expectMiss = (key, g, p, label) => {
    const s = scorerOf(key)
    if (!s) return check(false, `${key}: 维度不存在`)
    check(s.applicable(g) === true, `${key}: 夹具应 applicable（${label}）`)
    check(s.pass(g, p) === false, `${key}: ${label} → 应判负`)
    const d = describeDimMiss(key, g, p)
    check(!!d, `${key}: ${label} → 判负时必须有诊断投影（当前返回 null，日志里只剩一个维度名）`)
    if (!d) return
    check(
      d.want !== d.got,
      `${key}: ${label} → 判负时投影必须不同（got = ${JSON.stringify(d.got)}，want = ${JSON.stringify(d.want)}）`
    )
  }
  /** 断言：该维度判正，且投影两侧相同（否则 `want === got` 就不再等价于 pass）。 */
  const expectHit = (key, g, p, label) => {
    const s = scorerOf(key)
    check(s.pass(g, p) === true, `${key}: ${label} → 应判正`)
    const d = describeDimMiss(key, g, p)
    if (!d) return // 维度没有投影（attr 类由 attrMisses 覆盖），不承诺
    check(d.want === d.got, `${key}: ${label} → 判正时投影必须相同（want=${JSON.stringify(d.want)} got=${JSON.stringify(d.got)}）`)
  }

  // tableBtns / operationColumn：本来就是同源（tableBtnKeyParts / effectiveRowBtns），钉住不回退。
  expectHit('tableBtns', base, clone(base), 'gold-vs-gold')
  {
    const p = clone(base)
    p.tableBtns[0].actionType = 'custom'
    expectMiss('tableBtns', base, p, 'actionType 被改')
  }
  expectHit('operationColumn', base, clone(base), 'gold-vs-gold')
  {
    const p = clone(base)
    p.operationColumn.btns[0].name = '修改'
    expectMiss('operationColumn', base, p, '行按钮 name 被改')
  }

  // dialogs：判据含 formItems / 底座键 / 声明式底栏三半，打印器必须三半都在。
  expectHit('dialogs', base, clone(base), 'gold-vs-gold')
  {
    const p = clone(base)
    p.dialogs.add.formItems[0].prop = 'nameX'
    expectMiss('dialogs', base, p, 'formItems 的 prop 被改')
  }
  {
    // 底座数据键（AI-27）：gold 声明了 showClose=false，pred 写 true。
    const p = clone(base)
    p.dialogs.add.showClose = true
    expectMiss('dialogs', base, p, '底座键 showClose 被改（旧打印器只看 formItems，会打出两侧相同）')
  }
  {
    // 声明式底栏：action 写成 confirm→cancel 是真实可渲染、但语义相反的产物。
    const p = clone(base)
    p.dialogs.add.configBtn[0].action = 'cancel'
    expectMiss('dialogs', base, p, '底栏按钮 action 被改（旧打印器根本不看 configBtn）')
  }

  // treeConfig：判据是整对象深等值。
  {
    const g = { ...clone(base), treeConfig: { childrenField: 'children', expandAll: true } }
    expectHit('treeConfig', g, clone(g), 'gold-vs-gold')
    const p = clone(g)
    p.treeConfig.expandAll = false
    expectMiss('treeConfig', g, p, 'expandAll 被改')
  }

  // editConfig：判据是整对象深等值 —— 这正是生产日志里「want === got 却 miss」的形状：
  // 打印器只印 trigger/mode，而模型多写了一个键（或少写了），深等值因此不成立。
  expectHit('editConfig', base, clone(base), 'gold-vs-gold')
  {
    const p = clone(base)
    p.tableOptions.editConfig.showStatus = true
    expectMiss('editConfig', base, p, '模型多写了一个未锁定的键（日志曾对此打出两侧相同）')
  }

  // columns：62 条 miss 在日志里**完全无声**（没有投影，也没有 prop 级差异输出）。
  {
    const g = {
      ...clone(base),
      columns: [
        { type: 'selection', width: 50 },
        { prop: 'name', label: '名称' },
        { prop: 'status', label: '状态' },
      ],
    }
    expectHit('columns', g, clone(g), 'gold-vs-gold')
    const p = clone(g)
    p.columns.pop()
    expectMiss('columns', g, p, '漏掉一列')
    const p2 = clone(g)
    p2.columns[1].label = '名字'
    expectMiss('columns', g, p2, '列 label 被改')

    // A2/D15：装饰键被豁免时，投影必须**两侧相同**（否则 pass 了日志却说不一样）
    const w = clone(g)
    w.columns[1].width = 120
    expectHit('columns', w, g, 'width 单侧声明（装饰键豁免）')
  }

  // expandConfig：与 columns 同构的整体深等值（A2/D15 起补上打印器 + 标题装饰键投影）
  {
    const g = { ...clone(base), expandConfig: { title: '详情', fields: [{ prop: 'remark', label: '备注' }] } }
    expectHit('expandConfig', g, clone(g), 'gold-vs-gold')
    const p = clone(g)
    p.expandConfig.fields = []
    expectMiss('expandConfig', g, p, '漏掉展开字段')
    const noTitle = clone(g)
    delete noTitle.expandConfig.title
    expectHit('expandConfig', g, noTitle, '标题单侧声明（装饰键豁免）')
  }
}

if (failures) {
  console.error(`\nmeta-eval FAILED: ${failures} 处断言未过`)
  process.exit(1)
}
console.log('\nmeta-eval OK — 记分卡 gold-vs-gold 满分、每个维度扰动均咬得住。✔')
