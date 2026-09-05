#!/usr/bin/env node
/**
 * AI 工具链文案单源同步：docs/ai/ai-tools.json 为权威源，分发到三个文档站点。
 *
 * 三站 AI 页（es-pc AiTools.vue / es-eui ai-tools.vue）从各自 src/ai/ai-tools.json 读取，
 * 保证 MCP / CLI / 在线体验文案跨站零漂移（docs/改造三端站点.md §5.5）。
 *
 * 用法：
 *   node scripts/sync-ai.mjs           # 同步：拷贝单源到各站点
 *   node scripts/sync-ai.mjs --check   # 校验：各站点与单源逐字节一致（CI）
 *
 * 退出码：0 = 成功/一致；1 = 校验发现漂移。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SOURCE = join(ROOT, 'docs', 'ai', 'ai-tools.json')

const TARGETS = [
  join(ROOT, 'es-plus-docs', 'src', 'ai', 'ai-tools.json'),
  join(ROOT, 'es-pc', 'src', 'ai', 'ai-tools.json'),
  join(ROOT, 'es-eui', 'src', 'ai', 'ai-tools.json'),
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
      // es-eui/ 被 .gitignore（本地-only playground，不进 CI）：该站点缺失时跳过校验，
      // 只对已跟踪站点（es-plus-docs / es-pc）做单源一致性门禁。
      if (rel(target).startsWith('es-eui/') && !existsSync(target)) continue
      const dstContent = existsSync(target) ? readFileSync(target, 'utf-8') : null
      if (dstContent !== srcContent) {
        console.error(`❌ AI 文案漂移：${rel(target)} 与单源不一致`)
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
      console.error('\nAI 文案与单源不同步。运行 `npm run ai:sync` 重新生成，不要手改各站点副本。')
      process.exit(1)
    }
    console.log(`✅ 全部 ${TARGETS.length} 个站点 AI 文案与单源逐字节一致`)
  } else {
    console.log(`✅ 已从单源同步 ai-tools.json 到 ${synced} 个站点`)
  }
}

main()
