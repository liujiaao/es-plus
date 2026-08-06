#!/usr/bin/env node
/**
 * schema ↔ 类型 同步校验
 *
 * “手写单源 + 校验”模式下，schema 不由类型自动生成，因此需要一道守卫防止
 * core 的类型/常量与单源 schema（packages/shared/schemas）悄悄漂移。
 *
 * 当前校验项：
 *  1. formtype 枚举：core/constants.ts 的 VALID_FORM_TYPES 必须与 form-item schema
 *     的 formtype.enum 完全一致（新增控件类型时两处必须同步）。
 *  2. 关键契约字段存在性：core/types.ts 新增的重要契约字段必须在对应 schema 中出现，
 *     避免 AI 工具链拿到过期 schema。
 *
 * 用法：node scripts/check-schema-contract.mjs
 * 退出码：0 = 同步；1 = 发现漂移。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SCHEMAS = join(ROOT, 'packages/shared/schemas')

const read = (p) => readFileSync(join(ROOT, p), 'utf-8')
const readSchema = (name) => JSON.parse(readFileSync(join(SCHEMAS, name), 'utf-8'))

let failed = false
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}

// ── 1. formtype 枚举同步 ────────────────────────────────
function checkFormTypeEnum() {
  const constantsSrc = read('packages/core/src/constants.ts')
  const m = constantsSrc.match(/VALID_FORM_TYPES\s*=\s*\[([\s\S]*?)\]\s*as const/)
  if (!m) return fail('未能在 core/constants.ts 定位 VALID_FORM_TYPES')
  const coreTypes = m[1]
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)

  const schema = readSchema('form-item.schema.json')
  const enumVals = schema?.properties?.formtype?.enum ?? []

  const missingInSchema = coreTypes.filter((t) => !enumVals.includes(t))
  const extraInSchema = enumVals.filter((t) => !coreTypes.includes(t))

  if (missingInSchema.length) {
    fail(
      `form-item schema 的 formtype.enum 缺少 core VALID_FORM_TYPES 中的：${missingInSchema.join(', ')}`
    )
  }
  if (extraInSchema.length) {
    fail(
      `form-item schema 的 formtype.enum 多出 core 未定义的：${extraInSchema.join(', ')}`
    )
  }
  if (!missingInSchema.length && !extraInSchema.length) {
    console.log(`✅ formtype 枚举同步（${coreTypes.length} 项）`)
  }
}

// ── 2. 关键契约字段存在性 ───────────────────────────────
// core/types.ts 里这些字段是近期新增/易漏同步项，schema 必须覆盖。
const REQUIRED_FIELDS = [
  { schema: 'form-item.schema.json', path: ['properties', 'labelKey'], label: 'FormItemOption.labelKey (i18n)' },
  { schema: 'form-item.schema.json', path: ['properties', 'placeholder'], label: 'FormItemOption.placeholder' },
  { schema: 'table-column.schema.json', path: ['properties', 'labelKey'], label: 'TableColumn.labelKey (i18n)' },
  { schema: 'table-options.schema.json', path: ['properties', 'tabHeight'], label: 'TableOptions.tabHeight' },
  { schema: 'table-options.schema.json', path: ['properties', 'maxHeight'], label: 'TableOptions.maxHeight' },
  { schema: 'table-options.schema.json', path: ['properties', 'engine'], label: 'TableOptions.engine' },
  { schema: 'table-options.schema.json', path: ['properties', 'virtual'], label: 'TableOptions.virtual' },
]

function checkRequiredFields() {
  const cache = {}
  for (const f of REQUIRED_FIELDS) {
    const schema = (cache[f.schema] ??= readSchema(f.schema))
    let node = schema
    let ok = true
    for (const key of f.path) {
      if (node && typeof node === 'object' && key in node) node = node[key]
      else { ok = false; break }
    }
    if (!ok) fail(`schema ${f.schema} 缺少契约字段：${f.label}`)
  }
  if (!failed) console.log(`✅ 关键契约字段全部存在（${REQUIRED_FIELDS.length} 项）`)
}

// ── 3. 结构化配置 Zod ↔ JSON 单源 漂移 ──────────────────
// structured-config.schema.ts 是 AI 结构化生成（generate_crud_from_config）的输入
// 校验层（Zod）。它必须与 packages/shared/schemas 单源 + core 类型保持同步，否则：
//  - target 枚举漏加渲染目标 → 合法请求被 Zod 拒绝（曾漏 antdv）；
//  - tableOptions 漏加契约字段 → 用户传入的字段被 Zod 静默 strip、无法传导到生成物
//    （曾漏 tabHeight）。
// mcp-server（zod3）在 generate-from-config.ts 里内联了一份 StructuredCrudConfig 的
// zod 副本；它与 shared（zod4）的权威 schema 无法安全共享对象（版本不兼容），因此二者
// 极易漂移（antdv 就曾只加到内联副本、漏掉权威 schema）。本守卫对“权威 schema”与
// “mcp 内联副本”两处同时做单源文本巡检（与 checkFormTypeEnum 解析 core/constants.ts
// 的做法一致），不引入构建依赖。
const STRUCTURED_CONFIG_SOURCES = [
  { file: 'packages/shared/src/structured-config.schema.ts', label: 'shared 权威 Zod' },
  { file: 'packages/mcp-server/src/tools/generate-from-config.ts', label: 'mcp 内联 Zod 副本' },
]
// tableOptions 里必须覆盖 JSON 单源 table-options 中声明的高度/虚拟滚动契约字段，
// 否则会被 Zod strip、用户设置无法生效。只校验 JSON 确实声明的字段，使守卫随单源
// 自动扩展、又不过度约束（结构化配置本就是 TableOptions 的子集）。
const STRUCTURED_TABLE_CONTRACT = ['heightType', 'tabHeight', 'height', 'virtual', 'rowHeight', 'estimatedRowHeight', 'overscanCount', 'rowClassName']

function checkStructuredConfigZod() {
  let ok = true
  const jsonTO = readSchema('table-options.schema.json').properties ?? {}

  for (const { file, label } of STRUCTURED_CONFIG_SOURCES) {
    const src = read(file)

    // target 枚举必须覆盖三个渲染目标
    const tm = src.match(/target:\s*z\s*\.enum\(\[([^\]]*)\]\)/)
    if (!tm) { fail(`未能在 ${label} 定位 target 枚举`); ok = false }
    else {
      const targets = tm[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
      for (const t of ['vue3', 'vue2', 'antdv']) {
        if (!targets.includes(t)) { fail(`${label} 的 target 枚举缺少：${t}`); ok = false }
      }
    }

    // tableOptions 契约字段（容忍 z 与 .object 之间、) 与 .optional 之间的换行/空白）
    const to = src.match(/tableOptions:\s*z\s*\.object\(\{([\s\S]*?)\}\)\s*\.optional\(\)/)
    if (!to) { fail(`未能在 ${label} 定位 tableOptions`); ok = false }
    else {
      for (const f of STRUCTURED_TABLE_CONTRACT) {
        if (!(f in jsonTO)) continue
        if (!new RegExp(`\\b${f}:`).test(to[1])) {
          fail(`${label} 的 tableOptions 缺少契约字段 ${f}（table-options.schema.json 已声明，会被 Zod 静默丢弃）`)
          ok = false
        }
      }
    }
  }

  if (ok) console.log(`✅ 结构化配置 Zod 与 JSON 单源同步（${STRUCTURED_CONFIG_SOURCES.length} 处 schema × target 枚举 + tableOptions 契约字段）`)
}

checkFormTypeEnum()
checkRequiredFields()
checkStructuredConfigZod()

if (failed) {
  console.error('\nschema 与 core 类型不同步 —— 更新 packages/shared/schemas 后运行 `npm run schemas:sync`。')
  process.exit(1)
}
console.log('\nschema ↔ 类型 契约同步 ✅')
