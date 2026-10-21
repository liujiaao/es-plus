#!/usr/bin/env node
/**
 * AN-06 —— `EsCrudPage` 的 action 面**三端同源**守卫（静态，无需 API key、无需构建）。
 *
 * ## 为什么需要它
 *
 * 修前三端各写一份 `props.schema.actions || ['add','edit','delete']`。三份副本意味着
 * 「某端忘了改」不会有任何信号 —— 而这正是本仓历史上反复出现的形状（同一契约字段三端
 * 各读一遍，漏掉一端静默失效）。AN-06 把推导收敛到 core 的 `resolveCrudActions`，
 * 本守卫钉的就是这条**收敛本身**：
 *
 *   1. 三端都从 `@es-plus/core` 导入并调用 `resolveCrudActions`；
 *   2. 三端都不再出现「缺 actions 就猜一套 CRUD」的兜底（注释里的说明不算）；
 *   3. 三端的三个派生面（弹窗 / 工具栏 / 操作列）都读同一个 `resolvedActions`，
 *      而不是各自再 `props.schema.actions` 一次（否则同页三个面可以给出互相矛盾的按钮）。
 *
 * 行为面（推导四档判据、产物 actions 恒发射、view 只读、rowkey 透传）由 vitest 覆盖：
 *   · `packages/core/__tests__/crud-actions.spec.ts`（四档判据）
 *   · `packages/vue3/__tests__/es-crud-page.spec.ts`（vue3 挂载）
 *   · `packages/adapter-antdv/__tests__/es-crud-page-actions.spec.ts`（antdv 挂载）
 *   · `packages/mcp-server/__tests__/page-actions.spec.ts`（四入口 × 三端产物）
 *
 * vue2 没有组件挂载 harness（element-ui 在本仓测试环境下会因 CJS `require('vue')`
 * 解析到根部的 vue@3 而崩，见 `packages/vue2/__tests__/es-form.spec.ts` 头注），
 * 故它在这里只受**静态**断言保护 —— 比三缺一好，比真挂载弱，这是已知的覆盖边界。
 *
 * 用法：`node scripts/check-crud-actions.mjs`
 * 退出码：0 = 三端同源；1 = 任一端仍在猜。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { stripComments } from './lib/entry-keys.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const ENDS = {
  vue3: 'packages/vue3/src/components/es-crud-page/src/es-crud-page.vue',
  vue2: 'packages/vue2/src/components/es-crud-page/es-crud-page.vue',
  antdv: 'packages/adapter-antdv/src/components/es-crud-page/src/es-crud-page.vue',
}

const failures = []
const check = (cond, msg, into = failures) => {
  if (!cond) into.push(msg)
}

/** 对一份（已去注释的）组件源码跑全部三端判据，返回失败消息。 */
function inspect(end, code, out = []) {
  check(
    /import \{[^}]*resolveCrudActions[^}]*\} from '@es-plus\/core'/.test(code),
    `${end}: 必须从 @es-plus/core 导入 resolveCrudActions`,
    out
  )
  check(
    /const resolvedActions = computed\(\(\) => resolveCrudActions\(props\.schema\)\)/.test(code),
    `${end}: 必须只算一次 resolvedActions（computed(() => resolveCrudActions(props.schema))）`,
    out
  )
  check(
    !/props\.schema\.actions\s*\|\|/.test(code),
    `${end}: 不得再有 \`props.schema.actions || [...]\` 兜底 —— 缺 actions 时按 schema 结构推导，不猜 CRUD`,
    out
  )

  // 三个派生面（normalizedDialogs / normalizedToolbarBtns / normalizedOperationColumn）
  // 必须都读同一个 resolvedActions —— 否则同页的工具栏与操作列可以给出互相矛盾的按钮。
  const uses = (code.match(/resolvedActions\.value/g) ?? []).length
  check(uses >= 3, `${end}: 三个派生面都应读 resolvedActions（实际引用 ${uses} 处，期望 ≥ 3）`, out)
  return out
}

// core 必须真的导出解析器（否则三端 import 会静默拿到 undefined？不会 —— 构建期就红；
// 但 CI 的静态守卫先于构建，这里提前把「导出被删掉」变成可读的一条。）
const coreIndex = readFileSync(join(ROOT, 'packages/core/src/index.ts'), 'utf8')
check(
  /export \{[^}]*resolveCrudActions[^}]*\} from '\.\/crud-actions'/.test(coreIndex),
  'packages/core/src/index.ts 必须导出 resolveCrudActions（三端共用解析器）'
)
const coreSrc = readFileSync(join(ROOT, 'packages/core/src/crud-actions.ts'), 'utf8')
check(
  /schema\.actions/.test(coreSrc) && /dialogFormItems/.test(coreSrc),
  'core/crud-actions.ts 必须同时判 actions 与 dialogFormItems（四档判据）'
)

for (const [end, rel] of Object.entries(ENDS)) {
  const raw = readFileSync(join(ROOT, rel), 'utf8')
  // 只在**代码**里断言：本文件的修复说明会原样引用旧写法，按原文扫描必然假红。
  failures.push(...inspect(end, stripComments(raw)))
}

/**
 * 变异自检：把 AN-06 之前的写法（三端各一份硬编码兜底）喂进同一组判据，必须咬住。
 * 只修不验的守卫，下一次重构时会静默失去分辨力 —— 本仓为「恒绿守卫」付过代价。
 */
{
  const legacySnippet = `
    const normalizedToolbarBtns = computed(() => {
      const actions = props.schema.actions || ['add', 'edit', 'delete']
      return actions
    })
  `
  if (inspect('legacy', legacySnippet).length === 0) {
    failures.push('自检：AN-06 之前的兜底写法必须被这组判据咬住（现在没咬住 = 守卫已失去分辨力）')
  }
}

if (failures.length) {
  console.error('[crud-actions] 三端 action 面未同源：')
  for (const f of failures) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log(
  `[crud-actions] 三端（${Object.keys(ENDS).join(' / ')}）action 面同源：均走 core resolveCrudActions，无 CRUD 硬编码兜底 ✔`
)
