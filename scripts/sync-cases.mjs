#!/usr/bin/env node
/**
 * 案例目录单源同步：`docs/cases/` 为权威源，分发到三个文档站点。
 *
 * 两份单源：
 *   1. `cases.json` 承载 L1–L5 案例梯度（docs/internal/改造三端站点.md §3.2）——
 *      15 个案例的痛点/解法/链接，三站「核心案例」页从各自 src/cases/cases.json 读取；
 *   2. `flagship-approval.json` + `flagship-approval.mock.js` 是旗舰案例「合同审批工作台」：
 *      前者是整页的 **CrudPageSchema（纯 JSON、0 个函数）**，后者是它所依赖的 mock 后端
 *      （数据 + httpRequest + 角色权限表）。三站宿主页只有几十行，加载的却是**同一份字节**——
 *      「一份 JSON 三端跑」这条头号卖点因此可 diff、可下载、可断言。
 *
 * 用法：
 *   node scripts/sync-cases.mjs           # 同步：拷贝单源到各站点
 *   node scripts/sync-cases.mjs --check   # 校验：各站点与单源逐字节一致（CI）
 *
 * 退出码：0 = 成功/一致；1 = 校验发现漂移。
 */
import { writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readText, sameText } from './lib/text-sync.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const SITES = [
  join(ROOT, 'es-plus-docs', 'src', 'cases'),
  join(ROOT, 'es-pc', 'src', 'cases'),
  join(ROOT, 'es-eui', 'src', 'cases'),
]

/** 单源文件 → 站点副本（同名，放在各自 src/cases/ 下）。 */
const SOURCES = ['cases.json', 'flagship-approval.json', 'flagship-approval.mock.js'].map((name) => ({
  source: join(ROOT, 'docs', 'cases', name),
  targets: SITES.map((dir) => join(dir, name)),
}))

const CHECK = process.argv.includes('--check')

function rel(p) {
  return p.replace(ROOT + '\\', '').replace(ROOT + '/', '').replace(/\\/g, '/')
}

function main() {
  let drift = false
  let synced = 0

  for (const { source, targets } of SOURCES) {
    const srcContent = readText(source)

    for (const target of targets) {
      if (CHECK) {
        // 三个站点均已纳入版本库与构建：目标缺失属异常，显式报错而非静默跳过
        // （此前误以为 es-eui/ 被 .gitignore，导致该站目标被删时漏检）。
        if (!existsSync(target)) {
          console.error(`❌ 目标不存在：${rel(target)}`)
          drift = true
          continue
        }
        const dstContent = readText(target)
        if (!sameText(dstContent, srcContent)) {
          console.error(`❌ 案例目录漂移：${rel(target)} 与单源 ${rel(source)} 不一致`)
          drift = true
        }
      } else {
        const dir = dirname(target)
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
        writeFileSync(target, srcContent)
        synced++
      }
    }
  }

  if (CHECK) {
    if (drift) {
      console.error('\n案例目录与单源不同步。运行 `npm run cases:sync` 重新生成，不要手改各站点副本。')
      process.exit(1)
    }
    const total = SOURCES.reduce((n, s) => n + s.targets.length, 0)
    console.log(`✅ 全部 ${SITES.length} 个站点的 ${SOURCES.length} 份案例文件（共 ${total} 个副本）与单源逐字节一致`)
  } else {
    console.log(`✅ 已从单源同步 ${SOURCES.length} 份案例文件到 ${SITES.length} 个站点（共 ${synced} 个副本）`)
  }
}

main()

