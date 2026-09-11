#!/usr/bin/env node
/**
 * 品牌文案单源同步：docs/brand/slogan.json 为权威源，分发到三个文档站点。
 *
 * 该文件承载三站统一的口号、定位与「三个承诺」文案（见 docs/改造三端站点.md §5.1）。
 * 三站首页 hero 从各自 `src/brand/slogan.json` 读取，保证跨站文案零漂移。
 *
 * 用法：
 *   node scripts/sync-brand.mjs           # 同步：拷贝单源到各站点
 *   node scripts/sync-brand.mjs --check   # 校验：各站点与单源逐字节一致（CI）
 *
 * 退出码：0 = 成功/一致；1 = 校验发现漂移。
 */
import { writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readText, sameText } from './lib/text-sync.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SOURCE = join(ROOT, 'docs', 'brand', 'slogan.json')

const TARGETS = [
  join(ROOT, 'es-plus-docs', 'src', 'brand', 'slogan.json'),
  join(ROOT, 'es-pc', 'src', 'brand', 'slogan.json'),
  join(ROOT, 'es-eui', 'src', 'brand', 'slogan.json'),
]

const CHECK = process.argv.includes('--check')

function rel(p) {
  return p.replace(ROOT + '\\', '').replace(ROOT + '/', '').replace(/\\/g, '/')
}

function main() {
  const srcContent = readText(SOURCE)
  let drift = false
  let synced = 0

  for (const target of TARGETS) {
    if (CHECK) {
      // es-eui/ 被 .gitignore（本地-only playground，不进 CI）：该站点缺失时跳过校验，
      // 只对已跟踪站点（es-plus-docs / es-pc）做单源一致性门禁。
      if (rel(target).startsWith('es-eui/') && !existsSync(target)) continue
      const dstContent = existsSync(target) ? readText(target) : null
      if (!sameText(dstContent, srcContent)) {
        console.error(`❌ 品牌文案漂移：${rel(target)} 与单源不一致`)
        drift = true
      }
    } else {
      const dir = dirname(target)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(target, srcContent)
      synced++
    }
  }

  if (CHECK) {
    if (drift) {
      console.error('\n品牌文案与单源不同步。运行 `npm run brand:sync` 重新生成，不要手改各站点副本。')
      process.exit(1)
    }
    console.log(`✅ 全部 ${TARGETS.length} 个站点品牌文案与单源逐字节一致`)
  } else {
    console.log(`✅ 已从单源同步 slogan.json 到 ${synced} 个站点`)
  }
}

main()
