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
 *   +unmeasured-expand-title-v1   : `expandConfig.title` 无条件不参与比较（NL 从不陈述它，
 *                                   而两侧总会各写一个 ⟹ 装饰键的「单侧缺失豁免」永不触发）
 *   +cond-dsl-canonical-v1        : `isHidden` 先规范化再比（schema 允许两套等价写法：旧条件
 *                                   `{field,op,value}` / 表达式节点；条件数组 = AND / `{and:[…]}`；
 *                                   `nin[a,b]` ≡ 两条 `!=`）
 *   +edit-config-defaults-v1      : `editConfig` 的省略 ≡ 默认值（trigger:click / mode:cell /
 *                                   enabled:true），show 系列 / autoClear 按装饰键豁免
 *   +reaction-options-v1          : reactions 的 `fulfill.dataOptions` 改按「标签树 + 数量 +
 *                                   唯一性」比（value 是后端约定、NL 从不给）
 *   +edit-render-options-v1       : `editRender.options` 同规（标签树 + 数量 + 唯一性），
 *                                   `defaultValue` 先解析回选项**标签**再比
 *   +columns-derived-v1           : `columns` 省略 ≡ 由 fields（`inTable !== false`）派生 +
 *                                   引擎前置的非数据列；展开列**位置**不测量（生成器会前置注入）
 *   +tree-config-defaults-v1      : 顶层 `treeConfig` 的省略 ≡ 默认值（childrenField 'children'、
 *                                   expandAll false），弃用别名 `children` 归一
 *   +dialog-key-align-v1          : `dialogs` 的 key 按「打开它的按钮名」对齐；gold 声明的
 *                                   add/edit/view 而 pred 省略 ≡ 派生弹窗；不再要求 key 集合双向相等
 *   +condition-value-identity-v1  : 条件（`isHidden` / reactions 的 `when`·`required`·`disabled`·
 *                                   `value`）右操作数字面量先按**本侧** dataOptions 解析成选项
 *                                   标签再比（码值是后端约定，NL 只给标签，与 dataOptions 同规）；
 *                                   布尔字段上 `truthy`/`falsy` ≡ `== true`/`== false`
 *   +reaction-encoding-parity-v1  : reactions 与片段腿对齐 —— `dependencies` 顺序不计（集合），
 *                                   无 `when` + fulfill 只含布尔键且表达式相同（AI-51 等价格控）
 *   +fragment-bool-literal-v1     : 片段腿的 `isHidden` 与 CRUD 腿对齐 —— 布尔字段（Switch /
 *                                   全布尔 dataOptions）上 `truthy`/`falsy` ≡ `== true`/`== false`。
 *                                   此前两条腿不对称：同一份模型输出在两个场景里得不同结论。
 *                                   当前片段语料零影响（无布尔 truthy 条件），但尺子已变。
 *
 * 串是**复合**的：`<字段身份>` + 各段的 `+…` 后缀。
 * 每个「同一份 pred 得不同分」的改动单独占一段，因为少写一段就等于让两把不同的尺子
 * 共用一个版本号，跨版本比较的护栏（`compareToBaseline`）随之形同虚设。
 */
export const RULER_VERSION =
  'label-identity-v1+deco-projection-v1+unmeasured-expand-title-v1+cond-dsl-canonical-v1+edit-config-defaults-v1+reaction-options-v1+edit-render-options-v1+columns-derived-v1+tree-config-defaults-v1+dialog-key-align-v1+condition-value-identity-v1+reaction-encoding-parity-v1+fragment-bool-literal-v1'

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
 * 读回 dump。返回 meta（首行，缺失为 null）、全部行、损坏行数与被覆盖行数。
 * 损坏行（半行 JSON）跳过并计数 —— 进程被杀时最后一行可能不完整。
 *
 * **同一个 `(kind, file, lang)` 出现多次时，后写的覆盖先写的**（`superseded` 计数）。
 * 这不是宽容，而是唯一的正确语义：dump 是**逐行 append** 的（进程被杀仍保住已跑完的行），
 * 而「行级重放」（`eval/replay.mjs`）会把没测到的行再跑一遍 —— 那一行必然被写第二次。
 * 若按「出现几次算几行」读回，重放过的那一行会在分母里被算两次：一次没测到（0 分）、
 * 一次测到了，等于把一个基础设施抖动记成半次模型失败。后写覆盖先写让 dump 的语义与
 * 内存里的 `rows`（同样按 key 覆盖）保持一致，复算与产物才不会漂移。
 *
 * @param {string} path
 * @returns {{meta: object|null, rows: object[], skipped: number, superseded: number}}
 */
export function readDump(path) {
  const text = readFileSync(path, 'utf8')
  // 用 Map 保序：删除后重新插入 ⟹ 「最后一次出现」落在它实际的位置上。
  const byKey = new Map()
  let meta = null
  let skipped = 0
  let superseded = 0
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    let obj
    try {
      obj = JSON.parse(line)
    } catch {
      skipped++
      continue
    }
    if (obj.kind === 'meta') {
      meta = obj
      continue
    }
    const key = `${obj.kind}|${obj.file ?? ''}|${obj.lang ?? ''}`
    if (byKey.has(key)) {
      superseded++
      byKey.delete(key)
    }
    byKey.set(key, obj)
  }
  return { meta, rows: [...byKey.values()], skipped, superseded }
}
