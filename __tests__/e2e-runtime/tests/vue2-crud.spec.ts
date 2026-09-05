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
 *
 * 本 spec 额外锁定审计发现（真实浏览器 + 真实 element-ui 校验，vitest+happy-dom 下 el-form.validate()
 * 不 reject、element-ui 无法挂载，故只能在此层验证）：
 *   - #1 表单校验拦截：必填未填点「确定」→ onConfirm 被阻断 + 无 unhandled rejection
 *   - #3 渲染契约：falsy(0) 原样显示、嵌套路径经 getNestedValue 解析
 *   - F2 请求失败：失败经 request-error 暴露、数据保留、无 unhandled rejection
 * 注：#2（vxe proxy keepPage：query vs reload）为 vxe 引擎专属，本 fixture 用默认 el-table 引擎，
 *     不覆盖；如需锁定 #2 需另建 engine:'vxe' + proxyConfig 的 fixture。
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
const unhandled = (page: Page) => page.evaluate(() => (window as any).__unhandled as string[])
const requestErrors = (page: Page) => page.evaluate(() => (window as any).__requestErrors as string[])

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

test('#3 falsy/嵌套渲染：score=0 原样显示、嵌套 info.city 经 getNestedValue 解析', async ({ page }) => {
  // 旧实现 `row[prop] || row[key]` 会把 0 显示为空、且 `row['info.city']` 取不到嵌套值。
  // 取 Alice 所在行（score:0, info.city:'Beijing'）——在主体层（非 fixed 复制层）断言。
  const aliceRow = page.locator('.el-table__body-wrapper').first().locator('tbody tr.el-table__row', { hasText: 'Alice' }).first()
  await expect(aliceRow).toContainText('0') // score=0 未被吞成空
  await expect(aliceRow).toContainText('Beijing') // 嵌套 info.city 正确解析
  // Bob 行：score=99 + 城市 Shanghai
  const bobRow = page.locator('.el-table__body-wrapper').first().locator('tbody tr.el-table__row', { hasText: 'Bob' }).first()
  await expect(bobRow).toContainText('99')
  await expect(bobRow).toContainText('Shanghai')
})

test('#1 校验拦截：必填未填点「确定」→ 新增被阻断（不新增）且无 unhandled rejection', async ({ page }) => {
  await page.getByRole('button', { name: '新增' }).click()
  await expect(dialog(page)).toBeVisible()

  // 不填姓名直接点「确定」：EsForm.validate() reject → validateAndConfirm 抛出 → onConfirm 不执行
  await dialog(page).getByRole('button', { name: '确定' }).click()

  // 弹窗保持打开（未 close），后端未新增，列表仍 2 行
  await expect(dialog(page)).toBeVisible()
  await expect(page.locator('.el-form-item__error').first()).toBeVisible()
  await expect(rows(page)).toHaveCount(2)
  expect((await backendCalls(page)).create).toBe(0)
  // F2 交叉：confirm 点击处 try/catch 吞掉 validate 的 reject，不得冒泡成 unhandled rejection
  expect(await unhandled(page)).toHaveLength(0)
})

test('F2 请求失败：强制失败刷新 → 失败经 request-error 暴露、数据保留、无 unhandled rejection', async ({ page }) => {
  await page.getByRole('button', { name: '强制失败刷新' }).click()

  // 失败被暴露（EsTable emit request-error）
  await expect.poll(async () => (await requestErrors(page)).length).toBeGreaterThanOrEqual(1)
  // 列表数据保留（失败不清空既有行），页面仍可用
  await expect(rows(page)).toHaveCount(2)
  await expect(page.getByText('Alice').first()).toBeVisible()
  // 核心 F2 保证：命令式 refresh 的 reject 被 .catch 吞掉，无 unhandled rejection
  expect(await unhandled(page)).toHaveLength(0)
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
