#!/usr/bin/env node
/**
 * 案例目录单源同步：`docs/cases/` 为权威源，分发到三个文档站点。
 *
 * ## 单源清单从哪来（AI-28 改动）
 *
 * 此前这份清单是**硬编码**的三组文件名（`scripts/sync-cases.mjs:41-52`）：新增一个案例
 * 必须同时改脚本，漏改就漏同步，而漏同步的表现是「站点上没有这个案例」——不报错。
 * 现在改由 manifest `docs/cases/ai-cases.json` 驱动：
 *
 *   · `shared[]` —— 非案例专属的单源：`cases.json`（L1–L5 案例梯度）、
 *     `cases-metrics.json`（F6 原生 vs es-plus 的实测数字）→ 各站 `src/cases/`；
 *   · `cases[].artifacts` —— 每个案例的产物（`schema` 必填；`meta` / `mock` / `config` 可选）
 *     → 各站对应目录，三站**同一份字节**；
 *   · `src/cases/generated/registry.js` —— 由本脚本按 manifest **生成**（不是手写）：
 *     通用宿主 `AiCaseHost` 靠它按 id 取 `{ schema, meta, mock }`。
 *
 * ## 为什么 registry 是生成文件而不是 `import.meta.glob`
 *
 * 三个站的打包器不同（vite / vue-cli webpack），动态 glob 的语义与产物形态都不一样；生成的
 * 静态 import 清单在三端逐字节相同，`cases:check` 因此还能把它当漂移门禁（见 §4.6）。
 * 「计划」本身落在 `scripts/lib/case-plan.mjs`：同步脚本与 `check-ai-cases` 共用同一份算法。
 *
 * 用法：
 *   node scripts/sync-cases.mjs           # 同步：拷贝单源到各站点
 *   node scripts/sync-cases.mjs --check   # 校验：各站点与单源逐字节一致（CI）
 *
 * 退出码：0 = 成功/一致；1 = 校验发现漂移。
 */
import { writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { readText, sameText } from './lib/text-sync.mjs'
import { readManifest, ROOT } from './lib/ai-cases.mjs'
import { buildPlan, SITES } from './lib/case-plan.mjs'

const CHECK = process.argv.includes('--check')

function rel(p) {
  return p.replace(ROOT + '\\', '').replace(ROOT + '/', '').replace(/\\/g, '/')
}

function main() {
  const manifest = readManifest()
  const plan = buildPlan(manifest)
  let drift = false
  let synced = 0

  for (const entry of plan) {
    const srcContent = entry.text !== undefined ? entry.text : readText(entry.absSource)

    for (const target of entry.targets) {
      if (CHECK) {
        // 三个站点均已纳入版本库与构建：目标缺失属异常，显式报错而非静默跳过
        // （此前误以为 es-eui/ 被 .gitignore，导致该站目标被删时漏检）。
        if (!existsSync(target)) {
          console.error(`❌ 目标不存在：${rel(target)}（来源 ${entry.kind}）`)
          drift = true
          continue
        }
        const dstContent = readText(target)
        if (!sameText(dstContent, srcContent)) {
          console.error(`❌ 案例目录漂移：${rel(target)} 与单源 ${entry.source} 不一致（${entry.kind}）`)
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
    const total = plan.reduce((n, s) => n + s.targets.length, 0)
    console.log(
      `✅ 全部 ${SITES.length} 个站点的 ${plan.length} 份案例文件（共 ${total} 个副本）与单源逐字节一致`
    )
  } else {
    console.log(`✅ 已从单源同步 ${plan.length} 份案例文件到 ${SITES.length} 个站点（共 ${synced} 个副本）`)
  }
}

main()
