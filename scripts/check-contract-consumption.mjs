#!/usr/bin/env node
/**
 * 「契约字段必须被消费」静态检查
 *
 * 背景：本库多次出现「契约类型声明了某字段、文档承诺可用，但三端渲染器从未读取」
 * 的静默失效（`props`/`on`、`placeholder`/`clearable`/`disabled`、全局 `EsForm.rules` …）。
 * 类型检查与现有门禁都抓不到这类问题，因为它们只校验名字/键集。
 *
 * 本脚本对 core 的契约接口（默认 FormItemOption）做字段级扫描，断言每个字段
 * 被**每一个**渲染器（packages/{vue3,vue2,adapter-antdv}/src）**实际读取**：
 *   - 属性访问：`row.field`
 *   - 下标访问：`row['field']` / `item["field"]`
 *   - 解构：`const { field } = row`
 *
 * 为什么是「每一个」而不是「至少一个」：早先的实现把三端源码拼成一个 blob 再统计，
 * 判据是「总数不为 0」——**结构上不可能发现「三缺一」**（某字段只有 vue3 接线、
 * vue2/antdv 静默忽略，总数照样非 0）。而这恰恰是历史缺陷的形状：同一个契约字段
 * 在三端各读一遍，漏掉一端不会有任何信号。现在逐端统计，任一端为 0 即红。
 *
 * 合法的「有渲染层不读它」必须登记：
 *   - `ALLOWLIST`：**没有**渲染层直接读（由 core 消费 / 仅供扩展点 / 废弃别名）；
 *   - `RENDERER_EXEMPT`：**部分**渲染层不读（其余端确实在读，故不能整字段登记）。
 * 新增契约字段若忘了接线，本检查会红。
 *
 * 已知局限：消费统计是「按字段名在渲染层源码中出现」，因此与通用词同名的字段
 * （如 `type`/`size`/`key`/`width`）天然会被判为已消费；同名但属**别的**契约/对象的
 * 访问（如 `props.options.listenToCallBack` 之于 `FormItemOption.listenToCallBack`）、
 * 甚至 CSS 类名（`.ellipsis-text` 会让 `TableColumn.ellipsis` 计到数）同样会算作消费。
 * 它擅长抓的是**专有字段名**（placeholder/required/formItemOptions/nameKey 这类）的
 * 漏接线，这正是历史缺陷的高发区；逐端断言把「哪一端没接」也纳入了信号。
 *
 * 用法：
 *   node scripts/check-contract-consumption.mjs            # 校验（CI 用）
 *   node scripts/check-contract-consumption.mjs --report   # 打印每个字段的逐端消费计数
 *
 * 退出码：0 = 全部已消费/已登记；1 = 发现未消费且未登记的字段。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

/**
 * 被检查的契约接口（core 中面向用户配置的接口）。
 * 不含 TableOptions：其 vxe 相关配置项（exportConfig/printConfig/keyboardConfig…）
 * 由 vxe-engine 以**动态键列表**整体透传（`opts[k]`），按名字扫描无法识别，属误报源。
 */
const CONTRACTS = [
  { name: 'FormItemOption', path: 'packages/core/src/types.ts' },
  { name: 'BtnConfig', path: 'packages/core/src/types.ts' },
  { name: 'TableColumn', path: 'packages/core/src/types.ts' },
]

/** 渲染层源码目录（消费者） */
const RENDERER_SRC = [
  'packages/vue3/src',
  'packages/vue2/src',
  'packages/adapter-antdv/src',
]

/**
 * 允许「渲染层不直接读取」的字段登记表。
 * key = 字段名，value = 原因。新增条目请写明为什么它是合法的。
 */
const ALLOWLIST = new Map([
  // —— 由 core 统一消费，渲染器不需要感知 ——
  ['FormItemOption.callOptionListFormat', '由 core 的 request.ts 在响应处理链中消费，渲染器无需读取'],
  ['FormItemOption.clearable', '由 core 的 normalizeFormItem 注入 attrs 后由控件消费（渲染器无需直接读）'],
  ['FormItemOption.required', '由 core 的 resolveItemValidateProps 消费（渲染器只需展开其返回值）'],
  ['BtnConfig.direction', '由 core 的 resolveButtonSide / splitButtonsByDirection 消费；三端内联的 direction 过滤已删除，改调 core'],
])

/**
 * 只对**部分**渲染器豁免的登记表：其余端确实在读，故不能整字段进 ALLOWLIST。
 * key = `接口.字段`，value = { exempt: 允许为 0 的渲染器 key, reason }
 */
const RENDERER_EXEMPT = new Map([
  [
    'FormItemOption.placeholder',
    {
      exempt: ['vue3', 'vue2'],
      reason:
        '由 core 的 compat.ts（FORM_ITEM_SHORTCUT_KEYS）注入 attrs 后由控件消费，与 clearable 同构；' +
        'antdv 侧另有直接读取（range 类控件的两段占位拆分），故不能整字段登记',
    },
  ],
])

const CHECK = !process.argv.includes('--report')

/** 去注释：避免「加一行 // field 注释」或注释里的 `.field` 骗过消费统计 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

/** 用花括号配对截取 `export interface <name>` 的 body（避免嵌套对象/CRLF 干扰） */
function interfaceBody(src, name) {
  const start = src.indexOf(`export interface ${name}`)
  if (start < 0) return null
  const open = src.indexOf('{', start)
  if (open < 0) return null
  let depth = 0
  for (let i = open; i < src.length; i++) {
    const ch = src[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return src.slice(open + 1, i)
    }
  }
  return null
}

/**
 * 抽取接口的**顶层**字段名（`name?: type` / `name: type`）。
 * 用花括号 + 圆括号深度判断，故缩进多少格都能识别，且不会把嵌套对象/泛型里的键误当字段
 * （此前写死「缩进恰好两格」，四格缩进的字段会被漏掉）。
 *
 * 同时跟踪圆括号深度：多行函数类型的**参数名**不是字段，但它们按花括号计数恰好落在
 * 深度 0 上（下表 `render?: (` 之后的 `h:` / `ctx:` 都在花括号深度 0、只有圆括号还开着），
 * 于是此前被当成两个字段混进清单。`h` / `ctx` 这种极短的名字在渲染层里遍地都是，
 * 结果就是两个**假字段**常年被记为「已消费」，稀释了这份清单的可信度。
 */
function interfaceFields(body) {
  const fields = []
  let depth = 0
  let paren = 0
  for (const rawLine of stripComments(body).split(/\r?\n/)) {
    const line = rawLine
    if (depth === 0 && paren === 0) {
      const m = line.match(/^\s*([A-Za-z_$][\w$]*)\??\s*:/)
      // 排除索引签名（`[key: string]: unknown`）—— 它们以 `[` 开头，上面的正则本就不匹配
      if (m) fields.push(m[1])
    }
    for (const ch of line) {
      if (ch === '{') depth++
      else if (ch === '}') depth--
      else if (ch === '(') paren++
      else if (ch === ')') paren--
    }
  }
  return fields
}

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) {
      // types/ 是类型声明（含各端特化的同名契约），声明本身不算「消费」
      if (['node_modules', 'build', 'dist', 'types'].includes(entry.name)) continue
      walk(p, acc)
    } else if (/\.(ts|vue|tsx)$/.test(entry.name)) {
      acc.push(p)
    }
  }
  return acc
}

/** 统计某字段在源码中被「实际读取」的次数 */
function countConsumption(blob, field) {
  const dot = new RegExp(`\\.${field}\\b`, 'g')
  const bracket = new RegExp(`\\[\\s*['"\`]${field}['"\`]\\s*\\]`, 'g')
  let n = (blob.match(dot) || []).length + (blob.match(bracket) || []).length

  // 解构：const { a, field } = row / const { field: alias } = row
  const destructures = blob.match(/(?:const|let|var)\s*\{([^}]*)\}/g) || []
  for (const d of destructures) {
    if (new RegExp(`\\b${field}\\b`).test(d)) n++
  }
  return n
}

function main() {
  // 逐端一份 blob —— 合并成一份会让「三缺一」在统计上消失
  const blobs = RENDERER_SRC.map((dir) => ({
    key: dir.split('/')[1],
    blob: stripComments(
      walk(join(ROOT, dir))
        .map((f) => readFileSync(f, 'utf-8'))
        .join('\n')
    ),
  }))
  if (blobs.some((b) => !b.blob)) {
    console.error('❌ 某个渲染器目录为空，检查路径配置')
    process.exit(1)
  }

  let fail = false
  for (const contract of CONTRACTS) {
    const src = stripComments(readFileSync(join(ROOT, contract.path), 'utf-8'))
    const body = interfaceBody(src, contract.name)
    if (body == null) {
      console.error(`❌ 无法解析 ${contract.name}（${contract.path}），选择器失效`)
      fail = true
      continue
    }
    const fields = interfaceFields(body)

    const allowKey = (f) => `${contract.name}.${f}`

    if (!CHECK) {
      console.log(`\n=== ${contract.name}（${fields.length} 字段）===`)
      console.log(`  ${blobs.map((b) => b.key.slice(0, 4).padStart(6)).join('')}  field`)
      for (const f of fields.sort()) {
        const counts = blobs.map((b) => countConsumption(b.blob, f))
        console.log(
          `  ${counts.map((c) => String(c).padStart(6)).join('')}  ${f}${ALLOWLIST.has(allowKey(f)) ? '  [allowlisted]' : ''}`
        )
      }
      continue
    }

    // 逐端判定：任一端为 0 即「该端没接线」
    const silentByField = new Map()
    for (const f of fields) {
      if (ALLOWLIST.has(allowKey(f))) continue
      const exempt = new Set(RENDERER_EXEMPT.get(allowKey(f))?.exempt ?? [])
      const silent = blobs
        .filter((b) => !exempt.has(b.key) && countConsumption(b.blob, f) === 0)
        .map((b) => b.key)
      if (silent.length) silentByField.set(f, silent)
    }

    // 登记表里出现过期条目也算问题（字段已删除/改名 / 该端其实早就读了）
    const stale = [...ALLOWLIST.keys()]
      .filter((k) => k.startsWith(`${contract.name}.`))
      .map((k) => k.slice(contract.name.length + 1))
      .filter((f) => !fields.includes(f))
    const staleExempt = []
    for (const [k, v] of RENDERER_EXEMPT) {
      if (!k.startsWith(`${contract.name}.`)) continue
      const f = k.slice(contract.name.length + 1)
      if (!fields.includes(f)) {
        staleExempt.push(`${k}（字段已不存在）`)
        continue
      }
      for (const r of v.exempt) {
        const b = blobs.find((x) => x.key === r)
        if (!b) staleExempt.push(`${k}（渲染器 key "${r}" 不存在）`)
        else if (countConsumption(b.blob, f) > 0) {
          staleExempt.push(`${k} 豁免了 ${r}，但该端已在读取（请移除该豁免）`)
        }
      }
    }

    if (silentByField.size) {
      fail = true
      console.error(`❌ ${contract.name} 存在「声明了但在某个渲染端从未读取」的字段（疑似静默失效）：`)
      for (const [f, silent] of silentByField) {
        console.error(`   - ${f}  ← 未读取：${silent.join(', ')}`)
      }
      console.error('   要么在该端接线，要么在 ALLOWLIST / RENDERER_EXEMPT 登记并说明原因。')
    }
    if (stale.length) {
      fail = true
      console.error(`❌ ${contract.name} ALLOWLIST 含已不存在的字段（请清理）：${stale.join(', ')}`)
    }
    if (staleExempt.length) {
      fail = true
      console.error(`❌ ${contract.name} RENDERER_EXEMPT 含过期条目（请清理）：`)
      for (const s of staleExempt) console.error(`   - ${s}`)
    }
    if (!fail) {
      console.log(
        `✅ ${contract.name}: ${fields.length} 个字段在 ${blobs.length} 端均被消费或已登记`
      )
    }
  }

  if (CHECK && fail) process.exit(1)
}

main()
