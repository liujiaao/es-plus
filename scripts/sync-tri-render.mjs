#!/usr/bin/env node
/**
 * 三端「同一份 Schema」单源同步：docs/tri-render/ 为权威源，分发到三个文档站点。
 *
 * 现状：只分发 `schema.json`（「同一份配置」的 JSON Schema，三站 TriRenderTabs 展示源码用）。
 * **三端渲染快照（*.png）尚未产出** —— 生成脚本 scripts/gen-tri-render-snapshots.mjs 依赖
 * Playwright 且未接入 CI，三站当前也不展示快照（占位 UI 已移除）。快照的生成与 CI 接入
 * 属独立任务；在那之前，本脚本不参与「快照一致性」的门禁，避免对 1 个文件恒绿造成假象。
 *
 * 用法：
 *   node scripts/sync-tri-render.mjs           # 同步：拷贝 schema.json 到各站点
 *   node scripts/sync-tri-render.mjs --check   # 校验：各站点与单源逐字节一致（CI）
 *
 * 退出码：0 = 成功/一致；1 = 校验发现漂移或目标缺失。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readText, sameText } from './lib/text-sync.mjs'

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

/**
 * 权威源中需要分发的文件（当前仅 schema.json；快照另立任务）。
 *
 * 必须显式声明、且**缺失即报错**。此前实现是「扫描存在性后过滤」：
 * 源文件一旦被删，`files` 变成空数组 → 循环体一次都不执行 → 打印
 * 「3 个站点（0 个文件）逐字节一致」并退出 0，门禁恒绿而三站副本仍在。
 * 显式清单 + 缺失报错杜绝了这种「空集绿灯」。
 */
const DISTRIBUTED_FILES = ['schema.json']

function main() {
  const files = DISTRIBUTED_FILES
  let drift = false
  let synced = 0

  // 单源本身缺失 / 声明文件缺失 → 报错，不能静默降级成「0 个文件」
  const missingSources = []
  if (!existsSync(SOURCE)) missingSources.push(rel(SOURCE))
  else for (const f of files) if (!existsSync(join(SOURCE, f))) missingSources.push(rel(join(SOURCE, f)))
  if (missingSources.length) {
    console.error(`❌ 单源缺失：${missingSources.join(', ')}`)
    console.error('（DISTRIBUTED_FILES 声明的文件必须存在；缺失时不报错会退化成「0 个文件恒绿」）')
    process.exit(1)
  }

  for (const target of SITES) {
    // 三个站点都已纳入版本库与构建，因此目标目录缺失属异常（此前对 es-eui 的静默跳过已移除）。
    if (!existsSync(target)) {
      if (CHECK) {
        console.error(`❌ 目标目录不存在：${rel(target)}`)
        drift = true
      } else {
        mkdirSync(target, { recursive: true })
      }
    }
    for (const file of files) {
      const srcPath = join(SOURCE, file)
      const dstPath = join(target, file)
      if (CHECK) {
        const same = existsSync(dstPath) && sameText(readText(dstPath), readText(srcPath))
        if (!same) {
          console.error(`❌ 三端 Schema 漂移：${rel(dstPath)} 与单源不一致`)
          drift = true
        }
      } else {
        if (!existsSync(target)) mkdirSync(target, { recursive: true })
        writeFileSync(dstPath, readText(srcPath))
        synced++
      }
    }
  }

  if (CHECK) {
    if (drift) {
      console.error('\n三端 Schema 与单源不同步。运行 `npm run tri-render:sync` 重新同步，不要手改各站点副本。')
      process.exit(1)
    }
    console.log(`✅ 全部 ${SITES.length} 个站点三端 Schema（${files.length} 个文件）与单源逐字节一致`)
  } else {
    console.log(`✅ 已从单源同步 ${files.length} 个文件到 ${SITES.length} 个站点`)
  }
}

main()
