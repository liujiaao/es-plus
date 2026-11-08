import { readFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'

/**
 * Tier 2 运行时 E2E（antdv 表格交互，真实 Chromium + 真实 Ant Design Vue + 真实
 * `@es-plus/adapter-antdv` dist）
 * ────────────────────────────────────────────────────────────────────────
 * 与 table-vue3.spec.ts 同一套五条交互，断言上的**唯一刻意差异**：
 * a-table 的 `sorter: true` 是服务端语义 —— 点表头只切指示器 + 抛 `change-table-sort`，
 * 不本地重排。所以排序腿断言「事件 + 指示器」，不断言行序（那会被误当成缺陷）。
 *
 * fixture：`__tests__/e2e-runtime/table?lib=antdv`（默认 60 行 + 内建分页 pageSize=20）。
 */

const rows = (page: Page) => page.locator('#main-table .ant-table-tbody tr.ant-table-row')
const mainTable = (page: Page) => page.locator('#main-table')

async function openFixture(page: Page, query = ''): Promise<void> {
  await page.goto(`/?lib=antdv${query ? `&${query}` : ''}`)
  await page.waitForFunction(() => (window as unknown as Record<string, unknown>).__fixtureReady === true)
  await expect(rows(page).first()).toBeVisible()
}

test('排序：点「金额」表头 → 抛 change-table-sort（a-table 只切指示器，不本地重排）', async ({ page }) => {
  await openFixture(page)
  await expect(rows(page).first()).toContainText('用户1')

  const header = mainTable(page).locator('.ant-table-thead th').filter({ hasText: '金额' })
  await header.locator('.ant-table-column-sorters').click()

  const events = await page.evaluate(() => (window as unknown as Record<string, any>).__fixture.sortEvents)
  expect(events.at(-1)).toEqual({ prop: 'amount', order: 'ascending' })
  // 指示器真的亮了，但行序不动（服务端排序语义）
  await expect(header.locator('.ant-table-column-sorter-up.active')).toHaveCount(1)
  await expect(rows(page).first()).toContainText('用户1')
})

test('选择：点表头全选 → getSelectionRows() 返回当前页 20 行', async ({ page }) => {
  await openFixture(page)
  await mainTable(page).locator('.ant-table-thead .ant-checkbox-wrapper').first().click()

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

  await mainTable(page).locator('.ant-pagination-item-2').click()

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
  expect(lines).toHaveLength(21)
  // dataOptions 码值 → label（'on' 导出成「启用」），与 vue3 腿逐字相同
  expect(lines[1]).toBe('1,用户1,60,启用')
  expect(await page.locator('#export-result').innerText()).toBe('true')
})

test('行内编辑：vxe 表格点单元格进编辑器，回车后 getUpdateRecords() 拿到改动', async ({ page }) => {
  await openFixture(page, 'vxe=1')

  const vxeRows = page.locator('#vxe-table .vxe-body--row')
  await expect(vxeRows.first()).toBeVisible()

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
