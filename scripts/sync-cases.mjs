#!/usr/bin/env node
/**
 * 案例目录单源同步：docs/cases/cases.json 为权威源，分发到三个文档站点。
 *
 * 该文件承载 L1-L5 案例梯度（docs/改造三端站点.md §3.2）——15 个案例的痛点/解法/链接，
 * 三站「核心案例」页从各自 src/cases/cases.json 读取，保证案例叙事跨站零漂移。
 *
 * 用法：
 *   node scripts/sync-cases.mjs           # 同步：拷贝单源到各站点
 *   node scripts/sync-cases.mjs --check   # 校验：各站点与单源逐字节一致（CI）
 *
 * 退出码：0 = 成功/一致；1 = 校验发现漂移。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SOURCE = join(ROOT, 'docs', 'cases', 'cases.json')

const TARGETS = [
  join(ROOT, 'es-plus-docs', 'src', 'cases', 'cases.json'),
  join(ROOT, 'es-pc', 'src', 'cases', 'cases.json'),
  join(ROOT, 'es-eui', 'src', 'cases', 'cases.json'),
]

const CHECK = process.argv.includes('--check')

function rel(p) {
  return p.replace(ROOT + '\\', '').replace(ROOT + '/', '').replace(/\\/g, '/')
}

function main() {
  const srcContent = readFileSync(SOURCE, 'utf-8')
  let drift = false
  let synced = 0

  for (const target of TARGETS) {
    if (CHECK) {
      const dstContent = existsSync(target) ? readFileSync(target, 'utf-8') : null
      if (dstContent !== srcContent) {
        console.error(`❌ 案例目录漂移：${rel(target)} 与单源不一致`)
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
      console.error('\n案例目录与单源不同步。运行 `npm run cases:sync` 重新生成，不要手改各站点副本。')
      process.exit(1)
    }
    console.log(`✅ 全部 ${TARGETS.length} 个站点案例目录与单源逐字节一致`)
  } else {
    console.log(`✅ 已从单源同步 cases.json 到 ${synced} 个站点`)
  }
}

main()
