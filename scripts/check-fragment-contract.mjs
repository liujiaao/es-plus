#!/usr/bin/env node
/**
 * fragment 词汇 ↔ zod3 镜像 同步校验
 *
 * 背景:shared 用 zod4、mcp-server 用 zod3,两个大版本的 zod 对象不能跨包复用。
 * 于是片段工具(generate_form/table/dialog)与前门(generate_crud)在 mcp-server 侧
 * **手写**了一份 zod3 `surfaceFieldSchema`(packages/mcp-server/src/tools/_fragment-shapes.ts),
 * 作为 shared 权威 `SurfaceField`(packages/shared/src/compose-crud-config.ts)的镜像。
 *
 * 手写副本就会漂移:给 SurfaceField 加了字段却忘了同步 zod3 镜像 → MCP 工具会**静默
 * 丢弃**那个入参(zod 不认识的 key 被 strip),LLM 以为传了、生成器却没收到。本脚本在
 * PR 上就把这类漂移打红。
 *
 * 校验项:
 *  1. 键集一致:SurfaceField(接口)的属性集 === surfaceFieldSchema(zod3)的顶层键集。
 *  2. 成员标志必须双双缺席:inQuery/inTable/inForm 由 composeCrudConfig 推导,
 *     不在任何「单面字段」里出现——两处都不许冒出来(冒出来说明有人把组合层的概念
 *     漏进了单面词汇)。
 *
 * 用法:node scripts/check-fragment-contract.mjs
 * 退出码:0 = 同步;1 = 发现漂移。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf-8')

const SURFACE_FIELD_SRC = 'packages/shared/src/compose-crud-config.ts'
const FRAGMENT_SHAPES_SRC = 'packages/mcp-server/src/tools/_fragment-shapes.ts'
const MEMBERSHIP_FLAGS = ['inQuery', 'inTable', 'inForm']

const fail = (msg) => {
  console.error(`❌ ${msg}`)
  return false
}

/** 从 `export const <marker> = <start>` 到首个列 0 的 `<close>` 之间的块。 */
function sliceBlock(src, startMarker, closeLine, label) {
  const i = src.indexOf(startMarker)
  if (i === -1) {
    fail(`未能在 ${label} 定位 ${JSON.stringify(startMarker)}`)
    return null
  }
  const rest = src.slice(i + startMarker.length)
  // 列 0 的 closeLine(接口是 `}`、zod 对象是 `});`)标记块结束。用 \n+字面量 定位,
  // 避开把 closeLine 当正则(`});` 里的 `)` 会被解析成未配对括号)。
  const needle = '\n' + closeLine
  const end = rest.indexOf(needle)
  if (end === -1) {
    fail(`未能在 ${label} 定位块结束符 ${JSON.stringify(closeLine)}`)
    return null
  }
  return rest.slice(0, end)
}

/** 收集缩进 2 空格的顶层键(接口属性 / zod 对象属性都是这个形状)。 */
function topLevelKeys(block) {
  const keys = []
  for (const m of block.matchAll(/^ {2}([A-Za-z_$][\w$]*)\??\s*:/gm)) {
    keys.push(m[1])
  }
  return keys
}

function main() {
  let ok = true

  // ── 1. SurfaceField 接口键集 ──
  const sfBlock = sliceBlock(read(SURFACE_FIELD_SRC), 'export interface SurfaceField {', '}', 'SurfaceField')
  // ── 2. surfaceFieldSchema(zod3)顶层键集 ──
  const zBlock = sliceBlock(read(FRAGMENT_SHAPES_SRC), 'export const surfaceFieldSchema = z.object({', '});', 'surfaceFieldSchema')
  if (sfBlock === null || zBlock === null) process.exit(1)

  const sfKeys = new Set(topLevelKeys(sfBlock))
  const zKeys = new Set(topLevelKeys(zBlock))

  const missingInZod = [...sfKeys].filter((k) => !zKeys.has(k))
  const extraInZod = [...zKeys].filter((k) => !sfKeys.has(k))

  if (missingInZod.length) {
    ok = fail(
      `zod3 surfaceFieldSchema 缺少 SurfaceField 的字段：${missingInZod.join(', ')}` +
        '（给 SurfaceField 加了字段，但没同步 _fragment-shapes.ts —— MCP 工具会静默丢弃该入参）'
    )
  }
  if (extraInZod.length) {
    ok = fail(
      `zod3 surfaceFieldSchema 多出 SurfaceField 没有的字段：${extraInZod.join(', ')}` +
        '（镜像里凭空多了 key —— 要么 SurfaceField 漏加，要么镜像拼错）'
    )
  }

  // ── 3. 成员标志双双缺席 ──
  for (const flag of MEMBERSHIP_FLAGS) {
    if (sfKeys.has(flag)) ok = fail(`SurfaceField 不应包含成员标志 "${flag}"（它由 composeCrudConfig 推导）`)
    if (zKeys.has(flag)) ok = fail(`zod3 surfaceFieldSchema 不应包含成员标志 "${flag}"（它由 composeCrudConfig 推导）`)
  }

  if (ok) {
    console.log(`✅ fragment 词汇同步（SurfaceField ${sfKeys.size} 键 === zod3 surfaceFieldSchema ${zKeys.size} 键，成员标志均未泄漏）`)
    process.exit(0)
  }
  process.exit(1)
}

main()
