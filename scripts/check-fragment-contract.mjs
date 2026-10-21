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
 *  6. 片段 `tableOptions`(Wave 4):shared `TableBlockOptions` === zod3
 *     `tableBlockOptionsSchema`,两者都 ⊆ core `TableOptions` 的具名键;且键集恰等于
 *     `TABLE_BLOCK_ALWAYS ∪ TABLE_BLOCK_OPTION_ORDER`(两者不重叠)—— 接口声明了却不在
 *     发射枚举里 = 接受入参却永不注入产物。
 *  7. 片段 `formLayout` / `pagination`(Wave 4):`EsFormLayout` / `EsTablePagination`
 *     各自 ≡ `FORM_LAYOUT_KEYS` / `PAGINATION_KEYS` ≡ zod3 镜像(三处全等)。
 *     片段与**权威 schema** 同名嵌套块的等价性由 `check-entry-contract.mjs` 断言(6),
 *     两条守卫各守一侧:本脚本守手写副本漂移,那条守片段↔权威收窄。
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
  //
  // zod 对象带 `.passthrough()` 时块尾是 `}).passthrough();` —— 这不是写法漂移,
  // 而是**入参闸门的前提**(`_arg-guard.ts`:SDK 用 safeParse 的结果调用 handler,
  // 嵌套 strip 会把拼写错误吃掉）。故 `});` 的两种收尾都认,块内容仍只到对象右花括号。
  const needles = closeLine === '});' ? ['\n});', '\n}).passthrough();'] : ['\n' + closeLine]
  // 取**最早**出现的候选收尾。逐个 indexOf 后取首个命中会在块尾是
  // `}).passthrough();` 时跳到下一个 schema 的 `});`,把后面的键吞进来。
  const hits = needles.map((n) => rest.indexOf(n)).filter((idx) => idx !== -1)
  const end = hits.length > 0 ? Math.min(...hits) : -1
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

/**
 * 从 `export const <name> = [...] as const` 抓全部带引号成员（单行/多行通吃）。
 * `quotedMembers` 只认多行缩进写法，而 Wave 4 的 `PAGINATION_KEYS` / `FORM_LAYOUT_KEYS`
 * 是单行数组 —— 这里统一按字面量抓，避免为书写风格再分两套解析。
 */
function constArrayMembers(src, name, label) {
  const m = src.match(new RegExp(`export const ${name} = \\[([^\\]]*)\\] as const`))
  if (m === null) {
    fail(`未能在 ${label} 定位 ${name}`)
    return null
  }
  return [...m[1].matchAll(/'([A-Za-z_$][\w$]*)'/g)].map((x) => x[1])
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

  // 4a. 双份镜像逐键一致（zod 对象是 passthrough：未知键由闸门报错而非静默 strip，
  //     所以键集跑偏不会自己暴露——镜像漂移必须在这里静态钉住）。
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

  // ── 6. 片段 tableOptions(Wave 4)：shared 接口 ≡ zod3 镜像 ⊆ core TableOptions ──
  const fgenSrc = read(FRAGMENT_GENERATOR_SRC)
  const fshapesSrc = read(FRAGMENT_SHAPES_SRC)
  const tboBlock = sliceBlock(fgenSrc, 'export interface TableBlockOptions {', '}', 'TableBlockOptions')
  const tbozBlock = sliceBlock(
    fshapesSrc,
    'export const tableBlockOptionsSchema = z.object({',
    '});',
    'tableBlockOptionsSchema'
  )
  const coreTblBlock = sliceBlock(read(CORE_TYPES_SRC), 'export interface TableOptions {', '}', 'core TableOptions')
  if (tboBlock === null || tbozBlock === null || coreTblBlock === null) process.exit(1)

  const tboKeys = new Set(topLevelKeys(tboBlock))
  const tbozKeys = new Set(topLevelKeys(tbozBlock))
  const coreTblKeys = new Set(topLevelKeys(coreTblBlock))

  // 6a. 双份镜像逐键一致（zod 无 passthrough：跑偏了就是静默 strip）。
  const tboOnlyShared = diff(tboKeys, tbozKeys)
  const tboOnlyZod = diff(tbozKeys, tboKeys)
  if (tboOnlyShared.length) {
    ok = fail(`zod3 tableBlockOptionsSchema 缺少 TableBlockOptions 的键：${tboOnlyShared.join(', ')}（工具入参会静默 strip）`)
  }
  if (tboOnlyZod.length) {
    ok = fail(`zod3 tableBlockOptionsSchema 多出 TableBlockOptions 没有的键：${tboOnlyZod.join(', ')}（镜像凭空多键）`)
  }

  // 6b. ⊆ core TableOptions 的具名键（承诺的选项运行时必须读得懂）。
  const tboPhantom = diff(tboKeys, coreTblKeys)
  if (tboPhantom.length) {
    ok = fail(`TableBlockOptions 含 core TableOptions 不认的键：${tboPhantom.join(', ')}（承诺了一个 runtime 读不懂的选项）`)
  }

  // 6c. 发射全覆盖：键集 ≡ TABLE_BLOCK_ALWAYS ∪ TABLE_BLOCK_OPTION_ORDER。
  const tbaKeys = constArrayMembers(fgenSrc, 'TABLE_BLOCK_ALWAYS', 'TABLE_BLOCK_ALWAYS')
  const tboOrderKeys = constArrayMembers(fgenSrc, 'TABLE_BLOCK_OPTION_ORDER', 'TABLE_BLOCK_OPTION_ORDER')
  if (tbaKeys === null || tboOrderKeys === null) process.exit(1)
  const tbaSet = new Set(tbaKeys)
  const tboOrderSet = new Set(tboOrderKeys)
  const tboNeverEmitted = diff(tboKeys, new Set([...tbaKeys, ...tboOrderKeys]))
  const tboDead = diff(new Set([...tbaSet, ...tboOrderSet]), tboKeys)
  if (tboNeverEmitted.length) {
    ok = fail(
      `TableBlockOptions 的键 ${tboNeverEmitted.join(', ')} 不在 TABLE_BLOCK_ALWAYS / TABLE_BLOCK_OPTION_ORDER 里 —— ` +
        '工具会接受该入参却**永不注入产物**（静默丢弃）；把键加进发射枚举或从接口删掉'
    )
  }
  if (tboDead.length) {
    ok = fail(`TABLE_BLOCK_ALWAYS / TABLE_BLOCK_OPTION_ORDER 含 TableBlockOptions 没有的键：${tboDead.join(', ')}（发射循环里的死条目）`)
  }
  // 两个发射枚举不得重叠（否则产物里同一键出现两次）。
  const tboDuplicated = [...tbaKeys].filter((k) => tboOrderSet.has(k))
  if (tboDuplicated.length) {
    ok = fail(`TABLE_BLOCK_ALWAYS 与 TABLE_BLOCK_OPTION_ORDER 重复键：${tboDuplicated.join(', ')}（产物会重复发射同一选项）`)
  }

  // ── 7. 片段 formLayout / pagination(Wave 4)：接口 ≡ 发射枚举 ≡ zod3 镜像 ──
  const pairSpecs = [
    {
      label: 'formLayout',
      iface: 'export interface EsFormLayout {',
      constName: 'FORM_LAYOUT_KEYS',
      zod: 'export const formLayoutSchema = z.object({',
    },
    {
      label: 'pagination',
      iface: 'export interface EsTablePagination {',
      constName: 'PAGINATION_KEYS',
      zod: 'export const tablePaginationSchema = z.object({',
    },
  ]
  for (const spec of pairSpecs) {
    const ifaceBlock = sliceBlock(fgenSrc, spec.iface, '}', `${spec.label} interface`)
    const zodBlock = sliceBlock(fshapesSrc, spec.zod, '});', `${spec.label} zod mirror`)
    const constKeys = constArrayMembers(fgenSrc, spec.constName, spec.constName)
    if (ifaceBlock === null || zodBlock === null || constKeys === null) process.exit(1)
    const ifaceKeys = new Set(topLevelKeys(ifaceBlock))
    const zodKeys = new Set(topLevelKeys(zodBlock))
    const constSet = new Set(constKeys)
    const ifaceOnly = [...ifaceKeys].filter((k) => !constSet.has(k))
    const constOnly = [...constSet].filter((k) => !ifaceKeys.has(k))
    if (ifaceOnly.length || constOnly.length) {
      ok = fail(
        `片段 ${spec.label}：接口与 ${spec.constName} 不等价（接口多 [${ifaceOnly.join(', ') || '无'}]、枚举多 [${constOnly.join(', ') || '无'}]）` +
          ' —— 接口声明了却不在发射枚举里 = 静默丢弃'
      )
    }
    const zodOnlyIface = diff(zodKeys, ifaceKeys)
    const ifaceOnlyZod = diff(ifaceKeys, zodKeys)
    if (zodOnlyIface.length) {
      ok = fail(`zod3 ${spec.label} 镜像多出接口没有的键：${zodOnlyIface.join(', ')}`)
    }
    if (ifaceOnlyZod.length) {
      ok = fail(`zod3 ${spec.label} 镜像缺少接口的键：${ifaceOnlyZod.join(', ')}（工具入参会静默 strip）`)
    }
  }

  // ── 8. 发射必须由冻结数组驱动（而非逐键手写循环 —— 那正是死键的温床）──
  for (const [label, constName] of [
    ['tableOptions', 'TABLE_BLOCK_OPTION_ORDER'],
    ['pagination', 'PAGINATION_KEYS'],
    ['formLayout', 'FORM_LAYOUT_KEYS'],
  ]) {
    if (!fgenSrc.includes(`of ${constName}`)) {
      ok = fail(
        `fragment-generator 的 ${label} 发射未遍历 ${constName} —— ` +
          '逐键手写会让「接口加了键、循环没跟上」重新变成无守卫缺口'
      )
    }
  }

  // ── 9. reactions 结构镜像（AI-47）──
  // 片段侧刻意**不**镜像递归算子校验（归 shared 权威 Zod），但结构键必须一致：
  // 形状少一个键 = 工具入参静默 strip；多一个键 = 教出一个运行时读不懂的键。
  // 这组键也是 prompt 自省的直接输入（`reactions` 曾因 `z.any()` 被渲染成 `any[]`，
  // 模型把 `fulfill.required` 写成裸 `true`）。
  {
    const sharedSchemaSrc = read('packages/shared/src/structured-config.schema.ts')
    const keysAt = (block, indent) => {
      const re = new RegExp(`^ {${indent}}([A-Za-z_$][\\w$]*)\\??\\s*:`, 'gm')
      return [...block.matchAll(re)].map((m) => m[1])
    }
    // shared 的 ReactionSchema 是 `z\n  .object({`（键缩进 4），且块尾跟 `.refine(...)` ——
    // 用下一个顶层 const 当边界，避免把 refine 的键算进来。
    const shReactionStart = 'const ReactionSchema = z'
    const i = sharedSchemaSrc.indexOf(shReactionStart)
    const j = sharedSchemaSrc.indexOf('const FieldConfigSchema', i)
    let shReactionBlock = i === -1 || j === -1 ? null : sharedSchemaSrc.slice(i + shReactionStart.length, j)
    // shared 的属性键在 `.object({ ... })` 里；块尾的顶层 `.refine(...)`（缩进 2）
    // 也有 `message` 键，不计入结构镜像。注意 `dependencies` 内部还有一个缩进 6 的
    // `.refine(isSafeProp, …)` —— 必须按缩进定位顶层那条，否则会把块截断成一行。
    if (shReactionBlock) {
      const refineAt = shReactionBlock.indexOf('\n  .refine(')
      if (refineAt !== -1) shReactionBlock = shReactionBlock.slice(0, refineAt)
    }
    const shFulfillBlock = sliceBlock(sharedSchemaSrc, 'const ReactionFulfillSchema = z.object({', '})', 'shared ReactionFulfillSchema')
    const fgReactionBlock = sliceBlock(fshapesSrc, 'const ReactionSchema = z.object({', '});', 'fragment ReactionSchema')
    const fgFulfillBlock = sliceBlock(fshapesSrc, 'const ReactionFulfillSchema = z.object({', '});', 'fragment ReactionFulfillSchema')
    if (shReactionBlock === null || shFulfillBlock === null || fgReactionBlock === null || fgFulfillBlock === null) {
      process.exit(1)
    }
    const pairs = [
      ['ReactionSchema', keysAt(shReactionBlock, 4), keysAt(fgReactionBlock, 2)],
      ['ReactionFulfillSchema', keysAt(shFulfillBlock, 2), keysAt(fgFulfillBlock, 2)],
    ]
    for (const [label, sharedKeys, fragmentKeys] of pairs) {
      const a = new Set(sharedKeys)
      const b = new Set(fragmentKeys)
      const onlyShared = diff(a, b)
      const onlyFragment = diff(b, a)
      if (onlyShared.length) {
        ok = fail(`片段 zod3 ${label} 缺少 shared 的键：${onlyShared.join(', ')}（工具入参会静默 strip）`)
      }
      if (onlyFragment.length) {
        ok = fail(`片段 zod3 ${label} 多出 shared 没有的键：${onlyFragment.join(', ')}（教出一个运行时读不懂的键）`)
      }
    }
    // 形状必须真的被字段引用（否则退回 `z.any()` 时上面的一致性检查仍在，却在教 `any[]`）。
    // 正则兼容 CRLF（仓库在 Windows 上检出时是 CRLF）。
    if (!/reactions:\s*z\s*\r?\n\s*\.array\(ReactionSchema\)/.test(fshapesSrc)) {
      ok = fail('surfaceFieldSchema.reactions 不再是 z.array(ReactionSchema) —— prompt 会退回 `any[]`，模型又把 fulfill.required 写成裸 boolean')
    }
  }

  if (ok) {
    console.log(
      `✅ fragment 词汇同步（SurfaceField ${sfKeys.size} 键 === zod3 surfaceFieldSchema ${zKeys.size} 键，成员标志均未泄漏；` +
        `dialog 选项 ${dboKeys.size} 键双份一致 ⊆ core ${coreDlgKeys.size} 键，发射顺序全覆盖，教学面覆盖 ${dozKeys.size} 键；` +
        `tableOptions ${tboKeys.size} 键双份一致 ⊆ core TableOptions ${coreTblKeys.size} 键，发射枚举全覆盖；` +
        `formLayout / pagination 接口 ≡ 发射枚举 ≡ zod3 镜像；reactions 结构 ≡ shared 权威）`
    )
    process.exit(0)
  }
  process.exit(1)
}

main()
