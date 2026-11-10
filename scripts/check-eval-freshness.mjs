#!/usr/bin/env node
/**
 * 已发布评测产物的**分支语义与新鲜度**（P12）。
 *
 * `check:artifact-freshness` 只管「产物自己前后一致」；本守卫管另外三件事：
 *   1. 发布分支（master）上必须有一份**完整测量**，而不是 `failed`/legacy 记录；
 *   2. 数字不能描述**旧语料**（corpusHash）或太旧（measuredAt > 上限，默认 7 天）；
 *   3. 失败旁路文件（`last-accuracy.failed.json`）存在时，它必须确实是失败记录，
 *      且不得发布准确率数字 —— 一次失败的跑批只允许留下诊断，不允许撤回已发布的测量。
 *
 * 第 2 条从 2026-11-07 起还包含**模型输入指纹**（`promptFingerprint`）：语料没变但
 * system prompt 改了，徽章上的数字同样不属于当前源码。旧产物没有这个键时只警告
 * （下一次全量跑批补齐），有不一致则与 corpusHash 不符同等处理。
 *
 * 分支语义见 `scripts/eval/freshness.mjs` 头注：同一条判据在 master 上是红、
 * 在 PR/本地是警告（旧快照天然落后）。这里只负责读文件、选分支、打印。
 *
 * 环境变量：
 *   ESPLUS_EVAL_MAX_DAYS   新鲜度上限（默认 7）
 *   ESPLUS_EVAL_BRANCH     覆盖分支检测（测试/手工复核用）
 *
 * 注意：master 上判红会让 Typecheck 失败，而 Deploy Docs 依赖 Typecheck ⟹ 发布面
 * 过期时文档部署也会被挡。这是刻意的：宁可停下部署，也不能让一个过期数字继续冒充
 * 「当前成绩」。急修路径是补跑一次成功测量（`gh workflow run eval-llm.yml`）。
 *
 * 用法：node scripts/check-eval-freshness.mjs
 * 退出码：0 = 满足当前分支的要求（可有警告）；1 = 违反。
 */
import { existsSync, readFileSync } from 'node:fs'
import {
  ACCURACY_FILE,
  CASES_DIR,
  FAILED_ACCURACY_FILE,
  MISSES_FILE,
  corpusFingerprint,
  currentCommit,
  listCaseFiles,
  verifyArtifact,
} from './eval/artifact.mjs'
import {
  currentBranch,
  detectBranch,
  evaluateFailedSidecar,
  evaluateFreshness,
  evaluateMissesSidecar,
  MAX_STALE_DAYS,
} from './eval/freshness.mjs'

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    console.error(`❌ 读不到${label} ${path}: ${err.message}`)
    return null
  }
}

const artifact = readJson(ACCURACY_FILE, '产物')
if (!artifact) {
  console.error('   （产物由全量 eval 写入：npm run eval:llm）')
  process.exit(1)
}

const maxDays = Number(process.env.ESPLUS_EVAL_MAX_DAYS ?? MAX_STALE_DAYS)
if (!Number.isFinite(maxDays) || maxDays <= 0) {
  console.error(`❌ ESPLUS_EVAL_MAX_DAYS=${process.env.ESPLUS_EVAL_MAX_DAYS} 不是正数`)
  process.exit(2)
}

const branch = detectBranch(process.env, currentBranch())
const headCommit = currentCommit()
let corpusHash = null
try {
  corpusHash = corpusFingerprint(listCaseFiles(CASES_DIR), CASES_DIR)
} catch (err) {
  console.error(`❌ 语料指纹算不出来（${CASES_DIR}）：${err.message}`)
  process.exit(1)
}

// 当前源码渲染出的模型输入指纹。采集侧（prompt-sources）会现打包片段/前门工具，
// 与 eval 同源；CRUD 一项读 `@es-plus/shared` 构建产物 —— 故必须先 `npm run build:libs`
// （CI 的 consistency job 已在 check:consistency 之前 build shared）。
let promptFingerprint = null
try {
  const { currentPromptFingerprint } = await import('./eval/prompt-sources.mjs')
  promptFingerprint = await currentPromptFingerprint()
} catch (err) {
  console.error(`❌ 算不出模型输入指纹（promptFingerprint）：${err.message}`)
  console.error('   先 `npm run build:libs`（CRUD prompt 读 @es-plus/shared 构建产物；片段/前门现打包源码）。')
  process.exit(1)
}

const { failures, warnings } = evaluateFreshness({
  artifact,
  branch,
  headCommit,
  corpusHash,
  promptFingerprint,
  maxDays,
})

// 失败旁路文件：存在即代表「最近一次跑批没测到，主产物保留的是更早的完整测量」。
let sidecar = null
if (existsSync(FAILED_ACCURACY_FILE)) {
  sidecar = readJson(FAILED_ACCURACY_FILE, '失败记录')
  if (!sidecar) process.exit(1)
  failures.push(...evaluateFailedSidecar(sidecar, { mainArtifact: artifact }).failures)
  failures.push(...verifyArtifact(sidecar, { badgeFiles: [] }).failures)
  warnings.push(
    `最近一次跑批失败（诊断见 ${FAILED_ACCURACY_FILE}，${sidecar.measuredAt ?? '时间未知'}）；` +
      `主产物仍是 ${artifact.measuredAt ?? '时间未知'} 的${artifact.measurement ?? '未知'}记录`
  )
}

// W5 逐行归因旁路：存在时必须属于主产物那一次测量（W5 新增，旧产物没有该文件不报）。
if (existsSync(MISSES_FILE)) {
  const misses = readJson(MISSES_FILE, '逐行归因')
  if (!misses) process.exit(1)
  failures.push(...evaluateMissesSidecar(misses, { mainArtifact: artifact }).failures)
  warnings.push(`逐行归因旁路存在（${MISSES_FILE}）—— 已确认与主产物同一次测量`)
}

for (const w of warnings) console.warn(`⚠️  ${w}`)
if (failures.length) {
  for (const f of failures) console.error(`❌ ${f}`)
  console.error(
    `\n分支 ${branch ?? '(detached)'}：发布面必须在 ${MAX_STALE_DAYS} 天内有完整测量且语料一致。`
  )
  process.exit(1)
}

const d = artifact.definition95
console.log(
  `✅ eval freshness — branch ${branch ?? '(detached)'} · measurement ${artifact.measurement ?? '(legacy)'} · ` +
    `measuredAt ${artifact.measuredAt ?? '(unknown)'}` +
    (d ? ` · definition95 ${(d.rate * 100).toFixed(1)}% (${d.pass}/${d.total})` : '') +
    (artifact.prd?.gateOk === false ? ' · ⚠ PRD gate RED' : '')
)
