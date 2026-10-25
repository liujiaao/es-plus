#!/usr/bin/env node
/**
 * D11 守卫：es-eui 示例的**列定义**统一写 `prop:`，不要写 `key:`。
 *
 * 背景：三端适配层对列做了 `key ↔ prop` 双向映射（`column-item.vue` / `column-adapter.ts`），
 * 所以 `key:` 能用。但「同一份配置三端跑」是头号卖点，而 docs / pc 的示例一律写 `prop:`、
 * eui 示例曾混写 133 处 `key:` —— 观众把同一页三端对照时会以为配置不通用。
 *
 * 判据刻意保守（只认列定义，绝不误伤按钮与弹窗）：
 *   · 同一行既有 `key: '…'` 又有 `label:` → 判为列；
 *   · 该行只有 `key: '…',`，且对象结束（`}`）前出现 `label:` → 判为列；
 *   · 行内已有 `prop:` → 不是「用 key 代替 prop」，不管（API 表格的行数据就是这种）；
 *   · 其余（按钮 `{ name, key }`、弹窗注册 `key: 'xxxDialog'`）一律放过。
 *
 * 扫描范围含 `views/`：快速上手与开发者指南里的代码块是**给人抄的**（`&lt;` 转义，
 * 渲染成带高亮的样例）——只查 `examples/` 会让「文档教你写 key、示例写 prop」继续成立。
 *
 * 用法：node scripts/check-eui-column-prop.mjs   → 0 = 干净；1 = 有 `key:` 列定义
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIRS = [join(ROOT, 'es-eui', 'src', 'examples'), join(ROOT, 'es-eui', 'src', 'views')]

const collect = (dir, out = []) => {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name)
    if (entry.isDirectory()) collect(abs, out)
    else if (entry.name.endsWith('.vue')) out.push(abs)
  }
  return out
}

function main() {
  const offenders = []
  const files = DIRS.flatMap((dir) => collect(dir))
  for (const abs of files) {
    const lines = readFileSync(abs, 'utf8').split(/\r?\n/)
    lines.forEach((line, i) => {
      if (!/key:\s*'/.test(line)) return
      if (/prop:\s*'/.test(line)) return
      const sameLineLabel = /key:\s*'[^']*',\s*label:/.test(line)
      let nextLabel = false
      if (!sameLineLabel) {
        for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
          if (/^\s*label:/.test(lines[j])) {
            nextLabel = true
            break
          }
          if (/^\s*\}/.test(lines[j])) break
        }
      }
      if (sameLineLabel || nextLabel) {
        offenders.push({ file: relative(ROOT, abs).replace(/\\/g, '/'), line: i + 1, text: line.trim() })
      }
    })
  }

  if (offenders.length) {
    console.error(`❌ es-eui 的示例/文档样例里有 ${offenders.length} 处列定义仍写 key:（应与另两端一致用 prop:）：`)
    for (const o of offenders) console.error(`   ${o.file}:${o.line}  ${o.text}`)
    console.error(
      '\n适配层两种写法都认，但示例是三端对照的原料：同一份配置在 eui 写 key、另两端写 prop，\n' +
        '读者会以为配置不能通用。改成 prop: 即可（按钮的 key、弹窗注册的 key 不受影响）。',
    )
    process.exit(1)
  }

  console.log(`✅ es-eui 示例与文档样例的列定义统一用 prop:（扫描 ${files.length} 个 .vue）`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === join(process.argv[1])) main()
