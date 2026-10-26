#!/usr/bin/env node
/**
 * 由**冻结配置**确定性产出案例的 pageSchema JSON（零模型）。
 *
 * ## 它在证明链里的位置
 *
 * `docs/cases/generated/<id>.config.json` 是模型产出的 StructuredCrudConfig（由
 * `es-plus create --ai --emit-config` 落盘，**未经手工修改**）；本脚本把它喂进确定性
 * 生成器 `generateFromConfig`，抽出产物 `schema.ts` 里的 pageSchema JSON 写成
 * `docs/cases/generated/<id>.json` —— 也就是三个站点真正加载的那份字节。
 *
 * 于是「产物 = 编译(冻结配置)」这条等式**可以随时重算**：任何对 JSON 的手工编辑都会让
 * `scripts/check-ai-cases.mjs` 的重放断言变红。这条边界写清楚一点很重要：
 * 它证明的是「产物确实是这份配置的编译结果」，**不**证明「模型能逐字节重现这份配置」
 * （中继/温度/版本都不受控，见 docs/internal/ai-showcase-matrix-plan.md §4.8 / §6 B1）。
 *
 * 用法：
 *   node scripts/gen-ai-case-artifact.mjs docs/cases/generated/<id>.config.json docs/cases/generated/<id>.json
 * 退出码：0 = 已写出；1 = 配置非法 / 生成失败。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { captureFrontDoor, ROOT } from './lib/front-door.mjs'
import { extractPageSchema, pureJsonProblems } from './lib/ai-cases.mjs'

const [, , configArg, outArg] = process.argv
if (!configArg || !outArg) {
  console.error('用法：node scripts/gen-ai-case-artifact.mjs <config.json> <out.json>')
  process.exit(2)
}

const configPath = resolve(process.cwd(), configArg)
const outPath = resolve(process.cwd(), outArg)
const relOut = relative(ROOT, outPath).split('\\').join('/')

const config = JSON.parse(readFileSync(configPath, 'utf-8'))

const { mod, cleanup } = await captureFrontDoor()
try {
  // 与 CLI / MCP 前门同一条落地点：先过确定性校验，再由确定性生成器落地。
  const validation = mod.validateAndRepair(config)
  if (!validation.valid) {
    console.error('❌ 配置没过权威校验：')
    for (const err of validation.errors) console.error(`   ${err}`)
    process.exitCode = 1
  } else {
    const result = mod.generateFromConfig(config)
    const schema = extractPageSchema(result.code, relOut)

    const problems = pureJsonProblems(schema, relOut)
    if (problems.length > 0) {
      console.error('❌ 产物不是纯 JSON（案例页要求可存库/可下发的数据）：')
      for (const p of problems) console.error(`   ${p}`)
      process.exitCode = 1
    } else {
      writeFileSync(outPath, `${JSON.stringify(schema, null, 2)}\n`)
      console.log(`✅ 已写出 ${relOut}（确定性生成，输入 ${configArg}）`)
      if (result.warnings.length > 0) {
        console.log('⚠️ 生成器告警（非阻断，但请人工确认不是映射错误）：')
        for (const w of result.warnings) console.log(`   - ${w}`)
      }
      console.log(result.summary)
    }
  }
} finally {
  cleanup()
}
