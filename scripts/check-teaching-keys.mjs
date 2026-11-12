#!/usr/bin/env node
/**
 * B12 —— **教学面不得把运行时键当成配置键**守卫（静态，无需 API key、无需构建）。
 *
 * ## 为什么需要它
 *
 * `formItemOptions` 是**运行时 FormItem 的 prop**（`es-form.vue` 透传给底层 `a-form-item`
 * / `el-form-item`）；结构化配置里**没有这个键** —— 字段级校验键是 `rules`，校验规则由
 * 生成器编译成产物里的 `formItemOptions.rules`。修前有两处教学文本让模型「优先用
 * `formItemOptions`」（`structured-config.schema.ts` 的 render 描述、`ai-nl-to-config-prompt.ts`
 * 的英文规则），模型照着写就会被 Zod 静默剥掉 —— 与 `check-unknown-keys` 记录的是同一类
 * 失败，只是这次**源头在教学面**：前门已经判非法，但模型仍在被教错。
 *
 * 本守卫钉三件事：
 *
 *   A. **配置类教学文本**（prompt / schema describe / MCP 资源）里，`formItemOptions`
 *      必须带「编译后 / 产物 / artifact / runtime」限定语。裸出现 = 把它教成配置键 → 红。
 *   B. **运行时示例白名单**（`crud-page-schema.ts`）：只有紧邻 `formtype` 的**运行时示例**
 *      才放行。同一段文本出现在教学文件里仍然红 —— 白名单是**按文件**给的，不是按文本。
 *   C. **能力矩阵的 `structuredPath`** 是「配置面路径」的权威声明；它不得出现
 *      `formItemOptions`。`artifactPaths` 是产物面，允许（它本来就在那里）。
 *
 * ## 非空证明
 *
 * 守卫自带用例（不进语料）：
 *   · 历史坏文本（`prefer the declarative form capabilities (formItemOptions/...)`）必须红；
 *   · 带限定语的说明必须绿；
 *   · 运行时示例在**白名单文件**里绿、在**教学文件**里红；
 *   · 矩阵 `structuredPath` 里出现必须红、`artifactPaths` 里出现必须绿。
 * 每条用例都走**同一个** `scanTeachingText` / `scanStructuredPaths`，注入失败即 exit 1。
 *
 * 用法：`node scripts/check-teaching-keys.mjs`
 * 退出码：0 = 教学面与产物面口径一致；1 = 有文件把运行时键教成配置键（或守卫失效）。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

/** 教学面：这些文件直接决定模型认为「配置里有什么键」。 */
const TEACHING_FILES = [
  'packages/shared/src/ai-nl-to-config-prompt.ts',
  'packages/shared/src/structured-config.schema.ts',
  'packages/mcp-server/src/resources/nl-to-config-examples.ts',
  'packages/mcp-server/src/resources/conventions.ts',
  'packages/mcp-server/src/resources/examples.ts',
  'packages/mcp-server/src/resources/surfaces-examples.ts',
]

/**
 * 运行时示例白名单：`crud-page-schema.ts` 的 `formItems` 示例是**运行时 FormItem** 的形状，
 * 里面出现 `formItemOptions` 是正确的（它演示的是产物形态，不是配置键）。
 * 放行条件不是「文件在名单里」而是「文件在名单里 **且** 紧邻 `formtype`」——
 * 防止有人以后在同一文件里写一句「配置里可写 formItemOptions」也被顺带放行。
 */
const RUNTIME_EXAMPLE_FILES = new Set(['packages/mcp-server/src/resources/crud-page-schema.ts'])

/** 限定语：说明「这是编译后 / 运行时 / 产物里的形态」，而不是配置键。 */
const QUALIFIER = /(compiled|compile|runtime|artifact|generated|产物|编译后|运行时|生成的|透传)/i

const MATRIX = 'docs/ai/ai-capability-matrix.json'

/** ±400 字符窗口：这些文件里的 describe 是长单行，按行取窗会漏掉限定语。 */
const WINDOW = 400

/**
 * A/B 判据：扫描一段教学文本里的 `formItemOptions`。
 * @param {string} file 仓内相对路径（决定白名单）
 * @param {string} text 文件内容
 * @returns {{index:number, line:number, snippet:string, reason:string}[]}
 */
export function scanTeachingText(file, text) {
  const problems = []
  for (let i = text.indexOf('formItemOptions'); i !== -1; i = text.indexOf('formItemOptions', i + 1)) {
    const near = text.slice(Math.max(0, i - WINDOW), Math.min(text.length, i + WINDOW))
    const line = text.slice(0, i).split(/\r?\n/).length
    if (RUNTIME_EXAMPLE_FILES.has(file) && /formtype/.test(near)) continue
    if (QUALIFIER.test(near)) continue
    const lineStart = text.lastIndexOf('\n', i) + 1
    const lineEnd = text.indexOf('\n', i)
    problems.push({
      index: i,
      line,
      snippet: text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd).trim().slice(0, 160),
      reason: RUNTIME_EXAMPLE_FILES.has(file)
        ? '白名单文件里的 formItemOptions 必须紧邻 formtype（运行时 FormItem 示例）；裸出现会被读成配置键'
        : '教学文本把运行时 FormItem 的 prop 写成了配置键（配置侧应写 rules / attrs / dataOptions / reactions）',
    })
  }
  return problems
}

/**
 * C 判据：递归找所有 `structuredPath`（配置面路径）里的 `formItemOptions`。
 * `artifactPaths`（产物面）不在这条判据里 —— 它正是「编译后形态」的权威声明处。
 * @param {unknown} value
 * @param {string} at 当前位置（拼进错误信息）
 * @returns {{at:string, path:string}[]}
 */
export function scanStructuredPaths(value, at = '$') {
  const out = []
  if (!value || typeof value !== 'object') return out
  if (Array.isArray(value)) {
    value.forEach((v, i) => out.push(...scanStructuredPaths(v, `${at}[${i}]`)))
    return out
  }
  for (const [k, v] of Object.entries(value)) {
    if (k === 'structuredPath' && typeof v === 'string' && v.includes('formItemOptions')) {
      out.push({ at: `${at}.structuredPath`, path: v })
    } else {
      out.push(...scanStructuredPaths(v, `${at}.${k}`))
    }
  }
  return out
}

/** 守卫自带用例：证明上面两条判据真的会变红/变绿。 */
function selfTest() {
  const problems = []
  const expect = (label, got, want) => {
    if (got !== want) problems.push(`${label}：期望 ${want} 条，实得 ${got} 条`)
  }
  const TEACH = 'packages/shared/src/ai-nl-to-config-prompt.ts'
  const RUNTIME = 'packages/mcp-server/src/resources/crud-page-schema.ts'

  // 历史坏文本（457c374 之前的原文）必须红。
  expect(
    'S1 历史坏文本',
    scanTeachingText(
      TEACH,
      '"prefer the declarative form capabilities (formItemOptions/attrs/dataOptions/reactions) when a field needs custom FORM behaviour."',
    ).length,
    1,
  )
  // 修后文本必须绿。
  expect(
    'S2 修后文本',
    scanTeachingText(
      TEACH,
      '"prefer the declarative keys (rules/attrs/dataOptions/reactions) for custom FORM behaviour"',
    ).length,
    0,
  )
  // 带「产物/编译后」限定语的说明必须绿：这不是把它当配置键，而是说明它从哪来。
  expect(
    'S3 带限定语',
    scanTeachingText(TEACH, '"This is the CONFIG-side key; the artifact carries it as `formItemOptions.rules`."').length,
    0,
  )
  // 同一段运行时示例：白名单文件里绿、教学文件里红（白名单按文件，不按文本）。
  const runtimeSnippet = "{ prop: 'name', formtype: 'Input', formItemOptions: { rules: [{ required: true }] } }"
  expect('S4 白名单文件里的运行时示例', scanTeachingText(RUNTIME, runtimeSnippet).length, 0)
  expect('S5 教学文件里的同一段示例', scanTeachingText(TEACH, runtimeSnippet).length, 1)
  // 白名单文件里的裸配置键声明也必须红（白名单只放行紧邻 formtype 的示例）。
  expect(
    'S6 白名单文件里的裸配置键',
    scanTeachingText(RUNTIME, '"You can set `formItemOptions` in the config."').length,
    1,
  )
  // 矩阵：配置面路径不得有，产物面路径允许有。
  expect(
    'S7 structuredPath 里出现',
    scanStructuredPaths({ a: { structuredPath: 'fields[].formItemOptions.rules' } }).length,
    1,
  )
  expect(
    'S8 artifactPaths 里出现',
    scanStructuredPaths({
      a: { structuredPath: 'fields[].rules', artifactPaths: ['formItems[].formItemOptions.rules'] },
    }).length,
    0,
  )
  return problems
}

function main() {
  let failed = false
  const fail = (msg) => {
    failed = true
    console.error(`❌ ${msg}`)
  }

  // ── 正向：教学面 + 白名单 + 矩阵 ──
  let hitCount = 0
  for (const file of TEACHING_FILES) {
    const text = readFileSync(join(ROOT, file), 'utf-8')
    for (const p of scanTeachingText(file, text)) {
      hitCount++
      fail(`${file}:${p.line} ${p.reason}\n     ${p.snippet}`)
    }
  }
  if (!hitCount) console.log(`✅ 教学面 ${TEACHING_FILES.length} 个文件零裸 formItemOptions`)

  for (const file of RUNTIME_EXAMPLE_FILES) {
    for (const p of scanTeachingText(file, readFileSync(join(ROOT, file), 'utf-8'))) {
      fail(`${file}:${p.line} ${p.reason}\n     ${p.snippet}`)
    }
  }

  const matrix = JSON.parse(readFileSync(join(ROOT, MATRIX), 'utf-8'))
  for (const { at, path } of scanStructuredPaths(matrix)) {
    fail(`${MATRIX} ${at} = "${path}" —— structuredPath 是配置面路径，运行时 prop 不得出现在这里（应写 fields[].rules）`)
  }

  // ── 非空证明：自带用例必须全部咬住 ──
  const proof = selfTest()
  if (proof.length) for (const p of proof) fail(`非空证明失败：${p}`)
  else console.log('✅ 非空证明：坏文本/裸配置键/矩阵配置面路径全部变红，限定语与运行时示例保持绿')

  if (failed) {
    console.error('\n教学键守卫失败 —— 教学面与配置契约不一致。')
    process.exit(1)
  }
  console.log('✅ 教学键守卫：配置键是 rules/attrs/dataOptions/reactions；formItemOptions 只作为产物形态出现。')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === join(process.argv[1])) main()
