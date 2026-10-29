/**
 * 行级重放（replay）的**策略**：跑完主循环后，把「没测到」的行再跑一遍。
 *
 * ## 它解决的问题
 *
 * 一次全量跑批 2 小时、花真钱，而中继抖 2.5 分钟就足以让整批判红：
 * `createResilientTransport` 的熔断阈值是 `tripAfter = 3` —— 连续 3 个调用各自耗尽全部
 * 重试才判定「中继整段不可用」，第 4 个才进冷却。于是任何一次抖动，**最前面的几行必然陪葬**
 * （2026-10-27 实测：`frag-dialog-06-vue2`/`06-vue3`/`07-antdv` 三行落成
 * `ERROR(unknown) — Connection error.`，紧跟着的 `07-vue2` 冷却 30→60→120 s 后成功）。
 * 而片段腿与门禁腿的健康门都是「零未测到」⟹ 这几行把一次**完整**测量降级成「没发生」。
 *
 * 重放把这件事反过来：那几行与冷却后成功的 `07-vue2` 本质上是同一次重试，只是「碰巧发生在
 * 熔断打开之前」。跑完后统一补一遍，就把「少丢几行」变成「不丢行」。
 *
 * ## 纪律（这几条是「重放」不能越过的线）
 *
 * 1. **只重放「没测到」的行**（`isNotMeasured(errorKind)`）。模型**答错**的行是一次合法测量，
 *    重放它等于给模型第二次抽样的机会 —— 那会系统性地抬高分数，且抬高的部分无法与真实能力区分。
 * 2. **只重放一遍**。两遍、三遍会滑向「重试到成功为止」，同样是对成绩的污染。
 * 3. **中继仍然不通就停**：连续 N 次重放都还是没测到 ⟹ 这不是抖动，别把冷却预算烧在死中继上。
 * 4. **有条数上限**：抖动规模远超上限时，正确结论是「这次没测成」，不是「无限重试」。
 *
 * 本模块只做判定（纯函数），不发请求、不碰文件 —— 故单测零成本，且策略与执行分离后
 * 「重放规则」不会散落在 `eval-llm.mjs` 的循环里。
 */

/** 一次跑批最多重放多少行。默认值远大于「几分钟抖动」的量级（本次 3 行），又拦住「整轮重跑」。 */
export const REPLAY_MAX_DEFAULT = 32

/**
 * 连续多少个重放仍失败就停止（与 `createResilientTransport` 的 `tripAfter` 同值）：
 * 熔断已经用「连续 3 次耗尽」定义「中继整段不可用」，重放没有理由比它更乐观。
 */
export const REPLAY_ABORT_AFTER = 3

/**
 * 挑出要重放的行。
 *
 * @param {Array<{key: string, error?: string|null, errorKind?: string|null}>} attempts
 *   主循环每行跑完后的样子（成功行 `error` 为空）。顺序即重放顺序（语料顺序）。
 * @param {{ isNotMeasured: (kind: string|null) => boolean, max?: number }} opts
 *   `isNotMeasured` 由调用方注入（`eval/repair-loop.mjs` 是唯一判据来源，
 *   此处不复制那份白名单 —— 复制出来的第二份迟早与第一份漂移）。
 * @returns {{ targets: string[], skippedModelFailure: number, skippedOverCap: number }}
 */
export function planReplay(attempts, { isNotMeasured, max = REPLAY_MAX_DEFAULT } = {}) {
  if (typeof isNotMeasured !== 'function') {
    throw new TypeError('planReplay: 必须注入 isNotMeasured（判据只有一份，见 repair-loop.mjs）')
  }
  const cap = Number.isInteger(max) && max >= 0 ? max : REPLAY_MAX_DEFAULT
  const targets = []
  let skippedModelFailure = 0
  let skippedOverCap = 0
  for (const a of attempts ?? []) {
    if (!a || !a.error) continue // 测到了 ⟹ 不是候选
    if (!isNotMeasured(a.errorKind)) {
      skippedModelFailure++ // 模型答错：成绩的一部分，重放等于给第二次抽样
      continue
    }
    if (targets.length >= cap) {
      skippedOverCap++
      continue
    }
    targets.push(a.key)
  }
  return { targets, skippedModelFailure, skippedOverCap }
}

/** 连续失败达到阈值 ⟹ 停（中继不是抖动，是真不通）。 */
export function shouldAbortReplay(consecutiveFailures, limit = REPLAY_ABORT_AFTER) {
  return consecutiveFailures >= limit
}

/**
 * 把重放的原始计数压成产物里的一个块。**全部字段都是整数且可对账**：
 * `attempted = recovered + stillUnmeasured`。
 *
 * @param {{attempted:number, recovered:number, aborted:boolean, skippedModelFailure:number, skippedOverCap:number}} raw
 */
export function summarizeReplay(raw) {
  const attempted = Math.max(0, Number(raw?.attempted) || 0)
  const recovered = Math.max(0, Math.min(attempted, Number(raw?.recovered) || 0))
  return {
    attempted,
    recovered,
    stillUnmeasured: attempted - recovered,
    aborted: Boolean(raw?.aborted),
    skippedModelFailure: Math.max(0, Number(raw?.skippedModelFailure) || 0),
    skippedOverCap: Math.max(0, Number(raw?.skippedOverCap) || 0),
  }
}
