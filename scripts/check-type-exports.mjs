#!/usr/bin/env node
/**
 * CI 断言：三个渲染器（vue3 / vue2 / adapter-antdv）必须导出完全一致的
 * 「跨渲染器契约类型」集合。权威清单来自 packages/core/src/public-types.ts
 * 的 PUBLIC_CONTRACT_TYPES 常量。
 *
 * 目的：兑现“换渲染器只换 import 路径”的家族承诺，防止某个包漏导出/多导出
 * 契约类型而悄悄漂移。
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

  console.log('')

  if (failed) {
    console.error('契约类型导出不一致 —— 请补齐上述缺失导出，或同步更新 core/public-types.ts。')
    process.exit(1)
  }
  console.log('三个渲染器契约类型导出完全一致 ✅')
}

main()
