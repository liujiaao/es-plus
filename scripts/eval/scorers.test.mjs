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
import { CAPABILITY_SCORERS, scoreAll } from './scorers.mjs'

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
  tableOptions: { virtual: true }, // → virtualScroll 维度 applicable
  formLayout: { span: 12 }, //  → formLayout 维度 applicable
  permissions: { add: 'meta:write', edit: 'meta:write' }, // → permissions 维度
  fields: [
    { prop: 'name', label: '名称', formtype: 'Input' },
    { prop: 'status', label: '状态', formtype: 'Select', dataOptions: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] }, // → dataOptions 维度
    { prop: 'categoryId', label: '分类', formtype: 'Select', apiParams: { url: '/api/cat', labelField: 'name', valueField: 'id' } }, // → apiParams 维度
    { prop: 'amount', label: '金额', formtype: 'Input', inQuery: false, formatter: '(row) => row.amount.toFixed(2)' }, // → extPoints 维度
    { prop: 'createdAt', label: '创建时间', formtype: 'DatePicker', inForm: false },
  ],
  actions: ['add', 'edit', 'delete', 'view'],
  tableBtns: [
    { name: '批量导出', position: 'left', actionType: 'export' },
    { name: '新增', type: 'primary', position: 'right', actionType: 'add' },
  ], // → tableBtns 维度
  operationColumn: { label: '操作', btns: [{ name: '编辑', dialogKey: 'edit' }] }, // → operationColumn 维度
  dialogs: {
    add: { title: '新增', formItems: [{ prop: 'name', label: '名称', formtype: 'Input' }] },
    edit: { title: '编辑', formItems: [{ prop: 'name', label: '名称', formtype: 'Input' }, { prop: 'amount', label: '金额', formtype: 'Input' }] },
  }, // → dialogs 维度
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
  formLayout: (c) => { c.formLayout.span = 24 },
  target: (c) => { c.target = 'vue3' },
  mode: (c) => { c.mode = 'schema' },
  virtualScroll: (c) => { c.tableOptions.virtual = false },
  extPoints: (c) => { delete c.fields[3].formatter },
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

// 3) 语料覆盖体检（提示，不致命）
console.log('meta-eval: golden-corpus capability coverage')
{
  const files = readdirSync(CASES_DIR).filter((f) => f.endsWith('.json')).sort()
  const applicableCount = Object.fromEntries(CAPABILITY_SCORERS.map((s) => [s.key, 0]))
  for (const f of files) {
    const raw = JSON.parse(readFileSync(join(CASES_DIR, f), 'utf8'))
    const g = StructuredCrudConfigSchema.parse(raw.config)
    for (const s of CAPABILITY_SCORERS) if (s.applicable(g)) applicableCount[s.key]++
  }
  const uncovered = Object.entries(applicableCount).filter(([, n]) => n === 0).map(([k]) => k)
  for (const { key } of CAPABILITY_SCORERS) {
    console.log(`    ${key.padEnd(16)} ${applicableCount[key]} case(s)`)
  }
  if (uncovered.length) {
    console.warn(`  ⚠ 未被 golden 语料触发的维度（heldout rate 恒为 n/a，考虑补语料）：${uncovered.join(', ')}`)
  }
}

if (failures) {
  console.error(`\nmeta-eval FAILED: ${failures} 处断言未过`)
  process.exit(1)
}
console.log('\nmeta-eval OK — 记分卡 gold-vs-gold 满分、每个维度扰动均咬得住。✔')
