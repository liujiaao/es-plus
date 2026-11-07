#!/usr/bin/env node
/**
 * P12 — offline guards for branch-aware freshness (`scripts/eval/freshness.mjs`).
 *
 * Pure functions, injected `now`: these assertions must not depend on the state of
 * the workspace artifact, or they would flip colour whenever the nightly runs.
 */
import {
  DAY_MS,
  MAX_STALE_DAYS,
  detectBranch,
  evaluateFailedSidecar,
  evaluateFreshness,
} from './freshness.mjs'

let checks = 0
const failures = []
function check(cond, msg) {
  checks++
  if (cond) return
  failures.push(msg)
  console.error(`  ✗ ${msg}`)
}
const has = (list, substr) => list.some((m) => m.includes(substr))
const clean = (r) => r.failures.length === 0

const NOW = Date.parse('2026-11-04T12:00:00.000Z')
const fresh = new Date(NOW - 2 * DAY_MS).toISOString()
const stale = new Date(NOW - (MAX_STALE_DAYS + 1) * DAY_MS).toISOString()

const complete = (over = {}) => ({
  commit: 'deadbeef',
  measurement: 'complete',
  measuredAt: fresh,
  corpusHash: 'hash-current',
  definition95: { k: 3, rate: 0.8814, pass: 171, total: 194 },
  ...over,
})
const failed = (over = {}) => ({
  commit: 'deadbeef',
  measurement: 'failed',
  measuredAt: fresh,
  corpusHash: 'hash-current',
  failures: ['one row unmeasured'],
  ...over,
})

// ─── 发布分支：必须完整、新鲜、语料一致 ─────────────────────────────────────
{
  check(clean(evaluateFreshness({ artifact: complete(), branch: 'master', corpusHash: 'hash-current', now: NOW })), 'master 上的新鲜完整测量必须通过')

  const r = evaluateFreshness({ artifact: failed(), branch: 'master', corpusHash: 'hash-current', now: NOW })
  check(!clean(r) && has(r.failures, '不是一次完整测量'), 'master 上 measurement=failed 必须判红')

  const legacy = complete()
  delete legacy.measurement
  const rLegacy = evaluateFreshness({ artifact: legacy, branch: 'master', corpusHash: 'hash-current', now: NOW })
  check(!clean(rLegacy) && has(rLegacy.failures, '不是一次完整测量'), 'master 上无 measurement 的 legacy 产物必须判红')

  const rStale = evaluateFreshness({ artifact: complete({ measuredAt: stale }), branch: 'master', corpusHash: 'hash-current', now: NOW })
  check(!clean(rStale) && has(rStale.failures, '天未刷新'), 'master 上超过上限必须判红')

  const rCorpus = evaluateFreshness({ artifact: complete(), branch: 'master', corpusHash: 'hash-new', now: NOW })
  check(!clean(rCorpus) && has(rCorpus.failures, 'corpusHash'), 'master 上语料指纹不一致必须判红')

  const rNoHash = evaluateFreshness({ artifact: complete({ corpusHash: undefined }), branch: 'master', corpusHash: 'hash-current', now: NOW })
  check(!clean(rNoHash) && has(rNoHash.failures, '缺 corpusHash'), 'master 上缺 corpusHash 必须判红（无法证明数字属于当前语料）')

  const rBadTime = evaluateFreshness({ artifact: complete({ measuredAt: 'not-a-date' }), branch: 'master', corpusHash: 'hash-current', now: NOW })
  check(!clean(rBadTime) && has(rBadTime.failures, 'measuredAt'), '非法 measuredAt 在 master 上必须判红')

  // commit 漂移**永远**只是警告：nightly 先测量后提交，master 上天然落后一个提交。
  const rCommit = evaluateFreshness({ artifact: complete(), branch: 'master', headCommit: 'cafebabe', corpusHash: 'hash-current', now: NOW })
  check(clean(rCommit), 'master 上 commit 漂移不得判红（nightly 先测量后提交）')
  check(has(rCommit.warnings, 'commit'), 'commit 漂移必须可见地提示')
}

// ─── 模型输入指纹：与语料指纹同一条纪律 ────────────────────────────────────
{
  const fp = (over = {}) => ({
    version: 1,
    crud: 'a'.repeat(16),
    prd: 'b'.repeat(16),
    fragments: { table: 'c'.repeat(16), form: 'd'.repeat(16), dialog: 'e'.repeat(16) },
    ...over,
  })
  const same = evaluateFreshness({
    artifact: complete({ promptFingerprint: fp() }),
    branch: 'master',
    corpusHash: 'hash-current',
    promptFingerprint: fp(),
    now: NOW,
  })
  check(clean(same) && !has(same.warnings, 'promptFingerprint'), '指纹一致时必须通过且不提示')

  // 旧产物：只警告，不能红到下一次全量跑批为止（恒红 = 红盲）。
  const legacy = evaluateFreshness({
    artifact: complete(),
    branch: 'master',
    corpusHash: 'hash-current',
    promptFingerprint: fp(),
    now: NOW,
  })
  check(clean(legacy) && has(legacy.warnings, 'promptFingerprint'), '产物无 promptFingerprint 时只警告')

  // prompt 改了而没重测：master 判红，消息必须点名是哪一项变了。
  const rCrud = evaluateFreshness({
    artifact: complete({ promptFingerprint: fp() }),
    branch: 'master',
    corpusHash: 'hash-current',
    promptFingerprint: fp({ crud: 'f'.repeat(16) }),
    now: NOW,
  })
  check(!clean(rCrud) && has(rCrud.failures, 'promptFingerprint') && has(rCrud.failures, 'crud'),
    'master 上 CRUD prompt 指纹不一致必须判红，并点名 crud')

  const rFrag = evaluateFreshness({
    artifact: complete({ promptFingerprint: fp() }),
    branch: 'master',
    corpusHash: 'hash-current',
    promptFingerprint: fp({ fragments: { ...fp().fragments, dialog: '0'.repeat(16) } }),
    now: NOW,
  })
  check(!clean(rFrag) && has(rFrag.failures, 'dialog'), 'master 上片段 prompt 指纹不一致必须判红，并点名场景')

  const rOther = evaluateFreshness({
    artifact: complete({ promptFingerprint: fp() }),
    branch: 'feat/x',
    corpusHash: 'hash-current',
    promptFingerprint: fp({ prd: 'f'.repeat(16) }),
    now: NOW,
  })
  check(clean(rOther) && has(rOther.warnings, 'promptFingerprint') && has(rOther.warnings, 'master 上判红'),
    '非发布分支上的 prompt 漂移只警告，且说明 master 上会判红')

  // 不传当前指纹（未采集）时不得凭空报警 —— 这条判据是可选注入。
  const noCurrent = evaluateFreshness({
    artifact: complete({ promptFingerprint: fp() }),
    branch: 'master',
    corpusHash: 'hash-current',
    now: NOW,
  })
  check(clean(noCurrent) && !has(noCurrent.warnings, 'promptFingerprint'), '未提供当前指纹时跳过该判据')

  // 结构非法由 verifyArtifact 判红（任何分支）；freshness 不重复报。
  const broken = evaluateFreshness({
    artifact: complete({ promptFingerprint: { version: 1 } }),
    branch: 'master',
    corpusHash: 'hash-current',
    promptFingerprint: fp(),
    now: NOW,
  })
  check(clean(broken), '结构非法的指纹不在 freshness 里二次判红（由 verifyArtifact 负责）')
}

// ─── 其它分支：同一条判据只警告 ─────────────────────────────────────────────
{
  const r = evaluateFreshness({ artifact: failed(), branch: 'feat/x', corpusHash: 'hash-current', now: NOW })
  check(clean(r), '非发布分支上的失败产物不得判红（本地旧快照是常态）')
  check(has(r.warnings, '不是一次完整测量') && has(r.warnings, 'master 上判红'), '警告必须说明它在 master 上会判红')

  const rStale = evaluateFreshness({ artifact: complete({ measuredAt: stale }), branch: 'develop', corpusHash: 'hash-current', now: NOW })
  check(clean(rStale) && has(rStale.warnings, '天未刷新'), '非发布分支上的过期产物只警告')

  const rCorpus = evaluateFreshness({ artifact: complete(), branch: 'feat/x', corpusHash: 'hash-new', now: NOW })
  check(clean(rCorpus) && has(rCorpus.warnings, 'corpusHash'), '非发布分支上的语料漂移只警告')

  const detached = evaluateFreshness({ artifact: failed(), branch: null, corpusHash: 'hash-current', now: NOW })
  check(clean(detached), 'detached HEAD 不得当成发布分支')
}

// ─── 未来时间：语义上不可能，但只提示（时钟偏差不是产物缺陷） ──────────────
{
  const ahead = new Date(NOW + 2 * DAY_MS).toISOString()
  const r = evaluateFreshness({ artifact: complete({ measuredAt: ahead }), branch: 'master', corpusHash: 'hash-current', now: NOW })
  check(clean(r) && has(r.warnings, '在未来'), '未来时间只提示，不判红')
}

// ─── 旁路失败记录的形状 ─────────────────────────────────────────────────────
{
  check(clean(evaluateFailedSidecar(failed())), '合法失败记录必须通过')
  const wrong = evaluateFailedSidecar(complete())
  check(!clean(wrong) && has(wrong.failures, 'measurement'), '旁路文件写成完整测量必须判红（放错了地方）')
  const noList = evaluateFailedSidecar(failed({ failures: [] }))
  check(!clean(noList) && has(noList.failures, 'failures'), '旁路文件缺 failures[] 必须判红')
  const notObject = evaluateFailedSidecar(null)
  check(!clean(notObject), '旁路文件不是对象必须判红')

  // 成对不变量：旁路文件只在主产物保留完整测量时才有意义。
  check(
    clean(evaluateFailedSidecar(failed(), { mainArtifact: complete() })),
    '主产物是完整测量时，旁路失败记录合法'
  )
  const bothFailed = evaluateFailedSidecar(failed(), { mainArtifact: failed() })
  check(!clean(bothFailed) && has(bothFailed.failures, '主产物'), '主产物也是失败记录时必须判红（两份失败、没有可算数的数字）')
  check(
    clean(evaluateFailedSidecar(failed())),
    '不传主产物时只做旁路文件自身的形状检查'
  )
}

// ─── 分支检测优先级 ─────────────────────────────────────────────────────────
{
  check(detectBranch({ ESPLUS_EVAL_BRANCH: 'a', GITHUB_REF_NAME: 'b' }, 'c') === 'a', '显式环境变量优先')
  check(detectBranch({ GITHUB_REF_NAME: 'master' }, 'feat/x') === 'master', 'GitHub ref 次之（schedule 为默认分支）')
  check(detectBranch({}, 'feat/x') === 'feat/x', '最后回退到 git 分支')
  check(detectBranch({}, null) === null, '拿不到就是 null（按非发布分支处理）')
  // PR 的 GITHUB_REF_NAME 是 `123/merge`，天然不等于 master —— 这里钉住，避免以后改成
  // 「以 refs/heads/ 前缀判断」时把 PR 误判成发布分支。
  check(detectBranch({ GITHUB_REF_NAME: '123/merge' }, 'master') !== 'master', 'PR ref 不得被当成发布分支')
}

if (failures.length) {
  console.error(`\nfreshness meta-eval FAILED: ${failures.length}/${checks} 处断言未过`)
  process.exit(1)
}
console.log(`✅ freshness meta-eval — ${checks}/${checks} 处断言通过`)
