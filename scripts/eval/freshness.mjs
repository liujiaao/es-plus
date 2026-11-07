/**
 * P12 — 已发布评测产物的**新鲜度与分支语义**。
 *
 * ## 与 `artifact.mjs` 的分工
 *
 * `verifyArtifact` 回答「这份产物自己说的话前后一致吗」——它与分支无关，任何 ref 上都该绿。
 * 本模块回答另一个问题：**这个分支允许发布什么样的数字，以及它还能算数多久**。
 * 两者都必需：产物可以完全自洽却已经三周没刷新；也可以很新却是 `measurement: failed`。
 *
 * ## 当前的三类失效（本模块逐条封死）
 *
 * 1. **失败覆盖成功**：一次中继全灭把 407 行全部记成「未测到」，失败分支直接覆盖
 *    `last-accuracy.json` 与徽章，于是一份真实的 88.14% 被一份「没测到」抹掉。
 *    修法在写入方（`eval-llm.mjs` 写到 `FAILED_ACCURACY_FILE`）；本模块校验旁路文件
 *    存在时它**确实**是失败记录，且主产物仍是完整测量。
 * 2. **发布分支上长期没有完整测量**：master 的徽章是公开面，`failed`/legacy 产物
 *    不该被当作「可以算数的数字」。master 上判红；其它分支只警告（本地快照天然落后）。
 * 3. **数字描述的是旧语料 / 太旧**：`corpusHash` 与当前语料不符，或 `measuredAt`
 *    超过上限（默认 7 天）。master 上判红；其它分支警告。
 *
 * `commit` 漂移**永远只警告**：nightly 是「先测量、后提交产物」，所以 master 上产物的
 * `commit` 天然是提交它的那次 commit 的父提交 —— 把它判红会让 master 每次全绿变红。
 *
 * ## 为什么分支语义不能塞进 `verifyArtifact`
 *
 * PR/本地工作区里的产物是旧快照（`develop` 领先 master 若干提交），把它当红会让
 * 「每次改语料都红一次」；而 master 上继续只警告，则发布面可以在无人察觉的情况下
 * 停更数周。两种环境的正确答案不同，判据就必须知道自己在哪种环境里。
 */
import { execSync } from 'node:child_process'
import { diffPromptFingerprint, isPromptFingerprint } from './prompt-fingerprint.mjs'

export const PUBLISHED_BRANCH = 'master'
export const MAX_STALE_DAYS = 7
export const DAY_MS = 86_400_000

/** 环境变量优先（可测），其次 GitHub 的 ref（PR 是 `123/merge`，天然不是 master），最后问 git。 */
export function detectBranch(env = process.env, gitBranch = null) {
  if (env.ESPLUS_EVAL_BRANCH) return env.ESPLUS_EVAL_BRANCH
  if (env.GITHUB_REF_NAME) return env.GITHUB_REF_NAME
  if (gitBranch !== null) return gitBranch
  return null
}

/** `git rev-parse --abbrev-ref HEAD`；detached 时返回 null（按非发布分支处理）。 */
export function currentBranch() {
  try {
    const b = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim()
    return b && b !== 'HEAD' ? b : null
  } catch {
    return null
  }
}

export const isCompleteMeasurement = (m) => m === 'complete' || m === 'complete-gated-leg-only'

/**
 * @param {object} ctx
 * @param {object} ctx.artifact        `last-accuracy.json` 的内容
 * @param {string|null} ctx.branch     当前分支（`detectBranch`）
 * @param {string|null} [ctx.headCommit]
 * @param {string|null} [ctx.corpusHash] 当前语料指纹
 * @param {object|null} [ctx.promptFingerprint] 当前源码渲染出的模型输入指纹
 *        （由 `prompt-sources.mjs` 采集；不传则跳过这一条判据）
 * @param {number} [ctx.now]           ms（默认 Date.now()，测试可注入）
 * @param {number} [ctx.maxDays]       新鲜度上限
 * @param {string} [ctx.publishedBranch]
 * @returns {{failures: string[], warnings: string[]}}
 */
export function evaluateFreshness({
  artifact,
  branch,
  headCommit = null,
  corpusHash = null,
  promptFingerprint = null,
  now = Date.now(),
  maxDays = MAX_STALE_DAYS,
  publishedBranch = PUBLISHED_BRANCH,
} = {}) {
  const failures = []
  const warnings = []

  if (!artifact || typeof artifact !== 'object') {
    return { failures: ['产物不是对象 —— 无法判断新鲜度'], warnings }
  }

  const onPublishedBranch = branch === publishedBranch
  // 同一条判据在发布分支上是红、在其它分支上是警告，但消息必须说明「这里为什么只警告」，
  // 否则本地看到一行警告会以为 master 上也是同样的宽松。
  const publish = (msg) => {
    if (onPublishedBranch) failures.push(msg)
    else warnings.push(`${msg}（分支 ${branch ?? '(detached)'} 只警告；${publishedBranch} 上判红）`)
  }

  const measurement = artifact.measurement
  if (!isCompleteMeasurement(measurement)) {
    publish(
      `产物不是一次完整测量（measurement=${measurement ?? '(缺失)'}）—— ` +
        `发布分支必须有一份能核对门禁分母的数字；诊断请看失败记录旁路文件`
    )
  }

  if (typeof artifact.measuredAt !== 'string' || !Number.isFinite(Date.parse(artifact.measuredAt))) {
    publish(`产物 measuredAt 非法：${JSON.stringify(artifact.measuredAt)} —— 无法判断新鲜度`)
  } else {
    const ageDays = (now - Date.parse(artifact.measuredAt)) / DAY_MS
    if (ageDays > maxDays) {
      publish(
        `产物已 ${ageDays.toFixed(1)} 天未刷新（上限 ${maxDays} 天）—— ` +
          `徽章/门禁读到的数字已经过期，nightly 可能断了`
      )
    } else if (ageDays < -0.5) {
      warnings.push(`产物 measuredAt 在未来 ${(-ageDays).toFixed(1)} 天（时钟偏差？）`)
    }
  }

  if (corpusHash) {
    if (!artifact.corpusHash) {
      publish('产物缺 corpusHash —— 无法证明数字描述的是当前语料')
    } else if (artifact.corpusHash !== corpusHash) {
      publish(
        `产物 corpusHash ${artifact.corpusHash} ≠ 当前语料 ${corpusHash}` +
          ` —— 已发布的数字描述的是旧语料，需要一次新的完整测量`
      )
    }
  }

  // prompt 指纹与语料指纹同一条纪律：数字必须能被证明「是用当前这份 system prompt 测的」。
  // 旧产物没有这个键 → 只警告（不能让它红到下一次全量跑批为止，恒红 = 红盲）；
  // 有键但不一致 → 与 corpusHash 不符同样处理（master 上红、其它分支警告）：
  // prompt 改了而没重测，徽章上的数字就属于另一版教法，读者却会当成当前成绩。
  if (promptFingerprint) {
    if (artifact.promptFingerprint == null) {
      warnings.push(
        '产物无 `promptFingerprint`（模型输入指纹）—— 下一次全量跑批会补齐；' +
          '在补齐前，无法证明这份数字对应的 system prompt 仍是当前源码'
      )
    } else if (isPromptFingerprint(artifact.promptFingerprint)) {
      const diffs = diffPromptFingerprint(artifact.promptFingerprint, promptFingerprint)
      if (diffs.length) {
        publish(
          `产物 promptFingerprint 与当前源码不一致（${diffs.join('；')}）—— ` +
            `已发布的数字是用另一版 system prompt 测出来的，需要一次新的完整测量`
        )
      }
    }
    // 结构非法的情形由 `verifyArtifact` 判红（与分支无关），此处不重复报。
  }

  // 只警告：nightly 先测量、后提交产物（见文件头）。
  if (headCommit && artifact.commit && artifact.commit !== headCommit) {
    warnings.push(
      `产物 commit ${String(artifact.commit).slice(0, 8)} ≠ HEAD ${headCommit.slice(0, 8)}` +
        `（nightly 先测量后提交，master 上天然落后一个提交；工作区旧快照同理）`
    )
  }

  return { failures, warnings }
}

/**
 * 失败记录旁路文件的结构判定（复用 `verifyArtifact` 的「失败记录不得发布数字」等纪律，
 * 由调用方传入；这里只补旁路文件独有的、便宜且确定的形状检查）。
 *
 * `mainArtifact` 传入时再钉一条**成对**不变量：旁路文件只在「主产物仍是一份完整测量」
 * 时才有意义。若两份都不是完整测量，说明写入方在某个分支上漏判了，读者会看到两份失败
 * 记录却没有任何可算数的数字。
 */
export function evaluateFailedSidecar(sidecar, { mainArtifact = null } = {}) {
  const failures = []
  if (!sidecar || typeof sidecar !== 'object') {
    failures.push('失败记录旁路文件不是对象')
    return { failures }
  }
  if (sidecar.measurement !== 'failed') {
    failures.push(`失败记录旁路文件的 measurement=${JSON.stringify(sidecar.measurement)}，必须是 'failed'`)
  }
  if (!Array.isArray(sidecar.failures) || sidecar.failures.length === 0) {
    failures.push('失败记录旁路文件必须有非空的 failures[]（否则无法诊断为什么没测到）')
  }
  if (mainArtifact && !isCompleteMeasurement(mainArtifact.measurement)) {
    failures.push(
      `失败记录旁路文件存在，但主产物的 measurement=${mainArtifact.measurement ?? '(缺失)'} —— ` +
        '旁路文件只应在主产物保留完整测量时存在（否则没有可撤回的数字）'
    )
  }
  return { failures }
}
