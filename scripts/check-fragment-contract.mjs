#!/usr/bin/env node
/**
 * fragment 词汇 ↔ mcp 工具镜像 同步校验
 *
 * 背景:片段工具(generate_form/table/dialog)与前门(generate_crud)的字段词汇/容器选项，
 * 2026-11 W2 起**不再由 mcp 手写镜像**：`_fragment-shapes.ts` 从 shared 的权威 Zod
 * （`SurfaceFieldSchema` / `StructuredCrudConfigSchema.shape.*` / `DialogBlockOptionsSchema`）
 * 派生。故本脚本的「Zod 一侧」改为**运行时读取**（esbuild 现打包源码，`captureFrontDoor()`
 * 已经导出这些形状），不再切源码字面量 —— 派生结果没有可切的对象字面量，硬切只会让
 * 守卫在「选择器失配 → 空集」时假绿。
 *
 * 为什么要对账:接口/枚举是手写的（`SurfaceField` / `TableBlockOptions` /
 * `DialogBlockOptions` / `EsFormLayout` / `EsTablePagination` / 发射枚举），派生只保证
 * 「Zod 与 shared 的 Zod 同源」，不保证「shared 的 Zod 与这些手写接口同步」。这条守卫
 * 仍然把两侧钉在一起；任一侧加键而另一侧没跟上 → 红。
 *
 * 校验项:
 *  1. 键集一致:SurfaceField(接口)的属性集 === surfaceFieldSchema(运行时派生形状)的顶层键集。
 *  2. 成员标志必须双双缺席:inQuery/inTable/inForm 由 composeCrudConfig 推导,
 *     不在任何「单面字段」里出现——两处都不许冒出来(冒出来说明有人把组合层的概念
 *     漏进了单面词汇)。
 *  3. dialog 底座选项(AI-28)三处一致:shared `DialogBlockOptions`(接口) ===
 *     `dialogOptionsSchema`(运行时形状),且**两者的键集都 ⊆ core `DialogOptions`
 *     的具名键** —— 往任一侧加一个 core 不认的键都会红。
 *  4. 选项**发射顺序**全覆盖:上条的键集必须恰等于 `DIALOG_OPTION_ORDER ∪ {width}`。
 *     这是「输入形状承诺了、生成器却读不到」这一类静默丢弃的守卫 —— 接口里有一个
 *     键而发射循环没枚举它,工具会接受该入参却永不注入产物,宿主看不出来。
 *  5. 教学面不得教幻影键:`resources/types.ts` 的 `TYPES_FALLBACK_VUE3.DialogOptions`
 *     具名键 ⊆ core 的具名键,且**必须覆盖** `dialogOptionsSchema` 的全部键 ——
 *     `generate_dialog` 的 `options` 收的每个键,宿主要在类型资源里看得到。
 *  6. 片段 `tableOptions`(Wave 4):shared `TableBlockOptions` === 运行时派生形状,两者都
 *     ⊆ core `TableOptions` 的具名键;且键集恰等于 `TABLE_BLOCK_ALWAYS ∪
 *     TABLE_BLOCK_OPTION_ORDER`(两者不重叠)—— 接口声明了却不在发射枚举里 = 接受入参
 *     却永不注入产物。
 *  7. 片段 `formLayout` / `pagination`(Wave 4):`EsFormLayout` / `EsTablePagination`
 *     各自 ≡ `FORM_LAYOUT_KEYS` / `PAGINATION_KEYS` ≡ 运行时派生形状(三处全等)。
 *     `formLayout` 另有**兄弟键**表 `FORM_LAYOUT_SIBLING_KEYS`（`layout` 分组容器：
 *     映射到 `layoutFormProps` 顶层而非 `formLayProps`）；接口键集 ≡ 两表之并。
 *     片段与**权威 schema** 同名嵌套块的等价性由 `check-entry-contract.mjs` 断言(6),
 *     两条守卫各守一侧:本脚本守「派生形状 ↔ 手写接口」,那条守「片段 ↔ 权威收窄」。
 *  8. 发射必须由冻结数组驱动（而非逐键手写循环 —— 那正是死键的温床）。
 *  9. `reactions` 结构不得退回 `any[]`（prompt 自省直接读形状；曾因此教模型把
 *     `fulfill.required` 写成裸 boolean）—— 运行时断言它是带 `dependencies/when/fulfill`
 *     的对象数组。
 *
 * 用法:node scripts/check-fragment-contract.mjs
 * 退出码:0 = 同步;1 = 发现漂移。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { captureFrontDoor } from './lib/front-door.mjs'

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

/**
 * 运行时取 Zod 对象的顶层键。
 *
 * 派生形状没有源码字面量可切，只能读实例。zod 4 的公开面是 `.shape`；同时兼容
 * `_zod.def.shape`（跨副本/未来内部变动时不至于静默返回空集 —— 空集会让所有
 * 差集断言恒真，这是本仓踩过的假绿模式）。
 *
 * 顶层可能带一层包装：`_fragment-shapes.ts` 对 `tableOptions` / `pagination` /
 * `formLayout` 保留了 shared 的 `.optional()`（派生只剥 `.default()`，容器整体可省略
 * 是真实语义）。读键前先把 optional/nullable/default 这层拆掉，否则拿到的是包装层、
 * 键集为空。
 */
function runtimeKeys(schema, label) {
  const WRAPPERS = new Set(['optional', 'nullable', 'default', 'prefault', 'catch', 'readonly', 'nonoptional'])
  let cur = schema
  for (let i = 0; i < 8 && cur; i++) {
    const def = cur?._zod?.def ?? cur?._def
    if (!def || !WRAPPERS.has(def.type) || !def.innerType) break
    cur = def.innerType
  }
  const shape = cur?.shape ?? cur?._zod?.def?.shape ?? cur?._def?.shape
  if (!shape || typeof shape !== 'object' || Object.keys(shape).length === 0) {
    fail(`无法从运行时形状 ${label} 读取键集（若派生层或 zod 版本变了，请同步本守卫）`)
    return null
  }
  return Object.keys(shape)
}

/**
 * W2 棘轮：`_fragment-shapes.ts` 必须保持派生形态，不得把手写副本写回来。
 * 与 `check-schema-contract` 对 `configShape` 的处理同一范式。
 */
function assertDerivedShapes() {
  const src = read(FRAGMENT_SHAPES_SRC)
  let ok = true
  const markers = [
    'export const tableBlockOptionsSchema = deriveSchema(crudShape.tableOptions',
    'export const tablePaginationSchema = deriveSchema(crudShape.pagination',
    'export const formLayoutSchema = deriveSchema(crudShape.formLayout',
    'export const dialogOptionsSchema = deriveSchema(DialogBlockOptionsSchema',
    'const derivedSurface = deriveSchema(SurfaceFieldSchema',
  ]
  for (const m of markers) {
    if (!src.includes(m)) {
      ok = fail(
        `_fragment-shapes.ts 缺少派生标记 ${JSON.stringify(m)} —— shared 权威 schema 才是单源（W2 棘轮，回滚请同批恢复本守卫并说明理由）`
      )
    }
  }
  for (const name of [
    'tableBlockOptionsSchema',
    'tablePaginationSchema',
    'formLayoutSchema',
    'dialogOptionsSchema',
    'surfaceFieldBase',
    'surfaceFieldSchema',
  ]) {
    if (new RegExp(`export const ${name} = z\\s*\\n?\\s*\\.object\\(`).test(src)) {
      ok = fail(`_fragment-shapes.ts 的 ${name} 又出现了手写 z.object 字面量 —— shared 权威 Zod 才是单源（W2）`)
    }
  }
  return ok
}

async function main() {
  const captured = await captureFrontDoor()
  try {
    await run(captured.mod)
  } finally {
    captured.cleanup()
  }
}

async function run(mod) {
  let ok = assertDerivedShapes()

  // ── 1. SurfaceField 接口键集 × 2. 运行时派生形状键集 ──
  const sfBlock = sliceBlock(read(SURFACE_FIELD_SRC), 'export interface SurfaceField {', '}', 'SurfaceField')
  const zKeysList = runtimeKeys(mod.surfaceFieldSchema, 'surfaceFieldSchema')
  if (sfBlock === null || zKeysList === null) process.exit(1)

  const sfKeys = new Set(topLevelKeys(sfBlock))
  const zKeys = new Set(zKeysList)

  const missingInZod = [...sfKeys].filter((k) => !zKeys.has(k))
  const extraInZod = [...zKeys].filter((k) => !sfKeys.has(k))

  if (missingInZod.length) {
    ok = fail(
      `surfaceFieldSchema 缺少 SurfaceField 的字段：${missingInZod.join(', ')}` +
        '（给 SurfaceField 加了字段，但 shared 的 SurfaceFieldSchema 没跟上 —— MCP 工具会静默丢弃该入参）'
    )
  }
  if (extraInZod.length) {
    ok = fail(
      `surfaceFieldSchema 多出 SurfaceField 没有的字段：${extraInZod.join(', ')}` +
        '（shared 的 SurfaceFieldSchema 凭空多了 key —— 要么 SurfaceField 漏加，要么 schema 拼错）'
    )
  }

  // ── 3. 成员标志双双缺席 ──
  for (const flag of MEMBERSHIP_FLAGS) {
    if (sfKeys.has(flag)) ok = fail(`SurfaceField 不应包含成员标志 "${flag}"（它由 composeCrudConfig 推导）`)
    if (zKeys.has(flag)) ok = fail(`surfaceFieldSchema 不应包含成员标志 "${flag}"（它由 composeCrudConfig 推导）`)
  }

  // ── 4. dialog 底座选项(AI-28)：接口 ≡ 运行时派生形状，且都 ⊆ core DialogOptions ──
  const dboBlock = sliceBlock(read(FRAGMENT_GENERATOR_SRC), 'export interface DialogBlockOptions {', '}', 'DialogBlockOptions')
  const dozKeysList = runtimeKeys(mod.dialogOptionsSchema, 'dialogOptionsSchema')
  const orderBlock = sliceBlock(read(FRAGMENT_GENERATOR_SRC), 'const DIALOG_OPTION_ORDER = [', '] as const', 'DIALOG_OPTION_ORDER')
  const coreDlgBlock = sliceBlock(read(CORE_TYPES_SRC), 'export interface DialogOptions {', '}', 'core DialogOptions')
  const fbDlgBlock = sliceBlock(read(RESOURCE_TYPES_SRC), 'export interface DialogOptions {', '}', 'TYPES_FALLBACK_VUE3.DialogOptions')
  if (dboBlock === null || dozKeysList === null || orderBlock === null || coreDlgBlock === null || fbDlgBlock === null) process.exit(1)

  const dboKeys = new Set(topLevelKeys(dboBlock))
  const dozKeys = new Set(dozKeysList)
  const orderKeys = new Set(quotedMembers(orderBlock))
  const coreDlgKeys = new Set(topLevelKeys(coreDlgBlock))
  const fbDlgKeys = new Set(topLevelKeys(fbDlgBlock))

  // 4a. 接口声明与工具形状逐键一致（工具形状是 passthrough：未知键由闸门报错而非
  //     静默 strip，所以键集跑偏不会自己暴露——必须在这里静态钉住）。
  const onlyShared = diff(dboKeys, dozKeys)
  const onlyZod = diff(dozKeys, dboKeys)
  if (onlyShared.length) {
    ok = fail(`dialogOptionsSchema 缺少 DialogBlockOptions 的键：${onlyShared.join(', ')}（工具入参会静默 strip）`)
  }
  if (onlyZod.length) {
    ok = fail(`dialogOptionsSchema 多出 DialogBlockOptions 没有的键：${onlyZod.join(', ')}（凭空多键 = core 侧描述落后）`)
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

  // ── 6. 片段 tableOptions(Wave 4)：shared 接口 ≡ 运行时派生形状 ⊆ core TableOptions ──
  const fgenSrc = read(FRAGMENT_GENERATOR_SRC)
  const fshapesSrc = read(FRAGMENT_SHAPES_SRC)
  const tboBlock = sliceBlock(fgenSrc, 'export interface TableBlockOptions {', '}', 'TableBlockOptions')
  const tbozKeysList = runtimeKeys(mod.tableBlockOptionsSchema, 'tableBlockOptionsSchema')
  const coreTblBlock = sliceBlock(read(CORE_TYPES_SRC), 'export interface TableOptions {', '}', 'core TableOptions')
  if (tboBlock === null || tbozKeysList === null || coreTblBlock === null) process.exit(1)

  const tboKeys = new Set(topLevelKeys(tboBlock))
  const tbozKeys = new Set(tbozKeysList)
  const coreTblKeys = new Set(topLevelKeys(coreTblBlock))

  // 6a. 接口声明与工具形状逐键一致（容器形状保持 strip：跑偏了就是静默 strip）。
  const tboOnlyShared = diff(tboKeys, tbozKeys)
  const tboOnlyZod = diff(tbozKeys, tboKeys)
  if (tboOnlyShared.length) {
    ok = fail(`tableBlockOptionsSchema 缺少 TableBlockOptions 的键：${tboOnlyShared.join(', ')}（工具入参会静默 strip）`)
  }
  if (tboOnlyZod.length) {
    ok = fail(`tableBlockOptionsSchema 多出 TableBlockOptions 没有的键：${tboOnlyZod.join(', ')}（凭空多键）`)
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

  // ── 7. 片段 formLayout / pagination(Wave 4)：接口 ≡ 发射枚举 ≡ 运行时派生形状 ──
  const pairSpecs = [
    {
      label: 'formLayout',
      iface: 'export interface EsFormLayout {',
      constName: 'FORM_LAYOUT_KEYS',
      siblingName: 'FORM_LAYOUT_SIBLING_KEYS',
      runtime: ['formLayoutSchema', mod.formLayoutSchema],
    },
    {
      label: 'pagination',
      iface: 'export interface EsTablePagination {',
      constName: 'PAGINATION_KEYS',
      runtime: ['tablePaginationSchema', mod.tablePaginationSchema],
    },
  ]
  for (const spec of pairSpecs) {
    const ifaceBlock = sliceBlock(fgenSrc, spec.iface, '}', `${spec.label} interface`)
    const zodKeysList = runtimeKeys(spec.runtime[1], spec.runtime[0])
    const constKeys = constArrayMembers(fgenSrc, spec.constName, spec.constName)
    if (ifaceBlock === null || zodKeysList === null || constKeys === null) process.exit(1)
    // 兄弟键（映射到 layoutFormProps 顶层而非 formLayProps）同样必须被冻结表覆盖，
    // 接口键集 = formLayProps 键 ∪ 兄弟键。
    const siblingKeys = spec.siblingName
      ? constArrayMembers(fgenSrc, spec.siblingName, spec.siblingName)
      : []
    if (siblingKeys === null) process.exit(1)
    const ifaceKeys = new Set(topLevelKeys(ifaceBlock))
    const zodKeys = new Set(zodKeysList)
    const constSet = new Set([...constKeys, ...siblingKeys])
    const ifaceOnly = [...ifaceKeys].filter((k) => !constSet.has(k))
    const constOnly = [...constSet].filter((k) => !ifaceKeys.has(k))
    if (ifaceOnly.length || constOnly.length) {
      ok = fail(
        `片段 ${spec.label}：接口与 ${spec.constName}（含兄弟键表）不等价（接口多 [${ifaceOnly.join(', ') || '无'}]、枚举多 [${constOnly.join(', ') || '无'}]）` +
          ' —— 接口声明了却不在发射枚举里 = 静默丢弃'
      )
    }
    const zodOnlyIface = diff(zodKeys, ifaceKeys)
    const ifaceOnlyZod = diff(ifaceKeys, zodKeys)
    if (zodOnlyIface.length) {
      ok = fail(`${spec.label} 工具形状多出接口没有的键：${zodOnlyIface.join(', ')}`)
    }
    if (ifaceOnlyZod.length) {
      ok = fail(`${spec.label} 工具形状缺少接口的键：${ifaceOnlyZod.join(', ')}（工具入参会静默 strip）`)
    }
  }

  // ── 8. 发射必须由冻结数组驱动（而非逐键手写循环 —— 那正是死键的温床）──
  for (const [label, constName] of [
    ['tableOptions', 'TABLE_BLOCK_OPTION_ORDER'],
    ['pagination', 'PAGINATION_KEYS'],
    ['formLayout', 'FORM_LAYOUT_KEYS'],
    ['formLayout 兄弟键', 'FORM_LAYOUT_SIBLING_KEYS'],
  ]) {
    if (!fgenSrc.includes(`of ${constName}`)) {
      ok = fail(
        `fragment-generator 的 ${label} 发射未遍历 ${constName} —— ` +
          '逐键手写会让「接口加了键、循环没跟上」重新变成无守卫缺口'
      )
    }
  }

  // ── 9. reactions 结构（AI-47 → W2 运行时断言）──
  // 片段 prompt 直接自省工具形状；`reactions` 一旦退回 `any[]`，模型就会把
  // `fulfill.required` 写成裸 `true`。W2 起该形状由 shared 派生，故不再切源码文本，
  // 而是读运行时的 JSON Schema：它必须是「对象数组」，且元素带 dependencies/when/fulfill，
  // fulfill 带 dataOptions/required/disabled/value。
  {
    const schemaOf = mod.z.toJSONSchema(mod.surfaceFieldSchema, {
      io: 'input',
      unrepresentable: 'any',
    })
    const reactions = schemaOf?.properties?.reactions
    const items = reactions?.items?.properties
    if (!items) {
      ok = fail('surfaceFieldSchema.reactions 没有结构（prompt 会退回 `any[]`，模型又把 fulfill.required 写成裸 boolean）')
    } else {
      for (const k of ['dependencies', 'when', 'fulfill']) {
        if (!(k in items)) ok = fail(`surfaceFieldSchema.reactions 的元素缺少 ${k} —— prompt 自省会教出不完整的结构`)
      }
      const fulfill = items.fulfill?.properties
      if (!fulfill) {
        ok = fail('surfaceFieldSchema.reactions 的 fulfill 没有结构（选项联动/值回写表达不了）')
      } else {
        for (const k of ['dataOptions', 'required', 'disabled', 'value']) {
          if (!(k in fulfill)) ok = fail(`surfaceFieldSchema.reactions 的 fulfill 缺少 ${k}（prompt 自省教不全）`)
        }
      }
    }
  }

  if (ok) {
    console.log(
      `✅ fragment 词汇同步（SurfaceField ${sfKeys.size} 键 === 派生 surfaceFieldSchema ${zKeys.size} 键，成员标志均未泄漏；` +
        `dialog 选项 ${dboKeys.size} 键接口一致 ⊆ core ${coreDlgKeys.size} 键，发射顺序全覆盖，教学面覆盖 ${dozKeys.size} 键；` +
        `tableOptions ${tboKeys.size} 键接口一致 ⊆ core TableOptions ${coreTblKeys.size} 键，发射枚举全覆盖；` +
        `formLayout / pagination 接口 ≡ 发射枚举 ≡ 工具形状；reactions 结构完整；形状全部由 shared 派生）`
    )
    process.exit(0)
  }
  process.exit(1)
}

await main().catch((err) => {
  console.error(err)
  process.exit(1)
})
