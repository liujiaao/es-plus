import { test, expect, type Page } from '@playwright/test'

/**
 * 首页 / 文档页的**版式回归**（审计 §6.4-2、§8）。
 *
 * ## 为什么不是像素级截图 diff
 *
 * 审计原文建议 Playwright `toHaveScreenshot`（阈值 0.1%）。这里没有照搬：
 * 截图基线绑死字体渲染，而主站中文走系统字体栈（PingFang / 微软雅黑 / Noto），
 * 同一张基线在 Windows 开发机与 Linux CI 上必然对不上 —— 那样的门禁第一次进 CI
 * 就会红，随后被 `--update` 一键洗白，等于没有。这里改守**版式不变量**：
 * 高度、section 数、首屏图尺寸、横向溢出、表格滚动能力。它们跨字体稳定，且正好
 * 对应审计里被反复改坏的五件事（首页长回 8,935px、H1 换回品牌名、表格在手机上被压扁……）。
 *
 * ## 覆盖
 *
 * 只跑主站（与 mobile.spec.ts 同一条 dev server，不增加 CI 成本）。
 * es-pc / es-eui 的对应结构断言在 `scripts/check-landing.mjs` 与
 * `scripts/check-mobile.mjs` 里做静态版本 —— 那两站起 dev server 的代价见
 * mobile.spec.ts 头注，这是已知缺口，不是覆盖。
 */

const DESKTOP = { width: 1440, height: 900 }
const MOBILE = { width: 390, height: 844 }

async function overflowX(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
}

/** 等到 DOM 就绪即可：默认的 `load` 会等**所有**第三方资源，无外网的 CI 上
 *  GoatCounter（gc.zgo.at）会把 goto 拖到 30s 超时，红的是网络而不是版式。
 *  本文件要断言的元素都在下面显式 waitFor，不依赖 load。 */
async function gotoApp(page: Page, hash: string) {
  await page.goto(hash, { waitUntil: 'domcontentloaded' })
}

test('首页：section ≤ 6、总高 ≤ 5,000、H1 不是品牌名、首屏有 ≥800px 产品图', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await gotoApp(page, '/#/')
  // 首屏实拍是 eager 加载的；等它解码完再量尺寸
  await page.locator('.hero-section img').first().waitFor({ state: 'visible' })

  const stats = await page.evaluate(() => {
    const home = document.querySelector('.home-page') as HTMLElement | null
    const sections = home ? [...home.querySelectorAll(':scope > section')] : []
    const h1 = document.querySelector('h1') as HTMLElement | null
    const img = document.querySelector('.hero-section img') as HTMLImageElement | null
    return {
      height: document.body.scrollHeight,
      sections: sections.length,
      h1: (h1?.innerText || '').trim(),
      imgNatural: img?.naturalWidth || 0,
      imgRendered: Math.round(img?.getBoundingClientRect().width || 0),
    }
  })

  expect(stats.sections, '首页 section 数超过 6 —— 每多一屏都在稀释首屏').toBeGreaterThanOrEqual(4)
  expect(stats.sections).toBeLessThanOrEqual(6)
  expect(stats.height, '首页总高超过 5,000px（审计 §8 验收；旧版 8,935px，当前约 4,632px）').toBeLessThanOrEqual(5000)
  expect(stats.h1, 'H1 不能是品牌名，要说价值主张').not.toMatch(/^ES-Plus$/i)
  expect(stats.h1.length).toBeGreaterThan(4)
  expect(stats.imgRendered, '首屏产品实拍渲染宽度 < 800px，图里的表格读不清').toBeGreaterThanOrEqual(800)
  expect(stats.imgNatural, '首屏产品实拍自然宽度 < 800px（放大会糊）').toBeGreaterThanOrEqual(800)
})

test('首页：390×844 无横向溢出，首屏实拍仍在首屏内', async ({ page }) => {
  await page.setViewportSize(MOBILE)
  await gotoApp(page, '/#/')
  await page.locator('.hero-section img').first().waitFor({ state: 'visible' })
  expect(await overflowX(page)).toBeLessThanOrEqual(1)

  const shotTop = await page.evaluate(() => {
    const img = document.querySelector('.hero-section img') as HTMLElement | null
    return img ? Math.round(img.getBoundingClientRect().top + window.scrollY) : -1
  })
  // 首屏（844px）之内要看到实拍的开头，否则「证据」被挤到第二屏
  expect(shotTop).toBeGreaterThan(0)
  expect(shotTop).toBeLessThan(844)
})

test('组件文档页：390 下无横向溢出，演示表格可横滑而不是被压扁', async ({ page }) => {
  await page.setViewportSize(MOBILE)
  await gotoApp(page, '/#/components/es-table')
  await page.locator('.el-table').first().waitFor({ state: 'visible' })

  expect(await overflowX(page)).toBeLessThanOrEqual(1)

  const table = await page.evaluate(() => {
    const el = document.querySelector('.el-table') as HTMLElement | null
    if (!el) return null
    const wrap = el.querySelector('.el-scrollbar__wrap') as HTMLElement | null
    const body = el.querySelector('.el-table__body') as HTMLElement | null
    return {
      wrapOverflowX: wrap ? getComputedStyle(wrap).overflowX : null,
      wrapCanScroll: wrap ? wrap.scrollWidth > wrap.clientWidth : false,
      bodyWidth: body ? Math.round(body.getBoundingClientRect().width) : 0,
    }
  })
  expect(table, '组件文档页找不到 .el-table（选择器或页面结构变了）').not.toBeNull()
  // 表格要么窄到不需要横滑，要么容器真的能横滑 —— 不能是「列被压成一条线」
  const fits = (table?.bodyWidth ?? 0) <= 360
  expect(fits || table?.wrapOverflowX === 'auto').toBe(true)
  expect(fits || table?.wrapCanScroll).toBe(true)
})
