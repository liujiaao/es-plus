import { test, expect, type Page } from '@playwright/test'

/**
 * AI 案例画廊 —— 真实站点（`es-plus-docs`，vite + Element Plus）里的运行时断言。
 *
 * ## 为什么这一条必须存在
 *
 * manifest 里 `employee-roster` 声明了三站 `execute`。按 `docs/internal/ai-showcase-matrix-plan.md`
 * §6 B2，`execute` 要么有 e2e、要么有专属守卫背书 —— 否则最多只能写 `compile`。这条 spec 就是
 * 该案例的主张承担者，覆盖的正是「静态守卫看不见」的四件事：
 *
 *   1. **清单真的渲染**：registry（manifest 生成）→ 画廊卡片 → 详情页，链路任何一环断了
 *      页面上就是空白或 404，`check:ai-cases` 只验字节、不验渲染；
 *   2. **产物真的驱动页面**：14 条内存数据经宿主注入的 `http-request` 落到表格，第一页 10 行
 *      （`pagination.pageSize` 是产物里的值，不是测试里写死的）；
 *   3. **码值列**：`dataOptions[].tagType` 在浏览器里是彩色 `el-tag`，不是裸数字 1/0；
 *   4. **必填校验**：弹窗里空表单点「确定」必须被拦住（`required` 由模型写进配置，
 *      生成器翻成 `formItemOptions.rules`）；填完必须真的落库 + 提示 + 刷新。
 *   5. **全屏弹窗**：`dialogs.view.fullscreen`（产物的值）真的让 `el-dialog` 全屏。
 *
 * 选择器只用**公共语义**（按钮名 / 卡片类名 / element-plus 的 DOM 约定），不碰内部实现；
 * 站点改版时这里会先红，而不是让「三端可交互」这句话悄悄失真。
 */

const CARD = '.ai-card'
const rows = (page: Page) => page.locator('.el-table__body-wrapper').first().locator('tbody tr.el-table__row')
const dialog = (page: Page) => page.locator('.el-dialog').filter({ has: page.locator('.el-form') })

/** 画廊列表页：按 manifest 生成的清单渲染卡片。 */
test('画廊列出 manifest 里的全部案例，并按能力簇分组', async ({ page }) => {
  await page.goto('/#/ai-gallery')

  await expect(page.locator(CARD)).toHaveCount(3)
  // 三个案例的标题都来自 manifest（单一真源）—— 少一个说明 registry 或同步断了
  for (const title of ['员工花名册', '合同审批工作台', '采购申请审批页']) {
    await expect(page.locator(CARD).filter({ hasText: title })).toHaveCount(1)
  }
  // 能力簇标题来自 manifest.clusters
  await expect(page.getByRole('heading', { name: /字段三面扇出/ })).toBeVisible()
  // 「可机械重放」徽章只应出现在有冻结配置的案例上（当前是员工花名册）
  await expect(page.locator(CARD).filter({ hasText: '可机械重放' })).toHaveCount(1)
})

test('详情页由产物驱动：第一页 10 行、状态列是彩色标签', async ({ page }) => {
  await page.goto('/#/ai-gallery/employee-roster')

  // pageSize=10 来自产物（pagination.pageSize），不是测试常量
  await expect(rows(page)).toHaveCount(10)
  await expect(page.getByText('E-1001')).toBeVisible()

  // dataOptions + tagType：在职/离职是 el-tag，且类型不同（success / danger）
  const tags = page.locator('.el-table__body-wrapper .el-tag')
  await expect(tags.filter({ hasText: '在职' }).first()).toBeVisible()
  await expect(tags.filter({ hasText: '离职' }).first()).toBeVisible()
  await expect(tags.filter({ hasText: '离职' }).first()).toHaveClass(/el-tag--danger/)
})

test('新增弹窗：空表单被必填校验拦住，填完真的落库并刷新', async ({ page }) => {
  await page.goto('/#/ai-gallery/employee-roster')
  await expect(rows(page)).toHaveCount(10)

  await page.getByRole('button', { name: '新增', exact: true }).click()
  const dlg = dialog(page)
  await expect(dlg).toBeVisible()
  await expect(dlg).toContainText('新增员工')

  // 空表单直接确定 —— required 由产物声明，校验必须拦住
  await dlg.getByRole('button', { name: '确定' }).click()
  await expect(dlg.locator('.el-form-item__error').first()).toBeVisible()

  // 工号 / 姓名 / 部门三个必填（产物里 required: true 的三项）
  const inputs = dlg.locator('.el-form-item')
  await inputs.filter({ hasText: '工号' }).locator('input').fill('E-2001')
  await inputs.filter({ hasText: '姓名' }).locator('input').fill('测试员工')
  await inputs.filter({ hasText: '部门' }).locator('input').fill('测试部')

  await dlg.getByRole('button', { name: '确定' }).click()

  // 提示文案来自 mock 的 handleDialogConfirm（宿主只负责显示）
  await expect(page.getByText('已新增：测试员工（E-2001）')).toBeVisible()
  // 落库在最前（mock 用 unshift），刷新后第一页第一行就是它
  await expect(rows(page).first()).toContainText('E-2001')
})

test('查看弹窗按产物的 fullscreen 全屏打开', async ({ page }) => {
  await page.goto('/#/ai-gallery/employee-roster')
  await expect(rows(page)).toHaveCount(10)

  await page
    .locator('.el-table__body-wrapper')
    .first()
    .getByRole('button', { name: '查看' })
    .first()
    .click()

  const dlg = dialog(page)
  await expect(dlg).toBeVisible()
  await expect(dlg).toContainText('查看员工详情')
  // dialogs.view.fullscreen = true（产物里的值）→ element-plus 加 is-fullscreen 类
  await expect(dlg).toHaveClass(/is-fullscreen/)
})

test('产物可下载：「下载 schema」拿到的是本站加载的纯 JSON', async ({ page }) => {
  await page.goto('/#/ai-gallery')
  const card = page.locator(CARD).filter({ hasText: '员工花名册' })

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    card.getByRole('button', { name: '下载 schema' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('employee-roster.json')
})
