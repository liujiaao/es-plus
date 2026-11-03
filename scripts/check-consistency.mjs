#!/usr/bin/env node
/**
 * 分组全量报告 runner（P0）。
 *
 * 旧 `check:consistency` 是 121 段 `&&`：第 2 个守卫一红，第 3–121 个**不运行**。
 * 这会把「一处失败」放大成「其余结论未知」——修一轮只看得到一条。本 runner 按
 * `scripts/lib/guard-groups.mjs` 的分组顺序逐项运行，**每项都跑完**，最后汇总
 * 哪些组/哪几项失败；退出码仍在任何失败时为 1，CI 语义不变。
 *
 * 顺序不是随意重排：组的串接必须与 `package.json` 的
 * `check:consistency:legacy` 逐项相等（runner 启动时校验，不一致直接退出 2）。
 * 旧链仍保留为 `npm run check:consistency:legacy`，作为回退与真源。
 *
 * 用法：
 *   node scripts/check-consistency.mjs                # 跑全部分组
 *   node scripts/check-consistency.mjs --list         # 只列出分组
 *   node scripts/check-consistency.mjs --group=scene-front-door[,generator]
 *                                                     # 只跑指定组（仍先做全量校验）
 *
 * 退出码：0 = 全绿；1 = 有守卫失败；2 = 分组清单与旧链不一致 / 参数错误。
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GUARD_GROUPS, stepCommand, validateGroups } from './lib/guard-groups.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const legacy = pkg.scripts?.['check:consistency:legacy']

if (!legacy) {
  console.error(
    '✗ package.json 里没有 check:consistency:legacy —— 分组 runner 需要旧链作为权威顺序。',
  )
  process.exit(2)
}

const { errors, steps, groupCount } = validateGroups(legacy, GUARD_GROUPS)
if (errors.length) {
  console.error(`✗ 分组清单与 check:consistency:legacy 不一致（${errors.length} 处）：`)
  for (const e of errors) console.error(`   - ${e}`)
  console.error(
    '\n分组清单在 scripts/lib/guard-groups.mjs，必须与旧链「同集合、同顺序」。' +
      '两处一起改；不想分组时可直接跑 npm run check:consistency:legacy。',
  )
  process.exit(2)
}

const argv = process.argv.slice(2)
const onlyArg = argv.find((a) => a.startsWith('--group='))
const only = onlyArg
  ? onlyArg
      .slice('--group='.length)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : null

if (argv.includes('--list')) {
  console.log(`[consistency] ${groupCount} 组 / ${steps} 步（顺序与 check:consistency:legacy 一致）`)
  for (const [i, g] of GUARD_GROUPS.entries()) {
    console.log(`  ${String(i + 1).padStart(2)}. ${g.id.padEnd(20)} ${g.steps.length
      .toString()
      .padStart(2)} 步  ${g.title}`)
  }
  process.exit(0)
}

let selected = GUARD_GROUPS
if (only) {
  const known = new Set(GUARD_GROUPS.map((g) => g.id))
  const unknown = only.filter((id) => !known.has(id))
  if (unknown.length) {
    console.error(`✗ 未知分组：${unknown.join(', ')}（用 --list 查看）`)
    process.exit(2)
  }
  selected = GUARD_GROUPS.filter((g) => only.includes(g.id))
}

const fmt = (ms) => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`)
const results = []
const startedAt = Date.now()

console.log(
  `[consistency] 分组运行：${selected.length}/${groupCount} 组、${selected.reduce(
    (n, g) => n + g.steps.length,
    0,
  )}/${steps} 步（失败不会中断后续分组）\n`,
)

for (const [gi, group] of selected.entries()) {
  const groupIndex = GUARD_GROUPS.indexOf(group) + 1
  console.log(`\n━━ [${groupIndex}/${groupCount}] ${group.title}（${group.id}）━━`)
  const stepResults = []
  for (const step of group.steps) {
    const t0 = Date.now()
    console.log(`▶ ${step}`)
    const r = spawnSync(stepCommand(step), {
      cwd: ROOT,
      shell: true,
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: process.env.FORCE_COLOR ?? '1' },
    })
    const ms = Date.now() - t0
    const ok = r.status === 0
    stepResults.push({ step, ok, ms, status: r.status, signal: r.signal })
    console.log(`${ok ? '✓' : '✗'} ${step}（${fmt(ms)}）`)
  }
  const failed = stepResults.filter((r) => !r.ok)
  results.push({ group, stepResults, failed })
  console.log(
    `━━ 组 ${group.id}: ${stepResults.length - failed.length}/${stepResults.length} 通过${
      failed.length ? `，失败 ${failed.map((f) => f.step).join(', ')}` : ''
    } ━━`,
  )
}

const failedGroups = results.filter((r) => r.failed.length)
const failedSteps = results.flatMap((r) => r.failed)
const totalSteps = results.reduce((n, r) => n + r.stepResults.length, 0)

console.log('\n━━━━━━━━━━ 一致性汇总 ━━━━━━━━━━')
for (const r of results) {
  const ok = r.stepResults.length - r.failed.length
  console.log(
    `  ${r.failed.length ? '✗' : '✓'} ${r.group.id.padEnd(20)} ${String(ok).padStart(2)}/${String(
      r.stepResults.length,
    ).padStart(2)}  ${r.group.title}`,
  )
}
console.log(
  `\n[consistency] ${totalSteps - failedSteps.length}/${totalSteps} 步通过，耗时 ${fmt(
    Date.now() - startedAt,
  )}`,
)
if (failedSteps.length) {
  console.error(`✗ ${failedGroups.length} 个组共 ${failedSteps.length} 步失败：`)
  for (const r of failedGroups) {
    console.error(`  - ${r.group.id}: ${r.failed.map((f) => f.step).join(', ')}`)
  }
  process.exitCode = 1
} else {
  console.log('✅ 分组一致性检查全绿。')
}
