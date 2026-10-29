#!/usr/bin/env node
/**
 * 三端站点的「窄屏可达性」静态守卫。
 *
 * ## 为什么需要它
 *
 * 三端站点都做了移动端适配（主站 1200/768 两档、es-pc 992 一档、es-eui 769 一档），
 * 但这些适配**没有任何回归网**：`check:*` 全是静态的、都不看断点，Tier 2 运行时 e2e
 * 只跑桌面 Chrome。于是「删掉一个 `@media` 块」「把 aria-expanded 写成静态字符串」
 * 「新增站点忘了 viewport 元标签」这三类事故都会一路绿到线上 —— 而它们的共同后果是
 * **手机上根本打不开导航**：读者进得来页面，却找不到第二个页面。
 *
 * ## 它证明什么、不证明什么
 *
 * 这里只证明**入口存在且是活的**（四条结构性不变量），不证明布局正确 ——
 * 宽度溢出、遮挡、点击目标尺寸这些只有真浏览器能判。
 * 行为由 `__tests__/e2e-runtime/tests/mobile.spec.ts`（390×844，主站）覆盖。
 *
 * 三条不对称是**已知缺口，不是覆盖**，写在这里以免被误读成「三端都验过了」：
 *   · 行为腿只有主站。es-pc 的 dev server 要 `@es-plus/adapter-antdv` 的 dist、
 *     es-eui 是 vue-cli（webpack）冷启动 30 s+，塞进现有 10 分钟的 runtime-e2e job
 *     会把一条稳定的链变成不稳定的链 —— 静态四条对它们是全部覆盖。
 *
 * ## 四条不变量（每站）
 *
 *   1. `viewport` 元标签带 `width=device-width` —— 缺了它，移动浏览器按 980px 渲染，
 *      所有断点永不触发，**桌面布局在手机上「正常工作」**，问题因此极其隐蔽。
 *   2. 布局源里存在一个开关元素，带 `:aria-expanded` **绑定**与可读标签
 *      （`aria-label` / `aria-labelledby` / 自身文本）。写死的 `aria-expanded="false"`
 *      对读屏软件永远报「已折叠」，等于告诉用户菜单不可用。
 *   3. 该开关在桌面隐藏（它自己的类有一条 `display: none` 基础规则）。
 *   4. 同一文件里有 `@media (max-width: …)` 分支 —— 断点分支被整体删除时，
 *      开关会在桌面上常驻，而 3 仍然绿。
 *
 * 用法：node scripts/check-mobile.mjs
 * 退出码：0 = 三站入口齐备且是活的；1 = 有站点缺项。
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

/**
 * 失败计数（不是布尔）：逐站打印「这一段有没有新增失败」要一个可比较的窗口，
 * 否则第一站红了之后，后面两站的 ✅ 也一并消失，读日志的人会以为三站都坏了。
 */
let failedCount = 0
const fail = (msg) => {
  failedCount++
  console.error(`❌ ${msg}`)
}
const ok = (msg) => console.log(`✅ ${msg}`)

/**
 * 每站：index.html + 承载「窄屏导航开关」的布局源文件。
 * 开关文件不是随便选的 —— 它必须是渲染顶栏/侧栏的那个组件，否则第 3 条
 * （开关自己的样式规则在同一文件里）无从谈起。
 */
const SITES = [
  {
    name: '主文档站',
    dir: 'es-plus-docs',
    index: 'es-plus-docs/index.html',
    layout: 'es-plus-docs/src/components/layout/AppHeader.vue',
  },
  {
    name: 'es-pc（Ant Design Vue）',
    dir: 'es-pc',
    index: 'es-pc/index.html',
    layout: 'es-pc/src/layouts/DocLayout.vue',
  },
  {
    name: 'es-eui（Element UI / Vue 2）',
    dir: 'es-eui',
    index: 'es-eui/public/index.html',
    layout: 'es-eui/src/App.vue',
  },
]

/** 读取并去掉注释，避免把注释里的示例代码当成实现 */
function readSource(rel) {
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) return null
  return readFileSync(abs, 'utf-8')
}

// ── 1. viewport 元标签 ───────────────────────────────────
function checkViewport(site) {
  const html = readSource(site.index)
  if (html === null) {
    fail(`${site.index} 不存在 —— 站点入口换了路径要同步本脚本`)
    return
  }
  const meta = html.match(/<meta\s+name=["']viewport["'][^>]*>/i)
  if (!meta) {
    fail(
      `${site.name}: ${site.index} 没有 viewport 元标签 —— 移动浏览器会按 980px 渲染，`
        + '所有 max-width 断点永不触发，手机上看的是桌面布局（且页面看起来「没坏」）',
    )
    return
  }
  // content 可能在 name 之后（两种写法都合法），单独在整段 content 里找
  if (!/width\s*=\s*device-width/i.test(meta[0])) {
    fail(`${site.name}: viewport 的 content 缺 width=device-width（当前：${meta[0]}）`)
  }
}

// ── 2/3/4. 开关存在、活着、桌面隐藏、有断点分支 ────────────
function checkToggle(site) {
  const before = failedCount
  const src = readSource(site.layout)
  if (src === null) {
    fail(`${site.layout} 不存在 —— 布局组件改名/搬家要同步本脚本`)
    return
  }

  // 2. 找到带 `:aria-expanded` 绑定的那个开标签。
  //    绑定 = 冒号前缀（Vue）或 v-bind:，写死成 `aria-expanded="false"` 不算。
  const binding = src.search(/(?::|v-bind:)aria-expanded\s*=/)
  if (binding === -1) {
    fail(
      `${site.name}: ${site.layout} 里没有「:aria-expanded 绑定」的开关元素 —— `
        + '要么窄屏导航入口被删了，要么把展开状态写死了（写死时读屏软件永远报「已折叠」）',
    )
    return
  }
  // 向前找到这个元素的 `<`，向后找到 `>`，取整段开标签
  const openAt = src.lastIndexOf('<', binding)
  const closeAt = src.indexOf('>', binding)
  if (openAt === -1 || closeAt === -1) {
    fail(`${site.name}: 无法定位 :aria-expanded 所在元素（${site.layout}:${lineOf(src, binding)}）`)
    return
  }
  const tag = src.slice(openAt, closeAt + 1)
  const lineNo = lineOf(src, binding)

  // 2b. 可读标签：aria-label / aria-labelledby 绑定，或元素内有文本内容。
  //     元素内文本要看模板（`>` 之后到下一个 `<`），这里只做近距离判定。
  const hasLabel =
    /(?::|v-bind:)?aria-label\s*=/.test(tag) ||
    /aria-labelledby\s*=/.test(tag)
  if (!hasLabel) {
    fail(
      `${site.name}: 窄屏开关（${site.layout}:${lineNo}）没有 aria-label / aria-labelledby —— `
        + '只放一个图标的按钮在无障碍树里是无名按钮',
    )
  }

  // 3. 取出开关的类名（用来定位它自己的样式规则）
  const clsMatch = tag.match(/\bclass\s*=\s*["']([^"']+)["']/)
  if (!clsMatch) {
    fail(`${site.name}: 窄屏开关（${site.layout}:${lineNo}）没有 class —— 本脚本无法定位它的显示规则`)
    return
  }
  // class 可能是 `a b` 或绑定的对象语法；只取第一个静态类名
  const cls = clsMatch[1].trim().split(/\s+/)[0]
  if (/[{}]/.test(cls)) {
    fail(`${site.name}: 窄屏开关的 class 是动态绑定（${clsMatch[1]}），本脚本需要一个静态类名来核对显示规则`)
    return
  }

  // 在样式里找 `.<cls> { … display: none … }`。
  // 不能用 `\.cls \{[^{}]*\}` 这种正则：三站都是 SCSS/嵌套写法，规则体里还有
  // `&:hover { … }` 之类的子块，花括号一出现非贪婪匹配就整段落空（这正是本脚本
  // 第一版对主站和 es-eui 误报的原因）。改为花括号配对取完整规则体。
  const hiddenAtDesktop = ruleBodies(src, cls).some((body) => /display\s*:\s*none/.test(body))
  if (!hiddenAtDesktop) {
    fail(
      `${site.name}: 开关 .${cls} 在 ${site.layout} 里没有一条 \`display: none\` 基础规则 —— `
        + '它在桌面上会常驻，而桌面已经有完整导航',
    )
  }

  // 4. 断点分支存在（开关要在某个 max-width 下被重新显示）
  if (!/@media\s*\(max-width\s*:/.test(src)) {
    fail(
      `${site.name}: ${site.layout} 里没有任何 \`@media (max-width: …)\` 分支 —— `
        + '断点整段删除后，开关在手机上也不会出现（而第 3 条仍然绿）',
    )
    return
  }

  if (failedCount === before) {
    ok(`${site.name}: viewport + 开关 .${cls}（绑定状态、可读、桌面隐藏）+ 窄屏断点分支`)
  }
}

/**
 * 取出源码里所有 `.cls { … }` 规则的**完整规则体**（花括号配对，含嵌套子块）。
 * 只看 `.cls` 本身，不匹配 `.cls-xxx` / `.clsXxx`。
 */
function ruleBodies(src, cls) {
  const re = new RegExp(`\\.${escapeRe(cls)}(?![\\w-])\\s*\\{`, 'g')
  const bodies = []
  let m
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length - 1 // 指向 `{`
    let depth = 0
    const start = i + 1
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++
      else if (src[i] === '}') {
        depth--
        if (depth === 0) break
      }
    }
    bodies.push(src.slice(start, i))
  }
  return bodies
}

function lineOf(text, idx) {
  let n = 1
  for (let i = 0; i < idx && i < text.length; i++) if (text[i] === '\n') n++
  return n
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

for (const site of SITES) {
  checkViewport(site)
  checkToggle(site)
}

if (failedCount > 0) {
  console.error(`\n窄屏可达性存在 ${failedCount} 处缺口：手机用户可能进得来、出不去。`)
  process.exit(1)
}
console.log(`\n三端站点窄屏入口 ✅（静态四条；行为腿见 __tests__/e2e-runtime/tests/mobile.spec.ts）`)
