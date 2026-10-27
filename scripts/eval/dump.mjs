/**
 * 预测落盘（`--dump-pred`）的读写原语。
 *
 * ## 为什么要有它
 *
 * 跑批一次 3.5 小时、花真钱，而在此之前**预测配置从不落盘**：`eval-llm.mjs` 只写
 * `last-accuracy.json` + 两个徽章，逐行结果留在内存里就丢了。后果是：
 *
 *   1. 任何尺子（scorer）改动都必须再付一次全量跑批才能看到效果；
 *   2. 一次失败无法复盘 —— 你只有总分，没有「模型当时到底输出了什么」；
 *   3. 新旧口径无法在同一批模型产出上对照，只能跨批次比 —— 而模型、语料、中继都在变。
 *
 * 落盘之后，"同一份模型输出用两套尺子各算一遍"变成纯离线计算。这是后续所有口径调整
 * （Ruler v3 / label 身份）的前置条件。
 *
 * ## 格式
 *
 * JSONL，每行一个独立对象，**逐行 append**（进程被杀也保住已跑完的行）：
 *
 *   {"kind":"meta", ...}                       ← 首行：身份与可复算条件
 *   {"kind":"crud","file":…,"gold":…,"turn0":{…}|null,"turns":[…],…}
 *   {"kind":"fragment","file":…,"scene":…,"gold":…,"pred":{…}|null,…}
 *   {"kind":"prd","file":…,"pred":{…}|null,"goldConfig":{…},…}
 *
 * ## 纪律
 *
 *   - dump 是**只读证据**，不参与任何判定；写失败不能让跑批失败（只告警）。
 *   - dump **不属于探针开关**：探针也可以开（它零副作用），全量更应开。
 *   - 不含任何凭据（只有模型产出与语料）。
 */

import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

/**
 * 尺子版本。任何改变「同一份 pred 会得不同分」的改动都必须改这个串 ——
 * 它把「历史数字不可比」写成产物里的事实，而不是靠口头约定。
 *
 *   prop-identity-v1              : 字段按 `prop` 精确判等（含 AN-01 不喂 fixedFields）
 *   +deco-projection-v1           : `columns` / `expandConfig` 的装饰键单侧声明豁免（A2/D15）
 *   label-identity-v1             : Ruler v3 / R2，字段按归一化 `label` 建立单射后再比
 *
 * 串是**复合**的：`<字段身份>[+deco-projection-v1]`。装饰键策略单独也占一段，
 * 因为「同一份 pred 得不同分」的改动不止字段身份一种；少写一段就等于让两把不同的尺子
 * 共用一个版本号，跨版本比较的护栏（`compareToBaseline`）随之形同虚设。
 */
export const RULER_VERSION = 'prop-identity-v1+deco-projection-v1'

/** 递归按键排序的稳定序列化（用于 hash 与逐行 diff）。数组顺序保留。 */
export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`
}

/**
 * 语料快照哈希：gold 的稳定序列化 sha256。
 * 复算时必须校验它 —— 语料改过而 dump 是旧的，数字就不可比。
 */
export function goldHashOf(config) {
  return createHash('sha256').update(stableStringify(config)).digest('hex').slice(0, 16)
}

/**
 * JSONL 写入器。`path` 为假值时不落盘（返回 no-op），调用点无需到处判空。
 *
 * @param {string|null|undefined} path
 * @returns {{enabled:boolean, write:(obj:object)=>void, close:()=>void, path:string|null}}
 */
export function createDumpWriter(path) {
  if (!path) {
    return { enabled: false, write() {}, close() {}, path: null }
  }
  // 截断旧文件：一次跑批一份 dump，避免两次跑批的行混在一起被复算。
  writeFileSync(path, '')
  let failed = false
  return {
    enabled: true,
    path,
    write(obj) {
      if (failed) return
      try {
        appendFileSync(path, `${JSON.stringify(obj)}\n`)
      } catch (err) {
        // dump 写失败不能让一次几小时的测量失败：告警一次后停写，数字仍照常产出。
        failed = true
        console.warn(`[eval:llm] dump 写入失败（已停写，本次测量不受影响）：${err.message}`)
      }
    },
    close() {},
  }
}

/**
 * 读回 dump。返回 meta（首行，缺失为 null）与全部行。
 * 损坏行（半行 JSON）跳过并计数 —— 进程被杀时最后一行可能不完整。
 *
 * @param {string} path
 * @returns {{meta: object|null, rows: object[], skipped: number}}
 */
export function readDump(path) {
  const text = readFileSync(path, 'utf8')
  const rows = []
  let meta = null
  let skipped = 0
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    let obj
    try {
      obj = JSON.parse(line)
    } catch {
      skipped++
      continue
    }
    if (obj.kind === 'meta') meta = obj
    else rows.push(obj)
  }
  return { meta, rows, skipped }
}
