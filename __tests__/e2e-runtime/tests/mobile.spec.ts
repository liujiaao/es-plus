import { test, expect, type Page } from '@playwright/test'

/**
 * 主站窄屏行为腿（390×844）—— 静态守卫证明不了的那一半。
 *
 * ## 分工
 *
 * `scripts/check-mobile.mjs` 只看源码：viewport 元标签在不在、开关有没有 `:aria-expanded`
 * 绑定、它在桌面是否隐藏、断点分支是否存在。**四条全绿也不代表手机上能用** ——
 * 它们都是「入口存在」的证据，不是「进去之后页面没坏」的证据。
 * 这条 spec 才是后者：真浏览器、真 390px、真 Element Plus。
 *
 * ## 断言的由来（不是随手写的）
 *
 * 主站 `AppHeader.vue` 的样式注释里记着实测过的一次事故：手机宽度下右侧控件组会把
 * 「切站」和「仓库」推出视口（**390px 时溢出 124px**），修法是手机档只留图标 + 收边距。
 * 这类缺陷在桌面 e2e 里永远看不见，在静态守卫里也看不见 —— 页面的 `scrollWidth`
 * 才是唯一诚实的判据。所以下面每个页面都断三件事：
 *
 *   1. **没有横向溢出**（`scrollWidth <= innerWidth + 1`）：
 *      溢出意味着用户要横向拖动才能看全，移动端这是最典型的「看起来没坏」的坏；
 *   2. **顶栏控件全在视口内**：显式检查每个可见控件的外框，比只查 scrollWidth 更早
 *      定位 —— `overflow: hidden` 能把溢出藏起来，却藏不住按钮被切掉一半；
 *   3. **抽屉真的能开、能关、能跳**：开关可见 → 点开 → 侧栏进入视口 → 点导航项
 *      → 页面变了且抽屉收起。这是「进得来、出得去」的完整闭环。
 *
 * ## 覆盖面（以及不对称）
 *
 * 只有主站。es-pc 的 dev server 需要 `@es-plus/adapter-antdv` 的 dist、es-eui 是
 * vue-cli（webpack）冷启动 30 s+，塞进现有 10 分钟的 runtime-e2e job 会把一条稳定的
 * 链变成不稳定的链 —— 那两站的覆盖停在静态四条，这是**已知缺口，不是覆盖**。
 * 与 `scripts/check-mobile.mjs` 头注写的是同一句话，改一处要改两处。
 */

const MOBILE = { width: 390, height: 844 }

/** 文档没有横向溢出：scrollWidth 超出视口 1px 以上即判负（1px 给亚像素取整留余量）。 */
async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, `页面横向溢出 ${overflow}px（scrollWidth > clientWidth）`).toBeLessThanOrEqual(1)
}

/**
 * 顶栏里每个可见控件必须完整落在视口内。
 * 用外框而不是 scrollWidth，是因为 `overflow: hidden` 会把「按钮被推出屏幕」藏成
 * 「页面不滚动」—— 但那个按钮用户依然点不到。
 */
async function expectHeaderControlsInsideViewport(page: Page) {
  const escapes = await page.evaluate(() => {
    const w = document.documentElement.clientWidth
    const out: string[] = []
    const nodes = document.querySelectorAll<HTMLElement>('.app-header button, .app-header a')
    for (const el of nodes) {
      const s = getComputedStyle(el)
      if (s.display === 'none' || s.visibility === 'hidden') continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) continue
      const name = (el.getAttribute('aria-label') || el.textContent || el.className || el.tagName).trim().slice(0, 24)
      if (r.right > w + 0.5) out.push(`${name} 右边界 ${Math.round(r.right)} > 视口 ${w}`)
      if (r.left < -0.5) out.push(`${name} 左边界 ${Math.round(r.left)} < 0`)
    }
    return out
  })
  expect(escapes, `顶栏控件越界：\n${escapes.join('\n')}`).toEqual([])
}

/** 抽屉位置：关闭时在左侧视口外（translateX(-100%)），打开时左边界贴 0。 */
async function drawerX(page: Page): Promise<number | null> {
  const box = await page.locator('#es-sidebar').boundingBox()
  return box ? box.x : null
}

const toggle = (page: Page) => page.locator('.app-header .hamburger-btn')
const sidebar = (page: Page) => page.locator('#es-sidebar')

test('首页：无横向溢出、顶栏控件不越界、抽屉能开能关', async ({ page }) => {
  await page.setViewportSize(MOBILE)
  await page.goto('/#/')
  await expect(page.locator('.app-header')).toBeVisible()

  await expectNoHorizontalOverflow(page)
  await expectHeaderControlsInsideViewport(page)

  // 关闭态：抽屉被 translateX(-100%) 推到视口外，但**仍在布局里**（
  // toBeVisible 会为真），所以只能看外框的 x。
  await expect(toggle(page)).toBeVisible()
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false')
  const closedX = await drawerX(page)
  expect(closedX, '抽屉关闭时应在视口左侧之外').toBeLessThan(0)

  // 打开：aria-expanded 翻转 + 抽屉进入视口 + 出现遮罩
  await toggle(page).click()
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true')
  await expect.poll(() => drawerX(page)).toBeGreaterThanOrEqual(0)
  const overlay = page.locator('.sidebar-overlay')
  await expect(overlay).toBeVisible()

  // 点遮罩关闭 —— 移动端用户唯一的「退出」手势之一
  await overlay.click({ position: { x: MOBILE.width - 10, y: MOBILE.height / 2 } })
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false')
  await expect.poll(() => drawerX(page)).toBeLessThan(0)
})

test('窄屏不能横向滚动的页面集：文档页、案例页、AI 画廊', async ({ page }) => {
  // 一页一页跑（不是循环里的软断言）：红的时候要能一眼看出是哪个路由。
  // 选这四条是因为它们代表三种布局：Landing（单列长页）、Doc（侧栏 + 正文）、
  // Cases（卡片网格）、Gallery（卡片网格 + 详情入口）。
  for (const path of ['/#/guide/getting-started', '/#/cases', '/#/ai-gallery']) {
    await page.setViewportSize(MOBILE)
    await page.goto(path)
    await expect(page.locator('.app-header')).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await expectHeaderControlsInsideViewport(page)
  }
})

test('文档页：抽屉里点导航项 → 页面切换且抽屉自动收起', async ({ page }) => {
  await page.setViewportSize(MOBILE)
  await page.goto('/#/guide/getting-started')
  await expect(sidebar(page)).toBeAttached()

  await toggle(page).click()
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true')
  await expect.poll(() => drawerX(page)).toBeGreaterThanOrEqual(0)

  // 侧栏是全部入口的宿主（顶栏在窄屏只留开关）—— 点第一个「指南」类链接。
  // 关不收起是移动端的典型脏状态：新页面打开了，旧抽屉还盖在上面。
  const firstLink = sidebar(page).locator('a.nav-link').first()
  await expect(firstLink).toBeVisible()
  const before = page.url()
  await firstLink.click()
  await expect.poll(() => page.url()).not.toBe(before)
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false')
  await expect.poll(() => drawerX(page)).toBeLessThan(0)
})

test('桌面对照：开关隐藏、顶栏导航在流内（证明断点不是单向的）', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/#/guide/getting-started')
  await expect(page.locator('.app-header')).toBeVisible()

  // 手机那一套在桌面必须消失，否则等于给桌面用户留了个多余的抽屉开关
  await expect(toggle(page)).toBeHidden()
  await expect(page.locator('.app-header .header-nav')).toBeVisible()
  // 桌面同样要有「无横向溢出」这条底线（宽度越界的改动不该只在移动端被抓住）
  await expectNoHorizontalOverflow(page)
})
