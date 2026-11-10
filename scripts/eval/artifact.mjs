/**
 * 评测产物的**身份与自证**（AN-03）
 *
 * ## 为什么需要这个文件
 *
 * `last-accuracy.json` 以前只说「多少分」，不说「哪次提交、哪份语料、有没有喂 fixedFields」。
 * 于是出现过两类真实误判：
 *   · 工作区里的 10-18 旧快照被当成当前 HEAD 的成绩（分支分叉被读成「夜间断供」）；
 *   · 一次 146 行 en 腿 403 的运行，产物里只有一个 0.0%，事后无法判断它是「模型不会」
 *     还是「根本没测到」。
 *
 * 本模块是**唯一的**身份/指纹算法来源：`scripts/eval-llm.mjs` 写产物时用它，
 * `scripts/check-artifact-freshness.mjs` 校验产物时也用它 —— 两边若各写一份，
 * 守卫校验的就不是产物实际写下的东西了（这正是本仓库反复栽过的「双真源」坑）。
 */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
// 收敛腿样本地板：与 eval 的守卫共用同一个常量（写死第二份必然漂移）。
import { CONVERGE_SAMPLE_FLOOR } from './ratchet.mjs'
import { RULER_VERSION } from './dump.mjs'
import { isPromptFingerprint } from './prompt-fingerprint.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const ROOT = join(__dirname, '..', '..')
export const CASES_DIR = join(ROOT, '__tests__', 'golden', 'cases')
export const ACCURACY_FILE = join(ROOT, '__tests__', 'golden', 'last-accuracy.json')
/**
 * 失败记录的**旁路**文件（P12）：`last-accuracy.json` 只放「已发布的一次完整测量」。
 *
 * 为什么需要它：一次中继整段不可用会让 407 行全部未测到，而失败分支此前**直接覆盖**
 * `last-accuracy.json` 与两枚徽章 —— 于是一份真实的 88.14% 完整测量被一份「没测到」
 * 抹掉，仓库的发布面反而比昨晚更差。这不是模型退步，是记录被破坏。
 *
 * 现在的纪律：
 *   · 已有一份完整测量 ⟹ 失败记录写到本文件，`last-accuracy.json` 与徽章**一个字节都不动**；
 *   · 还没有完整测量（全新仓库）⟹ 失败记录仍写主文件（否则失败不可诊断），旁路文件清掉；
 *   · 下一次成功 ⟹ 删除旁路文件（失败已被一次完整测量取代）。
 */
export const FAILED_ACCURACY_FILE = join(ROOT, '__tests__', 'golden', 'last-accuracy.failed.json')
export const BADGE_FILE = join(ROOT, '__tests__', 'golden', 'last-accuracy-badge.json')
export const BADGE_SCOPED_FILE = join(ROOT, '__tests__', 'golden', 'last-accuracy-badge-scoped.json')

/**
 * 逐行失败归因的**旁路**产物（W5）。
 *
 * 为什么不塞进 `last-accuracy.json`：主产物是「已发布读数」的契约，几十个守卫按字段
 * 绑定它；把逐行明细（最坏几百行）混进去，既让每次读数 diff 变成噪声，也让「数字」
 * 与「为什么」的消费者耦合。旁路文件带**同一份身份块**，`check-eval-freshness` 用它
 * 证明「这份归因属于当前这次测量」，过期即红。
 */
export const MISSES_FILE = join(ROOT, '__tests__', 'golden', 'last-accuracy-misses.json')

/**
 * 「已发布的准确率」字段。`measurement: 'failed'` 的记录**不得**带这些数字 ——
 * 失败的意思是「这次没有测量」，而不是「测出来是 0 分」；把两者混在一起，读者就再也
 * 分不清「模型不会」与「没测到」（2026-10-13/14 两夜的产物正是这个形状）。
 *
 * 刻意**不**包含 `compileRate` / `typecheck` / `fragments` / `prd`：它们是确定性代码或
 * 独立语料的性质，不受 CRUD 中继故障影响，失败记录**应该**带上（见 eval-llm 失败分支注释）。
 */
export const PUBLISHED_ACCURACY_KEYS = Object.freeze([
  'definition95',
  'inSchemaIntentZeroEdit',
  'inSchemaIntentScoped',
  'inSchemaIntentZeroEditAll',
  'inSchemaIntentScopedAll',
  'coreRate',
  'exactIntentFull',
  'exactIntentFullAll',
  'propSetF1',
  'propNameMatch',
  'attributeAccuracy',
  'actionsF1',
])

/**
 * 失败记录写到哪里（P12）—— 一个**纯函数**，因为这是「撤回已发布数字」的唯一决策点，
 * 且它只在失败夜执行；混在 `eval-llm.mjs` 里就只能靠一次真故障来验证。
 *
 *   · `'sidecar'`：已有一份完整测量 ⟹ 失败的跑批只留诊断，主产物与徽章不动；
 *   · `'primary'`：还没有可撤回的东西（全新仓库 / pre-AN-03 旧产物 / 上一次也是失败）
 *     ⟹ 失败记录就是主产物，公开面必须显示灰度（否则读者会把旧数字当成绩）。
 */
export function failedRecordTarget(existing) {
  const m = existing?.measurement
  return m === 'complete' || m === 'complete-gated-leg-only' ? 'sidecar' : 'primary'
}

const sha = (parts) => {
  const h = createHash('sha256')
  for (const p of parts) {
    h.update(p)
    h.update('\0')
  }
  return h.digest('hex').slice(0, 16)
}

/**
 * 语料指纹：**排序后的文件名 + 内容**。文件名进哈希是刻意的 ——
 * 把 `a.json` 改名成 `b.json` 而内容不变，也是一次语料变更（用例的引用顺序/身份变了）。
 */
export function corpusFingerprint(files, dir = CASES_DIR) {
  const parts = []
  for (const f of files) {
    // 指纹要回答的是「语料内容变了吗」，不是「这份检出用 CRLF 还是 LF」。
    // Windows（core.autocrlf=true）与 CI 的检出字节不同；不归一化的话同一份语料
    // 会算出两个哈希，`check:artifact-freshness` 就把平台差异误报成「语料已变更」，
    // 真实变更反而淹没在噪声里。LF 检出（CI）归一化后哈希不变。
    const text = readFileSync(join(dir, f), 'utf8').replace(/\r\n/g, '\n')
    parts.push(f, Buffer.from(text, 'utf8'))
  }
  return sha(parts)
}

export function listCaseFiles(dir = CASES_DIR) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
}

export function currentCommit() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

/**
 * 产物身份块。挂在**成功与失败**两种记录上 —— 失败记录同样需要能被定位
 * （否则只能从 Actions 日志反推它属于哪次提交、哪份语料）。
 */
export function artifactIdentity({
  corpusHash,
  corpusFiles,
  fixedFieldsUsed,
  rulerVersion = RULER_VERSION,
  promptFingerprint = null,
}) {
  return {
    commit: process.env.GITHUB_SHA || currentCommit(),
    runId: process.env.GITHUB_RUN_ID || null,
    artifactSource: process.env.GITHUB_RUN_ID ? 'ci' : 'local',
    corpusHash,
    corpusFiles,
    fixedFieldsUsed: Boolean(fixedFieldsUsed),
    // 尺子版本（Ruler v3 起）：把「两个百分比是不是同一把尺子量出来的」写成产物里的事实。
    // 与 dump 的 meta 同源同串 —— 复算、棘轮、产物三方比对的都是这一个值。
    rulerVersion,
    // 模型输入指纹（prompt 版本）：把「这份数字是哪一版 system prompt 测出来的」写成事实。
    // 语料变更有 corpusHash，prompt 变更此前没有任何痕迹 —— 改一句教法，旧分数仍挂在徽章上。
    // 传 null 时不写键（老调用方/测试不受影响）；写出后由 verifyArtifact 校验结构、
    // 由 check:eval-freshness 与当前源码比对（见 prompt-fingerprint.mjs）。
    ...(promptFingerprint == null ? {} : { promptFingerprint }),
  }
}

export const REQUIRED_IDENTITY_KEYS = [
  'commit',
  'runId',
  'artifactSource',
  'corpusHash',
  'corpusFiles',
  'fixedFieldsUsed',
  'measurement',
]

/**
 * 产物自证：结构、算术、口径。
 *
 * 返回 `{ failures, warnings }`：
 * - **failures** = 产物**自相矛盾或口径违规**，任何环境都必须红（与提交/语料漂移无关）；
 * - **warnings** = 产物**比当前工作区旧**（commit/corpusHash 不一致）。这是正常的：
 *   master 上的产物由 nightly 提交，而 `develop`/本地工作区总是领先几个提交。
 *   **不能**把它当红，否则每次改语料都红一次、守卫立刻变成噪声。
 *
 * @param {object} artifact  last-accuracy.json 的内容
 * @param {object} ctx
 * @param {string|null} [ctx.headCommit]  当前 HEAD
 * @param {string|null} [ctx.corpusHash]  当前语料指纹
 * @param {number} [ctx.target]           门禁目标（默认 0.95）
 * @param {Array<[string, (a:object)=>unknown]>} [ctx.badgeFiles]
 *        徽章文件与取值器（默认仓库内那对；仅供单测注入临时文件）
 */
export function verifyArtifact(artifact, ctx = {}) {
  const failures = []
  const warnings = []
  const { headCommit = null, corpusHash = null, target = 0.95 } = ctx

  if (!artifact || typeof artifact !== 'object') {
    return { failures: ['产物不是对象'], warnings }
  }

  // ── 1. 身份字段齐全（旧产物没有这些字段 = 无法追溯，下次真实跑批后会自带） ──
  // 「一个都没有」与「只写了几个」必须区别对待：
  //   · 全无 = pre-AN-03 的历史格式。若直接判红，守卫会一直红到下一次全量付费评测为止，
  //     而长期恒红等于红盲（本仓库的反复教训）。只警告，让它在下次跑批时自然收敛。
  //   · 有但缺 = 写入方漏字段（新产物必须自证），这是真的缺陷，判红。
  const present = REQUIRED_IDENTITY_KEYS.filter((k) => k in artifact && artifact[k] !== undefined)
  const legacyArtifact = present.length === 0
  if (legacyArtifact) {
    warnings.push('产物是 pre-AN-03 旧格式（无 commit/corpusHash/fixedFieldsUsed）—— 下一次全量跑批会补齐')
  } else {
    for (const k of REQUIRED_IDENTITY_KEYS) {
      if (!(k in artifact) || artifact[k] === undefined) failures.push(`缺少身份字段 \`${k}\``)
    }
    // `rulerVersion` 刻意**不在** REQUIRED_IDENTITY_KEYS 里：已提交的产物是旧代码写的，
    // 把它判红会让守卫一直红到下一次夜间全量跑批为止（恒红 = 红盲）。缺了只提示。
    if (typeof artifact.rulerVersion !== 'string') {
      warnings.push('产物无 `rulerVersion`（Ruler v3 之前写的）—— 下一次全量跑批会补齐；期间的百分比不可与新版横向比较')
    }
    // `promptFingerprint` 同理：已提交的产物是旧写入方写的。缺了只提示，等下一次全量跑批
    // 自然补齐；写出来但结构坏了则是写入方缺陷（与「缺字段」不是一回事），判红。
    if (artifact.promptFingerprint === undefined) {
      warnings.push(
        '产物无 `promptFingerprint`（模型输入指纹）—— 下一次全量跑批会补齐；' +
          '在补齐前，无法证明这份数字对应的 system prompt 仍是当前源码'
      )
    } else if (!isPromptFingerprint(artifact.promptFingerprint)) {
      failures.push(
        `产物 promptFingerprint 结构非法：${JSON.stringify(artifact.promptFingerprint)} ` +
          '—— 必须是 { version, crud, prd, fragments:{table,form,dialog} } 的 16 位十六进制指纹'
      )
    }
  }
  // 诊断口径绝不允许被发布：喂了 fixedFields 的数字不是生产口径。
  if (artifact.fixedFieldsUsed === true) {
    failures.push('`fixedFieldsUsed: true` 是诊断口径（字段名由语料给出），不得作为发布产物')
  }
  // 失败记录允许没有分数，但必须有 reason；成功记录必须有测量归属。
  const measurement = artifact.measurement
  if (measurement && !['complete', 'complete-gated-leg-only', 'failed'].includes(measurement)) {
    failures.push(`未知的 \`measurement\`: ${measurement}`)
  }
  if (measurement === 'failed' && !Array.isArray(artifact.failures)) {
    failures.push('失败产物缺少 `failures[]`（无法诊断为什么没测到）')
  }
  // 失败记录**不得**发布准确率数字（P12）。`measurement: 'failed'` 说的是「没测到」，
  // 不是「测出来 0 分」；两者一旦混在一起，公开面就无法区分模型退步与中继故障。
  // 这条判据与分支无关：任何 ref 上出现都是红。
  if (measurement === 'failed') {
    const published = PUBLISHED_ACCURACY_KEYS.filter((k) => artifact[k] !== undefined && artifact[k] !== null)
    if (published.length) {
      failures.push(
        `measurement=failed 却发布了准确率字段：${published.join(', ')}（失败记录只放诊断，不得发布数字）`
      )
    }
  }

  // ── 2. 算术自洽（当前所有数字都从同一个 scorer 出来，写错即矛盾） ──
  const d95 = artifact.definition95
  if (d95 && typeof d95 === 'object') {
    const { pass, total, rate } = d95
    if (!Number.isInteger(pass) || !Number.isInteger(total) || total <= 0) {
      failures.push(`definition95 的 pass/total 非法：${pass}/${total}`)
    } else if (typeof rate === 'number' && Math.abs(pass / total - rate) > 0.001) {
      failures.push(`definition95.rate=${rate} 与 ${pass}/${total}=${(pass / total).toFixed(4)} 不符`)
    }
    if (typeof rate === 'number' && (rate < 0 || rate > 1)) {
      failures.push(`definition95.rate=${rate} 越界`)
    }
  }
  // ── AN-13：编译门进入 `passed`，产物必须自洽 ──────────────────────────────
  // 新产物带 `compileMeasured`（分母 = 有产物的行）。旧产物没有这个字段，按旧口径放行 ——
  // 否则守卫会一直红到下一次完整付费跑批为止（长期恒红 = 红盲，本仓库反复的教训）。
  if (Number.isInteger(artifact.compileMeasured)) {
    const { compileMeasured, compileCompiled, compileRate, compileFailure } = artifact
    if (!Number.isInteger(compileCompiled) || !Number.isInteger(compileFailure)) {
      failures.push(`编译口径字段非法：compiled=${compileCompiled} failure=${compileFailure}`)
    } else if (compileCompiled + compileFailure !== compileMeasured) {
      failures.push(`编译口径不自洽：${compileCompiled} 通过 + ${compileFailure} 失败 ≠ ${compileMeasured} 有产物`)
    } else if (compileMeasured > 0 && typeof compileRate !== 'number') {
      failures.push('compileMeasured > 0 但 compileRate 不是数字')
    } else if (compileMeasured > 0 && Math.abs(compileCompiled / compileMeasured - compileRate) > 0.001) {
      failures.push(`compileRate=${compileRate} 与 ${compileCompiled}/${compileMeasured} 不符`)
    }
    if (artifact.passed === true && compileRate !== 1) {
      failures.push(`passed=true 但 compileRate=${compileRate} ≠ 1（AN-13：编译门已进入 passed）`)
    }
    // 按语言拆开的诊断视图（A5：分母已含 en 腿）。**不**参与门禁，故只查两条：
    // 每个桶自身自洽；各桶之和与全局分母一致（不一致 ⟹ 拆分与总数来自两次不同的聚合，
    // 读者会拿一个去解释另一个）。旧产物没有这个键 → 跳过。
    const byLang = artifact.compileByLang
    if (byLang && typeof byLang === 'object') {
      let sum = 0
      let intact = true
      for (const [lang, b] of Object.entries(byLang)) {
        if (!b || !Number.isInteger(b.measured) || !Number.isInteger(b.compiled) || !Number.isInteger(b.failure)) {
          failures.push(`compileByLang.${lang} 字段非法：${JSON.stringify(b)}`)
          intact = false
          continue
        }
        if (b.compiled + b.failure !== b.measured) {
          failures.push(`compileByLang.${lang} 不自洽：${b.compiled} 通过 + ${b.failure} 失败 ≠ ${b.measured}`)
          intact = false
        }
        sum += b.measured
      }
      if (intact && sum !== compileMeasured) {
        warnings.push(
          `compileByLang 各语言分母之和 ${sum} ≠ compileMeasured ${compileMeasured} ` +
            `（拆分是诊断视图；比率仍以全局一对为准）`
        )
      }
    }
  }
  // ── A3：门禁口径的逐维视图（`byCapabilityOnPinned`）── 只查算术自洽 ──────────
  // 它是**观测**口径（不进门禁），但「pass > applicable」是自相矛盾的数字，与观测无关。
  // 旧产物没有这个块 → 跳过（与 AN-13/AN-18 同一处置：恒红 = 红盲）。
  const pinnedCaps = artifact.byCapabilityOnPinned
  if (pinnedCaps && typeof pinnedCaps === 'object') {
    for (const [key, c] of Object.entries(pinnedCaps)) {
      if (!c || !Number.isInteger(c.applicable) || !Number.isInteger(c.pass) || c.pass < 0 || c.pass > c.applicable) {
        failures.push(`byCapabilityOnPinned.${key} 非法：pass=${c?.pass} applicable=${c?.applicable}`)
        continue
      }
      if (c.applicable === 0 && c.rate !== null) {
        failures.push(`byCapabilityOnPinned.${key}：applicable=0 时 rate 必须是 null（不能把「没人 pin」写成 0）`)
      }
    }
  }
  // ── AN-18：片段腿进入 `passed`，产物必须自洽 ───────────────────────────────
  // 旧产物没有 `fragments` 块（或块里没有 `compileMeasured`）→ 按旧口径放行，理由同 AN-13
  // （长期恒红 = 红盲）。新产物的口径：编译分母 = 真有产物的行，失败必须为 0；scoped 必须
  // 达到人工基线 `scopedMin`；未测到必须为 0（否则这次片段测量不完整）。
  const frag = artifact.fragments
  if (frag && typeof frag === 'object' && Number.isInteger(frag.compileMeasured)) {
    const { compileMeasured, compileCompiled, compileFailure, compileRate } = frag
    if (!Number.isInteger(compileCompiled) || !Number.isInteger(compileFailure)) {
      failures.push(`片段编译口径字段非法：compiled=${compileCompiled} failure=${compileFailure}`)
    } else if (compileCompiled + compileFailure !== compileMeasured) {
      failures.push(`片段编译口径不自洽：${compileCompiled} 通过 + ${compileFailure} 失败 ≠ ${compileMeasured} 有产物`)
    } else if (compileMeasured > 0 && Math.abs(compileCompiled / compileMeasured - compileRate) > 0.001) {
      failures.push(`片段 compileRate=${compileRate} 与 ${compileCompiled}/${compileMeasured} 不符`)
    }
    if (artifact.passed === true) {
      if (compileFailure !== 0) {
        failures.push(`passed=true 但片段编译失败 ${compileFailure} 条（AN-18：片段编译门已进入 passed）`)
      }
      if (frag.notMeasured > 0) {
        failures.push(`passed=true 但片段腿有 ${frag.notMeasured} 行未测到（AN-18：测量不完整不得发布为通过）`)
      }
      if (frag.gateOk === false) {
        failures.push('passed=true 但产物里片段腿 gateOk=false')
      }
      if (typeof frag.scopedMin === 'number' && typeof frag.scoped === 'number') {
        // 与 `eval/fragment-leg.mjs` 同一发布精度：布尔均值按 4 位小数比较，避免尾数假红。
        if (Number(frag.scoped.toFixed(4)) < frag.scopedMin) {
          failures.push(
            `passed=true 但片段 scoped=${frag.scoped} < 基线地板 ${frag.scopedMin}（AN-18：片段 scoped 门禁已进入 passed）`
          )
        }
      }
    }
  }
  // ── AN-19：PRD 提取腿是**观测**，不进门禁 —— 但产物算术必须自洽 ─────────────
  // 旧产物没有 `prd` 块（AN-19 之前）→ 跳过，理由同 AN-13/AN-18。新产物：
  //   · measured + notMeasured = cases（每条语料要么测到要么没测到，没有第三种）；
  //   · membershipCorrect ≤ membershipTotal（微平均的分子不能超过分母）；
  //   · 编译口径 compiled + failure = measured（分母 = 真有产物的行）。
  // 刻意**不**校验 notMeasured > 0：与片段腿不同，这条腿只观测，未测到是缺失的数字而非红。
  const prd = artifact.prd
  if (prd && typeof prd === 'object' && Number.isInteger(prd.cases)) {
    if (!Number.isInteger(prd.measured) || !Number.isInteger(prd.notMeasured)) {
      failures.push(`PRD 口径字段非法：measured=${prd.measured} notMeasured=${prd.notMeasured}`)
    } else if (prd.measured + prd.notMeasured !== prd.cases) {
      failures.push(`PRD 口径不自洽：${prd.measured} 已测 + ${prd.notMeasured} 未测 ≠ ${prd.cases} 条语料`)
    }
    if (
      !Number.isInteger(prd.membershipCorrect) ||
      !Number.isInteger(prd.membershipTotal) ||
      prd.membershipCorrect < 0 ||
      prd.membershipCorrect > prd.membershipTotal
    ) {
      failures.push(`PRD membership 非法：${prd.membershipCorrect}/${prd.membershipTotal}`)
    } else if (
      typeof prd.membershipRate === 'number' &&
      prd.membershipTotal > 0 &&
      Math.abs(prd.membershipCorrect / prd.membershipTotal - prd.membershipRate) > 0.001
    ) {
      failures.push(
        `PRD membershipRate=${prd.membershipRate} 与 ${prd.membershipCorrect}/${prd.membershipTotal} 不符`
      )
    }
    if (Number.isInteger(prd.compileMeasured)) {
      const { compileMeasured, compileCompiled, compileFailure, compileRate } = prd
      if (!Number.isInteger(compileCompiled) || !Number.isInteger(compileFailure)) {
        failures.push(`PRD 编译口径字段非法：compiled=${compileCompiled} failure=${compileFailure}`)
      } else if (compileCompiled + compileFailure !== compileMeasured) {
        failures.push(
          `PRD 编译口径不自洽：${compileCompiled} 通过 + ${compileFailure} 失败 ≠ ${compileMeasured} 有产物`
        )
      } else if (compileMeasured > 0 && Math.abs(compileCompiled / compileMeasured - compileRate) > 0.001) {
        failures.push(`PRD compileRate=${compileRate} 与 ${compileCompiled}/${compileMeasured} 不符`)
      }
    }
    // ── P12：PRD membership 地板已进入 `passed`，产物必须自洽 ──────────────────
    // 只做**单向**矛盾检查（不重新推导整条门禁规则，规则真源在 `eval/prd-leg.mjs`）：
    // 门禁说「过」时，它自己列出的数字不能反过来证伪它。
    if (typeof prd.gateOk === 'boolean') {
      if (prd.gateOk === true) {
        if (
          typeof prd.membershipFloor === 'number' &&
          typeof prd.membershipRate === 'number' &&
          prd.membershipRate < prd.membershipFloor
        ) {
          failures.push(
            `PRD gateOk=true 但 membership ${prd.membershipRate} < 地板 ${prd.membershipFloor} —— 门禁判定与数字矛盾`
          )
        }
        if (Number.isInteger(prd.cases) && prd.measured !== prd.cases) {
          failures.push(`PRD gateOk=true 但只测到 ${prd.measured}/${prd.cases} 条 —— 不完整不能算过`)
        }
        if (Number.isInteger(prd.compileFailure) && prd.compileFailure > 0) {
          failures.push(`PRD gateOk=true 但编译失败 ${prd.compileFailure} 条 —— 门禁判定与数字矛盾`)
        }
      }
      if (artifact.passed === true && prd.gateOk === false) {
        failures.push('passed=true 但 PRD 提取腿 gateOk=false（P12：PRD membership 地板已进入 passed）')
      }
    }
  }
  // ── 行级重放（2026-10-29）：产物必须自证「补跑没有偷偷改变分母」 ──────────────
  // 重放是唯一会让同一条语料被模型答两次的路径。它**不**改变分母（dump 后写覆盖先写、
  // 内存按 key upsert），于是产物里的对账恒等式必须成立：attempted = recovered +
  // stillUnmeasured。若写入方把「出现几次算几行」的旧语义漏回来，这条会立刻红 ——
  // 而分数本身不会露馅（重放成功只会让分数变好，看起来像模型变强）。
  // 旧产物没有 `replay` 键 → 跳过（与 AN-13/AN-18/AN-19 同一处置：恒红 = 红盲）。
  const replay = artifact.replay
  if (replay && typeof replay === 'object') {
    for (const leg of ['crud', 'fragments']) {
      const r = replay[leg]
      if (!r || typeof r !== 'object') continue
      const ints = ['attempted', 'recovered', 'stillUnmeasured', 'skippedModelFailure', 'skippedOverCap']
      const bad = ints.filter((k) => !Number.isInteger(r[k]) || r[k] < 0)
      if (bad.length) {
        failures.push(`replay.${leg} 字段非法（需非负整数）：${bad.map((k) => `${k}=${r[k]}`).join(', ')}`)
        continue
      }
      if (r.recovered + r.stillUnmeasured !== r.attempted) {
        failures.push(
          `replay.${leg} 对账不成立：recovered ${r.recovered} + stillUnmeasured ${r.stillUnmeasured}` +
            ` ≠ attempted ${r.attempted}（重放不得让分母变大或变小）`
        )
      }
      if (typeof r.aborted !== 'boolean') {
        failures.push(`replay.${leg}.aborted 必须是布尔（记录「是否因中继持续不通而提前停止」）`)
      }
    }
    // 「完整测量」与「还有行没补回来」不能同时成立：passed 的产物里两腿的
    // stillUnmeasured 必须都是 0。与上面 AN-18 的 `frag.notMeasured > 0` 同一条纪律，
    // 只是换成重放自己的账本 —— 它俩若不一致，说明重放账本与实测账本来自两次聚合。
    if (artifact.passed === true) {
      for (const leg of ['crud', 'fragments']) {
        const r = replay[leg]
        if (r && typeof r === 'object' && Number.isInteger(r.stillUnmeasured) && r.stillUnmeasured > 0) {
          failures.push(
            `passed=true 但 replay.${leg}.stillUnmeasured=${r.stillUnmeasured}（补跑后仍有行没测到，不是一次完整测量）`
          )
        }
      }
    }
  }
  if (measurement === 'complete' || measurement === 'complete-gated-leg-only') {
    // 「完整测量」是一句**强声明**：它说门禁腿一条不缺。于是门禁数字本身必须存在 ——
    // 否则产物自称完整、却拿不出可核对的分母/分子（手改、字段被删、写入方漏字段都长这样）。
    if (!d95 || typeof d95 !== 'object') {
      failures.push(`measurement=${measurement} 但产物缺少 definition95 块 —— 门禁数字无从核对`)
    }
    // 95% 定义 = scoped ∨ ≤K 轮收敛。收敛腿样本不足时那个 OR 实际只剩第一条腿，
    // 「完整测量」就不再成立（AN-02：<CONVERGE_SAMPLE_FLOOR 条时比率落在单例噪声上）。
    // eval 侧已有同一判据（checkConvergenceSample 进 guards），此处让**产物自身**也自证 ——
    // 否则一份绕过 guards 写出/手改的产物会把 5/5 的收敛率当完整成绩发布。
    const conv = artifact.convergence
    if (!conv || typeof conv !== 'object') {
      failures.push(`measurement=${measurement} 但缺少 convergence 块 —— 95% 定义的第二条腿无法核对`)
    } else if (!Number.isInteger(conv.total) || conv.total < CONVERGE_SAMPLE_FLOOR) {
      failures.push(
        `收敛腿样本 total=${conv.total} 低于地板 ${CONVERGE_SAMPLE_FLOOR} —— ` +
          `第二条腿的比率会落在单例噪声上，不构成完整测量`
      )
    }
    if (typeof artifact.passed === 'boolean' && d95 && typeof d95.rate === 'number') {
      // `passed` 还含 guards/frontDoor，故只能单方向校验：分数达标却标 passed=false 是可疑的，
      // 但 `passed=true` 而分数不达标则是**确定**的谎报。
      if (artifact.passed === true && d95.rate < target) {
        failures.push(`passed=true 但 definition95=${d95.rate} < 目标 ${target}`)
      }
    }
    if (artifact.attributeAccuracy === null && !Number.isInteger(artifact.attributeRows)) {
      failures.push('attributeAccuracy=null 时必须给出 `attributeRows`（说明有多少行可测）')
    }
  }

  // ── 3. 徽章必须等于产物（徽章是公开发布面，最容易与产物分叉） ──
  // 路径可经 `ctx.badgeFiles` 覆盖，仅为可测性：单测用临时徽章把每条判据打穿，
  // 不依赖仓库里当前那一对（否则测试结果会被产物状态左右）。
  const badgeTargets = ctx.badgeFiles ?? [
    [BADGE_FILE, (a) => a.definition95?.rate],
    [BADGE_SCOPED_FILE, (a) => a.inSchemaIntentScoped],
  ]
  for (const [file, pick] of badgeTargets) {
    let badge = null
    try {
      badge = JSON.parse(readFileSync(file, 'utf8'))
    } catch {
      continue // 徽章缺失不算失败：失败产物写的是灰度徽章，由 measurement 判定。
    }
    const name = file.split(/[\\/]/).pop()
    const rate = pick(artifact)
    const message = badge?.message
    // 灰度占位只能配「没有分数」的产物。若产物已有真实分数而徽章仍是灰的，说明公开发布面
    // 落后于产物（读者看到「没测到」，仓库里却已有一个数字）—— 两个方向都必须对齐。
    if (message === 'measurement failed') {
      if (typeof rate === 'number') {
        failures.push(`${name} 仍写着 measurement failed，但产物已有分数 ${(rate * 100).toFixed(1)}%`)
      }
      continue
    }
    // 徽章消息必须要么是百分比、要么是灰度占位。畸形消息（拼错、"pending"、手改成 "95"）
    // 此前被静默跳过 —— 于是公开面可以与产物无关地漂移，而守卫全绿。
    const m = typeof message === 'string' ? /^(-?\d+(?:\.\d+)?)%$/.exec(message) : null
    if (!m) {
      failures.push(`${name} 的 message=${JSON.stringify(message)} 既不是百分比也不是灰度占位 —— 无法与产物核对`)
      continue
    }
    if (typeof rate !== 'number') {
      failures.push(`${name} 写着 ${message}，但产物没有对应分数（测量失败或字段缺失）—— 公开面不得先于测量`)
    } else if (Math.abs(Number(m[1]) - rate * 100) > 0.05) {
      // 比数值而非比字符串：产物存 4 位小数、徽章显示 1 位，边界值（x.x5）上字符串会假红。
      failures.push(`${name} 写着 ${message}，产物是 ${(rate * 100).toFixed(1)}%`)
    }
  }

  // ── 4. 新鲜度只报警告（见函数头注：master 产物天然落后于工作区） ──
  if (headCommit && artifact.commit && artifact.commit !== headCommit) {
    warnings.push(`产物 commit ${String(artifact.commit).slice(0, 8)} ≠ HEAD ${headCommit.slice(0, 8)}（工作区旧快照？）`)
  }
  if (corpusHash && artifact.corpusHash && artifact.corpusHash !== corpusHash) {
    warnings.push(`产物 corpusHash ${artifact.corpusHash} ≠ 当前语料 ${corpusHash}（语料已变更，数字待重测）`)
  }

  return { failures, warnings }
}
