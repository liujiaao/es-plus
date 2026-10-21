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
 *  3. 有意宽松的 schema 不得被加上 required（dialog-options：每个字段在权威类型里都可选），
 *     防止「补 required」这种听起来是加固、实际把合法配置判红的改动。
 *  4. dialog 契约守卫轴（AI-26）：运行时 `CrudDialogConfig`（三端手写副本）× AI 契约
 *     （两处手写 Zod 副本）× 生成器实际发射 —— 两条此前无人守望的差集。
 *  5. 契约双份全等 + MCP resource 第三份对齐（AI-32）：mcp 内联 `configShape` 与 shared
 *     权威 schema 的顶层键集必须**全等**（此前只按枚举清单逐项断，加非清单键两守卫全绿）；
 *     `crud-page-schema.ts` 内嵌的 `CrudDialogConfig` 第三份必须与运行时契约同步。
 *
 * 用法：node scripts/check-schema-contract.mjs
 * 退出码：0 = 同步；1 = 发现漂移。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  readDialogContract,
  readDialogPassthrough,
  readReachability,
  readDialogOptionsJsonKeys,
  readCoreDialogOptionsKeys,
  sliceBlock,
  DIALOG_KEY_UNREACHABLE,
  DIALOG_OPTIONS_JSON_ONLY,
} from './lib/entry-keys.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SCHEMAS = join(ROOT, 'packages/shared/schemas')

const read = (p) => readFileSync(join(ROOT, p), 'utf-8')
const readSchema = (name) => JSON.parse(readFileSync(join(SCHEMAS, name), 'utf-8'))

// 每个检查函数各自持有失败标志并**返回布尔值**，最后由调用处汇总。
//
// 这里曾经是模块级的 `let failed = false`，被所有检查函数共享写入。后果是：任何一个
// 函数置红之后，**另一个函数即便全过也不再打印自己的 ✅** —— `checkRequiredFields()`
// 就踩了这条（它用 `if (!failed)` 决定要不要打印，于是 formtype 一旦分叉，7 项字段
// 全存在也会静默不报）。共享可变标志让「到底谁失败了」在报告里不可分辨：读者只能
// 看到「某处起没有 ✅」，分不清是没跑、没打印、还是失败。改成本地标志 + 返回值汇总后，
// 这一类缺陷在结构上不存在了。
const fail = (msg) => {
  console.error(`❌ ${msg}`)
  return false
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

/** 解析 FORM_TYPE_ALIASES（旧写法 → 新写法），用于「枚举 = 规范 ∪ 别名」的判定。 */
function parseFormTypeAliases(src, label) {
  const m = src.match(/FORM_TYPE_ALIASES\s*(?::[^=]+)?=\s*\{([\s\S]*?)\n\}/)
  if (!m) {
    fail(`未能在 ${label} 定位 FORM_TYPE_ALIASES`)
    return null
  }
  const out = {}
  for (const mm of m[1].matchAll(/([A-Za-z_$][\w$]*)\s*:\s*['"]([^'"]+)['"]/g)) {
    out[mm[1]] = mm[2]
  }
  return out
}

function checkFormTypeEnum() {
  let ok = true
  const coreSrc = read('packages/core/src/constants.ts')
  const coreTypes = parseFormTypeList(coreSrc, 'core/constants.ts')
  if (!coreTypes) return false // parseFormTypeList 已打印原因
  const coreAliases = parseFormTypeAliases(coreSrc, 'core/constants.ts')
  if (!coreAliases) return false
  const aliasKeys = Object.keys(coreAliases)

  const schema = readSchema('form-item.schema.json')
  const enumVals = schema?.properties?.formtype?.enum ?? []

  const missingInSchema = coreTypes.filter((t) => !enumVals.includes(t))
  // schema 里多出的项**只有**两处合法来源：core 的规范列表、或已登记的别名。
  // 别名必须被允许 —— 它们在运行时由 normalizeFormType 归一化、schema 自己的 describe
  // 也写明 "deprecated but still accepted"，枚举拒绝它们等于「文档承认、校验拒绝」。
  const extraInSchema = enumVals.filter((t) => !coreTypes.includes(t) && !aliasKeys.includes(t))
  // 别名写进了 schema 却没有对应映射 → 归一化后会落到未知控件，属真漂移。
  const aliasesMissingInSchema = aliasKeys.filter((t) => !enumVals.includes(t))

  if (missingInSchema.length) {
    ok = fail(
      `form-item schema 的 formtype.enum 缺少 core VALID_FORM_TYPES 中的：${missingInSchema.join(', ')}`
    )
  }
  if (extraInSchema.length) {
    ok = fail(
      `form-item schema 的 formtype.enum 多出 core 未定义、也未登记为别名的：${extraInSchema.join(', ')}`
    )
  }
  if (aliasesMissingInSchema.length) {
    ok = fail(
      `form-item schema 的 formtype.enum 缺少 core FORM_TYPE_ALIASES 已登记的别名：${aliasesMissingInSchema.join(', ')}` +
        '（运行时接受这些写法，枚举必须一并接受）'
    )
  }
  if (!missingInSchema.length && !extraInSchema.length && !aliasesMissingInSchema.length) {
    const aliasInSchema = aliasKeys.filter((t) => enumVals.includes(t))
    console.log(
      `✅ formtype 枚举同步（${coreTypes.length} 项规范 + ${aliasInSchema.length} 项别名 = ${enumVals.length} 项）`
    )
  }

  // ── 1b. core/constants.ts ↔ shared/contract.ts 两处手写副本必须逐项一致 ──
  // 这是此前**没有被任何检查覆盖**的一条边：本脚本锚定 core，check-renderer-parity
  // 锚定 shared/contract.ts，只改一处再同步 form-item schema 与 core/types.ts，
  // 就能让两道门禁同时保持全绿，而两处契约已经分叉。
  const sharedTypes = parseFormTypeList(
    read('packages/shared/src/contract.ts'),
    'shared/contract.ts'
  )
  if (!sharedTypes) {
    ok = false // parseFormTypeList 已打印原因
  } else {
    const onlyCore = coreTypes.filter((t) => !sharedTypes.includes(t))
    const onlyShared = sharedTypes.filter((t) => !coreTypes.includes(t))
    if (onlyCore.length || onlyShared.length) {
      ok = fail(
        'core/constants.ts 与 shared/contract.ts 的 VALID_FORM_TYPES 已分叉：' +
          (onlyCore.length ? `仅 core 有 [${onlyCore.join(', ')}]；` : '') +
          (onlyShared.length ? `仅 shared 有 [${onlyShared.join(', ')}]；` : '') +
          '两处是同一契约的手写副本（core 零依赖，不能 import shared），必须同步修改'
      )
    } else {
      console.log('✅ core/constants.ts 与 shared/contract.ts 的 formtype 列表一致')
    }
  }

  // ── 1c. 别名表也必须一致（core/constants.ts ↔ shared/contract.ts）──
  // 1b 只覆盖了 VALID_FORM_TYPES；FORM_TYPE_ALIASES 是同一契约的**另一处手写副本**，
  // 此前没有任何检查。后果：给 core 加一个别名（运行时生效）而漏改 shared 副本时，
  // above 的「枚举 = 规范 ∪ 别名」会按 core 的口径判定 —— schema 与 zod 都不会收录该别名，
  // 而运行时却承认它：又是一个「文档/校验 vs 运行时」不一致，且门禁全绿。
  const sharedAliases = parseFormTypeAliases(
    read('packages/shared/src/contract.ts'),
    'shared/contract.ts'
  )
  if (!sharedAliases) {
    ok = false
  } else {
    const coreKeys = Object.keys(coreAliases).sort()
    const sharedKeys = Object.keys(sharedAliases).sort()
    const diffs = []
    if (coreKeys.join(',') !== sharedKeys.join(',')) {
      diffs.push(
        `键集不同：仅 core [${coreKeys.filter((k) => !sharedKeys.includes(k)).join(', ') || '-'}]，` +
          `仅 shared [${sharedKeys.filter((k) => !coreKeys.includes(k)).join(', ') || '-'}]`
      )
    }
    for (const k of coreKeys.filter((k) => sharedKeys.includes(k))) {
      if (coreAliases[k] !== sharedAliases[k]) {
        diffs.push(`'${k}' 映射不同：core → ${coreAliases[k]}，shared → ${sharedAliases[k]}`)
      }
    }
    // 别名必须指向一个真实存在的规范写法，否则归一化后仍会落到未知控件。
    const badTargets = Object.entries(coreAliases).filter(([, v]) => !coreTypes.includes(v))
    if (badTargets.length) {
      diffs.push(
        `别名指向非 VALID_FORM_TYPES 的值：${badTargets.map(([k, v]) => `${k} → ${v}`).join(', ')}`
      )
    }
    if (diffs.length) {
      ok = fail(
        'core/constants.ts 与 shared/contract.ts 的 FORM_TYPE_ALIASES 已分叉：' + diffs.join('；')
      )
    } else {
      console.log(
        `✅ core/constants.ts 与 shared/contract.ts 的别名表一致（${coreKeys.length} 项，且均指向规范写法）`
      )
    }
  }
  return ok
}

// ── 2. 关键契约字段存在性 ───────────────────────────────
// core/types.ts 里这些字段是近期新增/易漏同步项，schema 必须覆盖。
const REQUIRED_FIELDS = [
  { schema: 'form-item.schema.json', path: ['properties', 'labelKey'], label: 'FormItemOption.labelKey (i18n)' },
  { schema: 'form-item.schema.json', path: ['properties', 'placeholder'], label: 'FormItemOption.placeholder' },
  { schema: 'form-item.schema.json', path: ['properties', 'isHidden'], label: 'FormItemOption.isHidden (声明式条件显隐)' },
  { schema: 'form-item.schema.json', path: ['properties', 'reactions'], label: 'FormItemOption.reactions (字段联动)' },
  { schema: 'table-column.schema.json', path: ['properties', 'labelKey'], label: 'TableColumn.labelKey (i18n)' },
  { schema: 'table-options.schema.json', path: ['properties', 'tabHeight'], label: 'TableOptions.tabHeight' },
  { schema: 'table-options.schema.json', path: ['properties', 'maxHeight'], label: 'TableOptions.maxHeight' },
  { schema: 'table-options.schema.json', path: ['properties', 'engine'], label: 'TableOptions.engine' },
  { schema: 'table-options.schema.json', path: ['properties', 'virtual'], label: 'TableOptions.virtual' },
  // AI-22：新增到 JSON 单源的可写展示/行为键（此前只存在于 core TableOptions）。
  { schema: 'table-options.schema.json', path: ['properties', 'showHeader'], label: 'TableOptions.showHeader' },
  { schema: 'table-options.schema.json', path: ['properties', 'emptyText'], label: 'TableOptions.emptyText' },
  { schema: 'table-options.schema.json', path: ['properties', 'defaultSort'], label: 'TableOptions.defaultSort' },
  { schema: 'table-options.schema.json', path: ['properties', 'refetchKeepPage'], label: 'TableOptions.refetchKeepPage' },
  { schema: 'table-options.schema.json', path: ['properties', 'localPagination'], label: 'TableOptions.localPagination' },
]

function checkRequiredFields() {
  const cache = {}
  let missing = 0
  for (const f of REQUIRED_FIELDS) {
    const schema = (cache[f.schema] ??= readSchema(f.schema))
    let node = schema
    let found = true
    for (const key of f.path) {
      if (node && typeof node === 'object' && key in node) node = node[key]
      else { found = false; break }
    }
    if (!found) {
      missing++
      fail(`schema ${f.schema} 缺少契约字段：${f.label}`)
    }
  }
  // 判据是本函数自己的计数，不是别的函数的失败标志 —— 这条边必须能独立报绿。
  if (missing === 0) console.log(`✅ 关键契约字段全部存在（${REQUIRED_FIELDS.length} 项）`)
  return missing === 0
}

// ── 2b. 「宽松是契约的一部分」的 schema 不得被加上 required ────────
// B3 的原计划是「给既无 required 又 additionalProperties:true 的 schema 补 required」，
// 但按 schema 逐份核对后，只有 table-column 真的补得（且补成了 anyOf[prop|key|type|groups]，
// 因为 {key} / {type:'selection'} / {groups} 三种列在库里都是真实用法，平铺 required:["prop"]
// 会把它们判红）。dialog-options 补不得：
//
//   - core/src/types.ts 的 DialogOptions 里**每个字段都是可选的**（`title?: string`）；
//   - es-dialog 组件自己也是 `title?: string`，模板 `{{ props.title }}` 缺省就是空标题；
//   - 也就是说「没有 title 的弹窗」是合法且运行时正常的配置。
//
// 给它加 `required: ["title"]` 会让 schema **比类型和运行时都严** —— 把当前能用的配置判红，
// 与 B3 自己定的原则（additionalProperties 保持 true，不做破坏性收紧）直接冲突。
// 这条断言把「有意宽松」钉成契约：谁想补 required，先来这里看理由。
// 注意极性与其他检查相反：本条要求 required **不存在**。
const PERMISSIVE_SCHEMAS = [
  {
    schema: 'dialog-options.schema.json',
    reason: 'DialogOptions 的每个字段都是可选的（title?: string，组件缺省渲染空标题），加 required 会拒绝合法配置',
  },
]

function checkPermissiveSchemas() {
  let ok = true
  for (const { schema: file, reason } of PERMISSIVE_SCHEMAS) {
    const schema = readSchema(file)
    if (schema?.required !== undefined) {
      ok = fail(
        `${file} 声明了顶层 required（${JSON.stringify(schema.required)}）——该 schema 的有意宽松是契约的一部分：${reason}`
      )
    }
    // 平铺的 required 之外，anyOf/oneOf 里塞 required 同样能收紧校验，一并拦。
    for (const kw of ['anyOf', 'oneOf']) {
      if (Array.isArray(schema?.[kw]) && schema[kw].some((b) => b && b.required)) {
        ok = fail(`${file} 的 ${kw} 分支里出现了 required —— ${reason}`)
      }
    }
  }
  if (ok) {
    console.log(
      `✅ 有意宽松的 schema 未被加上 required（${PERMISSIVE_SCHEMAS.map((s) => s.schema).join(', ')}）`
    )
  }
  return ok
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
const STRUCTURED_TABLE_CONTRACT = [
  'heightType', 'tabHeight', 'height', 'virtual', 'rowHeight', 'estimatedRowHeight', 'overscanCount', 'rowClassName',
  // AI-22：以下键在 core `TableOptions` / JSON 单源已有、三端运行时已消费，此前两处 AI Zod
  // 零声明（经 AI 入口传入被静默剥）。放在本块的**契约键区**（须排在 `editConfig` 之前，
  // 因块捕获非贪婪地停在首个 `}).optional()`；`defaultSort` 带嵌套对象，进一步排在末尾）。
  'size', 'showHeader', 'emptyText', 'snIndex', 'leftText', 'cachePageSelection', 'refetchKeepPage', 'localPagination', 'defaultSort',
]

// FieldConfigSchema 里必须声明的「AI 契约」字段。与 STRUCTURED_TABLE_CONTRACT 同因：
// 两处 Zod（shared 权威 + mcp 内联副本）都是 z.object（无 passthrough），少声明一个键
// 就等于把该字段**静默剥掉** —— 解析成功、零告警，配置里的值凭空消失。
// `isHidden` 就是这类：AI-06 用声明式条件驱动显隐，若只加在 shared 而漏了 mcp，
// 走 MCP 路径的配置里 isHidden 会被丢弃、字段永远可见（假承诺）。
// 注意 `isHiddenFooter`（dialog 级）不是同一字段：它后面跟的是 'F' 不是 ':'，
// 故 `\bisHidden\s*:` 不会误匹配。
const STRUCTURED_FIELD_CONTRACT = ['isHidden', 'reactions', 'labelKey']

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
  let ok = true
  const block = src.match(
    new RegExp(`const\\s+${constName}\\s*=\\s*z\\s*\\.object\\(\\{([\\s\\S]*?)\\}\\)[\\s\\S]{0,300}?\\.transform\\(([\\s\\S]{0,600})`)
  )
  if (!block) {
    return fail(`${label} 未能定位 ${constName} 的 .transform()（position 必须落成一致的 code）`)
  }
  const [, fields, rawTransform] = block
  // AN-07：表格按钮的归一化收敛到 `normalizeTableBtn()`（Zod transform 与生成器入口共用
  // 同一实现）。此时 `.transform()` 只有一行调用，position→code 的逻辑在 helper 里；
  // 断言必须**跟进 helper**，否则收敛本身会让这条守卫静默失明（它只认字面量函数体）。
  let transformBody = rawTransform
  if (/normalizeTableBtn\s*\(/.test(rawTransform)) {
    // 签名带泛型（`normalizeTableBtn<T extends Record<string, any>>`），别按 `name(` 精确匹配。
    //
    // AN-21：mcp 副本改为**从 shared import** 该 helper（不再手抄一份），所以本文件里
    // 定位不到时要去 shared 权威文件里找 —— 否则「消除重复实现」这个正确动作会把守卫
    // 直接变红，逼着人再抄回去。跨文件只允许指向这一个权威实现。
    const helperRe = /export\s+function\s+normalizeTableBtn[\s\S]*?\n\}/
    const helper =
      src.match(helperRe) ??
      stripComments(read('packages/shared/src/structured-config.schema.ts')).match(helperRe)
    if (!helper) {
      return fail(
        `${label} 的 .transform() 调用了 normalizeTableBtn，但本文件与 shared 权威 Zod 里都定位不到该函数 —— 归一化实现缺失`
      )
    }
    transformBody += `\n${helper[0]}`
  }
  if (!/\bcode\s*:/.test(fields)) {
    ok = fail(`${label} 的 ${constName} 缺少 code 字段（1=left,2=right；下游按 code 读取定位信息）`)
  }
  if (!/\bposition\s*:/.test(fields)) {
    ok = fail(
      `${label} 的 ${constName} 缺少 position 字段（渲染器契约推荐字段）——` +
        `缺失会让 position 被 Zod 静默 strip，position 与 code 不一致时按钮跑到错误一侧且无任何报错`
    )
  }
  if (!/code\s*:/.test(transformBody)) {
    ok = fail(
      `${label} 的 ${constName}.transform() 没有产出 code —— 空操作 transform（如 \`(x) => x\`）` +
        `同样能通过「存在性」检查，但归一化并未发生`
    )
  }
  if (!/\.position\b/.test(transformBody)) {
    ok = fail(`${label} 的 ${constName}.transform() 没有读取 b.position —— 未把 position 映射成 code`)
  }
  // 兜底方向必须与调用方声明一致：表单按钮（EsForm）默认右侧、表格按钮默认左侧。
  // 抄错方向的后果是**所有未配 position 的按钮静默翻到另一侧**，而上面几条断言全绿。
  if (fallback && !new RegExp(`\\.code\\s*\\?\\?\\s*${fallback}\\b`).test(transformBody)) {
    ok = fail(
      `${label} 的 ${constName}.transform() 兜底方向应为 ${fallback}（${fallback === 2 ? '表单按钮默认右侧' : '表格按钮默认左侧'}）—— ` +
        `抄错方向会让所有未配 position 的按钮静默翻到另一侧`
    )
  }
  return ok
}

/**
 * 解析 `EXPR_OPS` 白名单数组的字面量成员。
 *
 * 三处（core `expr.ts` 运行时权威 + shared 权威 Zod + mcp 内联副本）必须**逐一相等**：
 * 少一项就等于「一侧放行、另一侧拒绝」的假承诺（如 AI 生成的表达式被 mcp 静默剥掉）。
 * 返回 null 表示定位不到声明（守卫应报错，而非静默跳过）。
 */
function parseExprOps(src) {
  const m = src.match(/const\s+EXPR_OPS\s*=\s*(?:Object\s*\.\s*freeze\(\s*)?\[([\s\S]*?)\]/)
  if (!m) return null
  return m[1]
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
}

function checkStructuredConfigZod() {
  let ok = true
  const jsonTO = readSchema('table-options.schema.json').properties ?? {}
  const coreExprOps = parseExprOps(stripComments(read('packages/core/src/expr.ts')))
  if (!coreExprOps) {
    fail('未能在 core/expr.ts 定位 EXPR_OPS 白名单（表达式算子的运行时权威源）')
    ok = false
  }

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
    if (!assertButtonPositionContract(src, { constName: 'TableBtnSchema', label, fallback: 1 })) ok = false
    if (!assertButtonPositionContract(src, { constName: 'ToolbarBtnSchema', label, fallback: 2 })) ok = false

    // 字段契约：FieldConfigSchema 必须声明每个 AI 契约字段（否则 Zod 静默剥掉）。
    // 只按「对象字面量块」定位，不靠行号 —— 块以列 0 的 `})` 收尾（嵌套对象均缩进，
    // 不会误当块尾）。见 STRUCTURED_FIELD_CONTRACT 的说明。
    const fc = src.match(/const FieldConfigSchema\s*=\s*z\s*\.object\(\{([\s\S]*?)\n\}\);?/)
    if (!fc) { fail(`未能在 ${label} 定位 FieldConfigSchema`); ok = false }
    else {
      for (const f of STRUCTURED_FIELD_CONTRACT) {
        if (!new RegExp(`\\b${f}\\s*:`).test(fc[1])) {
          fail(`${label} 的 FieldConfigSchema 缺少契约字段 ${f}（会被 Zod 静默剥掉，配置里该字段凭空消失）`)
          ok = false
        }
      }
    }

    // 字段引用点也必须成对：具名 schema 写好了却没被引用，等于没修。
    for (const [field, constName] of [['tableBtns', 'TableBtnSchema'], ['toolbarBtns', 'ToolbarBtnSchema']]) {
      const ref = src.match(new RegExp(`${field}\\s*:\\s*z\\s*\\.array\\(([^)]*)\\)`))
      if (!ref) { fail(`未能在 ${label} 定位 ${field}`); ok = false }
      else if (!ref[1].includes(constName)) {
        fail(`${label} 的 ${field} 未引用 ${constName}（定位字段契约对它不生效）`)
        ok = false
      }
    }

    // 顶层 `columns` 逃生数组契约（AI-09 子项①）：两处 Zod 都必须声明。
    // z.object 无 passthrough —— 漏声明等于把整段 columns 静默剥掉，表格回落到派生列、
    // 零告警（与 isHidden 同类静默丢弃）。且 ColumnSchema 必须递归（z.lazy 自指），
    // 否则表达不了 groups 多级表头 —— 那正是它存在的理由。
    if (!/\bcolumns\s*:\s*z\s*\.array\(\s*ColumnSchema/.test(src)) {
      fail(`${label} 未声明顶层 columns: z.array(ColumnSchema)（逃生列数组会被 Zod 静默剥掉）`)
      ok = false
    }
    if (!/const ColumnSchema[\s\S]{0,120}?z\s*\.lazy\(/.test(src)) {
      fail(`${label} 的 ColumnSchema 不是递归（缺 z.lazy），无法表达 groups 多级表头`)
      ok = false
    }

    // 顶层 `expandConfig` 行展开内容契约（AI-09 子项②）：两处 Zod 都必须声明。
    // 同因（z.object 无 passthrough）—— 漏声明等于把声明式展开内容整段静默剥掉，
    // 表格有展开器但内容恒空、零告警。且其 `fields` 必须非空数组（否则同样是空展开）。
    if (!/\bexpandConfig\s*:\s*z\s*\n?\s*\.object\(/.test(src)) {
      fail(`${label} 未声明顶层 expandConfig: z.object(...)（声明式行展开内容会被 Zod 静默剥掉）`)
      ok = false
    }
    if (!/expandConfig\s*:[\s\S]{0,600}?fields\s*:\s*z\s*\n?\s*\.array\(/.test(src)) {
      fail(`${label} 的 expandConfig 缺少 fields: z.array(...)（展开内容为空则无意义）`)
      ok = false
    }
    // 列级 `expandConfig`（AI-09 子项② 的列内形态）：ColumnSchema 也必须声明。
    // 生成器的**列契约白名单直接从 shared 的 ColumnSchema 推导**（structured-generator.ts
    // 的 columnContractKeys），漏声明 = 「只在展开列上写 expandConfig」的配置在 schema
    // 模式被整键剥掉、展开器内容恒空且零告警（而 SFC 模式的 pushSfcColumn 本就会发它 ——
    // 同一份配置换 mode 产物不等价）。上面那条顶层正则只按键名匹配，覆盖不到列内位置，
    // 所以这里先切出 ColumnSchema 块再查。
    {
      const colStart = src.indexOf('const ColumnSchema')
      // 允许 CRLF：CI 与本地两份检出的行尾可能不同（列 0 的 `)` 才是 ColumnSchema 的收尾，
      // 块内所有闭合括号都有缩进）。
      const colEnd = colStart >= 0 ? /\r?\n\)[;,]?\r?\n/.exec(src.slice(colStart)) : null
      const colBlock = colEnd ? src.slice(colStart, colStart + colEnd.index) : ''
      if (!colBlock) {
        fail(`${label} 未能定位 ColumnSchema 块（列级契约无从核对）`)
        ok = false
      } else if (!/\bexpandConfig\s*:\s*z\s*\n?\s*\.object\(/.test(colBlock)) {
        fail(`${label} 的 ColumnSchema 未声明 expandConfig: z.object(...)（列上声明的展开内容会被 Zod 静默剥掉，展开器恒空）`)
        ok = false
      }
    }

    // 顶层 `treeConfig` 树表契约（AI-09 子项③）：两处 Zod 都必须声明。
    // 同因（z.object 无 passthrough）—— 漏声明等于把声明式树表整段静默剥掉，
    // 表格回落成扁平列表、零告警。childrenField/expandAll 是跨端窄子集。
    if (!/\btreeConfig\s*:\s*z\s*\n?\s*\.object\(/.test(src)) {
      fail(`${label} 未声明顶层 treeConfig: z.object(...)（声明式树表会被 Zod 静默剥掉）`)
      ok = false
    }
    if (!/treeConfig\s*:[\s\S]{0,600}?childrenField\s*:\s*z\s*\n?\s*\.string\(/.test(src)) {
      fail(`${label} 的 treeConfig 缺少 childrenField: z.string(...)（自定义嵌套键名表达不了）`)
      ok = false
    }

    // 顶层 `mergeConfig` 声明式合并单元格契约（AI-23）：两处 Zod 都必须声明。
    // 同因（z.object 无 passthrough）—— 漏声明等于把声明式合并整段静默剥掉，
    // 三端回落成「不合并」、零告警（正是本批要消灭的静默失效）。rowsBy 必须非空数组。
    if (!/\bmergeConfig\s*:\s*z\s*\n?\s*\.object\(/.test(src)) {
      fail(`${label} 未声明顶层 mergeConfig: z.object(...)（声明式合并单元格会被 Zod 静默剥掉）`)
      ok = false
    }
    if (!/mergeConfig\s*:[\s\S]{0,600}?rowsBy\s*:\s*z\s*\n?\s*\.array\(/.test(src)) {
      fail(`${label} 的 mergeConfig 缺少 rowsBy: z.array(...)（没有列可合并无意义）`)
      ok = false
    }

    // vxe 行内编辑契约（AI-09 子项④）：`tableOptions.editConfig`（表级开关）+ 列级
    // `editRender`（列级编辑器）两处 Zod 都必须声明。同因（z.object 无 passthrough）——
    // 漏声明等于把行内编辑配置静默剥掉，表格回落成只读、零告警。editConfig 缺 trigger、
    // editRender 缺 name 则表达不了「怎么进入编辑 / 用哪个编辑器」。二者均仅 vxe 生效。
    if (!/\beditConfig\s*:\s*z\s*\n?\s*\.object\(/.test(src)) {
      fail(`${label} 未声明 tableOptions.editConfig: z.object(...)（行内编辑开关会被 Zod 静默剥掉）`)
      ok = false
    }
    if (!/editConfig\s*:[\s\S]{0,400}?trigger\s*:\s*z\s*\n?\s*\.enum\(/.test(src)) {
      fail(`${label} 的 editConfig 缺少 trigger: z.enum(...)（进入编辑的方式表达不了）`)
      ok = false
    }
    if (!/\beditRender\s*:\s*z\s*\n?\s*\.object\(/.test(src)) {
      fail(`${label} 未在 ColumnSchema 声明 editRender: z.object(...)（列级行内编辑器会被 Zod 静默剥掉，该列永远不可编辑）`)
      ok = false
    }
    if (!/editRender\s*:[\s\S]{0,400}?name\s*:\s*z\s*\.string\(/.test(src)) {
      fail(`${label} 的 editRender 缺少 name: z.string(...)（渲染器名表达不了）`)
      ok = false
    }
    // 响应映射契约（AI-08 configTableOut，顺带纳管）：AI-08 只落了 shared 权威、漏了
    // mcp 内联副本（同类 strip 隐患，此前因 configTableOut 不在 STRUCTURED_TABLE_CONTRACT
    // 而漏网）。两处 Zod 都必须声明，且含 tableData 键。
    if (!/\bconfigTableOut\s*:\s*z\s*\n?\s*\.object\(/.test(src)) {
      fail(`${label} 未声明 tableOptions.configTableOut: z.object(...)（响应映射会被 Zod 静默剥掉）`)
      ok = false
    }
    if (!/configTableOut\s*:[\s\S]{0,400}?tableData\s*:\s*z\s*\.string\(/.test(src)) {
      fail(`${label} 的 configTableOut 缺少 tableData: z.string(...)（列表数据键映射表达不了）`)
      ok = false
    }

    // 表达式 DSL 契约（AI-16）：`isHidden` 的表达式超集由**闭算子白名单**收敛。
    // 两处 Zod 都必须（a）白名单与 core/expr.ts 逐项相等、（b）节点递归（z.lazy）、
    // （c）var 走 z.strictObject 闭键、（d）算子键闭在 EXPR_OPS 内、（e）顶层联合纳入
    // 表达式节点。任一条缺失都会让表达式被 Zod 静默剥掉 —— 字段永远可见、零告警
    // （与 isHidden 同类静默丢弃）。
    if (coreExprOps) {
      const srcOps = parseExprOps(src)
      if (!srcOps) {
        fail(`${label} 未能定位 EXPR_OPS 白名单（表达式算子集必须与 core/expr.ts 同步）`)
        ok = false
      } else {
        const core = [...coreExprOps].sort().join(',')
        const mine = [...srcOps].sort().join(',')
        if (core !== mine) {
          fail(`${label} 的 EXPR_OPS 与 core/expr.ts 不一致\n    core: ${core}\n    ${label}: ${mine}`)
          ok = false
        }
      }
    }
    if (!/HiddenExprVarSchema\s*=\s*z\s*\.strictObject\(/.test(src)) {
      fail(`${label} 的表达式 var 节点不是 z.strictObject（开键会让非算子键混入节点，闭集被破坏）`)
      ok = false
    }
    if (!/HiddenExprNodeSchema[\s\S]{0,120}?z\s*\.lazy\(/.test(src)) {
      fail(`${label} 的表达式节点不是递归（缺 z.lazy），嵌套 or/and 表达不了`)
      ok = false
    }
    if (!/EXPR_NODE_OP_SET\s*(?::[^=]+)?=\s*new Set\(\s*EXPR_OPS\.filter\(/.test(src)) {
      fail(`${label} 的 EXPR_NODE_OP_SET 未由 EXPR_OPS 派生（算子白名单可能漂移）`)
      ok = false
    }
    if (!/HiddenExprVarSchema[\s\S]{0,400}?isSafeProp/.test(src)) {
      fail(`${label} 的 var 节点未复用 isSafeProp（__proto__ 等路径注入防线缺失）`)
      ok = false
    }
    if (!/HiddenConditionListSchema[\s\S]{0,400}?HiddenExprNodeSchema/.test(src)) {
      fail(`${label} 的 HiddenConditionListSchema 未纳入 HiddenExprNodeSchema（表达式 isHidden 会被静默剥掉、字段永远可见）`)
      ok = false
    }

    // 字段联动契约（AI-07）：`reactions`（字段级规则数组）两处 Zod 都必须声明，
    // 且 fulfillment 的表达式键必须复用 `HiddenExprNodeSchema` —— 否则（a）reactions 被
    // Zod 静默剥掉（配置里写了、运行时无联动、零告警），或（b）退化成裸 JS 串/任意 JSON
    // （闭算子沙箱被破坏）。`fulfill.value` 与 `dataOptions` 都必须可表达。
    if (!/const\s+ReactionSchema\s*=\s*z/.test(src)) {
      fail(`${label} 未声明 const ReactionSchema（字段联动规则会被 Zod 静默剥掉）`)
      ok = false
    }
    if (!/reactions\s*:\s*z\s*\.array\(\s*ReactionSchema/.test(src)) {
      fail(`${label} 的 FieldConfigSchema 未声明 reactions: z.array(ReactionSchema)（字段联动会被 Zod 静默剥掉）`)
      ok = false
    }
    if (!/ReactionFulfillSchema\s*=\s*z\s*\.object\([\s\S]{0,900}?dataOptions[\s\S]{0,900}?value/.test(src)) {
      fail(`${label} 的 ReactionFulfillSchema 缺少 dataOptions / value（选项联动或值回写表达不了）`)
      ok = false
    }
    if (!/ReactionFulfillSchema[\s\S]{0,1400}?HiddenExprNodeSchema/.test(src)) {
      fail(`${label} 的 ReactionFulfillSchema 未复用 HiddenExprNodeSchema（表达式键退化成任意 JSON，闭算子沙箱被破坏）`)
      ok = false
    }
    if (!/ReactionSchema\s*=\s*z[\s\S]{0,600}?when\s*:\s*HiddenExprNodeSchema/.test(src)) {
      fail(`${label} 的 ReactionSchema 缺少 when: HiddenExprNodeSchema（规则门控表达不了 / 退化成裸 JS 串）`)
      ok = false
    }
  }

  if (ok) console.log(`✅ 结构化配置 Zod 与 JSON 单源同步（${STRUCTURED_CONFIG_SOURCES.length} 处 schema × target 枚举 + tableOptions 契约字段 + tableBtns/toolbarBtns 定位归一化 + isHidden 表达式白名单）`)
  return ok
}

// ── 3b. dialog 契约守卫轴（AI-26）────────────────────────
// 两条此前**无人守望**的差集：
//   ① AI 面 ↔ crud 运行时面：`CrudDialogConfig`（三端 crud-page 运行时契约，13 键）
//      vs `DialogConfigSchema`（AI 契约，9 键，非 passthrough）→ 经 AI 入口传
//      `render`/`configBtn`/`onOpen`/`onConfirm`/`onClose` 被 Zod **静默剥掉**，
//      而运行时 `EsCrudPage.openDialog` 真消费它们（与 AI-22 的 cachePageSelection 同族）。
//   ② 三套词汇互不相等：core `DialogOptions` / legacy `dialog-options.schema.json`（MCP
//      resource + CLI 消费）/ AI `DialogConfigSchema`。
// 盲区实况：`check-schema-contract` 对 `DialogConfigSchema` 此前**零键断言**（`Dialog` 的
// 命中全是 legacy JSON 的「不得加 required」宽松规则），`readReachability` 也**不下潜 dialogs**。
const MCP_RESOURCE_FALLBACK_SRC = 'packages/mcp-server/src/resources/crud-page-schema.ts'
/**
 * MCP resource 运行时镜像里允许出现的**非运行时键**白名单。
 *
 * `hasCustomRender` 不是幽灵键（AI-34 已更正）：`generate-from-config.ts` 用它放行
 * 「无 formItems 的变更型弹窗」、`structured-generator.ts` 用它派生 TODO 槽 + 告警。
 * 但运行时 `EsCrudPage` 不消费它 —— 它是 **AI-only 注解键**，故可留在资源镜像里，
 * 但必须逐个登记（新出现的「AI-only 键」不得悄悄混进这张教给宿主 LLM 的运行时契约）。
 */
const RESOURCE_MIRROR_ALLOWED_EXTRAS = {
  hasCustomRender:
    'AI-only 注解键：生成器据它派生 TODO 槽 + 告警、from_config 据它放行「无 formItems 的变更型弹窗」；运行时 EsCrudPage 不消费（AI-34）',
}

function checkDialogContract() {
  let ok = true
  const d = readDialogContract()
  if (d === null) return false // 定位失败原因已由 lib 打印

  // 两处手写 AI Zod 副本必须逐键一致（漂移 = 一侧放行、另一侧静默剥离）。
  const sorted = (xs) => [...xs].sort().join(',')
  if (sorted(d.sharedDialogKeys) !== sorted(d.mcpDialogKeys)) {
    ok = fail(
      `dialog 契约的两处 AI Zod 副本已分叉：\n    shared: [${d.sharedDialogKeys.join(', ')}]\n    mcp   : [${d.mcpDialogKeys.join(', ')}]\n` +
        '    两份都是手工维护（zod4 / zod3 无法共享对象），必须同改'
    )
  }
  // 三端 `CrudDialogConfig` 是同一契约的手写副本：任一端独有键即为漂移。
  for (const [end, only] of Object.entries(d.runtimeDialogEndOnly)) {
    if (only.length) {
      ok = fail(`CrudDialogConfig 在 ${end} 端多出其余端没有的键：${only.join(', ')}（三端是同一契约的手写副本）`)
    }
  }

  const aiSet = new Set(d.sharedDialogKeys)

  // ① 运行时键 ⊆ AI 键 ∪ 登记表 —— 差集① 自此有人守望。
  for (const k of d.runtimeDialogKeys) {
    if (!aiSet.has(k) && !(k in DIALOG_KEY_UNREACHABLE)) {
      ok = fail(
        `CrudDialogConfig 的 '${k}' 既不在 AI 契约（DialogConfigSchema）也不在 DIALOG_KEY_UNREACHABLE —— ` +
          '经 AI 入口传入会被 Zod 静默剥掉，而运行时消费它'
      )
    }
  }
  // ② 生成器发射键 ⊆ AI 键（产物里不得出现宿主 LLM 无法声明的键）。
  for (const k of d.generatorDialogKeys) {
    if (!aiSet.has(k)) {
      ok = fail(`生成器发射了 AI 契约不认识的 dialog 键 '${k}'（宿主 LLM 无从声明，属幽灵键）`)
    }
  }
  // ③ 反向陈旧：登记行若已进 AI 契约 → 必须删行（本表只减不增）。
  for (const k of Object.keys(DIALOG_KEY_UNREACHABLE)) {
    if (aiSet.has(k)) {
      ok = fail(`DIALOG_KEY_UNREACHABLE 的 '${k}' 已在 AI 契约里 —— 陈旧登记行，收编后必须删除（本表只减不增）`)
    }
  }
  for (const [k, def] of Object.entries(DIALOG_KEY_UNREACHABLE)) {
    if (!def.tier) ok = fail(`DIALOG_KEY_UNREACHABLE 的 '${k}' 未写明 tier`)
    if (!(def.reason && def.reason.trim())) ok = fail(`DIALOG_KEY_UNREACHABLE 的 '${k}' 未写明 reason`)
  }

  // ⑤ AI-27：三端 `openDialog` 的底座键白名单 —— 契约到运行时的**最后一道闸门**。
  //
  // 为什么需要它：AI Zod 放行一个键（放行 = 宿主 LLM 能写）并不等于它会到达弹窗组件。
  // AI-27 前的实况是 `openDialog` **硬编码转发 9 键、不 spread** —— 即便契约与生成器都到位，
  // 多出来的键在运行时被静默丢弃。这条断言把「AI 契约的逐键转发子集」与「三端白名单」
  // 绑成等式：任一侧加键而另一侧没跟上 → 红。
  {
    const pt = readDialogPassthrough()
    if (pt === null) return false
    for (const [end, keys] of Object.entries(pt.perEnd)) {
      if (sorted(keys) !== sorted(pt.keys)) {
        ok = fail(
          `openDialog 白名单在 ${end} 端与 vue3 端不一致：\n    vue3 : [${pt.keys.join(', ')}]\n    ${end.padEnd(5)}: [${keys.join(', ')}]\n` +
            '    三端是同一契约的手写副本（同 CrudDialogConfig），必须同改'
        )
      }
    }
    const runtimeSet = new Set(d.runtimeDialogKeys)
    for (const k of pt.keys) {
      if (!runtimeSet.has(k)) {
        ok = fail(`openDialog 白名单转了 '${k}'，但三端 CrudDialogConfig 没有声明它 —— 转发了宿主声明不了的键`)
      }
    }
    // 期望集 = AI 契约键 − 需要特殊装配的键（它们不逐键转发）：
    //   title（支持函数式）、formItems/formLayout（参与构造 render）、
    //   configBtn（由 resolveDialogBtns 按 action 装配 click）、hasCustomRender（AI-only 注解键）、
    //   render/onOpen/onConfirm/onClose（函数值，不在 AI 契约里，列出仅为自解释）。
    const SPECIAL = new Set([
      'title', 'formItems', 'formLayout', 'configBtn', 'hasCustomRender',
      'render', 'renderHeader', 'renderFooter', 'onOpen', 'onConfirm', 'onClose',
    ])
    const expected = d.sharedDialogKeys.filter((k) => !SPECIAL.has(k))
    const missing = expected.filter((k) => !pt.keys.includes(k))
    const extra = pt.keys.filter((k) => !expected.includes(k))
    if (missing.length) {
      ok = fail(
        `AI 契约可声明的弹窗数据键在 openDialog 白名单里被丢弃：${missing.join(', ')} —— ` +
          '宿主 LLM 能写、生成器会发射，运行时却收不到（第二道静默丢弃）'
      )
    }
    if (extra.length) {
      ok = fail(`openDialog 白名单多出 AI 契约放行范围外的键：${extra.join(', ')}（宿主无从声明，只会是脏键）`)
    }
    if (ok) {
      console.log(`✅ openDialog 底座键白名单三端一致且 == AI 契约逐键转发子集（${pt.keys.length} 键）`)
    }
  }

  // ④ 差集②：legacy JSON 键 ⊆ core DialogOptions ∪ 裁决清单。
  const jsonKeys = readDialogOptionsJsonKeys()
  const coreKeys = readCoreDialogOptionsKeys()
  if (jsonKeys === null || coreKeys === null) return false
  const coreSet = new Set(coreKeys)
  for (const k of jsonKeys) {
    if (!coreSet.has(k) && !(k in DIALOG_OPTIONS_JSON_ONLY)) {
      ok = fail(
        `dialog-options.schema.json 的 '${k}' 在 core DialogOptions 里没有、也未登记在 DIALOG_OPTIONS_JSON_ONLY —— ` +
          '请显式裁决「改 JSON 还是改 core」，别让它悄悄成为第 31 个键'
      )
    }
  }
  for (const [k, def] of Object.entries(DIALOG_OPTIONS_JSON_ONLY)) {
    if (!def.verdict) ok = fail(`DIALOG_OPTIONS_JSON_ONLY 的 '${k}' 未写明 verdict（promote-core / legacy-alias / end-specific / dead）`)
    if (!(def.reason && def.reason.trim())) ok = fail(`DIALOG_OPTIONS_JSON_ONLY 的 '${k}' 未写明 reason（本表的全部价值就是这条裁决理由）`)
    // 陈旧：裁决为 promote-core 却已进 core → 应删行。
    if (def.verdict === 'promote-core' && coreSet.has(k)) {
      ok = fail(`DIALOG_OPTIONS_JSON_ONLY 的 '${k}' 裁决为 promote-core，但它已在 core DialogOptions —— 陈旧登记行，请删除`)
    }
  }

  if (ok) {
    console.log(
      `✅ dialog 契约三面一致（运行时 ${d.runtimeDialogKeys.length} 键 / AI ${d.sharedDialogKeys.length} 键 ×2 副本 / ` +
        `生成器发射 ${d.generatorDialogKeys.length} 键 / 未达登记 ${Object.keys(DIALOG_KEY_UNREACHABLE).length} 行；` +
        `legacy JSON ${jsonKeys.length} 键 ⊆ core ${coreKeys.length} 键 ∪ 裁决 ${Object.keys(DIALOG_OPTIONS_JSON_ONLY).length} 行）`
    )
  }
  return ok
}

// ── 3c. 契约双份全等 + MCP resource 第三份对齐（AI-32）──────
// ① shared 权威 zod4 `StructuredCrudConfigSchema`（20 顶层键）与 mcp 内联 zod3
//    `configShape`（20 键）此前只按**枚举清单逐项断** —— 往任一处加非清单键（或改
//    `dialogs`/`operationColumn`/`pagination`/`formLayout` 形状）两守卫全绿而镜像已分叉，
//    且 mcp 侧 `z.object` 无 passthrough → 静默 strip。
// ③ MCP resource `crud-page-schema.ts` 内嵌的 `CrudDialogConfig` 是**第三份**（手写），
//    曾漂移成 `onCancel`（运行时 `onClose`）、`render` 三参（运行时二参）、缺 5 键 ——
//    教给宿主 LLM 的接口与运行时契约不符。
function checkContractParity() {
  let ok = true
  const reach = readReachability()
  if (reach === null) return false

  // ① 顶层键集全等（不只「清单里的键存在」）。
  const onlyShared = reach.schemaKeys.filter((k) => !reach.configShapeKeys.includes(k))
  const onlyMcp = reach.configShapeKeys.filter((k) => !reach.schemaKeys.includes(k))
  if (onlyShared.length || onlyMcp.length) {
    ok = fail(
      'shared 权威 Zod 与 mcp 内联 configShape 的顶层键集已分叉：' +
        (onlyShared.length ? `仅 shared 有 [${onlyShared.join(', ')}]；` : '') +
        (onlyMcp.length ? `仅 mcp 有 [${onlyMcp.join(', ')}]；` : '') +
        'mcp 侧 z.object 无 passthrough，只加在一侧的键经那条路径会被静默 strip'
    )
  } else {
    console.log(`✅ shared 权威 Zod 与 mcp 内联 configShape 顶层键全等（各 ${reach.schemaKeys.length} 键）`)
  }

  // ③ MCP resource 运行时镜像。
  const d = readDialogContract()
  if (d === null) return false
  const fbSrc = stripComments(read(MCP_RESOURCE_FALLBACK_SRC))
  const fbBlock = sliceBlock(
    fbSrc,
    'export interface CrudDialogConfig {',
    '}',
    'crud-page-schema.ts CRUD_PAGE_TYPES_FALLBACK CrudDialogConfig'
  )
  if (fbBlock === null) return false
  const fbKeys = topLevelKeysOf(fbBlock)
  const fbSet = new Set(fbKeys)

  for (const k of d.runtimeDialogKeys) {
    if (!fbSet.has(k)) {
      ok = fail(
        `MCP resource 的 CrudDialogConfig 镜像缺少运行时键 '${k}' —— 宿主 LLM 照它写 pageSchema 会写出运行时读不到的键`
      )
    }
  }
  for (const k of fbKeys) {
    if (!d.runtimeDialogKeys.includes(k) && !(k in RESOURCE_MIRROR_ALLOWED_EXTRAS)) {
      ok = fail(
        `MCP resource 的 CrudDialogConfig 镜像多出运行时契约没有的键 '${k}' —— ` +
          '要么删除，要么登记进 RESOURCE_MIRROR_ALLOWED_EXTRAS 并说明它是 AI-only 注解键'
      )
    }
  }
  // `render` 签名元数必须与运行时一致（(h, ctx) 二参；镜像曾写三参）。
  // 先剥掉泛型实参再数逗号 —— `Record<string, unknown>` 里的逗号会被误当参数分隔符
  // （实测把二参读成四参），剥泛型后计数才与肉眼一致。
  const rm = fbBlock.match(/\brender\?\s*:\s*\(([^)]*)\)/)
  if (!rm) {
    ok = fail('MCP resource 的 CrudDialogConfig 镜像缺少 render 声明')
  } else {
    let params = rm[1]
    let prev
    do {
      prev = params
      params = params.replace(/<[^<>]*>/g, '')
    } while (params !== prev)
    const arity = params.split(',').filter((s) => s.trim()).length
    if (arity !== 2) {
      ok = fail(
        `MCP resource 的 CrudDialogConfig 镜像 render 是 ${arity} 参，运行时为 2 参 (h, ctx) —— 教给宿主 LLM 的签名与运行时不符`
      )
    }
  }
  if (ok) {
    console.log(`✅ MCP resource 的 CrudDialogConfig 镜像与运行时契约同步（${d.runtimeDialogKeys.length} 键 + ${Object.keys(RESOURCE_MIRROR_ALLOWED_EXTRAS).length} 个已登记 AI-only 键；render 二参）`)
  }
  return ok
}

/** 从块体直接取缩进 2 的顶层键（`keysInBlock` 需要原始 src，这里已有块体）。 */
function topLevelKeysOf(block) {
  const keys = []
  const re = /^ {2}([A-Za-z_$][\w$]*)\??\s*:/gm
  for (const m of block.matchAll(re)) keys.push(m[1])
  return keys
}

// ── 汇总 ────────────────────────────────────────────────
// 每个检查独立报绿（上面的 ✅ 由各函数自己打印），最后按名字列出失败项 ——
// 原先只打印一行总错误，读者得自己回滚屏幕找是哪条边的 ❌。
const checks = [
  ['formtype 枚举同步', checkFormTypeEnum()],
  ['关键契约字段存在性', checkRequiredFields()],
  ['有意宽松的 schema 未被收紧', checkPermissiveSchemas()],
  ['结构化配置 Zod ↔ JSON 单源', checkStructuredConfigZod()],
  ['dialog 契约守卫轴（AI-26）', checkDialogContract()],
  ['契约双份全等 + resource 第三份（AI-32）', checkContractParity()],
]

const failedChecks = checks.filter(([, ok]) => !ok).map(([name]) => name)
if (failedChecks.length) {
  console.error(
    `\nschema 与 core 类型不同步（失败项：${failedChecks.join('、')}）—— ` +
      '更新 packages/shared/schemas 后运行 `npm run schemas:sync`。'
  )
  process.exit(1)
}
console.log('\nschema ↔ 类型 契约同步 ✅')
