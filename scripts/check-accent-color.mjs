#!/usr/bin/env node
/**
 * 强调色守卫（路线图 2.7：一个强调色）。
 *
 * 审计 §6.6 的口径是「一个页面最多一个强调色；AI 相关页面用品牌青作为强调，不再
 * 新增紫 / 琥珀 / 彩虹」。此前三个站点散着 82 处非品牌色：AI 页一律紫
 * （#6f42c1 → #a855f7）、片段拼装琥珀、eui 首页与指南页各配一套彩虹渐变。
 * 这些颜色都不是「设计决定」，是每张卡各自「想不一样一点」的沉淀 —— 于是
 * 一屏之内出现四五个强调色，读者只学到「这里没有系统」。
 *
 * 校验项：
 *   A. 三站 src 下的 .vue / .css / .scss 不得出现 DENY 里的色值（每条都写清
 *      该换成哪个 token，红的时候能直接照着改）；
 *   B. DENY 里不得混进品牌色 —— 防「为了让守卫变绿，把品牌青也加进黑名单」。
 *
 * 刻意**不**在范围内的两种「配色」：
 *   · 自定义属性定义（`--x: #hex`）：token 文件就是给颜色起名字的地方，它必须
 *     写具体色值；页面该引用名字，而不是回头抄色值 —— 所以这一行豁免；
 *   · 代码高亮主题（.hljs-*）与示例源码（src/examples、*.generated.js）：前者
 *     是给代码读的语法色板（字符串绿 / 关键字紫是跨语言约定），后者是**展示给
 *     读者看的用户代码**，里面的 #409eff 是在演示 Element Plus 的默认色。
 *
 * 用法：node scripts/check-accent-color.mjs
 * 退出码：0 = 通过；1 = 有非品牌色。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, extname, sep } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const SITES = ['es-plus-docs', 'es-pc', 'es-eui']

/**
 * 历史遗留的非品牌色 → 该换成的 token。
 * 判断标准只有一条：**它是不是本站在用的品牌色阶**。品牌蓝的三级色阶
 * #93c5fd / #3b82f6 / #1d4ed8 用在流程类图表（同一件事的三个阶段），算品牌色阶；
 * #06b6d4 就是 --es-brand-accent，必须留在黑名单外面。
 */
const DENY = new Map([
  ['#6f42c1', 'AI 紫 → var(--es-brand-primary)'],
  ['#a855f7', '紫 → var(--es-brand-accent)'],
  ['#b45309', '琥珀 → 语义色用 var(--es-warning-text)，强调用 var(--es-brand-strong)'],
  ['#f59e0b', '琥珀 → 语义色用 var(--es-warning)，流程图表用品牌蓝色阶'],
  ['#0e7490', '青绿深调 → var(--es-brand-strong)'],
  ['#a8edea', '彩虹浅青 → var(--es-brand-tint)'],
  ['#fed6e3', '彩虹浅粉 → var(--es-brand-tint)'],
  ['#30cfd0', '彩虹青 → var(--es-brand-accent)'],
  ['#330867', '彩虹深紫 → var(--es-brand-primary)'],
  ['#41b883', 'Vue 绿 → var(--es-brand-primary)'],
  ['#34495e', '深蓝灰 → var(--es-brand-strong)'],
  ['#ff6b6b', '珊瑚红 → var(--es-danger)'],
  ['#feca57', '琥珀黄 → var(--es-warning)'],
  ['#43e97b', '荧光绿 → var(--es-brand-accent)'],
  ['#38f9d7', '荧光青 → var(--es-brand-accent)'],
  // 第二类：语义状态色被手写成十六进制 —— 名字里的 token 在 dark 主题下有另一套值，
  // 手写的 hex 在深色下就是一块白斑。
  ['#fffbeb', '警告浅底 → var(--es-warning-tint)'],
  ['#fef3c7', '警告浅底 → var(--es-warning-tint)'],
  ['#fde68a', '警告边框 → var(--es-warning)'],
  ['#fffbe6', '警告浅底 → var(--es-warning-tint)'],
  ['#fff1b8', '警告浅底 → var(--es-warning-tint)'],
  ['#faad14', '警告色 → var(--es-warning)'],
  ['#d48806', '警告文字 → var(--es-warning-text)'],
  ['#92400e', '警告文字 → var(--es-warning-text)'],
  ['#78350f', '警告文字 → var(--es-warning-text)'],
  ['#f6ffed', '成功浅底 → var(--es-success-tint)'],
  ['#d9f7be', '成功浅底 → var(--es-success-tint)'],
  ['#389e0d', '成功文字 → var(--es-success-text)'],
  ['#f0f7ff', '提示浅底 → var(--es-info-tint)'],
  ['#e6f7ff', '提示浅底 → var(--es-info-tint)'],
  ['#bae7ff', '提示浅底 → var(--es-info-tint)'],
  ['#096dd9', '提示文字 → var(--es-info-text)'],
  ['#0369a1', '天蓝实底 / 文字 → 强调用品牌渐变，信息态用 var(--es-info-text)'],
  ['#e0f2fe', '天蓝浅底 → var(--es-info-tint)'],
  ['#dcfce7', '绿浅底 → var(--es-success-tint)'],
  ['#f0fdf4', '绿浅底 → var(--es-success-tint)'],
  ['#15803d', '绿实底 / 文字 → var(--es-success)（实底）或 var(--es-success-text)'],
  ['#16a34a', '绿 → var(--es-success)'],
])

/** 品牌色阶：黑名单里出现任何一个都算错（见校验项 B）。 */
const BRAND = ['#3b82f6', '#dbeafe', '#06b6d4', '#2563eb', '#60a5fa', '#93c5fd', '#1d4ed8']

/**
 * 示例源码不算本站配色：三个站点的演示文件放在三处约定目录里（主站
 * `components/examples/<family>/`、es-pc `views/es-<family>/`、es-eui `examples/<family>/`），
 * 它们**是展示给读者看的用户代码** —— 里面的 #409eff / #67c23a 是在演示原生
 * Element 的默认色，改成本站 token 反而会让「原生写法」这一栏说假话。
 */
const isDemoSource = (rel) =>
  /\/(components\/)?examples\//.test(rel) || /es-pc\/src\/views\/es-[a-z]+\//.test(rel)

function walk(rel, out = []) {
  let entries
  try {
    entries = readdirSync(join(ROOT, rel), { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const child = join(rel, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist') continue
      walk(child, out)
    } else if (['.vue', '.css', '.scss'].includes(extname(e.name))) {
      out.push(child.split(sep).join('/'))
    }
  }
  return out
}

const failures = []
const fail = (msg) => failures.push(msg)

/**
 * 自定义属性定义是「给颜色起名字」的地方，它必须写具体色值 —— 从行里摘掉再判。
 * 按声明摘而不是按行摘：本仓大量用法是单行 `&.cyan { --x: #fff; }`，按行摘会漏。
 */
const stripCustomProps = (line) => line.replace(/--[a-z0-9-]+\s*:\s*[^;{}]*;?/gi, '')

// ── A. 不得出现历史遗留的紫 / 琥珀 / 彩虹 ────────────────────────
let scanned = 0
let demo = 0
for (const site of SITES) {
  for (const rel of walk(`${site}/src`)) {
    if (isDemoSource(rel)) {
      demo++
      continue
    }
    scanned++
    readFileSync(join(ROOT, rel), 'utf8')
      .split(/\r?\n/)
      .forEach((line, i) => {
        if (!line.includes('#') || /hljs/.test(line)) return // 代码高亮色板，见文件头
        const lower = stripCustomProps(line).toLowerCase()
        for (const [hex, hint] of DENY) {
          if (lower.includes(hex)) fail(`${rel}:${i + 1}：${hex} —— ${hint}`)
        }
      })
  }
}

// 扫描面缩小会让「0 处问题」变成假绿。两个下限都要：页面文件数（豁免之外）
// 与豁免文件数本身 —— 否则把豁免写宽，扫到的文件悄悄少一半也没人发现。
if (scanned < 130) fail(`只扫到 ${scanned} 个页面样式文件（预期 ≥ 130）—— 扫描面缩小会让这条守卫假绿`)
if (demo < 250) fail(`只认出 ${demo} 个示例源码文件（预期 ≥ 250）—— 豁免面缩小意味着约定目录变了`)

// ── B. 黑名单清单自身不得误伤品牌色 ──────────────────────────────
for (const hex of DENY.keys()) {
  if (BRAND.includes(hex)) fail(`黑名单混进了品牌色 ${hex} —— #06b6d4 就是 --es-brand-accent，必须留在外面`)
}

if (failures.length) {
  console.error(`❌ 仍有 ${failures.length} 处非品牌色：\n`)
  for (const f of failures.slice(0, 40)) console.error(`   - ${f}`)
  if (failures.length > 40) console.error(`   … 另有 ${failures.length - 40} 处`)
  console.error('\n一个页面一个强调色：AI 相关内容用品牌色，状态用语义 token，图表用品牌色阶。')
  process.exit(1)
}

console.log(
  `✅ 三站 ${scanned} 个样式文件无紫 / 琥珀 / 彩虹残留（${DENY.size} 条历史色值），品牌色未进黑名单；` +
    `示例源码 ${demo} 个文件按约定豁免（它们展示的是原生组件的默认色）`,
)
