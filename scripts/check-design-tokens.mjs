#!/usr/bin/env node
/**
 * 设计令牌接入守卫（审计 §6.4-1）。
 *
 * 为什么需要它：三站共用 docs/tokens/design-tokens.css，但「共用」靠的是一份
 * **约定** —— 组件里照样能写 `font-size: 42px` / `padding: 60px` / `#409eff`，
 * 构建不会报错，视觉上也不会立刻崩，只是三站慢慢又长回三套字阶与三套间距。
 * 审计里 es-eui 的整屏渐变 hero、四个不同圆角、五档字号就是这么长出来的。
 *
 * ## 口径（先 warn，后收紧）
 *
 * 存量已经很大，一次全红没有意义。所以：
 *   · 首次运行 `--update` 把「每个文件当前的违规条数」写进基线；
 *   · 之后只判**回归**：某个文件的违规数变多，或新文件带着违规进来 → 红；
 *   · 违规变少不会自动改基线（避免基线在本地被悄悄放宽），要显式 `--update`。
 *
 * 计数三类（与审计原文一致）：
 *   A. `font-size` 字面量（白名单：> 48px —— 装饰性大标题，如 404 / hero 大字）；
 *   B. `padding` / `margin` / `gap` 字面量；
 *   C. 十六进制颜色字面量（`transparent` / `currentColor` 不在此列）。
 *
 * 不扫的文件：设计令牌单源本身、由脚本生成的 Element 主题、docs/theme 的分发副本
 * （它们各有 theme:check / element-theme:check 逐字节守卫）、品牌单源。
 *
 * 用法：
 *   node scripts/check-design-tokens.mjs            # 校验（CI）
 *   node scripts/check-design-tokens.mjs --update   # 重写基线
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { dirname, join, relative, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const BASELINE = join(__dirname, 'design-tokens-baseline.json')
const UPDATE = process.argv.includes('--update')

const SITE_ROOTS = ['es-plus-docs/src', 'es-pc/src', 'es-eui/src']
const STYLE_EXT = new Set(['.css', '.scss', '.vue'])

/** 这些文件不是「组件里的样式」，有各自的守卫，扫进来只会添噪。 */
const SKIP = [
  /(^|\/)design-tokens\.css$/,
  /(^|\/)docs-(a11y|chrome|content|footer|layout|notfound)\.css$/,
  /element-theme\.generated\.scss$/,
  /raw-sources\.generated\.js$/,
  /(^|\/)brand\//,
]

const FONT_RE = /font-size\s*:\s*([0-9.]+)(px|rem|em)\b/g
const SPACE_RE = /(?:^|[;{\s])(padding|margin|gap)\s*:\s*[^;{}]*?([0-9.]+)px\b/g
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name)
    const info = statSync(abs)
    if (info.isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue
      walk(abs, out)
    } else if (STYLE_EXT.has(extname(name))) {
      out.push(abs)
    }
  }
  return out
}

const rel = (abs) => relative(ROOT, abs).replace(/\\/g, '/')
const isSkipped = (r) => SKIP.some((re) => re.test(r))

/** .vue 只看 <style> 块：模板里的 href="#/..." 不是颜色字面量。 */
function styleText(abs, src) {
  if (extname(abs) !== '.vue') return src
  const blocks = []
  const re = /<style[^>]*>([\s\S]*?)<\/style>/g
  let m
  while ((m = re.exec(src))) blocks.push(m[1])
  return blocks.join('\n')
}

function countViolations(text) {
  const hits = []
  for (const m of text.matchAll(FONT_RE)) {
    const value = Number(m[1]) * (m[2] === 'px' ? 1 : 16)
    if (value > 48) continue // 装饰性大字白名单
    hits.push(`font-size: ${m[1]}${m[2]}`)
  }
  for (const m of text.matchAll(SPACE_RE)) {
    hits.push(`${m[1]}: ${m[2]}px`)
  }
  for (const m of text.matchAll(HEX_RE)) {
    hits.push(`color ${m[0]}`)
  }
  return hits
}

const counts = {}
const samples = {}
for (const root of SITE_ROOTS) {
  for (const abs of walk(join(ROOT, root))) {
    const r = rel(abs)
    if (isSkipped(r)) continue
    let src
    try {
      src = readFileSync(abs, 'utf8')
    } catch {
      continue
    }
    const hits = countViolations(styleText(abs, src))
    if (!hits.length) continue
    counts[r] = hits.length
    samples[r] = hits.slice(0, 3)
  }
}

if (UPDATE) {
  const ordered = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(BASELINE, JSON.stringify(ordered, null, 2) + '\n')
  const total = Object.values(ordered).reduce((n, v) => n + v, 0)
  console.log(`✅ 已写入基线 scripts/design-tokens-baseline.json：${Object.keys(ordered).length} 个文件 / ${total} 处`)
  process.exit(0)
}

if (!existsSync(BASELINE)) {
  console.error('❌ 缺少 scripts/design-tokens-baseline.json —— 先运行 node scripts/check-design-tokens.mjs --update')
  process.exit(1)
}
const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))

const regressions = []
for (const [file, n] of Object.entries(counts)) {
  const was = baseline[file] ?? 0
  if (n > was) regressions.push({ file, was, now: n, samples: samples[file] })
}

const total = Object.values(counts).reduce((n, v) => n + v, 0)
const baseTotal = Object.values(baseline).reduce((n, v) => n + v, 0)

if (regressions.length) {
  console.error(`❌ 设计令牌回归：${regressions.length} 个文件新增了字面量（基线 ${baseTotal} 处 → 当前 ${total} 处）\n`)
  for (const r of regressions.slice(0, 20)) {
    console.error(`   - ${r.file}：${r.was} → ${r.now}（例：${r.samples.join(' / ')}）`)
  }
  console.error('\n修法：换成 var(--es-text-*) / var(--es-space-*) / 令牌色；确属装饰性大字（>48px）可保留。')
  console.error('若确认新增是有意的，运行 node scripts/check-design-tokens.mjs --update 并说明理由。')
  process.exit(1)
}

const improved = Object.entries(baseline).filter(([f, n]) => (counts[f] ?? 0) < n)
console.log(
  `✅ 设计令牌无回归（存量基线 ${baseTotal} 处 / ${Object.keys(baseline).length} 个文件；当前 ${total} 处${
    improved.length ? `；${improved.length} 个文件已减少，可运行 --update 收紧基线` : ''
  }）`
)
