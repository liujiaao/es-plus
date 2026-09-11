#!/usr/bin/env node
/**
 * schemas 单一源同步 / 漂移校验
 *
 * 唯一权威源：packages/shared/schemas/*.schema.json（+ README.md）
 * 消费方（发布时各自打包一份副本，但内容由本脚本从单源生成，禁止手改）：
 *   - packages/vue3/schemas
 *   - packages/adapter-antdv/schemas
 *   - packages/mcp-server/schemas
 *
 * 用法：
 *   node scripts/sync-schemas.mjs           # 同步：把单源拷贝到各消费方
 *   node scripts/sync-schemas.mjs --check    # 校验：各消费方是否与单源逐字节一致（CI 用，不写文件）
 *
 * 退出码：0 = 成功 / 一致；1 = 校验发现漂移。
 */
import { writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readText, sameText } from './lib/text-sync.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const SOURCE = join(ROOT, 'packages/shared/schemas')
const TARGETS = [
  join(ROOT, 'packages/vue3/schemas'),
  join(ROOT, 'packages/adapter-antdv/schemas'),
  join(ROOT, 'packages/mcp-server/schemas'),
]

const CHECK = process.argv.includes('--check')

/** 单源中需要分发的文件（仅 .schema.json 契约；README 各包自有文案不纳入单源） */
function sourceFiles() {
  return readdirSync(SOURCE).filter((f) => f.endsWith('.schema.json'))
}

function rel(p) {
  return p.replace(ROOT + '\\', '').replace(ROOT + '/', '').replace(/\\/g, '/')
}

function main() {
  const files = sourceFiles()
  let drift = false
  let synced = 0

  for (const target of TARGETS) {
    if (!existsSync(target)) {
      if (CHECK) {
        console.error(`❌ 目标目录不存在：${rel(target)}`)
        drift = true
        continue
      }
      mkdirSync(target, { recursive: true })
    }

    for (const file of files) {
      const srcContent = readText(join(SOURCE, file))
      const dstPath = join(target, file)

      if (CHECK) {
        const dstContent = existsSync(dstPath) ? readText(dstPath) : null
        if (!sameText(dstContent, srcContent)) {
          console.error(`❌ 漂移：${rel(dstPath)} 与单源不一致`)
          drift = true
        }
      } else {
        writeFileSync(dstPath, srcContent)
        synced++
      }
    }

    // 校验模式：额外检测目标里有没有单源已删除的多余 schema
    if (CHECK && existsSync(target)) {
      const extra = readdirSync(target).filter(
        (f) => f.endsWith('.schema.json') && !files.includes(f)
      )
      for (const f of extra) {
        console.error(`❌ 多余文件（单源已无）：${rel(join(target, f))}`)
        drift = true
      }
    }
  }

  if (CHECK) {
    if (drift) {
      console.error(
        '\nschemas 与单源（packages/shared/schemas）不同步。\n运行 `npm run schemas:sync` 重新生成，不要手改各包 schemas 副本。'
      )
      process.exit(1)
    }
    console.log(`✅ 全部 ${TARGETS.length} 个消费方 schemas 与单源逐字节一致`)
  } else {
    console.log(
      `✅ 已从单源同步 ${files.length} 个文件 × ${TARGETS.length} 个消费方（共 ${synced} 次写入）`
    )
  }
}

main()
