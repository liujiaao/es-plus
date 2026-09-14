#!/usr/bin/env node
/**
 * 三站「站点切换器 SITES 数组」一致性检查
 *
 * 背景：三站顶栏的跨站切换器各有一份手写的 `const SITES = [...]`（es-plus-docs / es-pc / es-eui）。
 * 内容当前一致，但没有任何 sync / check 覆盖 —— 改域名或标签时漏改一处，就会造成跨站链接漂移。
 * 本脚本抽取三处数组字面量并逐字符比对（忽略空白差异），不一致即失败。
 *
 * 用法：node scripts/check-site-nav.mjs
 * 退出码：0 = 一致；1 = 漂移或无法解析。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const TARGETS = [
  ['es-plus-docs', 'es-plus-docs/src/components/layout/AppHeader.vue'],
  ['es-pc', 'es-pc/src/layouts/DocLayout.vue'],
  ['es-eui', 'es-eui/src/App.vue'],
]

/** 抽取 `const SITES = [ ... ]` 的数组字面量（花括号配对，避免正则截断） */
function extractSites(src, rel) {
  const m = src.match(/const\s+SITES\s*=\s*\[/)
  if (!m) {
    console.error(`❌ 未在 ${rel} 找到 const SITES = [`)
    return null
  }
  const open = src.indexOf('[', m.index)
  let depth = 0
  for (let i = open; i < src.length; i++) {
    const ch = src[i]
    if (ch === '[') depth++
    else if (ch === ']') {
      depth--
      if (depth === 0) {
        // 归一化空白后比较（三站缩进/换行可不同，内容必须一致）
        return src.slice(open + 1, i).replace(/\s+/g, ' ').trim()
      }
    }
  }
  console.error(`❌ ${rel} 的 SITES 数组未闭合`)
  return null
}

function main() {
  let fail = false
  const parsed = []

  for (const [name, rel] of TARGETS) {
    const src = readFileSync(join(ROOT, rel), 'utf-8')
    const sites = extractSites(src, rel)
    if (sites === null) {
      fail = true
      continue
    }
    parsed.push([name, sites])
  }

  if (!fail) {
    const [, ref] = parsed[0]
    for (const [name, sites] of parsed.slice(1)) {
      if (sites !== ref) {
        fail = true
        console.error(`❌ ${name} 的 SITES 数组与 ${parsed[0][0]} 不一致：`)
        console.error(`   ${parsed[0][0]}: ${ref}`)
        console.error(`   ${name}: ${sites}`)
      }
    }
  }

  if (fail) {
    console.error('\n三站站点切换器 SITES 数组存在漂移，请保持三处内容一致（改域名/标签时同步三处）。')
    process.exit(1)
  }
  console.log(`✅ 三站 SITES 数组一致（${parsed.length} 处）`)
}

main()
