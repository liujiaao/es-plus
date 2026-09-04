import { test, expect, type Page } from '@playwright/test'

/**
 * Tier 2 运行时 E2E（vue2, 真实 Chromium + 真实 Element UI + 真实 @es-plus/vue2 dist）
 * ────────────────────────────────────────────────────────────────────────
 * 与 Tier 1（vue3 / adapter-antdv 的 crud-runtime.spec.ts）同一套 schema / 内存后端 / 断言语义，
 * 只是把「vitest + happy-dom 挂载」换成「真实浏览器渲染」——因为 element-ui 的编译期 CJS
 * `_interopRequireDefault(require('vue'))` 在 vitest module runner 下 .default 为 undefined，
 * vue2 的 Tier 1 不可行（见 __tests__/e2e-runtime/README.md）。
 *
 * 后端计数通过 window.__backend.calls 读取（fixture 的 App.vue 把内存后端挂到了 window）。
 * 注入缝与 Tier 1 一致：EsCrudPage 的 :http-request prop。
 */

const rows = (page: Page) => page.locator('.el-table__body-wrapper').first().locator('tbody tr.el-table__row')
const dialog = (page: Page) => page.locator('.el-dialog').filter({ has: page.locator('.el-input__inner') })
const dialogInput = (page: Page) => dialog(page).locator('.el-input__inner')
// Element UI 的操作列默认 fixed:'right'，整表会在 .el-table__fixed-right 里复制一份，
// 故行内文本/按钮在页面上各有两份（主体层 + 固定层，共用同一事件）。用 .first() 取其一即可。
const rowBtn = (page: Page, name: string) => page.getByRole('button', { name }).first()

async function backendCalls(page: Page) {
  return page.evaluate(() => (window as any).__backend.calls as { list: number; create: number; update: number; remove: number })
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  // 列表加载：EsTable onMounted 自动经 httpRequest 拉数据 → 回写 data-source → 渲染 2 行
  await expect(rows(page)).toHaveCount(2)
})

test('列表加载：挂载即经 httpRequest 拉数据并渲染 Alice/Bob', async ({ page }) => {
  await expect(page.getByText('Alice').first()).toBeVisible()
  await expect(page.getByText('Bob').first()).toBeVisible()
  expect((await backendCalls(page)).list).toBeGreaterThanOrEqual(1)
})

test('新增：点工具栏「新增」→ 弹窗填表 → 确定 → 后端 +1 → 列表 +1', async ({ page }) => {
  await page.getByRole('button', { name: '新增' }).click()
  await expect(dialog(page)).toBeVisible()

  await dialogInput(page).fill('Carol')
  await dialog(page).getByRole('button', { name: '确定' }).click()

  await expect(rows(page)).toHaveCount(3)
  await expect(page.getByText('Carol').first()).toBeVisible()
  expect((await backendCalls(page)).create).toBe(1)
})

test('编辑：点行「编辑」→ 预填 Alice → 改值 → 确定 → 后端更新 → 列表刷新', async ({ page }) => {
  await rowBtn(page, '编辑').click()
  await expect(dialog(page)).toBeVisible()
  // 预填校验：第一行是 Alice
  await expect(dialogInput(page)).toHaveValue('Alice')

  await dialogInput(page).fill('Alice-Edited')
  await dialog(page).getByRole('button', { name: '确定' }).click()

  await expect(page.getByText('Alice-Edited').first()).toBeVisible()
  expect((await backendCalls(page)).update).toBe(1)
})

test('删除：点行「删除」→ 后端删除 → refresh → 列表 -1', async ({ page }) => {
  await rowBtn(page, '删除').click()

  await expect(rows(page)).toHaveCount(1)
  expect((await backendCalls(page)).remove).toBe(1)
})
