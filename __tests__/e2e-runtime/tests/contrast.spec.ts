import { test, expect, type Page } from '@playwright/test'

/**
 * 正文对比度回归（审计 §9.10 的延伸）。
 *
 * 为什么要有这一条：`scripts/check-a11y.mjs` 只对 **token 声明的配对** 做数学
 * （`--es-doc-text` / `--es-bg`），它算不出「某条规则实际把 A 色文字放到了 B 色底上」——
 * es-eui 的代码块就是这么坏的：token 配对全绿，渲染出来却是 1.30:1。
 * 这里在真实浏览器里按**最终计算值**复核：文字色 vs 最近的不透明祖先底色。
 *
 * 门槛按 WCAG 2.1：正文 4.5；大字（≥24px，或 ≥18.66px 且 bold）3.0。
 * 跳过三类：色值带 alpha 的文字（渐变字）、祖先里有 background-image 的
 * （图案底算不出平均值）、禁用态与 aria-hidden。
 *
 * ## 为什么不是「全文零违规」
 *
 * 首跑就扫出 40+ 处，全部是**品牌色 token 的既有取值**，不是某次改动引入的：
 * `--es-brand-primary`（#3b82f6）白底 3.68:1、成功绿 #16a34a 白底 3.3:1、
 * 白字压品牌蓝 3.68:1、占位/次要灰 2.3–2.8:1、琥珀 3.1:1。要真修，得改三站共用的
 * 品牌色，属于产品决策（审计 §9.10 已记为债务），不该由一条新守卫顺手定义。
 * 于是门禁分两段：
 *
 *   1. **代码块零容忍** —— `pre` 内的文字必须达标（行内 `<code>` 徽标不算，
 *      那是品牌蓝的行内样式、走基线）。这正是 es-eui 那次 1.30:1 的类别
 *      （深色 `pre` 背景 + 共享 CSS 的深色 `pre code` 文字），也是这条 spec 存在的理由。
 *   2. **其余按已知配对基线** —— 配对（前景 R,G,B > 背景 R,G,B）不在
 *      `KNOWN_PAIRS` 里就红。修好一条无需改基线；出现**新**的一种低对比组合
 *      （比如又有人写了 `color: #999` 压在深底上）会被抓住。
 */

const PAGES = ['/#/', '/#/components/es-form', '/#/ai-crud', '/#/cases']

/**
 * 已知的低对比配对 = 允许清单。键是 `fg R,G,B > bg R,G,B`。
 * 每条都对应审计里记过的品牌色取值；**新增一条都要想清楚为什么**，
 * 因为它是把一个新的可读性缺陷写进基线。
 */
const KNOWN_PAIRS = new Set([
  // 品牌蓝作正文/链接，白底与浅灰底、浅蓝底
  '59,130,246>255,255,255',
  '59,130,246>247,248,250',
  '59,130,246>219,234,254',
  // 白字压品牌蓝（徽标 / 按钮）
  '255,255,255>59,130,246',
  // 深蓝压浅蓝（选中态徽标）
  '37,99,235>219,234,254',
  // 成功绿：正文强调与白底徽标
  '22,163,74>255,255,255',
  '22,163,74>247,248,250',
  '103,194,58>255,255,255',
  // 琥珀（趋势数值）
  '217,119,6>247,248,250',
  // 次要灰 / 占位灰 / 空数据
  '156,163,175>247,248,250',
  '168,171,178>255,255,255',
  '168,171,178>245,247,250',
  '144,147,153>255,255,255',
  '144,147,153>244,244,245',
  '144,147,153>245,247,250',
])

async function contrastViolations(page: Page) {
  return page.evaluate(() => {
    const parse = (s: string) => {
      const m = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/)
      if (!m) return null
      return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] }
    }
    const lum = (c: { r: number; g: number; b: number }) => {
      const f = (v: number) => {
        v /= 255
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
      }
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
    }
    const ratio = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) => {
      const l1 = lum(a)
      const l2 = lum(b)
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
    }
    /** 向上找第一个不透明背景；遇到 background-image 就放弃（算不出图案的平均色） */
    const bgOf = (el: Element) => {
      for (let n: Element | null = el; n; n = n.parentElement) {
        const cs = getComputedStyle(n)
        if (cs.backgroundImage && cs.backgroundImage !== 'none') return null
        const c = parse(cs.backgroundColor)
        if (c && c.a >= 0.9) return c
      }
      return { r: 255, g: 255, b: 255 }
    }

    const out: {
      text: string
      fg: string
      bg: string
      ratio: number
      size: number
      key: string
      inCode: boolean
    }[] = []
    for (const el of document.querySelectorAll('body *')) {
      // 只看直接承载文字的叶子元素：父容器会重复统计同一段文字
      const hasText = [...el.childNodes].some(
        (n) => n.nodeType === Node.TEXT_NODE && (n.textContent || '').trim().length > 0,
      )
      if (!hasText) continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none') continue
      if (Number(cs.opacity) < 0.6) continue
      const r = el.getBoundingClientRect()
      if (r.width < 4 || r.height < 4) continue
      if (el.closest('[disabled], [aria-disabled="true"], [aria-hidden="true"]')) continue
      const fg = parse(cs.color)
      if (!fg || fg.a < 1) continue
      const bg = bgOf(el)
      if (!bg) continue
      const size = parseFloat(cs.fontSize)
      const bold = Number(cs.fontWeight) >= 700
      const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5
      const value = ratio(fg, bg)
      if (value >= need) continue
      out.push({
        text: (el.textContent || '').trim().slice(0, 40),
        fg: cs.color,
        bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`,
        ratio: Math.round(value * 100) / 100,
        size,
        // 基线键：与写成什么字符串无关，只比数值（`rgb(59, 130, 246)` vs `rgb(59,130,246)` 同键）
        key: `${Math.round(fg.r)},${Math.round(fg.g)},${Math.round(fg.b)}>${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)}`,
        // 只认代码块（`pre` 内）—— 行内 `<code>` 徽标走的是品牌蓝，属于下面的基线
        inCode: !!el.closest('pre'),
      })
    }
    out.sort((a, b) => a.ratio - b.ratio)
    return out.slice(0, 200)
  })
}

const DESKTOP = { width: 1440, height: 900 }

const fmt = (b: { text: string; fg: string; bg: string; ratio: number; size: number }) =>
  `  "${b.text}" ${b.fg} on ${b.bg} = ${b.ratio}:1 (${b.size}px)`

for (const path of PAGES) {
  test(`对比度：${path} 代码块达标、无基线之外的低对比正文`, async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    // domcontentloaded：默认 load 会被 gc.zgo.at 拖到超时（见 layout.spec.ts 头注）
    await page.goto(path, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1200)

    const bad = await contrastViolations(page)

    // 1) 代码块零容忍：这是 es-eui 1.30:1 那次事故的类别，也是这条 spec 的理由
    const inCode = bad.filter((b) => b.inCode)
    expect(
      inCode,
      `${path} 有 ${inCode.length} 处代码块文字低于 WCAG 阈值：\n` + inCode.map(fmt).join('\n'),
    ).toEqual([])

    // 2) 其余只拦「新配对」：品牌色等既有取值在 KNOWN_PAIRS 里
    const unknown = bad.filter((b) => !b.inCode && !KNOWN_PAIRS.has(b.key))
    expect(
      unknown,
      `${path} 出现 ${unknown.length} 处基线之外的低对比配对（正文 4.5 / 大字 3.0）：\n` +
        unknown.map((b) => `${fmt(b)}\n    键：'${b.key}'`).join('\n') +
        '\n  若是既有的品牌色取值，把配对加进 KNOWN_PAIRS 并注明来源；否则改配色。',
    ).toEqual([])
  })
}
