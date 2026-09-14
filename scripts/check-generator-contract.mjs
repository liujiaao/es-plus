#!/usr/bin/env node
/**
 * CI 断言：AI/CLI 代码生成器（@es-plus/shared）产出的「运行时契约标识符」必须在
 * 三个渲染器（vue3 / vue2 / adapter-antdv）的真实源码中存在。
 *
 * 背景：
 *  结构化生成器（structured-generator.ts）为 <es-crud-page> 包装代码发出固定的
 *  import / prop / event / slot 标识符。若某个渲染器重命名或删除了这些标识符，
 *  生成的代码会在运行时静默失效——类型检查抓不到（生成物是字符串）。
 *  这道守卫把「生成器 ↔ 渲染器」契约固化为可执行断言，是 AI 一次性成码准确度
 *  （目标 ≥95%）的兜底之一。
 *
 * 校验项（每个渲染器都必须满足）：
 *  1. index.ts 运行时导出（非 type-only）`httpRequest` —— 方案B：生成的包装代码
 *     `import { httpRequest } from '@es-plus/<renderer>'` 才能解析。
 *  2. <es-crud-page> 声明 `httpRequest` prop（生成器发出 :http-request）。
 *  3. <es-crud-page> 触发 `delete` / `btn-click` / `dialog-confirm` 事件
 *     （生成器发出 @delete / @btn-click / @dialog-confirm）。
 *  4. <es-table> 以 `scopedSlots.customRender` 作为列插槽名开关（生成器为带 render
 *     的列写入 scopedSlots.customRender，并发出对应 #column-<prop> 模板）。
 *
 * 用法：node scripts/check-generator-contract.mjs
 * 退出码：0 = 契约完整；1 = 有漂移。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf-8')

const RENDERERS = [
  {
    name: '@es-plus/vue3',
    index: 'packages/vue3/src/index.ts',
    crudPage: 'packages/vue3/src/components/es-crud-page/src/es-crud-page.vue',
    table: 'packages/vue3/src/components/es-table/src/component.vue',
  },
  {
    name: '@es-plus/vue2',
    index: 'packages/vue2/src/index.ts',
    crudPage: 'packages/vue2/src/components/es-crud-page/es-crud-page.vue',
    table: 'packages/vue2/src/components/es-table/component.vue',
  },
  {
    name: '@es-plus/adapter-antdv',
    index: 'packages/adapter-antdv/src/index.ts',
    crudPage: 'packages/adapter-antdv/src/components/es-crud-page/src/es-crud-page.vue',
    table: 'packages/adapter-antdv/src/components/es-table/src/component.vue',
  },
]

let failed = false
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}

/**
 * 去掉注释，避免「加一行 // httpRequest 注释」就骗过文本匹配（历史可绕过点之一）。
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

/**
 * index.ts 是否**以指定名字**运行时导出某符号（排除 `export type { ... }`）。
 * 支持 `export { a, b }` 与 `export { local as name }`；**拒绝** `export { name as other }`
 * —— 后者会让生成代码的 `import { name }` 解析失败（历史可绕过点之二）。
 */
function exportsRuntimeValue(indexSrc, name) {
  const src = stripComments(indexSrc)
  for (const block of src.matchAll(/export\s*(type\s*)?\{([^}]*)\}/g)) {
    if (block[1]) continue // export type { ... } 不算运行时导出
    for (const entry of block[2].split(',')) {
      const m = entry.trim().match(/^([\w$]+)(?:\s+as\s+([\w$]+))?$/)
      if (!m) continue
      const exportedName = m[2] || m[1]
      if (exportedName === name) return true
    }
  }
  return false
}

for (const r of RENDERERS) {
  // 1. 运行时导出 httpRequest
  const indexSrc = read(r.index)
  if (!exportsRuntimeValue(indexSrc, 'httpRequest')) {
    fail(`${r.name}: index.ts 未运行时导出 httpRequest（方案B 依赖：生成的包装代码需 import { httpRequest }）`)
  }

  // 2. es-crud-page 声明 httpRequest prop（必须是 prop 声明，不能只是使用/注释）
  const crudSrc = stripComments(read(r.crudPage))
  if (!/\bhttpRequest\s*\??\s*:/.test(crudSrc)) {
    fail(`${r.name}: es-crud-page 未声明 httpRequest prop（生成器发出 :http-request）`)
  }

  // 3. es-crud-page 通过 emit(...) 触发契约事件（不能只是任意字符串字面量）
  for (const evt of ['delete', 'btn-click', 'dialog-confirm']) {
    const re = new RegExp(`emit\\(\\s*['"]${evt}['"]`)
    if (!re.test(crudSrc)) {
      fail(`${r.name}: es-crud-page 未通过 emit('${evt}') 触发事件（生成器发出 @${evt}）`)
    }
  }

  // 4. es-table 以 scopedSlots.customRender 作为列插槽开关
  const tableSrc = stripComments(read(r.table))
  if (!/scopedSlots[\s\S]{0,40}customRender/.test(tableSrc)) {
    fail(`${r.name}: es-table 未使用 scopedSlots.customRender 作为列插槽开关（生成器依赖该机制渲染 #column-<prop>）`)
  }
}

if (failed) {
  console.error('\n生成器 ↔ 渲染器 运行时契约校验失败。')
  process.exit(1)
}
console.log('✅ 生成器 ↔ 渲染器 运行时契约一致（httpRequest 导出 / es-crud-page prop+events / es-table 列插槽机制）')
