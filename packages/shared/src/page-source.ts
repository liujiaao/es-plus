/**
 * `es-plus.page-source@1` —— 生成物的**出处**（provenance），W4 回读闭环的载体。
 *
 * ## 为什么需要它
 *
 * 页面生成后，宿主（AI 客户端）手里只剩产物：`schema.ts` 里的一份 `pageSchema`，
 * 或 sfc 模式的一整段 `.vue`。下一轮「再加一个手机号列」时，宿主要么重新问用户，
 * 要么从产物反推配置 —— 而反推必然有损：`formItems` 已经按 formtype 展开、可见性
 * 被压成「在不在这个数组里」、`permissions` 在 schema 模式**根本没进产物**。
 * 反推得越像，越容易把「猜测」当成「原始意图」，然后再生成一遍把猜测固化成配置。
 *
 * 所以生成器把自己的输入**原样**带进产物，回读就是解压，不是推理。
 *
 * ## 为什么要 `lossy[]`
 *
 * 「原样带进去」只对**数据**成立。生成器在落地时会做三类改动：
 *   1. 丢弃（未知键 / 非 JSON 值）—— 输入里有、产物里没有；
 *   2. 模式不消费（schema 模式的 `permissions`、sfc 模式的 `dialogs` 等）——
 *      配置有效、但这份产物不会执行它；
 *   3. 归一/修复（`rowkey → tableOptions.rowkey`、`"true" → true`）——
 *      读回的是**生效后**的配置，与宿主提交的那份不同。
 * 三类都必须逐条报出来，否则「回读得到的配置」会被误当成「当初提交的配置」。
 * 告警文本仍然保留（给人读）；`lossy[]` 是同一件事的机器可读视图（给宿主程序读）。
 *
 * ## 位置：pageSchema 内的 `__esPlusSource`
 *
 * 不另发一个文件（宿主落盘时最容易漏掉的那个），也不作为兄弟 `export`
 * （`extractPageSchema` 与既有测试都假定 pageSchema 是唯一的 `export const`）。
 * 放进 pageSchema 对象本身：产物是**自描述**的，`schema.ts` 一个文件就够回读。
 * 运行时 `EsCrudPage` 不认识这个键 —— 它是数据，不是配置。
 *
 * sfc 模式没有 pageSchema：出处以单行注释写在 `<script>` 块内
 * （`// __esPlusSource: {…}`）。注释内容经 `inlineJson` 转义，`</script>` 不会提前
 * 闭合脚本块；JSON 里的换行也已转义，因此一定是一行。
 *
 * ## 设计原则（D7）—— 出处是**发射器**的产物，不是页面的属性
 *
 * > 凡是「有确定性输入 → 产物」的入口，都必须带出处；凡是不能无损表达的入口
 * > （组合 / 自定义 `render`），用独立契约 + 显式降级说明，不做有损反推。
 *
 * 因此：`generateFromConfig` 的每个 mode（schema / sfc，js / ts）都写出处；
 * 组合页走独立的 `es-plus.composition-source@1` 键（见文件末尾），不冒充 page-source；
 * 投影损失由 `lossy[]` 逐条点名，而不是让读者从产物差异里猜。
 */

import { findNonJsonValues } from './codegen-escape.js'
import { DialogBlockOptionsSchema } from './structured-config.schema.js'

/** 协议标识。读回端按它判版本，未知版本明确报错而不是猜字段。 */
export const PAGE_SOURCE_CONTRACT = 'es-plus.page-source@1' as const

/** pageSchema 里的出处键。运行时忽略；`read_page` 读取。 */
export const PAGE_SOURCE_KEY = '__esPlusSource' as const

/** sfc 注释里的标记（后面紧跟 `: <json>`）。 */
export const PAGE_SOURCE_MARK = '__esPlusSource' as const

/** 一条「输入与产物不一致」的记录。 */
export interface EsPlusLossyEntry {
  /**
   * 相对配置根的路径，如 `tableOptions.rowKey` / `fields[2].formatter`。
   * 与 Zod issue 的 `/path/key` 形态刻意不同：这里是给宿主程序比对的，不带前导斜杠。
   */
  path: string
  /**
   * - `dropped`            未知键 / 非 JSON 值：输入里有，产物里没有；
   * - `ignored-in-mode`    该 mode 的发射器不消费这个键（产物有效，只是不生效）；
   * - `not-expressible`    运行时形态表达不了（schema 模式的行内函数、表单面 render）；
   * - `normalized`         确定性归一/修复改写了它（读回的是生效后的值）。
   */
  kind: 'dropped' | 'ignored-in-mode' | 'not-expressible' | 'normalized'
  /** 一句话说明，宿主可直接展示给用户。 */
  detail: string
}

/** `__esPlusSource` 的值。 */
export interface EsPlusPageSource {
  contract: typeof PAGE_SOURCE_CONTRACT
  /** 生成器自身标识，便于将来区分其它产出方。 */
  generator: 'es-plus'
  target: 'vue3' | 'vue2' | 'antdv'
  mode: 'schema' | 'sfc'
  /** **真正喂给发射器**的配置（归一并剔除了未知键）。回读即得，不是反推。 */
  config: Record<string, unknown>
  /** 输入与产物不一致之处；空数组 = 逐键无损。 */
  lossy: EsPlusLossyEntry[]
}

export interface BuildPageSourceInput {
  target: 'vue3' | 'vue2' | 'antdv'
  mode: 'schema' | 'sfc'
  /** `generateFromConfig` 内部生效的那份配置（已过 repair / 归一）。 */
  config: unknown
  /** 未知键（`collectUnknownKeys` 的 path + key + suggestion）。 */
  unknownKeys?: ReadonlyArray<{ path: ReadonlyArray<string | number>; key: string; suggestion?: string }>
  /** 归一/修复记录（`repairConfig` 的 renames / repairs）。 */
  renames?: ReadonlyArray<{ from: string; to: string; note: string }>
  repairs?: ReadonlyArray<{ path: string; note: string }>
}

/** 把路径片段渲染成 `a.b[0].c` 形态。 */
function joinPath(segments: ReadonlyArray<string | number>): string {
  let out = ''
  for (const seg of segments) {
    if (typeof seg === 'number') out += `[${seg}]`
    else out += out ? `.${seg}` : seg
  }
  return out
}

/** 深拷贝并删掉未知键（路径在 `config` 上真实存在；不存在就跳过）。 */
function pruneUnknown(value: unknown, unknownKeys: BuildPageSourceInput['unknownKeys']): unknown {
  if (!unknownKeys?.length) return value
  for (const f of unknownKeys) {
    let node: any = value
    let ok = true
    for (const seg of f.path) {
      if (node === null || typeof node !== 'object' || !(seg as any in node)) { ok = false; break }
      node = node[seg as any]
    }
    if (ok && node && typeof node === 'object') delete node[f.key]
  }
  return value
}

/**
 * 收集 `formatter` / `render` 这类行内函数（schema 模式无法内联，产物里没有它们）。
 *
 * 字段面与弹窗表单项面共用同一实现：只走顶层时，`dialogs.add.formItems[i].render`
 * 会被静默丢掉而 `lossy[]` 里没有 —— 宿主会以为它已经随配置带走了。
 * 嵌套 `children` 递归，与生成器的一层容器上限一致（更深的层级生成器本身会忽略）。
 */
function functionLossy(items: unknown, basePath: string, out: EsPlusLossyEntry[]): void {
  if (!Array.isArray(items)) return
  items.forEach((item, i) => {
    if (!item || typeof item !== 'object') return
    const node = item as Record<string, unknown>
    for (const key of ['formatter', 'render'] as const) {
      if (typeof node[key] === 'string' && node[key]) {
        out.push({
          path: `${basePath}[${i}].${key}`,
          kind: 'not-expressible',
          detail: 'JSON 不能携带函数：产物里没有这段逻辑（配置值已随出处保留，宿主改完重新生成即可）。',
        })
      }
    }
    if (Array.isArray(node.children)) functionLossy(node.children, `${basePath}[${i}].children`, out)
  })
}

/**
 * 找出「输入里有、产物不会执行」的键。与生成器内部的告警是**同一批事实**：
 * 告警负责解释给用户，这里负责给宿主程序（以及 `read_page` 的调用方）一个稳定的清单。
 */
function modeLossy(config: Record<string, any>, mode: 'schema' | 'sfc'): EsPlusLossyEntry[] {
  const out: EsPlusLossyEntry[] = []
  const fields: any[] = Array.isArray(config.fields) ? config.fields : []

  if (mode === 'schema') {
    if (config.permissions && Object.keys(config.permissions).length) {
      out.push({
        path: 'permissions',
        kind: 'ignored-in-mode',
        detail: 'schema 模式的按钮由运行时按 actions 派生，CrudPageSchema 没有逐按钮 permissionValue 通道；改用 mode=sfc 或在 operationColumn/toolbarBtns 里显式声明 permissionValue。',
      })
    }
    functionLossy(fields, 'fields', out)
    for (const [key, dlg] of Object.entries(config.dialogs ?? {})) {
      if (!dlg || typeof dlg !== 'object') continue
      if ((dlg as any).hasCustomRender) {
        out.push({
          path: `dialogs.${key}.hasCustomRender`,
          kind: 'not-expressible',
          detail: '自定义弹窗渲染函数不在 schema 里，产物只标记该弹窗需要宿主实现。',
        })
      }
      // 弹窗表单项与字段面同一件事：schema 模式的 formItems 是 JSON 数据，行内函数进不去。
      functionLossy((dlg as any).formItems, `dialogs.${key}.formItems`, out)
    }
    return out
  }

  // sfc 模式：以下四个块整体不被发射（见 generateSFC 的 ignoredInSfc 告警）。
  if (config.dialogs && Object.keys(config.dialogs).length) {
    out.push({
      path: 'dialogs',
      kind: 'ignored-in-mode',
      detail: 'sfc 模式只从 actions 派生一个通用弹窗，逐弹窗的标题/字段/布局不会发射。',
    })
  }
  if (Array.isArray(config.tableBtns) && config.tableBtns.length) {
    out.push({ path: 'tableBtns', kind: 'ignored-in-mode', detail: 'sfc 模式不发射表格工具栏按钮。' })
  }
  if (Array.isArray(config.toolbarBtns) && config.toolbarBtns.length) {
    out.push({ path: 'toolbarBtns', kind: 'ignored-in-mode', detail: 'sfc 模式不发射自定义工具栏按钮。' })
  }
  if (config.operationColumn && typeof config.operationColumn === 'object') {
    out.push({ path: 'operationColumn', kind: 'ignored-in-mode', detail: 'sfc 模式的操作列由 actions 派生，宽/标题/固定等设置不发射。' })
  }
  return out
}

/**
 * 构造出处。`config` 会先做 JSON 投影（函数 / undefined / BigInt 等无法进 JSON 的成员
 * 逐条记入 `lossy`），再剔除未知键 —— 产物里只留「真的生效过的数据」。
 */
export function buildPageSource(input: BuildPageSourceInput): EsPlusPageSource {
  const lossy: EsPlusLossyEntry[] = []

  for (const f of input.unknownKeys ?? []) {
    const path = [...f.path, f.key].map(String).join('.').replace(/\.(\d+)/g, '[$1]')
    lossy.push({
      path,
      kind: 'dropped',
      detail: f.suggestion
        ? `不在 StructuredCrudConfigSchema 里，生成时被忽略（did you mean "${f.suggestion}"?）`
        : '不在 StructuredCrudConfigSchema 里，生成时被忽略。',
    })
  }
  for (const r of input.renames ?? []) {
    lossy.push({ path: r.from, kind: 'normalized', detail: `归一为 ${r.to}（${r.note}）` })
  }
  for (const r of input.repairs ?? []) {
    lossy.push({ path: r.path, kind: 'normalized', detail: `确定性修复（${r.note}）` })
  }

  // 先做 JSON 投影（函数 / BigInt 在投影时会被静默删掉或置 null，故先在线性遍历里
  // 点名），再在**投影后的副本**上剔除未知键 —— 不碰调用方手里那份 config。
  const nonJson = findNonJsonValues(input.config)
  let config: Record<string, unknown>
  try {
    const projected = JSON.parse(JSON.stringify(input.config))
    const pruned = pruneUnknown(projected, input.unknownKeys)
    config = pruned && typeof pruned === 'object' && !Array.isArray(pruned) ? (pruned as Record<string, unknown>) : {}
  } catch {
    config = {}
  }
  // 函数 / symbol / BigInt / 稀疏洞：JSON 投影会静默删/置 null，这里点名。
  for (const p of nonJson) {
    lossy.push({ path: p, kind: 'not-expressible', detail: '不是 JSON 值，无法随出处携带（产物里也没有它）。' })
  }

  lossy.push(...modeLossy(config, input.mode))

  return {
    contract: PAGE_SOURCE_CONTRACT,
    generator: 'es-plus',
    target: input.target,
    mode: input.mode,
    config,
    lossy,
  }
}

// ── 回读 → `surfaces`（front-door 的再生成通道）───────────────────────────

/**
 * `SurfaceField` 的合法键。投影只**白名单拷贝**：配置里的成员布尔
 * （`inQuery` / `inTable` / `inForm`）与列级键不属于 surfaces 词汇，原样搬过去会被
 * 前门按未知键拒绝 —— 而 surfaces 的成员关系本来就由「这个字段出现在哪个面」表达。
 */
const SURFACE_FIELD_KEYS = [
  'prop',
  'label',
  'labelKey',
  'formtype',
  'querySpan',
  'formSpan',
  'group',
  'required',
  'rules',
  'attrs',
  'dataOptions',
  'apiParams',
  'width',
  'minWidth',
  'align',
  'fixed',
  'ellipsis',
  // D2：列筛选可以从字段面投影到派生列。
  'filters',
  'filterMultiple',
  'filterMode',
  'autoFilters',
  'formatter',
  'render',
  'isHidden',
  'reactions',
  'permissionValue',
] as const

function pickSurfaceField(field: unknown): Record<string, unknown> | null {
  if (!field || typeof field !== 'object') return null
  const src = field as Record<string, unknown>
  if (typeof src.prop !== 'string' || !src.prop) return null
  const out: Record<string, unknown> = {
    prop: src.prop,
    label: typeof src.label === 'string' ? src.label : src.prop,
    formtype: typeof src.formtype === 'string' ? src.formtype : 'Input',
  }
  for (const key of SURFACE_FIELD_KEYS) {
    if (key === 'prop' || key === 'label' || key === 'formtype') continue
    if (src[key] !== undefined) out[key] = src[key]
  }
  // 嵌套容器：子字段同样只带 surfaces 词汇（一层，与契约一致）。
  if (Array.isArray(src.children)) {
    out.children = src.children.map(pickSurfaceField).filter(Boolean)
  }
  return out
}

export interface ConfigToSurfacesResult {
  /** 可直接作为 `generate_scene`（scene='crud'）的 `intent` 传入。 */
  intent: Record<string, unknown>
  /** 配置里 surfaces 词汇表达不了、投影时被丢掉的键。 */
  lossy: EsPlusLossyEntry[]
}

/**
 * `StructuredCrudConfig` → `surfaces` 意图表。
 *
 * front-door 只注册 `generate_scene`，所以「回读 → 改 → 再生成」在那一档里必须能落回
 * surfaces。这是**机械投影**，不是推理：成员关系由 `inQuery/inTable/inForm` 决定，
 * 其余键按 `SurfaceField` 白名单拷贝。表达不了的（显式 `columns` 没有 surfaces 通道）
 * 逐条写进 `lossy`，绝不静默丢。
 */
/**
 * `generate_scene` 的 dialog 块接受的底座键（与 `DialogBlockOptionsSchema` 同源）。
 * 手写清单会漂移：这里少一个键，回读 → 再生成就把宿主的设置静默改回默认。
 */
const DIALOG_BLOCK_KEYS: ReadonlyArray<string> = Object.keys(DialogBlockOptionsSchema.shape)
/** `key` 是 entries 的键，`title` 不在底座 pick 里；其余一律按底座白名单拷贝。 */
const DIALOG_SURFACE_KEYS: ReadonlyArray<string> = ['title', ...DIALOG_BLOCK_KEYS]

export function configToSurfaces(config: Record<string, any>): ConfigToSurfacesResult {
  const lossy: EsPlusLossyEntry[] = []
  const fields: any[] = Array.isArray(config.fields) ? config.fields : []
  const dialogFormItems = (dlg: any): Array<Record<string, unknown>> =>
    (Array.isArray(dlg?.formItems) ? dlg.formItems : [])
      .map(pickSurfaceField)
      .filter((f: unknown): f is Record<string, unknown> => !!f)

  const query = fields.filter((f) => f && f.inQuery !== false).map(pickSurfaceField).filter(Boolean)
  const table = fields
    .filter((f) => f && f.inTable !== false && !Array.isArray(f.children))
    .map(pickSurfaceField)
    .filter(Boolean)
  // 表格面没有「容器列」：inTable 未显式关掉的容器会被生成器跳过，投影同样跳过 —— 但要报。
  fields.forEach((f, i) => {
    if (!f) return
    // R6：三个成员布尔全 false 的字段不进任何面 —— `surfacesToConfig` 组合时它不存在。
    // 它不是「配置无效」（expandConfig / 自定义消费者仍可能在用它），但回读→重生成一定会丢，
    // 所以必须点名，而不是让它悄悄消失。
    if (f.inQuery === false && f.inTable === false && f.inForm === false) {
      lossy.push({
        path: `fields[${i}]`,
        kind: 'not-expressible',
        detail:
          '该字段 inQuery/inTable/inForm 全为 false —— surfaces 的三个面都没有它，用它再生成会丢掉该字段。' +
          'expandConfig 等非面消费者仍需要它时，请把返回的 `config` 直接交给生成器。',
      })
    }
    if (f.inTable !== false && Array.isArray(f.children) && f.children.length) {
      lossy.push({
        path: `fields[${i}]`,
        kind: 'not-expressible',
        detail: '嵌套容器不是表格列：surfaces 的 table 面不带它（query / form 面仍保留）。',
      })
    }
  })
  const form = fields.filter((f) => f && f.inForm !== false).map(pickSurfaceField).filter(Boolean)

  const dialogEntries = Object.entries(config.dialogs ?? {})
    .filter(([, dlg]) => dlg && typeof dlg === 'object')
    .map(([key, dlg]: [string, any]) => {
      const out: Record<string, unknown> = { key }
      for (const k of DIALOG_SURFACE_KEYS) if (dlg[k] !== undefined) out[k] = dlg[k]
      if (Array.isArray(dlg.formItems)) out.formItems = dialogFormItems(dlg)
      // 投影不掉的键必须点名：它们不是「配置无效」，只是 surfaces 意图没有通道。
      for (const k of Object.keys(dlg)) {
        if (k === 'key' || k === 'formItems' || DIALOG_SURFACE_KEYS.includes(k)) continue
        if (k.startsWith('x-')) continue
        lossy.push({
          path: `dialogs.${key}.${k}`,
          kind: 'not-expressible',
          detail:
            'surfaces 意图的 dialog 块没有这个键（见 DialogBlockOptionsSchema）；' +
            '用它再生成会丢掉该设置。需要保留时把返回的 config 直接交给生成器。',
        })
      }
      return out
    })

  const intent: Record<string, unknown> = { surfaces: { query, table, form, dialog: dialogEntries } }
  for (const key of [
    'name',
    'apiUrl',
    'target',
    'mode',
    'typescript',
    'i18n',
    'actions',
    'permissions',
    'pagination',
    'tableOptions',
    'formLayout',
    'operationColumn',
    'tableBtns',
    'toolbarBtns',
    'expandConfig',
    'treeConfig',
    'mergeConfig',
  ]) {
    if (config[key] !== undefined) intent[key] = config[key]
  }

  if (Array.isArray(config.columns) && config.columns.length > 0) {
    lossy.push({
      path: 'columns',
      kind: 'not-expressible',
      detail:
        'surfaces 意图没有显式 columns 通道（列顺序/多级表头/非字段列）—— ' +
        '用它再生成会退回按 fields 派生列。需要保留显式列时请把返回的 `config` 直接交给生成器（full 档的 generate_crud_from_config）。',
    })
  }

  return { intent, lossy }
}

// ── 读回 ────────────────────────────────────────────────────────────────

export type ReadPageSourceResult =
  | { ok: true; source: EsPlusPageSource }
  | { ok: false; error: string; hint: string }

/**
 * 从一段源码里切出**第一个**完整的 JSON 对象。
 *
 * 不做 `JSON.parse(text.slice(indexOf('{'), lastIndexOf('}') + 1))`：那条捷径会把
 * 后面任何一段文本吞进来（sfc 的注释一行还好，pageSchema 后面接别的 export 就直接坏）。
 * 这里用字符串/转义感知的括号配平，对 `"label": "}"`、`"x": "\\"}"` 都成立。
 */
function sliceJsonObject(text: string, fromIndex = 0): string | null {
  const start = text.indexOf('{', fromIndex)
  if (start < 0) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

function assertSource(value: unknown): ReadPageSourceResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: '`__esPlusSource` 不是对象。', hint: '产物可能被手工改过；重新生成一次即可。' }
  }
  const s = value as Partial<EsPlusPageSource>
  if (s.contract !== PAGE_SOURCE_CONTRACT) {
    return {
      ok: false,
      error: `出处协议版本是 ${JSON.stringify(s.contract)}，本工具只认 ${PAGE_SOURCE_CONTRACT}。`,
      hint: '用当前版本的 es-plus 重新生成该页面（旧产物没有可读的出处）。',
    }
  }
  if (!s.config || typeof s.config !== 'object' || Array.isArray(s.config)) {
    return { ok: false, error: '出处里的 `config` 不是对象。', hint: '产物损坏；重新生成。' }
  }
  if (!Array.isArray(s.lossy)) {
    return { ok: false, error: '出处里的 `lossy` 不是数组。', hint: '产物损坏；重新生成。' }
  }
  return { ok: true, source: s as EsPlusPageSource }
}

/**
 * 在源码里找**含出处键的那个对象**。
 *
 * 不能从第一个 `{` 切：TypeScript 产物开头是
 * `import type { CrudPageSchema } from '@es-plus/vue3'` —— 第一个花括号属于 import 解构，
 * 配平后得到 `{ CrudPageSchema }`，JSON.parse 必失败。逐个候选对象试，命中即返回；
 * 上限 64 次防止超长文件（比如打包后的 bundle）把这里拖成 O(n²) 的重活。
 */
function findSourceObject(text: string): Record<string, unknown> | null {
  return locateSourceObject(text)?.parsed ?? null
}

/** 同上，但同时给出对象在源码里的起止（`stripPageSourceArtifact` 要用）。 */
function locateSourceObject(text: string): { start: number; json: string; parsed: Record<string, unknown> } | null {
  let from = 0
  for (let attempt = 0; attempt < 64; attempt++) {
    const start = text.indexOf('{', from)
    if (start < 0) return null
    const json = sliceJsonObject(text, start)
    if (json) {
      try {
        const obj = JSON.parse(json)
        if (obj && typeof obj === 'object' && !Array.isArray(obj) && PAGE_SOURCE_KEY in obj) {
          return { start, json, parsed: obj as Record<string, unknown> }
        }
      } catch {
        /* 不是这一层（import 解构 / 类型注解 / 普通代码块），继续试下一个 `{` */
      }
    }
    from = start + 1
  }
  return null
}

/**
 * 从生成物读回出处。接受三种输入，按以下顺序识别：
 *   1. `schema.ts`（`export const pageSchema = { … "__esPlusSource": {…} … }`）；
 *   2. 裸 pageSchema JSON（站点案例里存的那份）；
 *   3. sfc 模式产物（`<script>` 内的 `// __esPlusSource: {…}` 注释）。
 *
 * 没有出处的页面（W4 之前生成的、或手写的）**明确报错**，不做有损反推：
 * 反推出来的「配置」看起来像真的，但它会把猜测固化成下一轮生成的输入。
 */
export function readPageSource(text: string, label = 'page'): ReadPageSourceResult {
  if (typeof text !== 'string' || !text.trim()) {
    return { ok: false, error: `${label}：输入为空。`, hint: '传入 schema.ts / Page.vue 的文件内容。' }
  }

  // 1/2. pageSchema 路径：JSON 键一定带引号；注释标记不带。
  const quotedKey = `"${PAGE_SOURCE_KEY}"`
  if (text.includes(quotedKey)) {
    const pageSchema = findSourceObject(text)
    if (!pageSchema) {
      return {
        ok: false,
        error: `${label}：找不到包含 \`${PAGE_SOURCE_KEY}\` 的 pageSchema 对象（括号不配平，或产物被截断）。`,
        hint: '重新生成该页面；若确认产物完整，请检查出处键是否被手工改过。',
      }
    }
    return assertSource(pageSchema[PAGE_SOURCE_KEY])
  }

  // 3. sfc 注释路径。
  const mark = `${PAGE_SOURCE_MARK}:`
  const at = text.indexOf(mark)
  if (at >= 0) {
    const json = sliceJsonObject(text, at + mark.length)
    if (!json) {
      return { ok: false, error: `${label}：注释里的出处 JSON 不完整。`, hint: '重新生成该页面。' }
    }
    try {
      return assertSource(JSON.parse(json))
    } catch (err: any) {
      return { ok: false, error: `${label}：注释里的出处不是合法 JSON（${err.message}）。`, hint: '产物被手工改过；重新生成。' }
    }
  }

  return {
    ok: false,
    error: `${label}：找不到页面出处标记（\`${PAGE_SOURCE_KEY}\`）。`,
    hint:
      '只有 es-plus 生成的页面携带出处。W4 之前生成的页面 / 手写页面无法无损回读 —— ' +
      '用当前版本从原配置重新生成；若是外部 schema，请改用 ingest_schema。',
  }
}

/**
 * 去掉产物里的出处：schema 模式删 `"__esPlusSource": {…}` 属性，sfc 模式删整行注释。
 *
 * **为什么需要它**：出处按定义重复一份原始配置。任何「断言某个值真的落进了运行时产物」的
 * 守卫（fuzz 哨兵、字符泄漏检查、度量）都必须先剔除它 —— 否则一个被生成器丢弃/忽略的值
 * 仍然出现在出处里，断言就变成假绿。JSON 解析失败时原样返回，绝不猜（宁可让守卫红）。
 */
export function stripPageSourceArtifact(code: string): string {
  if (typeof code !== 'string' || !code) return code

  // sfc：注释是单行（`inlineJson` 已把换行转义），按整行删除。
  const mark = `${PAGE_SOURCE_MARK}:`
  if (code.includes(mark)) {
    return code
      .split('\n')
      .filter((line) => !line.trimStart().startsWith(`// ${mark}`))
      .join('\n')
  }

  const quoted = `"${PAGE_SOURCE_KEY}"`
  if (!code.includes(quoted)) return code
  const located = locateSourceObject(code)
  if (!located) return code

  // 只在**对象内部**做校验：schema 产物整段是 `import … export const … = {…}`，
  // 对整段 JSON.parse 必然失败（那会让剔除永远不发生，守卫继续假绿）。
  const strippedJson = stripSourceProperty(located.json)
  if (strippedJson === null) return code
  try {
    JSON.parse(strippedJson)
  } catch {
    return code
  }
  return code.slice(0, located.start) + strippedJson + code.slice(located.start + located.json.length)
}

/** 从一个完整对象字面量里删掉 `"__esPlusSource": {…}`（含相邻逗号）。 */
function stripSourceProperty(objText: string): string | null {
  const quoted = `"${PAGE_SOURCE_KEY}"`
  const keyAt = objText.indexOf(quoted)
  if (keyAt < 0) return null
  const valStart = objText.indexOf('{', keyAt + quoted.length)
  if (valStart < 0) return null
  const valJson = sliceJsonObject(objText, valStart)
  if (!valJson) return null
  const valEnd = valStart + valJson.length

  // 属性起点就是键的起始引号；往回只可能遇到逗号（不是第一项）或 `{`（是第一项）。
  let start = keyAt
  while (start > 0 && /\s/.test(objText[start - 1])) start--
  if (objText[start - 1] === ',') return objText.slice(0, start - 1) + objText.slice(valEnd)

  // 第一项：删掉后随逗号，保留后面的键。
  let end = valEnd
  while (end < objText.length && /\s/.test(objText[end])) end++
  if (objText[end] === ',') return objText.slice(0, start) + objText.slice(end + 1)
  return objText.slice(0, start) + objText.slice(valEnd)
}

/* ────────────────────────────────────────────────────────────────────────────
 * `es-plus.composition-source@1` —— **组合**产物的出处。
 *
 * 组合的输入不是一份 `StructuredCrudConfig`：它是一份 `CompositionPlan`（节点 = 各场景
 * 的 intent + 接线）。硬塞进 page-source@1 只有两条路：把 plan 降维成 `surfaces`
 * （丢 `role` / `wires.model` / `when`，重放必不逐字节相同），或把未知形状塞进
 * `config` 字段（读回端会把它当配置反推）。两条都在制造「看起来是原始意图」的猜测。
 *
 * 所以单独一份契约、单独一个键，`read_page` 识别后**不做 surfaces 投影**，只提示
 * 「用 generate_composition 原样重放」。组合能不能表达，由组合器自己判断。
 *
 * 位置：`<script>` 块内的一行注释（`// __esPlusCompositionSource: {…}`），与 sfc 模式的
 * page-source 同一手法（`inlineJson` 转义换行，故一定是一行）。
 * ──────────────────────────────────────────────────────────────────────────── */

export const COMPOSITION_SOURCE_CONTRACT = 'es-plus.composition-source@1' as const

/** 注释里的标记（后面紧跟 `: <json>`）。 */
export const COMPOSITION_SOURCE_MARK = '__esPlusCompositionSource' as const

/** 组合产物里的出处体。`plan` 是**整份** `CompositionPlan` —— 原样重放才逐字节相同。 */
export interface EsPlusCompositionSource {
  contract: typeof COMPOSITION_SOURCE_CONTRACT
  generator: 'es-plus'
  scene: 'composition'
  /** 生成器当时收到的计划（JSON 投影；`role` / `wires` / `behavior` 全在）。 */
  plan: Record<string, unknown>
}

/** 构造出处体（深拷贝，不持有调用方的 plan 对象）。 */
export function buildCompositionSource(plan: unknown): EsPlusCompositionSource {
  const projected = plan == null ? {} : JSON.parse(JSON.stringify(plan))
  return {
    contract: COMPOSITION_SOURCE_CONTRACT,
    generator: 'es-plus',
    scene: 'composition',
    plan: projected,
  }
}

/** 产物里的那一行注释（`JSON.stringify` 会把换行转义，故一定是一行）。 */
export function compositionSourceLine(source: EsPlusCompositionSource): string {
  return `// ${COMPOSITION_SOURCE_MARK}: ${JSON.stringify(source)}`
}

export type CompositionSourceRead =
  | { kind: 'absent' }
  | { kind: 'ok'; source: EsPlusCompositionSource }
  | { kind: 'error'; error: string; hint: string }

/**
 * 从产物读回组合出处。
 *
 * `absent` 与 `error` 必须分开：前者表示「这不是组合产物」（调用方继续按页面出处读），
 * 后者表示「是组合产物但出处坏了」（必须报错，不能退回去猜）。
 */
export function readCompositionSource(code: string): CompositionSourceRead {
  if (typeof code !== 'string' || !code) return { kind: 'absent' }
  const mark = `${COMPOSITION_SOURCE_MARK}:`
  const at = code.indexOf(mark)
  if (at < 0) return { kind: 'absent' }
  const lineEnd = code.indexOf('\n', at)
  const rest = code.slice(at + mark.length, lineEnd < 0 ? undefined : lineEnd).trim()
  if (!rest.startsWith('{')) {
    return {
      kind: 'error',
      error: `组合出处标记后不是 JSON 对象（读到 ${JSON.stringify(rest.slice(0, 40))}）。`,
      hint: '出处行应由 generate_composition 生成；手改过就重新生成，而不是让 read_page 猜。',
    }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(rest)
  } catch (e) {
    return {
      kind: 'error',
      error: `组合出处 JSON 解析失败：${e instanceof Error ? e.message : String(e)}`,
      hint: '出处行应由 generate_composition 生成；被格式化/截断后无法原样重放。',
    }
  }
  const obj = parsed as Record<string, unknown>
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { kind: 'error', error: '组合出处不是对象。', hint: '重新生成该页面。' }
  }
  if (obj.contract !== COMPOSITION_SOURCE_CONTRACT) {
    return {
      kind: 'error',
      error: `组合出处契约版本不认：${String(obj.contract)}（本工具只认 ${COMPOSITION_SOURCE_CONTRACT}）。`,
      hint: '升级 @es-plus/shared 后重新生成，或手工迁移这段注释。',
    }
  }
  if (!obj.plan || typeof obj.plan !== 'object' || Array.isArray(obj.plan)) {
    return {
      kind: 'error',
      error: '组合出处缺少 plan 字段。',
      hint: '出处应由 generate_composition 生成（plan = 生成器当时收到的整份计划）。',
    }
  }
  return { kind: 'ok', source: obj as unknown as EsPlusCompositionSource }
}
