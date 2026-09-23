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

/**
 * 剥掉行注释与块注释。
 *
 * 为什么必须有：本守卫在原文上跑正则来断言「某字段存在」，而 `// rowClassName: z...`
 * 里照样能匹配到 `rowClassName:` —— 把声明**改成注释**即可让守卫保持全绿却失去校验
 * （已实测：注释掉 rowClassName 后本脚本仍输出 ✅）。剥注释后这类绕过会立刻失败。
 *
 * 必须**单趟从左到右**扫描，不能先跑一遍块注释正则再跑行注释正则：
 * 这两个文件里存在 `// … @es-plus/星号 BtnConfig …` 形态的行注释（星号为块注释起始符），
 * 先做块注释替换会把它当成块注释起点，一路吞到很远的结束符 —— 实测直接把
 * `tableBtns` 声明整段吃掉，守卫随即报「定位不到 tableBtns」。单趟扫描在遇到
 * `//` 时先跳到行尾，就不会把行注释里的起始符当成块注释起点。
 *
 * `//` 的判定排除前置冒号，避免吃掉 `https://…` / `esplus://…` 这类字面量。
 */
function stripComments(src) {
  let out = ''
  let i = 0
  while (i < src.length) {
    const two = src.slice(i, i + 2)
    if (two === '/*') {
      const end = src.indexOf('*/', i + 2)
      if (end === -1) break // 未闭合：不猜，后面的内容一律丢弃（宁可漏也别误判为「存在」）
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

/**
 * 断言一个按钮 schema 同时接受 position 与 code，且 .transform() 真的把 position
 * **映射**成 code。
 *
 * 只检查「有没有 .transform(」是不够的：`.transform((x) => x)` 这种空操作同样满足
 * 文本匹配（已实测通过），而它恰恰会让 position:'right' 被静默丢掉。因此判据是该
 * transform 体内必须**同时**出现 `code:` 赋值与对 `position` 的读取。
 *
 * @param src 已剥注释的源码
 * @param opts.constName 具名 schema 常量名（shared 权威与 mcp 副本均为具名）
 * @param opts.label 出错信息里的来源名
 */
function assertButtonPositionContract(src, { constName, label, fallback }) {
  const block = src.match(
    new RegExp(`const\\s+${constName}\\s*=\\s*z\\s*\\.object\\(\\{([\\s\\S]*?)\\}\\)[\\s\\S]{0,300}?\\.transform\\(([\\s\\S]{0,600})`)
  )
  if (!block) {
    fail(`${label} 未能定位 ${constName} 的 .transform()（position 必须落成一致的 code）`)
    return
  }
  const [, fields, transformBody] = block
  if (!/\bcode\s*:/.test(fields)) {
    fail(`${label} 的 ${constName} 缺少 code 字段（1=left,2=right；下游按 code 读取定位信息）`)
  }
  if (!/\bposition\s*:/.test(fields)) {
    fail(
      `${label} 的 ${constName} 缺少 position 字段（渲染器契约推荐字段）——` +
        `缺失会让 position 被 Zod 静默 strip，position 与 code 不一致时按钮跑到错误一侧且无任何报错`
    )
  }
  if (!/code\s*:/.test(transformBody)) {
    fail(
      `${label} 的 ${constName}.transform() 没有产出 code —— 空操作 transform（如 \`(x) => x\`）` +
        `同样能通过「存在性」检查，但归一化并未发生`
    )
  }
  if (!/\.position\b/.test(transformBody)) {
    fail(`${label} 的 ${constName}.transform() 没有读取 b.position —— 未把 position 映射成 code`)
  }
  // 兜底方向必须与调用方声明一致：表单按钮（EsForm）默认右侧、表格按钮默认左侧。
  // 抄错方向的后果是**所有未配 position 的按钮静默翻到另一侧**，而上面几条断言全绿。
  if (fallback && !new RegExp(`\\.code\\s*\\?\\?\\s*${fallback}\\b`).test(transformBody)) {
    fail(
      `${label} 的 ${constName}.transform() 兜底方向应为 ${fallback}（${fallback === 2 ? '表单按钮默认右侧' : '表格按钮默认左侧'}）—— ` +
        `抄错方向会让所有未配 position 的按钮静默翻到另一侧`
    )
  }
}

function checkStructuredConfigZod() {
  let ok = true
  const jsonTO = readSchema('table-options.schema.json').properties ?? {}

  for (const { file, label } of STRUCTURED_CONFIG_SOURCES) {
    const src = stripComments(read(file))

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

    // 定位字段契约：`position`（渲染器契约推荐）与 `code`（旧别名）都必须被**接受**，
    // 且必须由 .transform() 归一化成「与 position 一致的 code」。
    //
    // 为什么归一化是硬要求：Zod 默认 strip 未知键。若只声明 code 而不接受 position，
    // 宿主 LLM 按 esplus://crud-page-schema 的示例写 position:'right' 时会被**静默改写成
    // code:1（左侧）**——解析成功、零告警，按钮跑到错误一侧（已实测复现）。
    // 反之，若只接受 position 而不落 code，下游按 code 读取的地方（golden 评分器、
    // 生成物 JSON）会拿不到定位信息。两者必须同时存在并归一化。
    //
    // **两类按钮都要查**。此前只查 tableBtns，正因为不对称才让 toolbarBtns 长期只有
    // position、没有 code 与归一化，而三端 EsForm 又只读 direction —— 生成出来的表单
    // 工具栏按钮的位置被静默丢弃、永远渲染到右侧。缺的那一边没人守，就一直缺着。
    //
    // 兜底方向也查（表单=2/right，表格=1/left）：两份 schema 长得几乎一样，把
    // TableBtnSchema 整段抄给 ToolbarBtnSchema 是最容易犯的错，且症状是「所有未配
    // position 的按钮翻到另一侧」这种大面积静默行为变更。
    assertButtonPositionContract(src, { constName: 'TableBtnSchema', label, fallback: 1 })
    assertButtonPositionContract(src, { constName: 'ToolbarBtnSchema', label, fallback: 2 })

    // 字段引用点也必须成对：具名 schema 写好了却没被引用，等于没修。
    for (const [field, constName] of [['tableBtns', 'TableBtnSchema'], ['toolbarBtns', 'ToolbarBtnSchema']]) {
      const ref = src.match(new RegExp(`${field}\\s*:\\s*z\\s*\\.array\\(([^)]*)\\)`))
      if (!ref) { fail(`未能在 ${label} 定位 ${field}`); ok = false }
      else if (!ref[1].includes(constName)) {
        fail(`${label} 的 ${field} 未引用 ${constName}（定位字段契约对它不生效）`)
        ok = false
      }
    }
  }

  if (ok) console.log(`✅ 结构化配置 Zod 与 JSON 单源同步（${STRUCTURED_CONFIG_SOURCES.length} 处 schema × target 枚举 + tableOptions 契约字段 + tableBtns/toolbarBtns 定位归一化）`)
}

checkFormTypeEnum()
checkRequiredFields()
checkStructuredConfigZod()

if (failed) {
  console.error('\nschema 与 core 类型不同步 —— 更新 packages/shared/schemas 后运行 `npm run schemas:sync`。')
  process.exit(1)
}
console.log('\nschema ↔ 类型 契约同步 ✅')
