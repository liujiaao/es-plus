/**
 * AI 展示案例矩阵的共享原语 —— manifest 读取 / 生成产物抽取 / 纯 JSON 判据 / 路径取证。
 *
 * 为什么要有这一层：同一个「案例产物」会被三处读，三处各写一套抽法必然漂移：
 *   1. `scripts/gen-ai-case-from-surfaces.mjs` —— 由冻结意图表经**真前门 handler** 生成产物；
 *   2. `scripts/check-ai-cases.mjs` —— 重放断言（产物 == 编译(冻结输入)）；
 *   3. `scripts/gen-ai-capability-matrix.mjs` —— 能力级矩阵（token → 配置路径 → 前门可达性）。
 *
 * 前门打包/捕获直接复用 `scripts/lib/front-door.mjs`（`check-front-door` 与 eval 前门腿的
 * 同一份实现）：再写一套 esbuild 入口，两套必然漂移，而漂移会让「守卫断言的」不等于
 * 「eval 测到的」。
 *
 * 产物形态的边界（重要）：站点加载的 `<id>.json` **不是**模型输出的 StructuredCrudConfig，
 * 而是确定性生成器的输出 —— `schema.ts` 里 `export const pageSchema: CrudPageSchema = {…}`
 * 的那段 JSON。因此「可重放」的准确含义是：
 *
 *     产物  ==  JSON(generateFromConfig(冻结配置).code)
 *
 * 或（前门路径）：
 *
 *     产物  ==  JSON(真 handler(冻结 surfaces))
 *
 * 断言的就是上面这条等式；模型那一步不承诺逐字节可重现（中继/温度/版本都不受控）。
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { ROOT } from './front-door.mjs'

/** manifest 单源（矩阵的真源）。 */
export const MANIFEST_PATH = join(ROOT, 'docs', 'cases', 'ai-cases.json')
export const MANIFEST_SCHEMA_PATH = join(ROOT, 'docs', 'cases', 'ai-cases.schema.json')

export function readJsonFile(absPath) {
  return JSON.parse(readFileSync(absPath, 'utf-8'))
}

export function readManifest() {
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(`缺少 manifest：${MANIFEST_PATH}（AI 案例矩阵的单一真源）`)
  }
  const manifest = readJsonFile(MANIFEST_PATH)
  if (!Array.isArray(manifest.cases)) {
    throw new Error('manifest 缺少 cases 数组')
  }
  return manifest
}

/** manifest 里的相对路径 → 仓库绝对路径。 */
export function repoPath(rel) {
  return resolve(ROOT, rel)
}

/** manifest 里的相对路径 → 站点内相对（用于报错文案）。 */
export function relFromRoot(absPath) {
  return absPath.slice(ROOT.length + 1).split('\\').join('/')
}

// ── 生成产物抽取 ────────────────────────────────────────────────────────────

/**
 * `schema.ts` 的两种前缀（TS / JS）都认；`[\s\S]*?` 配 `$` 惰性取到字符串末尾。
 * 生成器把 pageSchema 写成文件里**唯一**的一条 `export const` 语句，故不用做括号配平。
 */
const PAGE_SCHEMA_RE = /export const pageSchema(?:\s*:\s*CrudPageSchema)?\s*=\s*([\s\S]*?)\s*$/

export function extractPageSchema(code, label = 'schema') {
  if (typeof code !== 'string' || !code.trim()) {
    throw new Error(`${label}：产物为空`)
  }
  const m = code.match(PAGE_SCHEMA_RE)
  if (!m) {
    throw new Error(`${label}：找不到 \`export const pageSchema = …\`（生成器产物形态变了？请同步本抽取器）`)
  }
  try {
    return JSON.parse(m[1])
  } catch (err) {
    throw new Error(`${label}：pageSchema 不是合法 JSON（${err.message}）`)
  }
}

/**
 * 从 `generate_crud` 前门返回的 markdown 文本里取回 pageSchema。
 *
 * schema 模式会同时返回 schema.ts 与包装 SFC 两段围栏，只有 schema.ts 里带 pageSchema；
 * sfc 模式没有 pageSchema（单文件），调用方必须先确认 mode。
 */
export function extractSchemaFromFrontDoorText(text, label = 'front-door') {
  const blocks = [...String(text).matchAll(/```(?:typescript|ts|javascript|js)\n([\s\S]*?)```/g)].map((m) => m[1])
  const block = blocks.find((b) => /export const pageSchema/.test(b))
  if (!block) {
    throw new Error(`${label}：前门返回文本里没有 pageSchema 围栏块（返回格式变了？）`)
  }
  return extractPageSchema(block, label)
}

// ── 纯 JSON 判据 ────────────────────────────────────────────────────────────

/**
 * 函数式键：schema 是**数据**，运行时由组件读取；出现这些键意味着宿主把代码藏进了配置。
 * 与 `scripts/check-generated-case.mjs` 同一份清单（两处都断言同一件事，宁可重复也不放宽）。
 */
export const FUNCTION_KEYS = new Set(['click', 'onConfirm', 'onOpen', 'onClose', 'render', 'formatter', 'httpRequest'])

export function walkJson(node, path, visit) {
  if (Array.isArray(node)) {
    node.forEach((n, i) => walkJson(n, `${path}[${i}]`, visit))
    return
  }
  if (!node || typeof node !== 'object') return
  for (const [key, value] of Object.entries(node)) {
    const here = `${path}.${key}`
    visit(key, value, here)
    walkJson(value, here, visit)
  }
}

/** 纯 JSON 判据（函数式键 / 函数体字样 / 不可序列化值）。返回问题清单（空 = 通过）。 */
export function pureJsonProblems(schema, label = 'schema') {
  const problems = []
  walkJson(schema, label, (key, value, here) => {
    if (FUNCTION_KEYS.has(key)) problems.push(`${here} 是函数式键（${key}）—— 产物必须是纯数据`)
    if (typeof value === 'string' && /=>|\bfunction\b/.test(value)) {
      problems.push(`${here} 含函数体字样：${value.slice(0, 40)}`)
    }
  })
  try {
    const roundTripped = JSON.parse(JSON.stringify(schema))
    if (JSON.stringify(roundTripped) !== JSON.stringify(schema)) {
      problems.push(`${label} 经 JSON 往返后不相等（存在不可序列化的值）`)
    }
  } catch (err) {
    problems.push(`${label} 无法序列化：${err.message}`)
  }
  return problems
}

// ── 路径取证（`a[].b` 形式）────────────────────────────────────────────────

function splitPath(path) {
  return path.split('.').map((seg) => {
    const isArray = seg.endsWith('[]')
    return { key: isArray ? seg.slice(0, -2) : seg, isArray }
  })
}

/**
 * 沿 `formItems[].reactions` / `dialogs[].formItems[]` 这类路径收集所有命中值。
 * 返回 `[{ path: '$.formItems[0].reactions', value }]`。
 *
 * `[]` 的语义按**被遍历的容器**决定：数组 → 逐元素；对象 → 逐值（`dialogs` 是 record，
 * 弹窗字段住在 `dialogs.<key>.formItems[]` 里，用 `dialogs[].formItems[]` 才够得着）。
 * 这条规则是必要的：只认数组会让「弹窗里的 reactions」查不到，而条件必填恰恰在弹窗里。
 */
export function collectPath(node, path) {
  let current = [{ path: '$', value: node }]
  for (const { key, isArray } of splitPath(path)) {
    const next = []
    for (const { path: p, value } of current) {
      if (!value || typeof value !== 'object') continue
      const child = value[key]
      if (child === undefined) continue
      if (isArray) {
        if (Array.isArray(child)) {
          child.forEach((item, i) => next.push({ path: `${p}.${key}[${i}]`, value: item }))
        } else if (typeof child === 'object' && child !== null) {
          for (const [k, item] of Object.entries(child)) next.push({ path: `${p}.${key}.${k}`, value: item })
        }
        continue
      }
      next.push({ path: `${p}.${key}`, value: child })
    }
    current = next
  }
  return current
}

/** 「路径存在且有内容」：undefined / null / 空数组 / 空对象 / 空串 都不算证据。 */
export function hasEvidence(node, path) {
  return collectPath(node, path).some(({ value }) => {
    if (value === undefined || value === null) return false
    if (Array.isArray(value)) return value.length > 0
    if (typeof value === 'string') return value.length > 0
    if (typeof value === 'object') return Object.keys(value).length > 0
    return true
  })
}

/** 一次取回某路径的全部命中值（证据断言失败时用于报错文案）。 */
export function evidenceHint(node, path) {
  const hits = collectPath(node, path)
  return hits.length === 0 ? '路径不存在' : `命中 ${hits.length} 处但内容为空`
}

/** 站点根目录（三站同名约定）。 */
export const SITE_DIRS = {
  'es-plus-docs': join(ROOT, 'es-plus-docs'),
  'es-pc': join(ROOT, 'es-pc'),
  'es-eui': join(ROOT, 'es-eui'),
}

export { ROOT, dirname }
