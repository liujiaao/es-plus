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
function parseFormTypeList(src, label) {
  const m = src.match(/VALID_FORM_TYPES\s*=\s*\[([\s\S]*?)\]\s*as const/)
  if (!m) {
    fail(`未能在 ${label} 定位 VALID_FORM_TYPES`)
    return null
  }
  return m[1]
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
}

function checkFormTypeEnum() {
  const coreTypes = parseFormTypeList(read('packages/core/src/constants.ts'), 'core/constants.ts')
  if (!coreTypes) return

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

  // ── 1b. core/constants.ts ↔ shared/contract.ts 两处手写副本必须逐项一致 ──
  // 这是此前**没有被任何检查覆盖**的一条边：本脚本锚定 core，check-renderer-parity
  // 锚定 shared/contract.ts，只改一处再同步 form-item schema 与 core/types.ts，
  // 就能让两道门禁同时保持全绿，而两处契约已经分叉。
  const sharedTypes = parseFormTypeList(
    read('packages/shared/src/contract.ts'),
    'shared/contract.ts'
  )
  if (sharedTypes) {
    const onlyCore = coreTypes.filter((t) => !sharedTypes.includes(t))
    const onlyShared = sharedTypes.filter((t) => !coreTypes.includes(t))
    if (onlyCore.length || onlyShared.length) {
      fail(
        'core/constants.ts 与 shared/contract.ts 的 VALID_FORM_TYPES 已分叉：' +
          (onlyCore.length ? `仅 core 有 [${onlyCore.join(', ')}]；` : '') +
          (onlyShared.length ? `仅 shared 有 [${onlyShared.join(', ')}]；` : '') +
          '两处是同一契约的手写副本（core 零依赖，不能 import shared），必须同步修改'
      )
    } else {
      console.log('✅ core/constants.ts 与 shared/contract.ts 的 formtype 列表一致')
    }
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

    // tableBtns 定位字段：`position`（渲染器契约推荐：三端 BtnConfig 都把 code 标为
    // deprecated，core getButtonPosition 优先读 position）与 `code`（旧别名）都必须被**接受**，
    // 且必须由 .transform() 归一化成「与 position 一致的 code」。
    //
    // 为什么归一化是硬要求：Zod 默认 strip 未知键。若只声明 code 而不接受 position，
    // 宿主 LLM 按 esplus://crud-page-schema 的示例写 position:'right' 时会被**静默改写成
    // code:1（左侧）**——解析成功、零告警，按钮跑到错误一侧（已实测复现）。
    // 反之，若只接受 position 而不落 code，下游按 code 读取的地方（golden 评分器、
    // 生成物 JSON）会拿不到定位信息。两者必须同时存在并归一化。
    //
    // 兼容两种写法：内联 `tableBtns: z.array(z.object({...}))`（mcp 副本）与
    // 具名 `const TableBtnSchema = z.object({...})`（shared 权威）。
    // 注意 `z\s*\.object`：z 与 .object 可能跨行（链式写法），不容忍空白会让守卫在
    // 纯格式化改动下静默失配（把「定位失败」误报成契约漂移）。
    const btnBlock =
      src.match(/tableBtns:\s*z\s*\.array\(\s*z\s*\.object\(\{([\s\S]*?)\}\)\s*\)\s*\.optional\(\)/) ||
      src.match(/const\s+TableBtnSchema\s*=\s*z\s*\.object\(\{([\s\S]*?)\}\)/)
    if (!btnBlock) { fail(`未能在 ${label} 定位 tableBtns`); ok = false }
    else {
      if (!/\bcode:/.test(btnBlock[1])) {
        fail(`${label} 的 tableBtns 缺少 code 字段（1=left,2=right；下游按 code 读取定位信息）`)
        ok = false
      }
      if (!/\bposition\s*:/.test(btnBlock[1])) {
        fail(
          `${label} 的 tableBtns 缺少 position 字段（渲染器契约推荐字段）——` +
            `缺失会让 position 被 Zod 静默 strip，position:'right' 退化成 code:1（左侧）且无任何报错`
        )
        ok = false
      }
      // 归一化：两处副本都必须在 TableBtnSchema 上挂 .transform()，把 position 落成一致的 code。
      // 允许 object 与 transform 之间存在说明性注释（两处副本的注释长度不同）。
      if (!/const\s+TableBtnSchema\s*=\s*z\s*\.object\(\{[\s\S]*?\}\)[\s\S]{0,2000}?\.transform\(/.test(src)) {
        fail(`${label} 的 TableBtnSchema 缺少 .transform() 归一化（position 必须落成一致的 code）`)
        ok = false
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
