#!/usr/bin/env node
/**
 * 评测产物自证与新鲜度（AN-03）
 *
 * 校验 `__tests__/golden/last-accuracy.json` 自身是否站得住：
 *   1. **结构**：身份字段齐全（commit / runId / corpusHash / fixedFieldsUsed / measurement）；
 *      `fixedFieldsUsed: true` 的诊断口径不得被当作发布产物。
 *   2. **算术**：`definition95.pass/total` 与 `rate` 自洽；`passed=true` 不得低于目标；
 *      徽章数字必须等于产物（徽章是公开发布面）。
 *   3. **新鲜度**：产物 commit / corpusHash 与当前工作区不一致 **只警告**，不判红。
 *      理由：master 上的产物由 nightly 提交，工作区/develop 天然领先若干提交；
 *      把它判红会让「每次改语料都红一次」，守卫随即变成噪声（恒红 = 红盲）。
 *
 * 注意：本检查**不**要求产物是当前 HEAD 的成绩 —— 那需要一次全量付费评测。
 * 它只保证「产物自己说的话前后一致、且相对工作区的新鲜度可见」。
 *
 * 用法：node scripts/check-artifact-freshness.mjs
 * 退出码：0 = 一致（可有警告）；1 = 产物自相矛盾或口径违规。
 */
import { readFileSync } from 'node:fs'
import { ACCURACY_FILE, CASES_DIR, corpusFingerprint, currentCommit, listCaseFiles, verifyArtifact } from './eval/artifact.mjs'

let artifact
try {
  artifact = JSON.parse(readFileSync(ACCURACY_FILE, 'utf8'))
} catch (err) {
  console.error(`❌ 读不到产物 ${ACCURACY_FILE}: ${err.message}`)
  console.error('   （产物由全量 eval 写入：npm run eval:llm）')
  process.exit(1)
}

const { failures, warnings } = verifyArtifact(artifact, {
  headCommit: currentCommit(),
  corpusHash: corpusFingerprint(listCaseFiles(CASES_DIR), CASES_DIR),
})

for (const w of warnings) console.warn(`⚠️  ${w}`)
if (failures.length) {
  for (const f of failures) console.error(`❌ ${f}`)
  process.exit(1)
}

const d = artifact.definition95
console.log(
  `✅ artifact self-consistent — measuredAt ${artifact.measuredAt}` +
    (d ? ` · definition95 ${(d.rate * 100).toFixed(1)}% (${d.pass}/${d.total})` : '')
)
