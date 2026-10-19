#!/usr/bin/env node
/**
 * fragment 词汇 ↔ zod3 镜像 同步校验
 *
 * 背景:shared 用 zod4、mcp-server 用 zod3,两个大版本的 zod 对象不能跨包复用。
 * 于是片段工具(generate_form/table/dialog)与前门(generate_crud)在 mcp-server 侧
 * **手写**了一份 zod3 `surfaceFieldSchema`(packages/mcp-server/src/tools/_fragment-shapes.ts),
 * 作为 shared 权威 `SurfaceField`(packages/shared/src/compose-crud-config.ts)的镜像。
 *
 * 手写副本就会漂移:给 SurfaceField 加了字段却忘了同步 zod3 镜像 → MCP 工具会**静默
 * 丢弃**那个入参(zod 不认识的 key 被 strip),LLM 以为传了、生成器却没收到。本脚本在
 * PR 上就把这类漂移打红。
 *
 * 校验项:
 *  1. 键集一致:SurfaceField(接口)的属性集 === surfaceFieldSchema(zod3)的顶层键集。
 *  2. 成员标志必须双双缺席:inQuery/inTable/inForm 由 composeCrudConfig 推导,
 *     不在任何「单面字段」里出现——两处都不许冒出来(冒出来说明有人把组合层的概念
 *     漏进了单面词汇)。
 *  3. dialog 底座选项(AI-28)三处一致:shared `DialogBlockOptions`(接口) ===
 *     zod3 `dialogOptionsSchema`(镜像),且**两者的键集都 ⊆ core `DialogOptions`
 *     的具名键** —— 往任一侧加一个 core 不认的键都会红。
 *  4. 选项**发射顺序**全覆盖:上条的键集必须恰等于 `DIALOG_OPTION_ORDER ∪ {width}`。
 *     这是「输入形状承诺了、生成器却读不到」这一类静默丢弃的守卫 —— 接口里有一个
 *     键而发射循环没枚举它,工具会接受该入参却永不注入产物,宿主看不出来。
 *  5. 教学面不得教幻影键:`resources/types.ts` 的 `TYPES_FALLBACK_VUE3.DialogOptions`
 *     具名键 ⊆ core 的具名键,且**必须覆盖** `dialogOptionsSchema` 的全部键 ——
 *     `generate_dialog` 的 `options` 收的每个键,宿主要在类型资源里看得到。
 *
 * 用法:node scripts/check-fragment-contract.mjs
 * 退出码:0 = 同步;1 = 发现漂移。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf-8')

const SURFACE_FIELD_SRC = 'packages/shared/src/compose-crud-config.ts'
const FRAGMENT_SHAPES_SRC = 'packages/mcp-server/src/tools/_fragment-shapes.ts'
const FRAGMENT_GENERATOR_SRC = 'packages/shared/src/fragment-generator.ts'
const CORE_TYPES_SRC = 'packages/core/src/types.ts'
const RESOURCE_TYPES_SRC = 'packages/mcp-server/src/resources/types.ts'
const MEMBERSHIP_FLAGS = ['inQuery', 'inTable', 'inForm']

const fail = (msg) => {
  console.error(`❌ ${msg}`)
  return false
}

/** 从 `export const <marker> = <start>` 到首个列 0 的 `<close>` 之间的块。 */
function sliceBlock(src, startMarker, closeLine, label) {
  const i = src.indexOf(startMarker)
  if (i === -1) {
    fail(`未能在 ${label} 定位 ${JSON.stringify(startMarker)}`)
    return null
  }
  const rest = src.slice(i + startMarker.length)
  // 列 0 的 closeLine(接口是 `}`、zod 对象是 `});`)标记块结束。用 \n+字面量 定位,
  // 避开把 closeLine 当正则(`});` 里的 `)` 会被解析成未配对括号)。
  const needle = '\n' + closeLine
  const end = rest.indexOf(needle)
  if (end === -1) {
    fail(`未能在 ${label} 定位块结束符 ${JSON.stringify(closeLine)}`)
    return null
  }
  return rest.slice(0, end)
}

/** 收集缩进 2 空格的顶层键(接口属性 / zod 对象属性都是这个形状)。 */
function topLevelKeys(block) {
  const keys = []
  for (const m of block.matchAll(/^ {2}([A-Za-z_$][\w$]*)\??\s*:/gm)) {
    keys.push(m[1])
  }
  return keys
}

/** 收集缩进 2 空格的**带引号数组成员**(`'maxHeight',`)—— 用于 `as const` 数组。 */
function quotedMembers(block) {
  const keys = []
  for (const m of block.matchAll(/^ {2}'([A-Za-z_$][\w$]*)',?\s*$/gm)) {
    keys.push(m[1])
  }
  return keys
}

const diff = (a, b) => [...a].filter((k) => !b.has(k))

function main() {
  let ok = true

  // ── 1. SurfaceField 接口键集 ──
  const sfBlock = sliceBlock(read(SURFACE_FIELD_SRC), 'export interface SurfaceField {', '}', 'SurfaceField')
  // ── 2. surfaceFieldSchema(zod3)顶层键集 ──
  const zBlock = sliceBlock(read(FRAGMENT_SHAPES_SRC), 'export const surfaceFieldSchema = z.object({', '});', 'surfaceFieldSchema')
  if (sfBlock === null || zBlock === null) process.exit(1)

  const sfKeys = new Set(topLevelKeys(sfBlock))
  const zKeys = new Set(topLevelKeys(zBlock))

  const missingInZod = [...sfKeys].filter((k) => !zKeys.has(k))
  const extraInZod = [...zKeys].filter((k) => !sfKeys.has(k))

  if (missingInZod.length) {
    ok = fail(
      `zod3 surfaceFieldSchema 缺少 SurfaceField 的字段：${missingInZod.join(', ')}` +
        '（给 SurfaceField 加了字段，但没同步 _fragment-shapes.ts —— MCP 工具会静默丢弃该入参）'
    )
  }
  if (extraInZod.length) {
    ok = fail(
      `zod3 surfaceFieldSchema 多出 SurfaceField 没有的字段：${extraInZod.join(', ')}` +
        '（镜像里凭空多了 key —— 要么 SurfaceField 漏加，要么镜像拼错）'
    )
  }

  // ── 3. 成员标志双双缺席 ──
  for (const flag of MEMBERSHIP_FLAGS) {
    if (sfKeys.has(flag)) ok = fail(`SurfaceField 不应包含成员标志 "${flag}"（它由 composeCrudConfig 推导）`)
    if (zKeys.has(flag)) ok = fail(`zod3 surfaceFieldSchema 不应包含成员标志 "${flag}"（它由 composeCrudConfig 推导）`)
  }

  // ── 4. dialog 底座选项(AI-28)：双份镜像 + 都 ⊆ core DialogOptions ──
  const dboBlock = sliceBlock(read(FRAGMENT_GENERATOR_SRC), 'export interface DialogBlockOptions {', '}', 'DialogBlockOptions')
  const dozBlock = sliceBlock(read(FRAGMENT_SHAPES_SRC), 'export const dialogOptionsSchema = z.object({', '});', 'dialogOptionsSchema')
  const orderBlock = sliceBlock(read(FRAGMENT_GENERATOR_SRC), 'const DIALOG_OPTION_ORDER = [', '] as const', 'DIALOG_OPTION_ORDER')
  const coreDlgBlock = sliceBlock(read(CORE_TYPES_SRC), 'export interface DialogOptions {', '}', 'core DialogOptions')
  const fbDlgBlock = sliceBlock(read(RESOURCE_TYPES_SRC), 'export interface DialogOptions {', '}', 'TYPES_FALLBACK_VUE3.DialogOptions')
  if (dboBlock === null || dozBlock === null || orderBlock === null || coreDlgBlock === null || fbDlgBlock === null) process.exit(1)

  const dboKeys = new Set(topLevelKeys(dboBlock))
  const dozKeys = new Set(topLevelKeys(dozBlock))
  const orderKeys = new Set(quotedMembers(orderBlock))
  const coreDlgKeys = new Set(topLevelKeys(coreDlgBlock))
  const fbDlgKeys = new Set(topLevelKeys(fbDlgBlock))

  // 4a. 双份镜像逐键一致（zod 对象无 passthrough：跑偏了就是静默 strip）。
  const onlyShared = diff(dboKeys, dozKeys)
  const onlyZod = diff(dozKeys, dboKeys)
  if (onlyShared.length) {
    ok = fail(`zod3 dialogOptionsSchema 缺少 DialogBlockOptions 的键：${onlyShared.join(', ')}（工具入参会静默 strip）`)
  }
  if (onlyZod.length) {
    ok = fail(`zod3 dialogOptionsSchema 多出 DialogBlockOptions 没有的键：${onlyZod.join(', ')}（镜像凭空多键 = core 侧描述落后）`)
  }

  // 4b. 两者都 ⊆ core DialogOptions 的具名键（不含 [key: string]: unknown 索引签名）。
  for (const [label, set] of [['DialogBlockOptions', dboKeys], ['dialogOptionsSchema', dozKeys]]) {
    const phantom = diff(set, coreDlgKeys)
    if (phantom.length) {
      ok = fail(`dialog 选项 ${label} 含 core DialogOptions 不认的键：${phantom.join(', ')}（承诺了一个运行时读不懂的选项）`)
    }
  }

  // 4c. 发射顺序全覆盖（= 键集恰为 DIALOG_OPTION_ORDER ∪ {width}）。
  const emittable = new Set([...orderKeys, 'width'])
  const neverEmitted = diff(dboKeys, emittable)
  const deadOrder = diff(orderKeys, dboKeys)
  if (neverEmitted.length) {
    ok = fail(
      `DialogBlockOptions 的键 ${neverEmitted.join(', ')} 不在 DIALOG_OPTION_ORDER 里（也不是单发的 width）—— ` +
        '工具会接受该入参却**永不注入产物**（静默丢弃），把键加进 DIALOG_OPTION_ORDER 或从接口删掉'
    )
  }
  if (deadOrder.length) {
    ok = fail(`DIALOG_OPTION_ORDER 含 DialogBlockOptions 没有的键：${deadOrder.join(', ')}（发射循环里的死条目）`)
  }

  // ── 5. 教学面（TYPES_FALLBACK_VUE3.DialogOptions）：不教幻影键，且覆盖声明式子集 ──
  const fbPhantom = diff(fbDlgKeys, coreDlgKeys)
  if (fbPhantom.length) {
    ok = fail(`resources/types.ts 的 DialogOptions 兜底含 core 不认的键：${fbPhantom.join(', ')}（教给宿主 LLM 的接口不得凭空造键）`)
  }
  const fbMissing = diff(dozKeys, fbDlgKeys)
  if (fbMissing.length) {
    ok = fail(
      `resources/types.ts 的 DialogOptions 兜底漏了 generate_dialog.options 收的键：${fbMissing.join(', ')}—— ` +
        '该资源是宿主 LLM 的发现面，工具收的选项必须在那里看得到（AI-28 教学同步）'
    )
  }

  if (ok) {
    console.log(
      `✅ fragment 词汇同步（SurfaceField ${sfKeys.size} 键 === zod3 surfaceFieldSchema ${zKeys.size} 键，成员标志均未泄漏；` +
        `dialog 选项 ${dboKeys.size} 键双份一致 ⊆ core ${coreDlgKeys.size} 键，发射顺序全覆盖，教学面覆盖 ${dozKeys.size} 键）`
    )
    process.exit(0)
  }
  process.exit(1)
}

main()
