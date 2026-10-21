/**
 * 片段腿门禁（AN-18）—— 把 63 条片段语料从「只观测」抬成**门禁腿**。
 *
 * ## 为什么单独成腿，而不是塞进 CRUD 的 definition95
 *
 * 片段的 95% 定义与 CRUD 的 95% 定义回答的是两个问题：CRUD 问「组合页零编辑率」，
 * 片段问「独立 table/form/dialog 片段的契约命中率」。把两者混进一个分母，任何一侧的
 * 回归都会被另一侧的规模稀释（片段 63 条对 CRUD 188 条时，片段整体崩掉也只动 ~25%）。
 * 所以门禁读**两个独立的数**：CRUD 仍走 `definition95`，片段走本文件的 `scoped`。
 *
 * ## 门禁判据（计划原文：`compileRate === 1 && scoped ≥ 阈值`）
 *
 *   1. **产物编译必须 100%**。分母是「真有产物的行」而不是 `measured` —— 与 AN-13 的
 *      `summarizeCompile` 同一把尺子。模型答错（`model-failure`）没有产物，把它算成
 *      编译失败会让门禁在「总允许有答错行」的准确率目标下恒红（永久红 = 红盲）。
 *   2. **scoped ≥ 基线阈值**。阈值只从 `accuracy-baseline.json` 的 `fragmentScopedMin`
 *      读（该文件只由人工 PR 修改）—— 回归防线必须「只能经评审放宽」，否则夜间自动回写
 *      会把一次真实退步记成新基线，棘轮退化成装饰。
 *   3. **未测到 = 0 行**。未测到的行会以 0 计入 scoped 分母且可能是**选择偏置**样本；
 *      片段腿不在 CRUD 健康门的覆盖范围（健康门只数 zh CRUD 行），不在这里判红就等于
 *      「中继坏在片段语料上时门禁全绿」。
 *
 * ## 为什么阈值比较要四舍五入到 4 位
 *
 * `scoped` 是布尔均值（如 49/63 = 0.777777…），产物与基线都按 4 位小数发布/记录。
 * 直接比较会让**同一次跑批**因浮点尾数（0.777777 < 0.7778）翻红 —— 一次假红足以让人
 * 不再相信门禁。故两侧都按发布精度（4 位）比较。
 */

import { summarizeCompile } from './compile-leg.mjs'

/** 片段编译门：计划原文即 100%（确定性产物缺陷不是准确率口径）。 */
export const FRAGMENT_COMPILE_FLOOR = 1

/** 产物与基线共用的发布精度（见文件头注：避免浮点尾数假红）。 */
const PUBLISH_DECIMALS = 4
const round = (x) => (typeof x === 'number' ? Number(x.toFixed(PUBLISH_DECIMALS)) : x)

const pct = (x) => `${(x * 100).toFixed(1)}%`

/**
 * 从基线读片段 scoped 地板。
 *
 * 缺失时返回 `null`（由调用方判红，**不**静默放行）：门禁腿没有阈值 = 「绿灯只是因为
 * 没人设线」，正是本仓反复栽过的红盲。基线的写入路径是人工 PR，故缺失是显式的配置缺口。
 *
 * @param {null|{fragmentScopedMin?: number}} baseline
 * @returns {number|null}
 */
export function fragmentScopedFloor(baseline) {
  const v = baseline?.fragmentScopedMin
  if (typeof v !== 'number' || Number.isNaN(v) || v < 0 || v > 1) return null
  return v
}

/**
 * 聚合片段腿门禁读数（纯函数，`fragment-leg.test.mjs` 直接喂构造行）。
 *
 * @param {Array<{error?:string|null, compiles?:boolean, file?:string, scene?:string, compileError?:object|null}>} rows
 *        逐行片段观测（`fragmentRows`）。`error` 非空 = 模型没给出可评产物。
 * @param {{cases:number, measured:number, notMeasured:number, scoped:number|null}} summary
 *        片段汇总（`fragmentSummary`）。`scoped` 的分母是 `measured`（含模型答错，按 0 计）。
 * @param {null|{fragmentScopedMin?: number}} baseline
 */
export function summarizeFragmentLeg(rows, summary, baseline) {
  const all = Array.isArray(rows) ? rows : []
  const compile = summarizeCompile(all)
  const floor = fragmentScopedFloor(baseline)
  const failures = []

  const cases = summary?.cases ?? 0
  const measured = summary?.measured ?? 0
  const notMeasured = summary?.notMeasured ?? 0

  // ① 分母存在性：一条都没跑 ≠ 全对。语料删除 / 跑批计划遗漏 / 未来新增的 --limit
  //    截断，都会让片段腿在没有分母时「通过」。
  if (!cases) {
    failures.push(
      '片段腿一条都没跑（cases=0）—— 没有分母的腿不能算通过；' +
        '检查语料是否被删、跑批计划是否遗漏片段，或 --limit 是否截掉了整段'
    )
  } else if (!measured) {
    failures.push(`片段腿 ${cases} 条全部未测到（measured=0）—— 这不是 0 分，是没测`)
  }

  // ② 测量完整性：未测到的行会让 scoped 分母带选择偏置。
  if (notMeasured > 0) {
    failures.push(
      `片段腿 ${notMeasured}/${cases} 行**未测到**（无 text 块 / 截断）—— ` +
        `未测到的行以 0 计入分母且活下来的子集可能选择偏置，本腿不构成一次完整测量`
    )
  }

  // ③ 编译门：分母 = 真有产物的行（见文件头注），必须 100%。
  if (compile.measured === 0) {
    if (cases > 0) failures.push('片段腿没有任何可编译产物（所有行都未产出结果）—— 编译门没有分母')
  } else if (compile.rate !== FRAGMENT_COMPILE_FLOOR) {
    failures.push(
      `片段产物编译失败 ${compile.failure}/${compile.measured}（compileRate ${pct(compile.rate)}）` +
        `—— 能产出但编译不过的是**发射器缺陷**，不是模型准确率` +
        (compile.failureSamples.length ? `：${compile.failureSamples.join('；')}` : '')
    )
  }

  // ④ scoped 地板：只认基线（人工 PR 上调），缺失即红。
  const scoped = typeof summary?.scoped === 'number' ? summary.scoped : null
  if (floor === null) {
    failures.push(
      '基线（accuracy-baseline.json）未声明 fragmentScopedMin —— 片段 scoped 门禁没有阈值，' +
        '不能静默放行；请在基线里写入当前值（并注明来源跑批）'
    )
  } else if (scoped === null) {
    failures.push(`片段 scoped 没有数字（基线地板 ${pct(floor)}）—— 测量缺失或该口径被移除`)
  } else if (round(scoped) < floor) {
    failures.push(
      `片段 scoped 退步：本次 ${pct(scoped)} < 基线地板 ${pct(floor)}` +
        `（阈值只经评审下调；若是语料/教学面有意变更，请更新基线并说明）`
    )
  }

  return {
    ok: failures.length === 0,
    floor,
    scoped,
    cases,
    measured,
    notMeasured,
    compileRate: compile.rate,
    compileMeasured: compile.measured,
    compileCompiled: compile.compiled,
    compileFailure: compile.failure,
    failures,
  }
}
