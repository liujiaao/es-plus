#!/usr/bin/env node
/**
 * 文档单源同步：根 docs/ 与 es-plus-docs/src/docs/ 的重叠文档（当前 why-es-plus.md / .en）
 * 以根 docs/ 为权威源，复制到文档站，避免同一份文档双份维护产生漂移。
 *
 * 用法：
 *   node scripts/sync-docs.mjs           # 同步：把根 docs/ 重叠文件复制到文档站
 *   node scripts/sync-docs.mjs --check   # 校验：文档站是否与根 docs/ 逐字节一致（CI）
 *
 * 退出码：0 = 成功/一致；1 = 校验发现漂移。
 */
import { writeFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readText, sameText } from './lib/text-sync.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SOURCE = join(ROOT, 'docs')
const TARGET = join(ROOT, 'es-plus-docs', 'src', 'docs')

const CHECK = process.argv.includes('--check')

/** 两目录重叠的 .md 文件（单一权威源在根 docs/，文档站副本由本脚本生成，禁止手改） */
function overlappingFiles() {
  const src = new Set(readdirSync(SOURCE).filter((f) => f.endsWith('.md')))
  const dst = new Set(readdirSync(TARGET).filter((f) => f.endsWith('.md')))
  return [...src].filter((f) => dst.has(f)).sort()
}

function main() {
  const files = overlappingFiles()
  let drift = false
  let synced = 0

  for (const file of files) {
    const srcContent = readText(join(SOURCE, file))
    const dstPath = join(TARGET, file)

    if (CHECK) {
      const dstContent = existsSync(dstPath) ? readText(dstPath) : null
      if (!sameText(dstContent, srcContent)) {
        console.error(`❌ 文档漂移：es-plus-docs/src/docs/${file} 与 docs/${file} 不一致`)
        drift = true
      }
    } else {
      writeFileSync(dstPath, srcContent)
      synced++
    }
  }

  if (CHECK) {
    if (drift) {
      console.error('\n文档站与根 docs/ 不同步。运行 `npm run docs:sync` 重新同步，不要手改文档站副本。')
      process.exit(1)
    }
    console.log(`✅ ${files.length} 个重叠文档与根 docs/（单一权威源）逐字节一致`)
  } else {
    console.log(`✅ 已从根 docs/ 同步 ${synced} 个重叠文档到 es-plus-docs/src/docs/`)
  }
}

main()
