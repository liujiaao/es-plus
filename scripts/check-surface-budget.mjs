#!/usr/bin/env node
/**
 * W3 —— `tools/list` 预算守卫（宿主每轮要读多少字节）。
 *
 * ## 为什么要守卫「字节数」
 *
 * 工具面收缩（front-door 只留场景路由器 + 组合页 + 确定性支撑工具）的收益不在
 * 「少几个名字」，而在**宿主每轮的上下文开销**：`tools/list` 是随每次请求一起发出去
 * 的，一个 `generate_crud` 的形状就占 80.9 KB。能力没变（`check-scene-parity` 证明
 * `generate_scene` 的四个 scene 逐字节复现），但字节数可以悄悄涨回来 —— 加一个字段、
 * 抄一段描述，没有任何现有守卫会红。数字没有门禁就一定会漂。
 *
 * ## 为什么读快照而不是重新测量
 *
 * 测量要起真 SDK、跑 `client.listTools()`，已在 `tools-list-snapshot.mjs` 里做一次。
 * 本脚本**只读快照文件**，因此必须排在 `tools:list:check` 之后：前者先证明快照与源码
 * 一致（否则这里量的是陈旧产物，与本仓 `generated-artifacts-go-stale` 是同一类陷阱）。
 * 分组 runner 的组内顺序就是执行顺序，故两者放在同一个步进里，顺序写死在这里的注释
 * 和 `GUARD_GROUPS` 中。
 *
 * ## 预算的三种读法
 *
 *   · **总量**（profile 级）：front-door 的出口指标是 < 40 KB；
 *   · **单工具上限**：防止「总量没超、但把某一个工具养成巨无霸」——
 *     `generate_composition` 的描述是一份使用手册，它自己就占了 7.3 KB；
 *   · **档位落差**：front-door 必须显著小于 full，否则收缩被悄悄抵消。
 *
 * 数值是**棘轮**：只许下调，上调必须在 PR 里说明理由（与 `check:ratchet` 同一口径）。
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './lib/front-door.mjs'

const SNAPSHOT = join(ROOT, 'packages', 'mcp-server', 'tools-list.snapshot.json')

/** 预算表。单位 KB（1024 字节）。 */
const BUDGETS = {
  'front-door': {
    // W3 出口指标：宿主每轮拿到的工具面必须 < 40 KB（实测 21.1）。
    total: 40,
    // 单工具上限：当前最大的是 generate_composition 7.3 KB（它同时是前门的「怎么接线」手册）。
    perTool: 10,
  },
  full: {
    // 默认档**刻意**保持完整（AN-26：默认档不改是兼容性决定，翻默认值要等 AN-25 收敛）。
    // 这里只做棘轮：不许在默认档上继续加肥。
    //
    // 2026-11-10 由 250 / 85 上调到 275 / 95：W2 把两份手写副本（前门旋钮、以及
    // `generate_crud_from_config` 的 configShape）都改成从 shared 权威 schema 派生，
    // 宿主读到的描述随之从手写副本换成 shared 的那一份（合计 +22.9 KB，实测 266.7）。
    // 这不是泄漏，是**有意**采用：手写副本里有事实性错误（例如称 antdv 的 a-table 支持
    // 虚拟滚动，实际两端都没有）。换成权威文案等于让教学面与配置判据同源。
    total: 275,
    perTool: 95, // 当前最大 generate_crud 89.4 KB（shared 文案更完整）
  },
}

const failures = []
const fail = (msg) => {
  failures.push(msg)
  console.error(`✗ ${msg}`)
}

if (!existsSync(SNAPSHOT)) {
  console.error(
    `✗ 缺少 tools/list 快照：${SNAPSHOT}\n` +
      '  先运行 `npm run tools:list:snapshot` 生成基线（本守卫只读它，不自己测量）。',
  )
  process.exit(1)
}

const snap = JSON.parse(readFileSync(SNAPSHOT, 'utf8'))
const kb = (a, b) => (a + b) / 1024
const fmt = (n) => n.toFixed(1)

const measured = {}
for (const [profile, budget] of Object.entries(BUDGETS)) {
  const names = snap.profiles?.[profile]
  if (!Array.isArray(names) || names.length === 0) {
    fail(`快照里没有 ${profile} 的工具名单（结构变了请同步本守卫）`)
    continue
  }

  let desc = 0
  let schema = 0
  const per = []
  for (const name of names) {
    const t = snap.tools?.[name]?.[profile]
    if (!t) {
      fail(`${profile}: 名单里有 ${name}，但快照没有它的定义`)
      continue
    }
    const d = (t.description ?? '').length
    const s = JSON.stringify(t.inputSchema ?? {}).length
    desc += d
    schema += s
    per.push({ name, kb: kb(d, s) })
  }
  const total = kb(desc, schema)
  measured[profile] = { total, tools: names.length }

  if (total > budget.total) {
    const top = per.sort((a, b) => b.kb - a.kb).slice(0, 3).map((x) => `${x.name} ${fmt(x.kb)} KB`)
    fail(
      `${profile} 的 tools/list 总量 ${fmt(total)} KB 超出预算 ${budget.total} KB（最大：${top.join('、')}）`,
    )
  }
  for (const { name, kb: size } of per) {
    if (size > budget.perTool) {
      fail(`${profile}: ${name} 单工具 ${fmt(size)} KB 超出上限 ${budget.perTool} KB`)
    }
  }
}

// 档位落差：front-door 存在的意义是把宿主的选择面与字节量一起压下来。
// 若两者接近，说明某个重量级工具漏回了 front-door（或 full 被瘦身到无差别）。
if (measured['front-door'] && measured.full) {
  const fd = measured['front-door'].total
  const full = measured.full.total
  if (fd >= full) {
    fail(`front-door 的 ${fmt(fd)} KB 不小于 full 的 ${fmt(full)} KB —— 收缩已被抵消`)
  } else if (full / fd < 4) {
    fail(
      `front-door 只有 full 的 ${fmt(full / fd)} 分之一（预期 ≥ 4）—— ` +
        '检查是否有重量级工具回到了 front-door',
    )
  }
}

if (!failures.length) {
  const parts = Object.entries(measured).map(
    ([p, m]) => `${p} ${fmt(m.total)} KB / ${m.tools} 个工具（预算 ${BUDGETS[p].total} KB）`,
  )
  console.log(`✅ tools/list 预算：${parts.join('；')}`)
  process.exit(0)
}

process.exit(1)
