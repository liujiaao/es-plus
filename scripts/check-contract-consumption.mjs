#!/usr/bin/env node
/**
 * 「契约字段必须被消费」静态检查
 *
 * 背景：本库多次出现「契约类型声明了某字段、文档承诺可用，但三端渲染器从未读取」
 * 的静默失效（`props`/`on`、`placeholder`/`clearable`/`disabled`、全局 `EsForm.rules` …）。
 * 类型检查与现有门禁都抓不到这类问题，因为它们只校验名字/键集。
 *
 * 本脚本对 core 的契约接口（默认 FormItemOption）做字段级扫描，断言每个字段
 * 至少被一个渲染器（packages/{vue3,vue2,adapter-antdv}/src）**实际读取**：
 *   - 属性访问：`row.field`
 *   - 下标访问：`row['field']` / `item["field"]`
 *   - 解构：`const { field } = row`
 *
 * 合法的「不被渲染层直接读取」的字段必须登记在 ALLOWLIST 里并写明原因（例如
 * 由 core 消费、仅供用户扩展点、废弃别名）。新增契约字段若忘了接线，本检查会红。
 *
 * 用法：
 *   node scripts/check-contract-consumption.mjs            # 校验（CI 用）
 *   node scripts/check-contract-consumption.mjs --report   # 打印每个字段的消费计数
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
  // —— 已知死字段（待接线或移除），见 docs/source-audit-report.md ——
  ['BtnConfig.nameKey', 'BtnConfig 的 i18n 别名，目前三端按钮均直接渲染 name、从未读取 nameKey（待接线或移除）'],
])

const CHECK = !process.argv.includes('--report')

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

/** 抽取接口的顶层字段名（缩进两格、`name?: type` / `name: type`） */
function interfaceFields(body) {
  return body
    .split(/\r?\n/)
    .map((line) => line.match(/^\s{2}([A-Za-z_$][\w$]*)\??\s*:/))
    .filter(Boolean)
    .map((m) => m[1])
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
  const rendererFiles = RENDERER_SRC.flatMap((d) => walk(join(ROOT, d)))
  if (rendererFiles.length === 0) {
    console.error('❌ 未找到任何渲染器源码文件，检查路径配置')
    process.exit(1)
  }
  const blob = rendererFiles.map((f) => readFileSync(f, 'utf-8')).join('\n')

  let fail = false
  for (const contract of CONTRACTS) {
    const src = readFileSync(join(ROOT, contract.path), 'utf-8')
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
      for (const f of fields.sort()) {
        console.log(`  ${String(countConsumption(blob, f)).padStart(4)}  ${f}${ALLOWLIST.has(allowKey(f)) ? '  [allowlisted]' : ''}`)
      }
      continue
    }

    const unconsumed = fields.filter((f) => countConsumption(blob, f) === 0)
    const unregistered = unconsumed.filter((f) => !ALLOWLIST.has(allowKey(f)))

    // 登记表里出现过期条目也算问题（字段已删除/改名）
    const stale = [...ALLOWLIST.keys()]
      .filter((k) => k.startsWith(`${contract.name}.`))
      .map((k) => k.slice(contract.name.length + 1))
      .filter((f) => !fields.includes(f))

    if (unregistered.length) {
      fail = true
      console.error(`❌ ${contract.name} 存在「声明了但渲染层从未读取」的字段（疑似静默失效）：`)
      for (const f of unregistered) console.error(`   - ${f}`)
      console.error('   要么在渲染器里接线，要么加入 ALLOWLIST 并说明原因。')
    }
    if (stale.length) {
      fail = true
      console.error(`❌ ${contract.name} ALLOWLIST 含已不存在的字段（请清理）：${stale.join(', ')}`)
    }
    if (!fail) {
      console.log(`✅ ${contract.name}: ${fields.length} 个字段全部被渲染层消费或已登记`)
    }
  }

  if (CHECK && fail) process.exit(1)
}

main()
