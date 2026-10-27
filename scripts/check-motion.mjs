#!/usr/bin/env node
/**
 * 动效语言守卫（路线图 2.8）
 *
 * 验收口径只有四句：**150–240ms；只用于状态；reduced-motion；无无限 shimmer**。
 * 这四句都守不住「人眼看」的检查 —— 加一个 0.5s 的渐入、一个 20s 漂移的光斑、
 * 一条 transition: all，本地看着都挺顺，三站各写各的之后就再也对不齐了。所以：
 *
 *   A. token 在：三站 design-tokens.css 都有 fast/base/slow/ease，且数值就是 120/180/240。
 *   B. 只用 token：transition / animation 里不许出现字面量时长（ms / s）。
 *      唯一的例外是**加载指示器**（无限循环的「正在输入」之类）—— 它们有自己的呼吸
 *      周期，不是状态切换；例外必须写进下面的 ALLOW，而不是让守卫瞎猜。
 *   C. 不对 all 做动画：`transition: all` 会顺带把布局属性一起动画化（重排 ×N）。
 *   D. 不对布局属性做动画：width / height / padding / margin / top / left / right 一律不允许
 *      —— 这类过渡每帧都在重排，且 reduced-motion 之外没有便宜的降级方式。
 *   E. 无无限循环：`infinite` 只允许出现在 ALLOW 里的加载指示器上。
 *   F. reduced-motion：三站的 docs-a11y.css 都有那条 `prefers-reduced-motion` 兜底
 *      （animation-duration / iteration-count / transition-duration / scroll-behavior 四件套）。
 *   G. 扫描面：每个站点扫到的文件数不能骤降，否则「0 处问题」是假绿。
 *
 * 用法：node scripts/check-motion.mjs
 * 退出码：0 = 通过；1 = 有违规。
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const SITES = [
  // minFiles 取实测值的 ~88%：目录结构变了要重新数，否则守卫会因为「扫得少了」假绿
  { dir: 'es-plus-docs/src', tokens: 'es-plus-docs/src/styles/design-tokens.css', a11y: 'es-plus-docs/src/styles/docs-a11y.css', minFiles: 132 },
  { dir: 'es-pc/src', tokens: 'es-pc/src/styles/design-tokens.css', a11y: 'es-pc/src/styles/docs-a11y.css', minFiles: 128 },
  { dir: 'es-eui/src', tokens: 'es-eui/src/assets/design-tokens.css', a11y: 'es-eui/src/assets/docs-a11y.css', minFiles: 130 },
]

/**
 * 加载指示器白名单：无限循环 + 自有时长，都是「进程在跑」的信号，不是装饰。
 * key = 仓库相对路径；value = 该文件里允许出现的动画花括号里的片段。
 */
const ALLOW = {
  'es-plus-docs/src/components/ai-crud/ChatComposer.vue': ['dot-bounce 1.2s infinite'],
}

// 会触发重排的属性：过渡它们等于每帧让浏览器重算布局。
// gap / flex-basis 这类同样算 —— 它们不写 width，但改动后兄弟节点全要重新排。
const LAYOUT_PROPS = [
  'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
  'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
  'margin', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
  'top', 'left', 'right', 'bottom', 'inset',
  'gap', 'row-gap', 'column-gap', 'flex-basis', 'flex-grow',
  'font-size', 'line-height', 'letter-spacing',
]

const failures = []
const fail = (msg) => failures.push(msg)

function read(rel) {
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) {
    fail(`${rel}：文件不存在`)
    return ''
  }
  return readFileSync(abs, 'utf8').replace(/\r\n/g, '\n')
}

function walk(dir, out) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry)
    if (statSync(abs).isDirectory()) {
      if (!/node_modules|[\\/]dist/.test(abs)) walk(abs, out)
    } else if (/\.(vue|css|scss)$/.test(entry)) {
      out.push(abs)
    }
  }
}

/* ------------------------------------------------------------------ *
 * A. token 在不在
 * ------------------------------------------------------------------ */
const TOKENS = { '--es-duration-fast': '120ms', '--es-duration-base': '180ms', '--es-duration-slow': '240ms' }
for (const site of SITES) {
  const css = read(site.tokens)
  if (!css) continue
  for (const [name, value] of Object.entries(TOKENS)) {
    const m = new RegExp(`${name}:\\s*([^;]+);`).exec(css)
    if (!m) fail(`${site.tokens}：缺少 ${name}`)
    else if (m[1].trim() !== value) {
      fail(`${site.tokens}：${name} 应为 ${value}，实际 ${m[1].trim()} —— 三站的时长必须同源`)
    }
  }
  if (!/--es-ease:\s*cubic-bezier\(/.test(css)) fail(`${site.tokens}：缺少 --es-ease 缓动 token`)
}

/* ------------------------------------------------------------------ *
 * B–E. 逐文件检查 transition / animation
 * ------------------------------------------------------------------ */
for (const site of SITES) {
  const files = []
  try {
    walk(join(ROOT, site.dir), files)
  } catch {
    fail(`${site.dir}：目录不存在`)
    continue
  }
  if (files.length < site.minFiles) {
    fail(`${site.dir}：只扫到 ${files.length} 个文件（预期 ≥ ${site.minFiles}）—— 扫描面缩小会让这条守卫假绿`)
  }

  for (const abs of files) {
    const rel = relative(ROOT, abs).split('\\').join('/')
    const source = readFileSync(abs, 'utf8').replace(/\r\n/g, '\n')
    const allow = ALLOW[rel] || []
    const lineOf = (index) => source.slice(0, index).split('\n').length

    for (const m of source.matchAll(/\b(transition|animation)\s*:\s*([^;}]+)/g)) {
      const decl = m[2].replace(/\s+/g, ' ').trim()
      const at = `${rel}:${lineOf(m.index)}`

      if (!allow.some((a) => decl.includes(a))) {
        if (/\b\d+(\.\d+)?m?s\b/.test(decl)) {
          fail(`${at}：${m[1]} 用了字面量时长「${decl}」—— 三站统一走 var(--es-duration-fast|base|slow)`)
        }
        if (/\binfinite\b/.test(decl)) {
          fail(`${at}：无限循环动效「${decl}」—— 只有加载指示器可以 infinite，且必须登记在 ALLOW`)
        }
      }

      if (m[1] === 'transition') {
        if (/(^|,\s*)all\b/.test(decl)) {
          fail(`${at}：transition: all 会把布局属性一起动画化 —— 请列出真正要过渡的属性`)
        }
        for (const prop of LAYOUT_PROPS) {
          if (new RegExp(`(^|,\\s*)${prop}\\s`).test(decl)) {
            fail(`${at}：对布局属性 ${prop} 做过渡（${decl}）—— 每帧重排，换成 opacity / transform`)
          }
        }
      }
    }

    // animation-duration / transition-duration 长写形式同样不许字面量
    for (const m of source.matchAll(/\b(animation|transition)-duration\s*:\s*([^;}]+)/g)) {
      const decl = m[2].replace(/\s+/g, ' ').trim()
      if (/^\s*0\.01ms/.test(decl)) continue // reduced-motion 兜底，刻意保留
      if (/\b\d+(\.\d+)?m?s\b/.test(decl) && !(ALLOW[rel] || []).some((a) => decl.includes(a))) {
        fail(`${rel}:${lineOf(m.index)}：${m[1]}-duration 用了字面量「${decl}」`)
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 * F. reduced-motion 兜底
 * ------------------------------------------------------------------ */
const MOTION_QUERIES = ['animation-duration', 'animation-iteration-count', 'transition-duration', 'scroll-behavior']
for (const site of SITES) {
  const css = read(site.a11y)
  if (!css) continue
  const at = css.indexOf('@media (prefers-reduced-motion: reduce)')
  if (at < 0) {
    fail(`${site.a11y}：缺少 prefers-reduced-motion 兜底`)
    continue
  }
  // 取该 @media 块（花括号配对）
  let depth = 0
  let block = ''
  for (let i = css.indexOf('{', at); i < css.length; i += 1) {
    if (css[i] === '{') depth += 1
    else if (css[i] === '}') {
      depth -= 1
      if (depth === 0) {
        block = css.slice(at, i + 1)
        break
      }
    }
  }
  for (const decl of MOTION_QUERIES) {
    if (!block.includes(decl)) fail(`${site.a11y}：reduced-motion 块缺 ${decl}`)
  }
}

/* ------------------------------------------------------------------ *
 * 汇总
 * ------------------------------------------------------------------ */
if (failures.length) {
  console.error('❌ 动效不符合路线图 2.8：\n')
  for (const f of failures) console.error(`   - ${f}`)
  console.error('\n动效只描述状态：120/180/240ms、只动 opacity / transform / 颜色类、尊重 reduced-motion。')
  process.exit(1)
}

console.log('✅ 动效：三站 token 同源（120/180/240 + ease）、无字面量时长、无 transition: all、无装饰性无限循环、reduced-motion 齐全')
