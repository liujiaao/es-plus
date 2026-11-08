import { readFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'

/**
 * Tier 2 运行时 E2E（vue3 表格交互，真实 Chromium + 真实 Element Plus + 真实 @es-plus/vue3 dist）
 * ────────────────────────────────────────────────────────────────────────
 * 补的是 **Tier 1（vitest + happy-dom）覆盖不到**的一条缝：happy-dom 里没有布局、
 * 没有真实下载、没有 vxe 的编辑器生命周期，所以「点表头后浏览器里真的重排」
 * 「点导出真的产生一份 CSV 文件」「vxe 行内编辑真的进编辑器并回写 updateRecords」
 * 这三类只能在这一层验。
 *
 * fixture：`__tests__/e2e-runtime/table`（`?lib=vue3`，默认 60 行 + 内建分页 pageSize=20）。
 * 五条交互各一条用例：排序 / 选择 / 分页 / 导出 / 行内编辑（编辑腿带 `?vxe=1`）。
 */

const rows = (page: Page) => page.locator('#main-table .el-table__body-wrapper tbody tr.el-table__row')

/** 打开 fixture 并等到「表格已有第一行」——那时 `window.__fixture` 也已挂好。 */
async function openFixture(page: Page, query = ''): Promise<void> {
  await page.goto(`/${query}`)
  await page.waitForFunction(() => (window as unknown as Record<string, unknown>).__fixtureReady === true)
  await expect(rows(page).first()).toBeVisible()
}

test('排序：点「金额」表头升序 → 抛 change-table-sort，且浏览器里真的重排', async ({ page }) => {
  await openFixture(page)
  // 数据刻意 amount 递减：第 1 页首行是 amount 最大的「用户1」
  await expect(rows(page).first()).toContainText('用户1')

  await page
    .locator('#main-table .el-table__header-wrapper th')
    .filter({ hasText: '金额' })
    .locator('.sort-caret.ascending')
    .click()

  // 本页升序后 amount 最小的是「用户20」（amount=41）—— 断言首行，不赌整页顺序
  await expect(rows(page).first()).toContainText('用户20')

  const events = await page.evaluate(() => (window as unknown as Record<string, any>).__fixture.sortEvents)
  expect(events.at(-1)).toEqual({ prop: 'amount', order: 'ascending' })
})

test('选择：点表头全选 → getSelectionRows() 返回当前页 20 行', async ({ page }) => {
  await openFixture(page)
  await page.locator('#main-table .el-table__header-wrapper .el-checkbox').first().click()

  await expect
    .poll(() => page.evaluate(() => (window as unknown as Record<string, any>).__fixture.selection().length))
    .toBe(20)
  const ids = await page.evaluate(() =>
    (window as unknown as Record<string, any>).__fixture.selection().map((r: any) => r.id),
  )
  expect(ids).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
})

test('分页：点第 2 页 → 渲染第 21–40 行（内建客户端分页切片）', async ({ page }) => {
  await openFixture(page)
  await expect(rows(page)).toHaveCount(20)

  await page.locator('#main-table .el-pager li', { hasText: '2' }).click()

  await expect(rows(page).first()).toContainText('用户21')
  await expect(rows(page)).toHaveCount(20)
})

test('导出：exportData() 走 core 的 CSV 兜底，真的产生可打开的 fixture-rows.csv', async ({ page }) => {
  await openFixture(page)

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#btn-export').click(),
  ])
  expect(download.suggestedFilename()).toBe('fixture-rows.csv')

  const path = await download.path()
  const content = readFileSync(path, 'utf8')
  // 导出的 CSV 带 UTF-8 BOM（Excel 中文），先剥掉首字符再按行切
  const text = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content
  const lines = text.trim().split('\r\n')
  expect(lines[0]).toBe('ID,姓名,金额,状态')
  // 内建分页导出的是**当前页**（displayDataSource 的切片），不是全量 60 行
  expect(lines).toHaveLength(21)
  // dataOptions 码值 → label（'on' 导出成「启用」），不是原始码
  expect(lines[1]).toBe('1,用户1,60,启用')
  expect(await page.locator('#export-result').innerText()).toBe('true')
})

test('行内编辑：vxe 表格点单元格进编辑器，回车后 getUpdateRecords() 拿到改动', async ({ page }) => {
  await openFixture(page, '?vxe=1')

  const vxeRows = page.locator('#vxe-table .vxe-body--row')
  await expect(vxeRows.first()).toBeVisible()

  // 第 2 列是「姓名」；ID 列没有 editRender，只读
  await vxeRows.first().locator('.vxe-body--column').nth(1).click()

  const editor = page.locator('#vxe-table .vxe-input--inner').first()
  await expect(editor).toBeVisible()
  await editor.fill('编辑后的姓名')
  await editor.press('Enter')

  await expect
    .poll(() => page.evaluate(() => (window as unknown as Record<string, any>).__fixture.updateRecords().length))
    .toBe(1)
  const record = await page.evaluate(
    () => (window as unknown as Record<string, any>).__fixture.updateRecords()[0],
  )
  expect(record.id).toBe(1)
  expect(record.name).toBe('编辑后的姓名')
})
