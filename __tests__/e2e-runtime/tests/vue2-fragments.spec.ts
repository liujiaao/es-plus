import { test, expect, type Page, type Locator } from '@playwright/test'

/**
 * Tier 2 运行时 E2E —— **生成出来的片段**（AI-44）
 * ────────────────────────────────────────────────────────────────────────
 * 与 vue2-crud.spec.ts 同一个 harness（真实 Chromium + 真实 Element UI + 真实
 * @es-plus/vue2 dist），对象换成 `generate_table` / `generate_form` / `generate_dialog`
 * 的六份 vue2 片段产物（由 scripts/gen-fragments.mjs 从 golden 语料生成）。
 *
 * 分层的意义：
 *   - Tier 0（__tests__/e2e/scripts/run-golden.mjs）只证明 `vite build` 能编译；
 *   - Tier 1（packages/{vue3,adapter-antdv}/__tests__/fragment-runtime.spec.ts）挂载
 *     vue3 / antdv 片段；
 *   - **本 spec** 证明 vue2 片段在真实浏览器里真的跑：真实请求、真实行/表单/弹窗。
 *
 * 注入缝刻意与 CRUD fixture 不同：本页只通过 `Vue.use(ESPlus, { httpRequest })`
 * 配顶层请求函数，片段产物自身没有 `:http-request` prop —— 因此本 spec 同时是
 * AI-43 修好的「全局 httpRequest 兜底」的运行时见证。
 */

const section = (page: Page, name: string) => page.locator(`[data-test="${name}"]`)
const bodyRows = (root: Locator) =>
  root.locator('.el-table__body-wrapper').first().locator('tbody tr.el-table__row')

async function calls(page: Page) {
  return page.evaluate(
    () =>
      (window as any).__backend.calls as {
        usersList: number
        ordersList: number
        submits: number
        requests: Array<{ url: string; method: string; data: Record<string, unknown> }>
      }
  )
}
const unhandled = (page: Page) => page.evaluate(() => (window as any).__unhandled as string[])

test.beforeEach(async ({ page }) => {
  await page.goto('/fragments.html')
  // 两个独立表格都靠挂载时的自动请求拉数 —— 先等两边的行都出来，
  // 后续用例的请求计数才是稳定的基线。
  await expect(bodyRows(section(page, 'frag-table-01'))).toHaveCount(2)
  await expect(bodyRows(section(page, 'frag-table-02'))).toHaveCount(2)
})

test('table-01：全局 httpRequest 拉数 → 行渲染 + formatter 生效 + 行操作按钮派生', async ({ page }) => {
  const table = section(page, 'frag-table-01')
  await expect(table.getByText('张三').first()).toBeVisible()
  await expect(table.getByText('李四').first()).toBeVisible()

  // formatter 是源码扩展点：产物里是 `formatter: (row) => Number(row.amount).toFixed(2)`，
  // 若发射/编译链路把它丢了，DOM 里只会是 12 / 3.5。
  const firstRow = bodyRows(table).first()
  await expect(firstRow).toContainText('12.00')
  const secondRow = bodyRows(table).nth(1)
  await expect(secondRow).toContainText('3.50')

  // 行操作按钮由 columns[operate].btns 派生（fixed:'right' 会在固定层复制一份，取 first）。
  for (const name of ['查看', '编辑', '删除']) {
    await expect(table.getByRole('button', { name }).first()).toBeVisible()
  }

  // 片段没有 :http-request prop —— 请求只能来自 AI-43 的全局兜底。
  expect((await calls(page)).usersList).toBeGreaterThanOrEqual(1)
  expect(await unhandled(page)).toHaveLength(0)
})

test('table-02：configTableOut 映射（total/list）+ 容器级词汇到真实表格', async ({ page }) => {
  const table = section(page, 'frag-table-02')
  await expect(table.getByText('SO-001').first()).toBeVisible()
  await expect(table.getByText('SO-002').first()).toBeVisible()

  // 后端对 /api/orders 返回 { total, list } —— 能渲染出行，就说明
  // configTableOut: { total:'total', tableData:'list' } 真的被请求层消费了。
  expect((await calls(page)).ordersList).toBeGreaterThanOrEqual(1)

  // leftText 进入工具栏左侧文案（当前三端都是原样渲染，不做插值）。
  await expect(table.locator('.left-text')).toContainText('共')

  // showHeader:false —— 表头容器存在但不可见。
  await expect(table.locator('.el-table__header-wrapper')).toBeHidden()

  // pagination.pageSize=20 播种到分页器（layout 里 jumper 在 sizes 之前，
  // 必须按 `.el-pagination__sizes` 精确取，否则会读到跳页输入框的 "1"）。
  await expect(table.locator('.el-pagination__sizes .el-input__inner')).toHaveValue(/20/)

  expect(await unhandled(page)).toHaveLength(0)
})

test('form-01：字段/控件/按钮渲染，输入回写宿主 model', async ({ page }) => {
  const form = section(page, 'frag-form-01')
  for (const label of ['姓名', '状态', '生日', '简介', '启用']) {
    await expect(form.locator('.el-form-item__label', { hasText: label }).first()).toBeVisible()
  }
  // bio 的 attrs.type=textarea 真的落到了 DOM。
  await expect(form.locator('textarea')).toBeVisible()
  // buttons:'submit' 分支 → 保存/重置。
  await expect(form.getByRole('button', { name: '保存' })).toBeVisible()
  await expect(form.getByRole('button', { name: '重置' })).toBeVisible()

  // 输入回写：es-form 用 v-model 绑定宿主 reactive model，值必须出现在输入框里。
  const nameInput = form.locator('.el-form-item', { hasText: '姓名' }).locator('input').first()
  await nameInput.fill('王五')
  await expect(nameInput).toHaveValue('王五')

  // 独立表单没有 apiUrl，不应产生任何提交。
  expect((await calls(page)).submits).toBe(0)
  expect(await unhandled(page)).toHaveLength(0)
})

test('form-02：formLayout.labelWidth 真到 DOM（110px）+ query 按钮分支', async ({ page }) => {
  const form = section(page, 'frag-form-02')
  await expect(form.getByRole('button', { name: '查询' })).toBeVisible()
  await expect(form.getByRole('button', { name: '重置' })).toBeVisible()

  const width = await form
    .locator('.el-form-item__label')
    .first()
    .evaluate((el) => getComputedStyle(el).width)
  expect(width).toBe('110px')
  expect(await unhandled(page)).toHaveLength(0)
})

test('dialog（component 形态）：open() 开窗、预填、默认插槽表单体、宽度/拖拽/关闭叉', async ({ page }) => {
  await page.locator('[data-test="open-component-dialog"]').click()

  // ⚠ 该语料带 `options.appendTo='#app'`：vue2 的 Element UI 只有布尔 append-to-body
  // （AI-48 显式降级 + 告警），弹窗**真的挂到了 body**，不再留在 section 内 ——
  // 所以这里按 body 级定位，而不是 `section(...).locator('.el-dialog')`。
  const dialog = page.locator('.el-dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('.dialog-title')).toHaveText('编辑')

  // 预填：open(title, row) 真的写进 reactive model。
  await expect(dialog.locator('.el-form-item', { hasText: '姓名' }).locator('input').first()).toHaveValue('张三')

  // AI-43：`<es-dialog><es-form/></es-dialog>` 的默认插槽此前被静默丢弃 ——
  // body 里必须真的有表单。
  await expect(dialog.locator('.el-dialog__body .el-form')).toBeVisible()

  // options.width=720、isDraggable=true、showClose=false 三条都落到了真实弹窗。
  expect(await dialog.evaluate((el) => getComputedStyle(el).width)).toBe('720px')
  expect(await dialog.locator('.el-dialog__header').evaluate((el) => getComputedStyle(el).cursor)).toBe('move')
  await expect(dialog.locator('.dialog-header .el-icon-close')).toBeHidden()

  // 校验拦截：必填未填 → 提交不发生。
  await dialog.locator('.el-form-item', { hasText: '姓名' }).locator('input').first().fill('')
  await dialog.getByRole('button', { name: '确定' }).click()
  await expect(dialog.locator('.el-form-item__error').first()).toBeVisible()
  expect((await calls(page)).submits).toBe(0)

  // 填好后提交：PUT /api/users/1（编辑分支）→ 关闭。
  await dialog.locator('.el-form-item', { hasText: '姓名' }).locator('input').first().fill('张三三')
  await dialog.getByRole('button', { name: '确定' }).click()
  await expect(dialog).toBeHidden()

  const after = await calls(page)
  expect(after.submits).toBe(1)
  expect(after.requests.find((r) => r.method === 'PUT')?.url).toBe('/api/users/1')
  expect(after.requests.find((r) => r.method === 'PUT')?.data.name).toBe('张三三')
  expect(await unhandled(page)).toHaveLength(0)
})

test('dialog（composable 形态）：useXxxDialog().open() 创建弹窗 → 校验 → POST 提交', async ({ page }) => {
  await page.locator('[data-test="open-composable-dialog"]').click()

  // useDialog 默认把实例挂到 body（不是 fixture 的 section 内）。
  const dialog = page.locator('.el-dialog', { hasText: '新增' })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('.el-form-item', { hasText: '姓名' })).toBeVisible()
  await expect(dialog.locator('.el-form-item', { hasText: '状态' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: '取消' })).toBeVisible()

  // 必填校验：空姓名点确定不提交。
  await dialog.getByRole('button', { name: '确定' }).click()
  await expect(dialog.locator('.el-form-item__error').first()).toBeVisible()
  expect((await calls(page)).submits).toBe(0)

  await dialog.locator('.el-form-item', { hasText: '姓名' }).locator('input').first().fill('赵六')
  await dialog.getByRole('button', { name: '确定' }).click()
  await expect(dialog).toBeHidden()

  const after = await calls(page)
  expect(after.submits).toBe(1)
  expect(after.requests.find((r) => r.method === 'POST')?.url).toBe('/api/users')
  expect(after.requests.find((r) => r.method === 'POST')?.data.name).toBe('赵六')
  expect(await unhandled(page)).toHaveLength(0)
})

test('dialog（component 形态）：新增 → POST /api/users（AN-16）', async ({ page }) => {
  // 方法映射是**运行时由 title 派生**的（生成器 `title === '新增' ? 'POST' : 'PUT'`），
  // 记分卡里没有这个维度 —— 只有真跑一次才能证明「新增走 POST、编辑走 PUT」。
  await page.locator('[data-test="open-component-new-dialog"]').click()

  // appendTo='#app' 在 vue2 退化为 append-to-body（AI-48）—— 弹窗在 body 级。
  const dialog = page.locator('.el-dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('.dialog-title')).toHaveText('新增')
  await expect(dialog.locator('.el-form-item', { hasText: '姓名' }).locator('input').first()).toHaveValue('王五')

  await dialog.getByRole('button', { name: '确定' }).click()
  await expect(dialog).toBeHidden()

  const after = await calls(page)
  expect(after.submits).toBe(1)
  expect(after.requests.find((r) => r.method === 'POST')?.url).toBe('/api/users')
  expect(after.requests.find((r) => r.method === 'POST')?.data.name).toBe('王五')
  expect(await unhandled(page)).toHaveLength(0)
})

test('dialog（component 形态）：查看 → 只读（只有关闭、无确定/取消、不发请求）（AN-16）', async ({ page }) => {
  await page.locator('[data-test="open-readonly-dialog"]').click()

  // 同上：appendTo 在 vue2 退化为 append-to-body（AI-48）。
  const dialog = page.locator('.el-dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('.dialog-title')).toHaveText('查看')
  // 只读形态的判据是「按钮集合」：只有关闭。三端同一启发式（title === '查看'）。
  await expect(dialog.getByRole('button', { name: '关闭' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: '确定' })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: '取消' })).toHaveCount(0)
  // 预填仍在：只读不是空壳。
  await expect(dialog.locator('.el-form-item', { hasText: '姓名' }).locator('input').first()).toHaveValue('张三')
  expect((await calls(page)).submits).toBe(0)

  await dialog.getByRole('button', { name: '关闭' }).click()
  await expect(dialog).toBeHidden()
  expect((await calls(page)).submits).toBe(0)
  expect(await unhandled(page)).toHaveLength(0)
})

test('dialog（composable 形态）：取消只关窗、不发请求（AN-16）', async ({ page }) => {
  await page.locator('[data-test="open-composable-dialog"]').click()

  const dialog = page.locator('.el-dialog', { hasText: '新增' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: '取消' }).click()
  await expect(dialog).toBeHidden()

  const after = await calls(page)
  expect(after.submits).toBe(0)
  expect(after.requests.filter((r) => r.method !== 'GET')).toHaveLength(0)
  expect(await unhandled(page)).toHaveLength(0)
})

test('组合 form+dialog：一份表单面派生 add/edit 两个 composable（AN-17）', async ({ page }) => {
  // 组合语料 comp-form-dialog-01-vue2 的产物**不是** CRUD 页面 —— 前门 no-table 分支
  // 为每个 dialog entry 各发一段 composable，弹窗体 = form 面。两段必须都能独立打开，
  // 且字段来自同一份 form 面（客户姓名/手机号/客户等级）。
  await page.locator('[data-test="open-composition-add"]').click()

  // 页面上常驻着按需打开的 component 形态弹窗（隐藏态也会留下 .el-dialog 节点），
  // 故用 `:visible` 只看当前真正打开的那一个。
  const add = page.locator('.el-dialog:visible')
  await expect(add).toBeVisible()
  await expect(add.locator('.dialog-title')).toHaveText('新增')
  for (const label of ['客户姓名', '手机号', '客户等级']) {
    await expect(add.locator('.el-form-item__label', { hasText: label }).first()).toBeVisible()
  }
  await add.getByRole('button', { name: '取消' }).click()
  await expect(add).toBeHidden()

  // 第二个 dialog key 是**另一段**产物（useCustomerEditDialog），不是复用 add 那一段。
  await page.locator('[data-test="open-composition-edit"]').click()
  const edit = page.locator('.el-dialog:visible')
  await expect(edit).toBeVisible()
  await expect(edit.locator('.dialog-title')).toHaveText('编辑')
  await expect(
    edit.locator('.el-form-item', { hasText: '客户姓名' }).locator('input').first()
  ).toHaveValue('赵六')
  await expect(edit.locator('.el-form-item__label', { hasText: '客户等级' }).first()).toBeVisible()

  // 只开窗 + 取消：不发任何写请求。
  expect((await calls(page)).submits).toBe(0)
  await edit.getByRole('button', { name: '取消' }).click()
  await expect(edit).toBeHidden()
  expect(await unhandled(page)).toHaveLength(0)
})
