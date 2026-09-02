#!/usr/bin/env node
/**
 * 文档内容设计规范单源同步：docs/theme/docs-content.css 为权威源，分发到三个文档站点。
 *
 * 三站文档正文排版/代码块/表格/提示框统一收敛到该文件（docs/改造三端站点.md §2.3/§5.1），
 * 各站点给内容容器加 `.es-doc-content` 类即可获得统一正文排版。
 *
 * 用法：
 *   node scripts/sync-theme.mjs           # 同步：拷贝单源到各站点
 *   node scripts/sync-theme.mjs --check   # 校验：各站点与单源逐字节一致（CI）
 *
 * 退出码：0 = 成功/一致；1 = 校验发现漂移。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SOURCE = join(ROOT, 'docs', 'theme', 'docs-content.css')

const TARGETS = [
  join(ROOT, 'es-plus-docs', 'src', 'styles', 'docs-content.css'),
  join(ROOT, 'es-pc', 'src', 'styles', 'docs-content.css'),
  join(ROOT, 'es-eui', 'src', 'assets', 'docs-content.css'),
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
        console.error(`❌ 文档内容设计规范漂移：${rel(target)} 与单源不一致`)
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
      console.error('\n文档内容设计规范与单源不同步。运行 `npm run theme:sync` 重新生成，不要手改各站点副本。')
      process.exit(1)
    }
    console.log(`✅ 全部 ${TARGETS.length} 个站点文档内容设计规范与单源逐字节一致`)
  } else {
    console.log(`✅ 已从单源同步 docs-content.css 到 ${synced} 个站点`)
  }
}

main()
