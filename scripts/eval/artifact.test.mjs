#!/usr/bin/env node
/**
 * 产物自证（`verifyArtifact`）的 meta-eval —— 无需 API key，进 CI 的 check:consistency。
 *
 * 为什么需要它：`check:artifact-freshness` 只拿**仓库里当前那一份**产物跑一遍。若判据本身
 * 被悄悄放宽（例如 `definition95` 缺失时直接跳过、徽章 message 解析失败就 `continue`），
 * 那份真产物照样绿 —— 守卫的失效不会被它自己的绿光照亮。这里用合成产物 + 临时徽章把
 * 每条判据打穿：
 *
 *   · **完整测量必须自带门禁分**：`measurement: complete` 却不能提供 `definition95`
 *     ⟹ 红（手改 / 写入方漏字段都长这样）。
 *   · **收敛腿样本地板**：95% 定义 = scoped ∨ ≤K 轮收敛；收敛语料只有 5 条时「第二条腿」
 *     只是噪声，产物不得自称完整测量。
 *   · **徽章（公开发布面）双向对齐**：畸形 message、灰度徽章配真实分数、数字徽章配无分数
 *     的产物，三种漂移都必须红 —— 此前它们被静默跳过。
 *
 * 徽章路径经 `ctx.badgeFiles` 注入临时文件：判据行为不该由仓库里那一对徽章的当前状态决定。
 */
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { verifyArtifact } from './artifact.mjs'

let checks = 0
const failures = []
function check(cond, msg) {
  checks++
  if (cond) return
  failures.push(msg)
  console.error(`  ✗ ${msg}`)
}
/** 断言某次判定**红了**且消息命中预期子串（只断「红了」会掩盖报错跑偏）。 */
function checkFails(result, substr, label) {
  check(result.failures.length > 0, `${label}: 应当判红，实际通过`)
  check(
    result.failures.some((m) => m.includes(substr)),
    `${label}: 报错未命中预期子串 ${JSON.stringify(substr)}；实际 = ${JSON.stringify(result.failures)}`
  )
}
const clean = (result) => result.failures.length === 0

const tmp = mkdtempSync(join(tmpdir(), 'esplus-artifact-'))
let badgeSeq = 0
/** 写一个临时徽章文件，返回 [路径, 取值器]（取值器默认读 definition95.rate）。 */
function badgeFile(obj, pick = (a) => a.definition95?.rate) {
  const p = join(tmp, `badge-${badgeSeq++}.json`)
  writeFileSync(p, JSON.stringify(obj))
  return [p, pick]
}

/** 一条结构完整的「完整测量」产物（各用例在其上做单点变异）。 */
const complete = (over = {}) => ({
  commit: 'deadbeef',
  runId: 'run-1',
  artifactSource: 'nightly',
  corpusHash: 'hash-1',
  corpusFiles: 216,
  fixedFieldsUsed: false,
  measurement: 'complete',
  definition95: { k: 3, source: 'heldout', rate: 0.96, pass: 96, total: 100 },
  convergence: { k: 3, total: 40, rateAtK: 0.6 },
  attributeAccuracy: 0.99,
  attributeRows: 100,
  ...over,
});

// ─── 结构：完整测量必须自带 definition95 与收敛腿 ─────────────────────────
{
  check(clean(verifyArtifact(complete(), { badgeFiles: [] })), '完整测量（合格形状）必须判过')

  // Ruler v3：`rulerVersion` 是身份字段，但**不是**必填 —— 已提交的产物是旧代码写的，
  // 判红会让守卫恒红到下一次夜间全量跑批为止（恒红 = 红盲）。缺了必须可见地提示。
  const noRuler = complete()
  check(clean(verifyArtifact(noRuler, { badgeFiles: [] })), '无 rulerVersion 不得判红（旧产物合法）')
  check(
    verifyArtifact(noRuler, { badgeFiles: [] }).warnings.some((w) => w.includes('rulerVersion')),
    '无 rulerVersion 必须给出提示（百分比不可与新版横向比较）'
  )
  check(
    !verifyArtifact(complete({ rulerVersion: 'label-identity-v1+deco-projection-v1' }), { badgeFiles: [] })
      .warnings.some((w) => w.includes('rulerVersion')),
    '带 rulerVersion 时不得再提示'
  )

  const noD95 = complete()
  delete noD95.definition95
  // A5：编译分母含 en 腿，产物带一份按语言的诊断拆分。
  // 拆分**不是**第二个门禁口径（全局那一对才是），故：桶自身必须自洽（红），
  // 桶之和与全局不一致只提示（警告）—— 否则一次「只跑了一半的观测腿」会把门禁判红。
  const langSplit = {
    compileMeasured: 4,
    compileCompiled: 3,
    compileFailure: 1,
    compileRate: 0.75,
    compileByLang: { zh: { measured: 2, compiled: 2, failure: 0 }, en: { measured: 2, compiled: 1, failure: 1 } },
  }
  check(clean(verifyArtifact(complete(langSplit), { badgeFiles: [] })), '自洽的 compileByLang 应判过')
  checkFails(
    verifyArtifact(
      complete({ ...langSplit, compileByLang: { zh: { measured: 2, compiled: 2, failure: 1 } } }),
      { badgeFiles: [] }
    ),
    'compileByLang.zh 不自洽',
    'compileByLang 桶内 compiled+failure≠measured 必须判红'
  )
  checkFails(
    verifyArtifact(complete({ ...langSplit, compileByLang: { zh: { measured: '2', compiled: 2, failure: 0 } } }), {
      badgeFiles: [],
    }),
    'compileByLang.zh 字段非法',
    'compileByLang 桶字段非整数必须判红'
  )
  const partial = verifyArtifact(
    complete({ ...langSplit, compileByLang: { zh: { measured: 2, compiled: 2, failure: 0 } } }),
    { badgeFiles: [] }
  )
  check(clean(partial), 'compileByLang 之和与全局不一致不得判红（观测腿可能只跑了一半）')
  check(
    partial.warnings.some((w) => w.includes('compileByLang')),
    'compileByLang 之和与全局不一致必须给出提示（否则读者会拿一个去解释另一个）'
  )

  // A3：门禁口径逐维视图的自洽性（观测口径，但 pass>applicable 是矛盾数字）。
  check(
    clean(
      verifyArtifact(
        complete({ byCapabilityOnPinned: { propSet: { applicable: 2, pass: 2, rate: 1 } , formtype: { applicable: 0, pass: 0, rate: null } } }),
        { badgeFiles: [] }
      )
    ),
    '自洽的 byCapabilityOnPinned 应判过（含 applicable=0 / rate=null）'
  )
  checkFails(
    verifyArtifact(complete({ byCapabilityOnPinned: { propSet: { applicable: 2, pass: 3, rate: 1.5 } } }), {
      badgeFiles: [],
    }),
    'byCapabilityOnPinned.propSet 非法',
    'byCapabilityOnPinned 的 pass > applicable 必须判红'
  )
  checkFails(
    verifyArtifact(complete({ byCapabilityOnPinned: { propSet: { applicable: 0, pass: 0, rate: 0 } } }), {
      badgeFiles: [],
    }),
    'rate 必须是 null',
    'applicable=0 却写 rate=0 必须判红（「没人 pin」不是「全错」）'
  )

  checkFails(verifyArtifact(noD95, { badgeFiles: [] }), '缺少 definition95 块', '完整测量缺 definition95')

  const noConv = complete()
  delete noConv.convergence
  checkFails(verifyArtifact(noConv, { badgeFiles: [] }), '缺少 convergence 块', '完整测量缺 convergence')

  checkFails(
    verifyArtifact(complete({ convergence: { total: 5 } }), { badgeFiles: [] }),
    '低于地板 30',
    '收敛腿样本 5 条（AN-02 之前的真实状态）必须判红'
  )
  checkFails(
    verifyArtifact(complete({ convergence: { total: '40' } }), { badgeFiles: [] }),
    '低于地板 30',
    '收敛腿样本非整数必须判红（不能把字符串当真值）'
  )
  check(
    clean(verifyArtifact(complete({ convergence: { total: 30 } }), { badgeFiles: [] })),
    '收敛腿样本恰等于地板 30 应判过'
  )

  // 门禁腿完整、观测腿残缺：同一套要求（门禁数字仍必须可核对）。
  check(
    clean(verifyArtifact(complete({ measurement: 'complete-gated-leg-only' }), { badgeFiles: [] })),
    'complete-gated-leg-only（合格形状）必须判过'
  )
  checkFails(
    verifyArtifact(complete({ measurement: 'complete-gated-leg-only', convergence: { total: 5 } }), {
      badgeFiles: [],
    }),
    '低于地板 30',
    'complete-gated-leg-only 同样受收敛样本地板约束'
  )

  // 失败产物**不**要求分数：那正是「没测到」的形状。
  check(
    clean(
      verifyArtifact(
        {
          commit: 'deadbeef',
          runId: 'run-2',
          artifactSource: 'nightly',
          corpusHash: 'hash-1',
          corpusFiles: 216,
          fixedFieldsUsed: false,
          measurement: 'failed',
          failures: ['health gate'],
          passed: false,
        },
        { badgeFiles: [] }
      )
    ),
    'measurement=failed 但带 failures[] 的产物必须判过（不要求分数）'
  )
  checkFails(
    verifyArtifact(complete({ measurement: 'failed' }), { badgeFiles: [] }),
    '缺少 `failures[]`',
    'measurement=failed 但缺 failures[] 必须判红'
  )
}

// ─── 徽章与产物双向对齐（公开发布面） ─────────────────────────────────────
{
  check(
    clean(verifyArtifact(complete(), { badgeFiles: [badgeFile({ message: '96.0%' })] })),
    '徽章数字与产物一致（1 位小数四舍五入）应判过'
  )
  checkFails(
    verifyArtifact(complete(), { badgeFiles: [badgeFile({ message: '95.0%' })] }),
    '产物是 96.0%',
    '徽章数字与产物不符必须判红'
  )
  checkFails(
    verifyArtifact(complete(), { badgeFiles: [badgeFile({ message: 'pending' })] }),
    '既不是百分比也不是灰度占位',
    '畸形徽章 message 必须判红（此前被静默跳过）'
  )
  checkFails(
    verifyArtifact(complete(), { badgeFiles: [badgeFile({ message: 96 })] }),
    '既不是百分比也不是灰度占位',
    '非字符串 message 同样必须判红'
  )
  checkFails(
    verifyArtifact(complete(), { badgeFiles: [badgeFile({ message: 'measurement failed' })] }),
    '仍写着 measurement failed',
    '产物有分数而徽章仍是灰度，必须判红（发布面落后于产物）'
  )
  check(
    clean(
      verifyArtifact(
        { ...complete(), measurement: 'failed', failures: ['x'], definition95: undefined },
        { badgeFiles: [badgeFile({ message: 'measurement failed' })] }
      )
    ),
    '失败产物 + 灰度徽章应判过'
  )
  checkFails(
    verifyArtifact(
      { ...complete(), measurement: 'failed', failures: ['x'], definition95: undefined },
      { badgeFiles: [badgeFile({ message: '96.0%' })] }
    ),
    '产物没有对应分数',
    '徽章有数字而产物没分数，必须判红（公开面不得先于测量）'
  )
  // 片段/ scoped 徽章走各自的取值器，不是复用 definition95。
  check(
    clean(
      verifyArtifact(complete({ inSchemaIntentScoped: 0.85 }), {
        badgeFiles: [badgeFile({ message: '85.0%' }, (a) => a.inSchemaIntentScoped)],
      })
    ),
    'scoped 徽章按自身取值器比对'
  )
  // 徽章文件缺失不是失败（失败产物可能只写灰度；文件本身也可能尚未生成）。
  check(
    clean(verifyArtifact(complete(), { badgeFiles: [[join(tmp, 'does-not-exist.json'), (a) => a.definition95?.rate]] })),
    '徽章文件缺失时跳过徽章判据（不判红）'
  )
}

// ─── 行级重放：产物必须自证「补跑没改分母」 ────────────────────────────────
// 重放是唯一会让同一条语料被答两次的路径。分母若因此变大/变小，分数会「看起来好一点」
// 而没有任何其它信号 —— 故对账恒等式写进产物自证。
{
  // 正常形状：重放过的行都补回来了，且 attempted = recovered + stillUnmeasured。
  check(
    clean(
      verifyArtifact(
        complete({ replay: { crud: { attempted: 3, recovered: 3, stillUnmeasured: 0, skippedModelFailure: 2, skippedOverCap: 0, aborted: false }, fragments: null } }),
        { badgeFiles: [] }
      )
    ),
    '重放对账成立且仍没测到为 0 时不得判红（正常批次）'
  )
  check(
    clean(verifyArtifact(complete({ replay: { crud: null, fragments: null } }), { badgeFiles: [] })),
    '两腿都为 null（本次无需重放）是正常情况，不得判红'
  )
  // 反例 1：对账不成立（写入方把「出现几次算几行」的旧语义漏回来）。
  checkFails(
    verifyArtifact(
      complete({ replay: { crud: { attempted: 3, recovered: 2, stillUnmeasured: 0, skippedModelFailure: 0, skippedOverCap: 0, aborted: false }, fragments: null } }),
      { badgeFiles: [] }
    ),
    '对账不成立',
    'recovered + stillUnmeasured ≠ attempted'
  )
  // 反例 2：recovered > attempted —— 「补回的比尝试的还多」是自相矛盾。
  checkFails(
    verifyArtifact(
      complete({ replay: { crud: { attempted: 1, recovered: 2, stillUnmeasured: 0, skippedModelFailure: 0, skippedOverCap: 0, aborted: false }, fragments: null } }),
      { badgeFiles: [] }
    ),
    '对账不成立',
    'recovered 超过 attempted'
  )
  // 反例 3：字段非法（缺 aborted / 负数）。
  checkFails(
    verifyArtifact(
      complete({ replay: { crud: { attempted: 2, recovered: -1, stillUnmeasured: 3, skippedModelFailure: 0, skippedOverCap: 0 }, fragments: null } }),
      { badgeFiles: [] }
    ),
    '字段非法',
    '负数 / 缺 aborted'
  )
  // 反例 4：passed=true 却仍有行没补回来 —— 与 AN-18 的「未测到不得发布为通过」同一条纪律。
  checkFails(
    verifyArtifact(
      complete({
        passed: true,
        replay: { crud: { attempted: 2, recovered: 1, stillUnmeasured: 1, skippedModelFailure: 0, skippedOverCap: 0, aborted: true }, fragments: null },
      }),
      { badgeFiles: [] }
    ),
    'stillUnmeasured',
    'passed=true 但有行没测到'
  )
}

rmSync(tmp, { recursive: true, force: true })

if (failures.length) {
  console.error(`\nartifact meta-eval FAILED: ${failures.length}/${checks} 处断言未过`)
  process.exit(1)
}
console.log(`artifact meta-eval OK — ${checks} 条判据全部咬得住（完整测量自证 + 徽章双向对齐）。✔`)
