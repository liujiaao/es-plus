#!/usr/bin/env node
/**
 * 三端渲染快照单源同步：docs/tri-render/ 为权威源，分发到三个文档站点。
 *
 * 分发两类文件：
 *   1. schema.json —— 「同一份配置」的 JSON Schema（三端通用，TriRenderTabs 展示源码用）
 *   2. *.png        —— 各渲染器渲染快照（scripts/gen-tri-render-snapshots.mjs 构建期生成）
 *
 * 用法：
 *   node scripts/sync-tri-render.mjs           # 同步：拷贝 schema.json + 快照到各站点
 *   node scripts/sync-tri-render.mjs --check   # 校验：各站点与单源逐字节一致（CI）
 *
 * 退出码：0 = 成功/一致；1 = 校验发现漂移。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SOURCE = join(ROOT, 'docs', 'tri-render')

const SITES = [
  join(ROOT, 'es-plus-docs', 'src', 'tri-render'),
  join(ROOT, 'es-pc', 'src', 'tri-render'),
  join(ROOT, 'es-eui', 'src', 'tri-render'),
]

const CHECK = process.argv.includes('--check')

function rel(p) {
  return p.replace(ROOT + '\\', '').replace(ROOT + '/', '').replace(/\\/g, '/')
}

/** 权威源中需要分发的文件（schema.json + 所有快照 PNG） */
function sourceFiles() {
  if (!existsSync(SOURCE)) return []
  return readdirSync(SOURCE)
    .filter((f) => f === 'schema.json' || f.endsWith('.png'))
    .sort()
}

function main() {
  const files = sourceFiles()
  let drift = false
  let synced = 0

  for (const target of SITES) {
    // es-eui/ 被 .gitignore（本地-only playground，不进 CI）：该站点缺失时跳过校验，
    // 只对已跟踪站点（es-plus-docs / es-pc）做单源一致性门禁。
    if (CHECK && rel(target).startsWith('es-eui/') && !existsSync(target)) continue
    for (const file of files) {
      const srcContent = readFileSync(join(SOURCE, file))
      const dstPath = join(target, file)
      if (CHECK) {
        const dstContent = existsSync(dstPath) ? readFileSync(dstPath) : null
        if (!dstContent || Buffer.compare(dstContent, srcContent) !== 0) {
          console.error(`❌ 三端渲染快照漂移：${rel(dstPath)} 与单源不一致`)
          drift = true
        }
      } else {
        if (!existsSync(target)) mkdirSync(target, { recursive: true })
        writeFileSync(dstPath, srcContent)
        synced++
      }
    }
  }

  if (CHECK) {
    if (drift) {
      console.error('\n三端渲染快照与单源不同步。运行 `npm run tri-render:sync` 重新生成，不要手改各站点副本。')
      process.exit(1)
    }
    console.log(`✅ 全部 ${SITES.length} 个站点三端渲染快照（${files.length} 个文件）与单源逐字节一致`)
  } else {
    console.log(`✅ 已从单源同步 ${files.length} 个文件到 ${SITES.length} 个站点`)
  }
}

main()
