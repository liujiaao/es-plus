/**
 * 入口可达性共享库（AI-24 → AI-25 抽出）
 *
 * 背景：es-plus 的 AI 生成有三个入口，**表达力不等** ——
 *   - `generate_crud_from_config`：完整 typed config（能到 schema 的一切）；
 *   - `generate_crud`（前门）：只填一张 surfaces 意图表 + 若干标量键；
 *   - fragments（generate_form/table/dialog）：精简 surfaceFieldSchema，SFC-only。
 *
 * 本文件抽出两处守卫（`check-entry-contract.mjs` / `check-feature-coverage.mjs`）共享的
 * **源码解析原语**（`stripComments`/`sliceBlock`/`topLevelKeys`）、**三个注册表**
 * （`FRONT_DOOR_ONLY` / `FRONT_DOOR_UNREACHABLE` / `SURFACE_FIELD_UNREACHABLE`）与
 * **实时键集抽取**（`readReachability`）。单一真源，避免两处守卫对「前门够不到什么」
 * 各自维护一份而漂移 —— AI-25 守卫断言⑤正建立在这份单一注册表之上。
 *
 * 用法：`import { readReachability, FRONT_DOOR_UNREACHABLE } from './lib/entry-keys.mjs'`
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')

/** 读仓库根为基准的 UTF-8 文本。 */
export const read = (p) => readFileSync(join(ROOT, p), 'utf-8')

export const FRONT_DOOR_SRC = 'packages/mcp-server/src/tools/generate-crud.ts'
export const SCHEMA_SRC = 'packages/shared/src/structured-config.schema.ts'
export const COMPOSE_SRC = 'packages/shared/src/compose-crud-config.ts'

export const fail = (msg) => {
  console.error(`❌ ${msg}`)
  return false
}

/**
 * 前门 `crudShape` 顶层键里**不**是 schema 顶层键的合法例外（前门独有语义）——
 * 每键必须写明原因，空原因会红。
 */
export const FRONT_DOOR_ONLY = {
  surfaces: '前门的意图表本身（query/table/form 字段列表 + dialog 罐头键），schema 侧不叫这个名字',
  rowkey: '前门仅用于无表片段（useDialog 的 rowkey 参数），schema 侧主键走 tableOptions.rowkey',
}

/**
 * schema 顶层键里**前门够不到**的键，必须显式登记（每键写明原因）。
 * AI-21/22/23 每让前门多到一个键，就删掉对应一行 —— 这张表是「缺口清单」，应只减不增。
 *
 * AI-25 耦合：`feature-coverage.data.mjs` 的 B 档令牌以 `via:'FRONT_DOOR_UNREACHABLE:<k>'`
 * 指到本表。若本表某键消失（前门扩宽到它），对应 B 档令牌**立刻变红**、强制重新分类。
 */
export const FRONT_DOOR_UNREACHABLE = {
  fields: '由 surfaces 的字段列表经 composeCrudConfig 派生，schema 侧是派生结果、无对应入参',
  dialogs: '由 surfaces.dialog 合成（罐头键 "add|edit|view" 或全参对象 {key,title,width,fullscreen,formItems} —— AI-21④ 已放宽）；schema 侧无同名顶层入参',
  columns: '**刻意不可达**（用户拍板）：Tier-3 逃生数组，留 generate_crud_from_config，前门不收',
}

/**
 * 权威 `FieldConfig` 里**入口词汇够不到**的字段级键，每键写明原因。
 * AI-22 给 FieldConfig 加 `labelKey` 却没提进 `SurfaceField` 时，此表**不存在**、无人可见；
 * AI-21③ 已经把它提进词汇并落地本表 —— 此后 FieldConfig 每加一个字段级键，要么提进
 * SurfaceField，要么登记在此，二者皆无 → 红。
 */
export const SURFACE_FIELD_UNREACHABLE = {
  inQuery: '面成员标志：由 surfaces 的字段落在哪张列表经 composeCrudConfig 派生，不做逐字段入参',
  inTable: '面成员标志：同上（字段进 surfaces.table 即 inTable）',
  inForm: '面成员标志：同上（字段进 surfaces.form 即 inForm）',
}

/**
 * 剥掉行注释与块注释（与 check-schema-contract.mjs 同一实现）。
 *
 * 必须**单趟从左到右**：先跑块注释正则再跑行注释正则会吞掉 `// … @es-plus/* BtnConfig …`
 * 这类行注释里含块注释起始符的文本。`//` 的判定排除前置冒号，避免吃掉 `https://…`。
 */
export function stripComments(src) {
  let out = ''
  let i = 0
  while (i < src.length) {
    const two = src.slice(i, i + 2)
    if (two === '/*') {
      const end = src.indexOf('*/', i + 2)
      if (end === -1) break
      i = end + 2
      continue
    }
    if (two === '//' && src[i - 1] !== ':') {
      const end = src.indexOf('\n', i)
      if (end === -1) break
      out += '\n'
      i = end + 1
      continue
    }
    out += src[i]
    i++
  }
  return out
}

/** 从 `startMarker` 到首个列 0 的 `closeLine` 之间的块（含起始换行）。找不到返回 null。 */
export function sliceBlock(src, startMarker, closeLine, label) {
  const i = src.indexOf(startMarker)
  if (i === -1) {
    fail(`未能在 ${label} 定位 ${JSON.stringify(startMarker)}`)
    return null
  }
  const rest = src.slice(i + startMarker.length)
  const needle = '\n' + closeLine
  const end = rest.indexOf(needle)
  if (end === -1) {
    fail(`未能在 ${label} 定位块结束符 ${JSON.stringify(closeLine)}（选择器失效，请检查脚本）`)
    return null
  }
  return rest.slice(0, end)
}

/**
 * 收集缩进 `indent` 空格的顶层键（zod 对象属性 `key:` / 接口属性 `key?:`）。
 * 默认 2 空格（schema 顶层 / crudShape / SurfaceField / FieldConfig）；
 * 嵌套块（如 `tableOptions`）传 4。
 */
export function topLevelKeys(block, indent = 2) {
  const keys = []
  const re = new RegExp(`^ {${indent}}([A-Za-z_$][\\w$]*)\\??\\s*:`, 'gm')
  for (const m of block.matchAll(re)) keys.push(m[1])
  return keys
}

/**
 * 抽取「入口可达性」的实时键集（供多条守卫复用）：
 *   - `frontKeys`：前门 `crudShape` 顶层键；
 *   - `schemaKeys`：`StructuredCrudConfigSchema` 顶层键；
 *   - `sfKeys`：`SurfaceField` 字段词汇；
 *   - `fcKeys`：`FieldConfig` 权威字段词汇；
 *   - `tableOptionsKeys`：AI Zod 的 `tableOptions` 嵌套键（缩进 4）。
 *
 * 任一定位失败（选择器失效）→ 打印 ❌ 并返回 `null`，调用方须 `process.exit(1)` 拒绝静默放行。
 */
export function readReachability() {
  const schemaSrc = stripComments(read(SCHEMA_SRC))
  const frontSrc = stripComments(read(FRONT_DOOR_SRC))
  const composeSrc = stripComments(read(COMPOSE_SRC))

  const crudBlock = sliceBlock(frontSrc, 'const crudShape = {', '} as const', 'generate-crud.ts crudShape')
  const schemaBlock = sliceBlock(
    schemaSrc,
    'export const StructuredCrudConfigSchema = z.object({',
    '})',
    'structured-config.schema.ts StructuredCrudConfigSchema'
  )
  const sfBlock = sliceBlock(composeSrc, 'export interface SurfaceField {', '}', 'compose-crud-config.ts SurfaceField')
  const fcBlock = sliceBlock(schemaSrc, 'const FieldConfigSchema = z.object({', '})', 'structured-config.schema.ts FieldConfigSchema')
  const tableBlock = sliceBlock(
    schemaSrc,
    '  tableOptions: z.object({',
    '  }).optional(),',
    'structured-config.schema.ts tableOptions'
  )

  if (crudBlock === null || schemaBlock === null || sfBlock === null || fcBlock === null || tableBlock === null) return null

  return {
    frontKeys: topLevelKeys(crudBlock),
    schemaKeys: topLevelKeys(schemaBlock),
    sfKeys: topLevelKeys(sfBlock),
    fcKeys: topLevelKeys(fcBlock),
    tableOptionsKeys: topLevelKeys(tableBlock, 4),
  }
}
