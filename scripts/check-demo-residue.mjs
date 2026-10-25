#!/usr/bin/env node
/**
 * 示例目录的调试残留守卫：`console.log` 计数必须为 0（白名单除外）。
 *
 * 这条口径写在 docs/internal/example-audit-and-flagship-plan.md §8「无调试残留」里，
 * 但一直**没有守卫**——只靠人肉复查，于是 `vxeOn sort-change` 那行日志在案例页里活了很久：
 * 观众点了表头排序，屏幕上没有任何变化，结论只落在控制台。
 *
 * 扫描范围只含**示例组件**（.vue）：
 *   · `es-plus-docs/src/components/examples/**`  文档站示例
 *   · `es-pc/src/views/**`                        Ant Design Vue 站示例（页面即示例）
 *   · `es-eui/src/examples/**`                    Vue 2 站示例
 *
 * 刻意不扫的东西：
 *   · `.md` 里的代码块 —— 文档正文里的 `console.log` 常常是在讲「拿到什么参数」，
 *     删掉反而讲不清；
 *   · 站点基础设施（`utils/server/request.js` 之类）—— 不是示例。
 *
 * 白名单是**逐文件**列出的，且每条都写清理由；新增白名单等于承认「这里允许残留」，
 * 应当先问能不能改成页面上可见的结论。
 *
 * 用法：node scripts/check-demo-residue.mjs   → 退出码 0 = 干净；1 = 有残留
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const SCAN_ROOTS = [
  'es-plus-docs/src/components/examples',
  'es-pc/src/views',
  'es-eui/src/examples',
]

/** 允许保留 console.log 的文件（键为相对仓库根的 posix 路径）。 */
const ALLOWLIST = new Map([
  [
    'es-eui/src/examples/vue2-compat/RechargeRecord.vue',
    'D6：刻意保留的「参考示例」，文件头注明调试日志是给人对照用的教学辅助',
  ],
  [
    'es-eui/src/examples/vue2-compat/RechargeForm.vue',
    'D6：同上的参考示例',
  ],
  [
    'es-eui/src/examples/raw-sources.generated.js',
    '生成物：示例源码的快照（由 generate-raw-sources.js 重算，改这里会被覆盖）',
  ],
])

/** 匹配 `console.log(`、`console.warn(`、`console.debug(`，放过 `console.error`（真错误值得留）。 */
const PATTERN = /console\.(?:log|warn|debug)\s*\(/

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue
      walk(abs, out)
    } else if (/\.(vue|jsx?|tsx?)$/.test(entry.name)) {
      out.push(abs)
    }
  }
  return out
}

const hits = []
let scanned = 0

function main() {
  for (const rel of SCAN_ROOTS) {
    for (const abs of walk(join(ROOT, rel))) {
      const key = relative(ROOT, abs).replace(/\\/g, '/')
      if (ALLOWLIST.has(key)) continue
      scanned++
      const lines = readFileSync(abs, 'utf8').split(/\r?\n/)
      lines.forEach((line, i) => {
        if (PATTERN.test(line)) hits.push({ file: key, line: i + 1, text: line.trim() })
      })
    }
  }

  if (hits.length) {
    console.error(`❌ 示例目录存在调试残留 ${hits.length} 处（白名单外）：`)
    for (const h of hits) console.error(`   ${h.file}:${h.line}  ${h.text}`)
    console.error(
      '\n结论要落在页面上：把事件载荷/响应渲染成可见文案（<el-tag>、提示条、结果区），\n' +
        'assert 型的期望写进单测，而不是只 console.log 给人去控制台里找。',
    )
    process.exit(1)
  }

  console.log(
    `✅ 示例目录无调试残留（扫描 ${scanned} 个文件，白名单 ${ALLOWLIST.size} 个文件：` +
      `${[...ALLOWLIST.keys()].join('、')}）`,
  )
}

// 只在直接运行时扫描：被 import 时不得 process.exit 掉调用方（与 gen-cases-metrics 同一条教训）。
if (process.argv[1] && fileURLToPath(import.meta.url) === join(process.argv[1])) main()
