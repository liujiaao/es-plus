#!/usr/bin/env node
/**
 * CI 断言：三个渲染器（vue3 / vue2 / adapter-antdv）必须导出完全一致的
 * 「跨渲染器契约类型」集合。权威清单来自 packages/core/src/public-types.ts
 * 的 PUBLIC_CONTRACT_TYPES 常量。
 *
 * 目的：兑现“换渲染器只换 import 路径”的家族承诺，防止某个包漏导出/多导出
 * 契约类型而悄悄漂移。
 *
 * 两条断言：
 *   1. 每个渲染器 ⊇ PUBLIC_CONTRACT_TYPES（漏导出）；
 *   2. 三端的导出集合彼此一致 —— 只存在于某一端的类型必须登记在 RENDERER_SPECIFIC
 *      并写明原因（多导出）。
 *
 * 为什么第 2 条是「三端两两一致」而不是「⊆ 契约清单」：index.ts 本来就会导出契约
 * 清单之外的类型（`EsFormProps`/`EsTableExpose` 之类），断言子集会立刻误报。
 * 但「**只有一端**导出某名字」恰恰是承诺被破坏的形状：使用者按 vue3 写完再换 import
 * 路径到 vue2，那个名字就消失了 —— 而此前只查缺失，这种不对称无人发现。
 *
 * 用法：node scripts/check-type-exports.mjs
 * 退出码：0 = 全部一致；1 = 有缺失/漂移。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const RENDERERS = [
  { name: '@es-plus/vue3', index: 'packages/vue3/src/index.ts' },
  { name: '@es-plus/vue2', index: 'packages/vue2/src/index.ts' },
  { name: '@es-plus/adapter-antdv', index: 'packages/adapter-antdv/src/index.ts' },
]

/**
 * 允许「只有某一端导出」的端特化类型登记表。
 * key = `渲染器包名.类型名`，value = 原因。新增条目请写明为什么它不该三端共有。
 */
const RENDERER_SPECIFIC = new Map([
  [
    '@es-plus/adapter-antdv.CrudPageProps',
    'antdv 的 es-crud-page 以独立 types 文件声明 Props/Emits/Expose 并对外导出；vue3/vue2 的对应组件未导出这三个类型',
  ],
  ['@es-plus/adapter-antdv.CrudPageEmits', '同上（antdv 端特化）'],
  ['@es-plus/adapter-antdv.CrudPageExpose', '同上（antdv 端特化）'],
  [
    '@es-plus/adapter-antdv.EsPlusGlobalConfig',
    'antdv 的插件全局配置类型（注释写明「对齐 vue3 最小集」）；vue3/vue2 未导出同名类型',
  ],
  [
    '@es-plus/vue2.TableBtnConfig',
    'vue2 的 crud-page 在 CrudBtnConfig 之上再声明 position/code（types.ts:56）；vue3/antdv 未导出该扩展名',
  ],
])

/** 从 public-types.ts 提取权威契约类型清单 */
function readContractList() {
  const src = readFileSync(join(ROOT, 'packages/core/src/public-types.ts'), 'utf-8')
  const m = src.match(/PUBLIC_CONTRACT_TYPES\s*=\s*\[([\s\S]*?)\]\s*as const/)
  if (!m) throw new Error('未能在 public-types.ts 中定位 PUBLIC_CONTRACT_TYPES 常量')
  return m[1]
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
}

/** 提取一个 index.ts 中所有对外导出的**类型名** */
function extractExportedTypeNames(filePath) {
  const src = readFileSync(join(ROOT, filePath), 'utf-8')
  const names = new Set()

  // 形如: export type { A, B as C, D } from '...'  /  export type { A }（多行）
  const blockRe = /export\s+type\s*\{([\s\S]*?)\}/g
  let bm
  while ((bm = blockRe.exec(src)) !== null) {
    for (const raw of bm[1].split(',')) {
      const part = raw.trim()
      if (!part) continue
      // 处理 `X as Y` —— 对外可见名是别名 Y
      const asMatch = part.match(/\bas\s+([A-Za-z0-9_$]+)/)
      const name = asMatch ? asMatch[1] : part.replace(/[^A-Za-z0-9_$]/g, '')
      if (name) names.add(name)
    }
  }

  // 形如: export type Name = ...  /  export interface Name ...
  const declRe = /export\s+(?:type|interface)\s+([A-Za-z0-9_$]+)/g
  let dm
  while ((dm = declRe.exec(src)) !== null) {
    // 排除 `export type {` 已在上面处理
    if (dm[1] !== undefined && !/\{/.test(dm[0])) names.add(dm[1])
  }

  return names
}

function main() {
  const contract = readContractList()
  console.log(`权威契约类型清单（PUBLIC_CONTRACT_TYPES）共 ${contract.length} 项。\n`)

  let failed = false
  const perPkg = {}

  for (const r of RENDERERS) {
    const exported = extractExportedTypeNames(r.index)
    perPkg[r.name] = exported
    const missing = contract.filter((t) => !exported.has(t))
    if (missing.length) {
      failed = true
      console.error(`❌ ${r.name} 缺失 ${missing.length} 个契约类型导出：`)
      console.error(`   ${missing.join(', ')}\n`)
    } else {
      console.log(`✅ ${r.name} 覆盖全部 ${contract.length} 个契约类型`)
    }
  }

  // ── 多导出 / 不对称：只存在于某一端的导出名 ──────────────
  const all = new Set(RENDERERS.flatMap((r) => [...perPkg[r.name]]))
  const onlyInOne = [...all].filter((n) => RENDERERS.some((r) => !perPkg[r.name].has(n)))
  const unregistered = onlyInOne.filter((n) => {
    const owners = RENDERERS.filter((r) => perPkg[r.name].has(n)).map((r) => r.name)
    // 登记表按「渲染器.类型名」登记，逐个所有者检查
    return owners.some((o) => !RENDERER_SPECIFIC.has(`${o}.${n}`))
  })
  if (unregistered.length) {
    failed = true
    console.error(`❌ 有 ${unregistered.length} 个类型只被部分渲染器导出（破坏「换 import 路径」承诺）：`)
    for (const n of unregistered) {
      const owners = RENDERERS.filter((r) => perPkg[r.name].has(n)).map((r) => r.name)
      const absent = RENDERERS.filter((r) => !perPkg[r.name].has(n)).map((r) => r.name)
      console.error(`   - ${n}：有 ${owners.join(', ')}；无 ${absent.join(', ')}`)
    }
    console.error('   要么补齐三端导出，要么逐端登记进 RENDERER_SPECIFIC 并写明原因。\n')
  } else if (onlyInOne.length) {
    console.log(`✅ ${onlyInOne.length} 个端特化导出均已登记（${onlyInOne.join(', ')}）`)
  }

  // 登记表过期：该名字如今已是三端共有，或已不再被导出
  const stale = []
  for (const key of RENDERER_SPECIFIC.keys()) {
    const dot = key.indexOf('.')
    const pkg = key.slice(0, dot)
    const name = key.slice(dot + 1)
    if (!all.has(name)) stale.push(`${key}（该类型已不再被任何端导出）`)
    else if (!onlyInOne.includes(name)) stale.push(`${key}（${name} 如今三端都导出，请移除该登记）`)
    else if (!perPkg[pkg]?.has(name)) stale.push(`${key}（${pkg} 并未导出 ${name}）`)
  }
  if (stale.length) {
    failed = true
    console.error(`❌ RENDERER_SPECIFIC 含过期条目（请清理）：`)
    for (const s of stale) console.error(`   - ${s}`)
    console.error('')
  }

  console.log('')

  if (failed) {
    console.error('契约类型导出不一致 —— 请补齐缺失导出，或同步更新 core/public-types.ts / RENDERER_SPECIFIC。')
    process.exit(1)
  }
  console.log('三个渲染器契约类型导出完全一致 ✅')
}

main()
