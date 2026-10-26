#!/usr/bin/env node
/**
 * 能力级矩阵生成器 —— `token → 配置路径 → 前门可达性 → 三端支持级别`。
 *
 * ## 解决的缺口（docs/internal/ai-showcase-matrix-plan.md §3 G3）
 *
 * `docs/ai/feature-coverage.json` 的 tier 是**站点案例条目**的属性，不是**能力令牌**的属
 * 性：一个 demo 只要自己写了 `spanMethod` 函数，`mergeConfig` 令牌就被归到 C —— 尽管声明
 * 式 `mergeConfig` 早已是前门参数且三端消费。于是「账本说 B/C」与「前门今天就能生成」是
 * 两件事，而站点上的卖点只有一个账本可引。
 *
 * 本脚本把可达性**现场算出来**，不靠人记：
 *   · `surfaces` 收哪些字段键 —— 从真前门注册里取 `surfaceFieldSchema.shape`；
 *   · 哪些顶层键是透传的 —— 从真前门注册里取 `crudShape` 的键集；
 *   · `structuredPath` 是否真实存在于权威 schema —— 用 `StructuredCrudConfigSchema` 校验，
 *     拼错的键直接报错（而不是安静地少一格）；
 *   · 三端支持级别 —— 直接用 AN-09 的 `CAPABILITIES`，**不另造一套**三端支持表。
 *
 * ## 为什么是「现场生成」而不是手写 JSON
 *
 * 手写矩阵会在生成器加键的那天变成第二真相。这里所有**可达性**事实都由源码推导，
 * 人手只提供词表本身（`scripts/lib/ai-token-map.mjs`：令牌 → 路径），因为令牌是自由文本，
 * 没有机制能猜出「virtualScroll 对应 tableOptions.virtual」。
 *
 * 用法：
 *   node scripts/gen-ai-capability-matrix.mjs           # 生成 docs/ai/ai-capability-matrix.json
 *   node scripts/gen-ai-capability-matrix.mjs --check   # 只校验文件与源码一致（CI，不写盘）
 * 退出码：0 = 一致/已生成；1 = 漂移或词表与 schema 对不上。
 */
import { writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { captureFrontDoor, ROOT } from './lib/front-door.mjs'
import { TOKEN_MAP } from './lib/ai-token-map.mjs'
import { sameText, readText } from './lib/text-sync.mjs'

const OUT_PATH = join(ROOT, 'docs', 'ai', 'ai-capability-matrix.json')
const CHECK = process.argv.includes('--check')

/** `fields[].x` / `tableOptions.x` / `columns[].x` / 裸顶层键。 */
function parsePath(path) {
  if (!path) return { kind: 'none' }
  if (path === 'columns') return { kind: 'columns' }
  if (path.startsWith('columns[]')) return { kind: 'columns' }
  if (path.startsWith('fields[]')) return { kind: 'field', key: path.slice('fields[].'.length) }
  if (path.startsWith('tableOptions.')) return { kind: 'tableOption', key: path.slice('tableOptions.'.length) }
  if (path.startsWith('tableOptions')) return { kind: 'tableOptions' }
  return { kind: 'top', key: path }
}

/**
 * 取 Zod 节点的对象键集。zod 4 里 `.shape` 可能是对象也可能是函数，且 `tableOptions`
 * 这类键是 `z.object({…}).optional()` —— 必须**剥掉包装层**才拿得到键集
 * （`.unwrap()` / `_zod.def.innerType` / `_def.innerType` 三条路都试）。
 */
function shapeKeys(node, label) {
  let cur = node
  for (let depth = 0; depth < 6 && cur; depth++) {
    if (typeof cur === 'function') cur = cur()
    const shape = typeof cur.shape === 'function' ? cur.shape() : cur.shape
    if (shape && typeof shape === 'object' && Object.keys(shape).length > 0) {
      return new Set(Object.keys(shape))
    }
    let next = null
    if (typeof cur.unwrap === 'function') {
      try {
        next = cur.unwrap()
      } catch {
        next = null
      }
    }
    if (!next) next = cur._zod?.def?.innerType || cur._def?.innerType || null
    if (!next) return null
    cur = next
  }
  return null
}

function fail(msg) {
  console.error(`❌ ${msg}`)
  process.exitCode = 1
}

async function main() {
  console.log('[capability-matrix] 打包并捕获真前门 / 权威 schema…')
  const { mod, cleanup, fromBuild, fromSrc } = await captureFrontDoor()
  try {
    if (fromBuild.length > 0) {
      fail(`打包拉到了 shared/build（${fromBuild.slice(0, 3).join(', ')}…）—— 陈旧构建会让矩阵失真`)
    }
    if (fromSrc.length === 0) fail('打包没有拉到任何 shared/src 输入 —— alias 没接上')

    const { cap, surfaceFieldSchema } = mod.capture()
    const crudKeys = Object.keys(cap.shape)
    const surfaceFieldKeys = shapeKeys(surfaceFieldSchema, 'surfaceFieldSchema')
    if (!surfaceFieldKeys || surfaceFieldKeys.size === 0) {
      fail('取不到前门 surfaces 的字段键集（surfaceFieldSchema.shape 为空）')
    }

    const structuredSchema = mod.StructuredCrudConfigSchema
    const rootShape = typeof structuredSchema?.shape === 'function' ? structuredSchema.shape() : structuredSchema?.shape
    const rootKeys = shapeKeys({ shape: rootShape }, 'StructuredCrudConfigSchema')
    if (!rootKeys) fail('取不到 StructuredCrudConfigSchema 的顶层键集')
    const fieldsNode = rootShape?.fields
    const fieldShape = fieldsNode?.element
    const fieldKeys = shapeKeys(fieldShape, 'FieldConfigSchema')
    if (!fieldKeys) fail('取不到 FieldConfigSchema 的键集（fields 元素形状变了？）')
    const tableOptionsKeys = shapeKeys(rootShape?.tableOptions, 'tableOptions')
    if (!tableOptionsKeys) {
      // tableOptions 在权威 schema 里可能是 z.record / passthrough —— 那一层就没有键集可对账，
      // 只能标注「无受限键集」而不是假装校验过。
      console.warn('   ⚠️ tableOptions 没有受限键集（record/passthrough）—— tableOptions.* 只做形状检查')
    }

    /** 前门可达性：surfaces 字段面 / 顶层透传 / 只能走 from_config。 */
    function reachOf(parsed) {
      if (parsed.kind === 'field') {
        return surfaceFieldKeys.has(parsed.key) ? 'front-door:surface' : 'config-only'
      }
      if (parsed.kind === 'tableOption' || parsed.kind === 'tableOptions') {
        return crudKeys.includes('tableOptions') ? 'front-door:passthrough' : 'config-only'
      }
      if (parsed.kind === 'columns') return 'config-only'
      if (parsed.kind === 'top') {
        return crudKeys.includes(parsed.key) ? 'front-door:passthrough' : 'config-only'
      }
      return 'not-declarative'
    }

    /** structuredPath 必须真实存在于权威 schema（拼错的键在这里就红）。 */
    function validatePath(parsed, token) {
      if (parsed.kind === 'none') return
      if (parsed.kind === 'field' && fieldKeys && !fieldKeys.has(parsed.key)) {
        fail(`令牌 ${token} 的 structuredPath "fields[].${parsed.key}" 不在 FieldConfigSchema 里`)
      }
      if (parsed.kind === 'tableOption' && tableOptionsKeys && !tableOptionsKeys.has(parsed.key)) {
        fail(`令牌 ${token} 的 structuredPath "tableOptions.${parsed.key}" 不在 schema 的 tableOptions 里`)
      }
      if (parsed.kind === 'top' && rootKeys && !rootKeys.has(parsed.key) && parsed.key !== 'name') {
        fail(`令牌 ${token} 的 structuredPath "${parsed.key}" 不在 StructuredCrudConfigSchema 顶层键里`)
      }
    }

    const capabilities = {}
    for (const entry of mod.CAPABILITIES) {
      capabilities[entry.key] = {
        ...(entry.equivalents ? { equivalents: entry.equivalents } : {}),
        targets: Object.fromEntries(
          Object.entries(entry.targets).map(([target, cell]) => [target, { level: cell.level, note: cell.note }])
        ),
      }
    }

    const tokens = {}
    for (const t of [...TOKEN_MAP].sort((a, b) => a.token.localeCompare(b.token))) {
      const parsed = parsePath(t.structuredPath)
      validatePath(parsed, t.token)
      // 令牌的 structuredPath 若是 tableOptions.<k> 且 CAPABILITIES 里有同名行，
      // 或顶层键本身就在 CAPABILITIES 里（mergeConfig / treeConfig / expandConfig），
      // 就把那张三端表挂上 —— 这是 claim 边界的唯一来源。
      const capabilityKey =
        parsed.kind === 'tableOption' && capabilities[`tableOptions.${parsed.key}`]
          ? `tableOptions.${parsed.key}`
          : parsed.kind === 'top' && capabilities[parsed.key]
            ? parsed.key
            : null
      tokens[t.token] = {
        kind: t.kind,
        ...(t.structuredPath ? { structuredPath: t.structuredPath } : {}),
        ...(t.artifactPaths ? { artifactPaths: t.artifactPaths } : {}),
        reach: t.reachOverride ?? (t.kind === 'declarative' ? reachOf(parsed) : 'not-declarative'),
        ...(capabilityKey ? { capabilityKey } : {}),
        note: t.note,
      }
    }

    // 覆盖统计：报告用，不是门禁（门禁在 check-ai-cases 的 --strict-coverage）。
    const declarative = Object.entries(tokens).filter(([, v]) => v.kind === 'declarative')
    const frontDoor = declarative.filter(([, v]) => v.reach.startsWith('front-door'))
    const configOnly = declarative.filter(([, v]) => v.reach === 'config-only')

    const matrix = {
      note:
        '由 scripts/gen-ai-capability-matrix.mjs 从源码现场生成，禁止手改。' +
        'reach 表示「前门一步可达」还是「需 generate_crud_from_config」；capabilities 是 AN-09 的三端支持表（claim 边界）。',
      generatedBy: 'scripts/gen-ai-capability-matrix.mjs',
      sources: [
        'packages/shared/src/structured-config.schema.ts',
        'packages/shared/src/capability.ts',
        'packages/mcp-server/src/tools/generate-crud.ts',
      ],
      frontDoor: {
        topLevelKeys: [...crudKeys].sort(),
        surfaceFieldKeys: [...surfaceFieldKeys].sort(),
        tableOptionsKeySet: tableOptionsKeys ? 'closed' : 'open (record/passthrough)',
      },
      stats: {
        tokens: Object.keys(tokens).length,
        declarative: declarative.length,
        frontDoorReachable: frontDoor.length,
        configOnly: configOnly.length,
      },
      capabilities,
      tokens,
    }

    const text = `${JSON.stringify(matrix, null, 2)}\n`
    if (CHECK) {
      if (!existsSync(OUT_PATH)) {
        fail(`矩阵文件不存在：${OUT_PATH}（运行 npm run ai:matrix 生成）`)
        return
      }
      if (!sameText(readText(OUT_PATH), text)) {
        fail('能力矩阵与源码不一致（前门形状 / schema / AN-09 表已变）。运行 `npm run ai:matrix` 重新生成。')
        return
      }
      console.log(
        `✅ 能力矩阵与源码一致：${matrix.stats.tokens} 令牌（声明式 ${matrix.stats.declarative}，` +
          `前门可达 ${matrix.stats.frontDoorReachable}，仅配置 ${matrix.stats.configOnly}）`
      )
      return
    }

    writeFileSync(OUT_PATH, text)
    console.log(
      `✅ 已生成 docs/ai/ai-capability-matrix.json：${matrix.stats.tokens} 令牌（声明式 ${matrix.stats.declarative}，` +
        `前门可达 ${matrix.stats.frontDoorReachable}，仅配置 ${matrix.stats.configOnly}）`
    )
  } finally {
    cleanup()
  }
}

main().catch((err) => {
  console.error(`❌ 生成失败：${err?.stack || err}`)
  process.exit(1)
})
