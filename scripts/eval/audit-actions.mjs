#!/usr/bin/env node
/**
 * 动作面一次性审计（L5；**不进 consistency**）。
 *
 * ## 它回答什么
 *
 * 每个 CRUD 用例打印一行：`NL 里出现的动作词` × `gold.actions / tableBtns` × `pred.actions`
 * （给了 dump 才有 pred 列）。人过一遍，就能把 L5 的三类情形分开：
 *
 *   1. NL 没点名、gold 有     → 语料缺陷（改 gold 或补 NL；门禁见 `check:gold-self`）；
 *   2. NL 点名、pred 没有     → 教学面缺失（补 few-shot）；
 *   3. 两边都点名但语义不同   → 人工裁（例如「导出」是表格导出还是行导出）。
 *
 * 判据与措辞表**复用** `scripts/lib/action-evidence.mjs`（与 `check:gold-self` 同一份，
 * 不另写一套谓词）。本脚本只做「打印 + 计数」，不修改任何语料、不写产物。
 *
 * ## 用法
 *
 *   node scripts/eval/audit-actions.mjs                       # 只审计 gold
 *   node scripts/eval/audit-actions.mjs .tmp-audit/pred.jsonl # 加一列 pred.actions
 *   node scripts/eval/audit-actions.mjs --json                # 机器可读
 *
 * 退出码恒为 0（审计不是门禁）：唯一例外是参数错误（2）。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isCrudCase } from './scenes.mjs'
import { readDump } from './dump.mjs'
import { ACTION_CUES, actionEvidenceProblems, detectVerbs, grantedVerbs, statedTextOf } from '../lib/action-evidence.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CASES_DIR = join(__dirname, '..', '..', '__tests__', 'golden', 'cases')

/** 审计整个语料目录（可注入 dump 行）；返回逐例结果，供 CLI 与单测复用。 */
export function auditActions({ casesDir = CASES_DIR, dumpPath = null } = {}) {
  /** file → { lang → row }（同一文件可能 zh/en 各一行）。 */
  const preds = new Map()
  if (dumpPath) {
    const { rows } = readDump(dumpPath)
    for (const r of rows) {
      if (r.kind !== 'crud') continue
      if (r.lang && r.lang !== 'zh') continue
      preds.set(r.file, r)
    }
  }
  const out = []
  for (const file of readdirSync(casesDir).filter((f) => f.endsWith('.json')).sort()) {
    const raw = JSON.parse(readFileSync(join(casesDir, file), 'utf8'))
    if (!isCrudCase(raw)) continue
    const text = statedTextOf(raw)
    // 打印「含动作词的分句」而不是整段 NL：审计时一眼就能判「这句是在要求动作，
    // 还是顺带提到」（例：「老数据导入时系统生成不了」是背景，不是授予）。
    const clauses = text.split(/[。；;\n]/).map((c) => c.trim()).filter((c) => c && detectVerbs(c).length)
    const goldActions = raw.config?.actions ?? []
    const goldBtns = (raw.config?.tableBtns ?? []).map((b) => b?.name).filter(Boolean)
    const row = preds.get(file)
    const predActions = Array.isArray(row?.turn0?.actions) ? row.turn0.actions : null
    out.push({
      file,
      nlVerbs: detectVerbs(text),
      // 授予语境里的动作词：只拿来判「NL 点名但 gold 漏」，避免「展开查看联系人」
      // 这类词面命中把审计变成噪声（见 grantedVerbs 头注）。
      granted: grantedVerbs(text),
      clauses,
      goldActions,
      goldBtns,
      predActions,
      // NL 点名但 gold 漏了（镜像缺陷：模型按 NL 写反而判负）
      goldMissing: grantedVerbs(text).filter((v) => !goldActions.includes(v)),
      // gold 有但 NL 没点名（死按钮；门禁 `check:gold-self` 会红）
      goldDead: actionEvidenceProblems(raw, { file }).map((p) => p.replace(`${file}: `, '')),
      // pred 多写 / 少写（只在给了 dump 时有意义）
      predExtra: predActions ? predActions.filter((a) => !goldActions.includes(a)) : null,
      predMissing: predActions ? goldActions.filter((a) => !predActions.includes(a)) : null,
    })
  }
  return out
}

function main(argv) {
  const json = argv.includes('--json')
  const explicit = argv.find((a) => !a.startsWith('--')) ?? null
  const dumpPath = explicit ?? (process.env.ESP_AUDIT_DUMP || null)
  const rows = auditActions({ dumpPath })

  if (json) {
    process.stdout.write(JSON.stringify(rows, null, 2) + '\n')
    return
  }

  const mark = (list) => (list.length ? list.join(',') : '·')
  for (const r of rows) {
    const flags = []
    if (r.goldDead.length) flags.push('DEAD-GOLD')
    if (r.goldMissing.length) flags.push('NL-NOT-IN-GOLD')
    if (r.predExtra?.length) flags.push('PRED-EXTRA')
    if (r.predMissing?.length) flags.push('PRED-MISSING')
    if (!flags.length) continue
    console.log(`${r.file}`)
    console.log(`  NL 动作词   : ${mark(r.nlVerbs)}`)
    for (const c of r.clauses) console.log(`  NL 分句     : ${c}`)
    console.log(`  gold.actions: ${mark(r.goldActions)}${r.goldBtns.length ? ` | 按钮: ${r.goldBtns.join(' / ')}` : ''}`)
    console.log(`  pred.actions: ${r.predActions ? mark(r.predActions) : '(未提供 dump)'}`)
    if (r.goldDead.length) console.log(`  ✗ gold 死动作: ${r.goldDead.join(' | ')}`)
    if (r.goldMissing.length) console.log(`  ✗ NL 点名但 gold 漏: ${r.goldMissing.join(',')}`)
    if (r.predExtra?.length) console.log(`  · pred 多写: ${r.predExtra.join(',')}`)
    if (r.predMissing?.length) console.log(`  · pred 少写: ${r.predMissing.join(',')}`)
  }
  const count = (k) => rows.filter((r) => (Array.isArray(r[k]) ? r[k].length : r[k])).length
  console.log(
    `\n[audit-actions] ${rows.length} 例；gold 死动作 ${count('goldDead')} / NL 点名但 gold 漏 ${count('goldMissing')}`
      + `${dumpPath ? ` / pred 多写 ${count('predExtra')} / pred 少写 ${count('predMissing')}` : ''}`
  )
}

// main-guard：被 import 时只导出纯函数，绝不执行扫描/打印
// （`gen-one-config-diff.mjs` 没有这层，import 它就会覆写产物 —— 同一类事故）。
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main(process.argv.slice(2))
  } catch (e) {
    console.error(`✗ ${e instanceof Error ? e.message : String(e)}`)
    process.exit(2)
  }
}

export { ACTION_CUES }
