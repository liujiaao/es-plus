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
import { writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readText, sameText } from './lib/text-sync.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SOURCE = join(ROOT, 'docs')
const TARGET = join(ROOT, 'es-plus-docs', 'src', 'docs')

const CHECK = process.argv.includes('--check')

/**
 * 应由根 docs/ 镜像到文档站的文档清单（单一权威源在根 docs/，文档站副本由本脚本生成，禁止手改）。
 *
 * 为什么是**显式清单**而不是「两目录交集」：交集写法下，删掉文档站副本会让该文件
 * 自动退出被检查集合 —— `--check` 依然打印「N 个文档一致」并退出 0，而站点页面
 * 已经消失。同类门禁里这是唯一可被「删除」绕过的一个。
 * 新增镜像文档时把文件名加进这里（不要依赖目录扫描）。
 */
const MIRRORED_DOCS = ['why-es-plus.md', 'why-es-plus.en.md', 'migrate-v1.4.md']

function main() {
  let drift = false
  let synced = 0

  for (const file of MIRRORED_DOCS) {
    const srcPath = join(SOURCE, file)
    const dstPath = join(TARGET, file)

    // 源缺失 = 单源本身被删，必须报错（不能静默跳过）
    if (!existsSync(srcPath)) {
      console.error(`❌ 单源缺失：docs/${file} 不存在（MIRRORED_DOCS 声明的镜像文档）`)
      drift = true
      continue
    }

    const srcContent = readText(srcPath)

    if (CHECK) {
      // 目标缺失同样报错：此前正是「目标被删 -> 退出检查集合 -> 绿灯」的漏点
      if (!existsSync(dstPath)) {
        console.error(
          `❌ 文档站副本缺失：es-plus-docs/src/docs/${file} 不存在（运行 \`npm run docs:sync\` 生成）`,
        )
        drift = true
        continue
      }
      if (!sameText(readText(dstPath), srcContent)) {
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
    console.log(`✅ ${MIRRORED_DOCS.length} 个镜像文档与根 docs/（单一权威源）逐字节一致`)
  } else {
    console.log(`✅ 已从根 docs/ 同步 ${synced} 个镜像文档到 es-plus-docs/src/docs/`)
  }
}

main()
