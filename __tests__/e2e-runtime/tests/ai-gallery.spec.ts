import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect, type Page } from '@playwright/test'

/**
 * AI 案例画廊 —— 真实站点（`es-plus-docs`，vite + Element Plus）里的运行时断言。
 *
 * ## 为什么这一条必须存在
 *
 * manifest 里声明 `execute` 的案例，按 `docs/internal/ai-showcase-matrix-plan.md` §6 B2，
 * 必须有 e2e 或专属守卫背书 —— 否则最多只能写 `compile`。这条 spec 就是那批主张的承担者，
 * 覆盖的正是「静态守卫看不见」的东西：
 *
 *   1. **清单真的渲染**：manifest → registry → 画廊卡片 → 详情页，链路任何一环断了
 *      页面上就是空白或 404，`check:ai-cases` 只验字节、不验渲染；
 *   2. **产物真的驱动页面**：每页的行数、总条数、列、按钮都来自产物里的值，
 *      不是测试常量（断言里出现的 8/10/26/5000 都能在产物或 mock 里找到出处）；
 *   3. **令牌语义在浏览器里成立**：跨页勾选、树展开、展开行、合并单元格、远端下拉、
 *      vxe 行内编辑 —— 每一项都是「声明式配置」的一句话，在 DOM 上真的发生了；
 *   4. **弹窗与校验**：必填拦截、全屏、落库后刷新。
 *
 * 选择器只用**公共语义**（按钮名 / 卡片类名 / element-plus 与 vxe 的 DOM 约定），
 * 不碰内部实现；站点改版时这里会先红，而不是让「三端可交互」这句话悄悄失真。
 *
 * 画案例清单**不写死**：直接读 `docs/cases/ai-cases.json`（单一真源），
 * 加案例只改 manifest，这条断言跟着走 —— 否则每加一个案例测试就假红一次。
 */

const ROOT = join(__dirname, '../../..')
const manifest = JSON.parse(readFileSync(join(ROOT, 'docs/cases/ai-cases.json'), 'utf8')) as {
  clusters: Record<string, string>
  cases: Array<{
    id: string
    title: string
    claim: string
    clusters: string[]
    // manifest 里 replay 是对象（{kind} 等元数据），registry 把它压成字符串 —— 两种都认
    replay: string | { kind: string }
    host: { kind: string }
  }>
}
const replayKind = (c: { replay: string | { kind: string } }) =>
  typeof c.replay === 'string' ? c.replay : c.replay.kind

const CARD = '.ai-card'
const rows = (page: Page) => page.locator('.el-table__body-wrapper').first().locator('tbody tr.el-table__row')
const dialog = (page: Page) => page.locator('.el-dialog').filter({ has: page.locator('.el-form') })
const total = (page: Page) => page.locator('.el-pagination__total')

/** 画廊列表页：按 manifest 生成的清单渲染卡片。 */
test('画廊列出 manifest 里的全部案例，并按能力簇分组', async ({ page }) => {
  await page.goto('/#/ai-gallery')

  // 卡片数 == manifest 条目数（2026-10 起是 9 条：2 个专属页 + 7 个通用宿主）
  await expect(page.locator(CARD)).toHaveCount(manifest.cases.length)

  // 每个案例的标题都来自 manifest（单一真源）—— 少一个说明 registry 或同步断了
  for (const c of manifest.cases) {
    await expect(page.locator(CARD).filter({ hasText: c.title })).toHaveCount(1)
  }

  // 能力簇标题来自 manifest.clusters，只显示「第一个簇」被用到的分组
  const usedClusters = [...new Set(manifest.cases.map((c) => c.clusters[0]))]
  for (const key of usedClusters) {
    await expect(page.locator('.ai-gallery-group').filter({ hasText: manifest.clusters[key] })).toHaveCount(1)
  }

  // 「可机械重放」徽章只出现在冻结配置的案例上，条数与 manifest 一致
  const replayable = manifest.cases.filter((c) => replayKind(c) === 'frozen-config').length
  await expect(page.locator(CARD).filter({ hasText: '可机械重放' })).toHaveCount(replayable)
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

/**
 * 跨页勾选 + 批量动作 —— `tableBtns` / `cachePageSelection` / `configTableOut` 三个令牌。
 *
 * 断言的核心是「第三行的勾选来自上一页」：mock 的批量处理**只**看宿主转交的 selection，
 * 若跨页勾选丢失，提示语会是 1 而不是 3。后端信封是 `{list,count}`（非默认的
 * `{rows,records}`），总条数能显示成 26 就是 `configTableOut` 真的生效了。
 */
test('订单批量：跨页勾选后批量动作作用在全部选中行上', async ({ page }) => {
  await page.goto('/#/ai-gallery/order-batch')

  await expect(rows(page)).toHaveCount(8) // pagination.pageSize
  await expect(total(page)).toContainText('26') // configTableOut: count → 总条数
  await expect(page.getByRole('button', { name: '导出已选' })).toBeVisible() // tableBtns 工具栏

  const checkboxes = page.locator('.el-table__body-wrapper').first().locator('tbody tr.el-table__row .el-checkbox')
  await checkboxes.nth(0).click()
  await checkboxes.nth(1).click()

  // 翻到第 2 页：换页后勾选不丢（cachePageSelection）
  await page.locator('.el-pager li').filter({ hasText: /^2$/ }).click()
  await expect(page.locator('.el-pager li.is-active')).toHaveText('2')
  await expect(rows(page).first()).toContainText('SO-20261013')

  await checkboxes.nth(0).click()

  // 批量按钮带 confirm 确认语（tableBtns[].confirm）
  await page.getByRole('button', { name: '批量通过' }).click()
  const box = page.locator('.el-message-box')
  await expect(box).toContainText('确认通过选中的订单？')
  await box.getByRole('button', { name: /^(OK|确定)$/ }).click()

  // 3 = 第 1 页两行 + 第 2 页一行；跨页丢失时会变成 1
  await expect(page.getByText('已通过 3 个订单')).toBeVisible()
})

/**
 * 树表 —— `treeConfig` 一个字段，层级来自**嵌套数据本身**（没有一行构树代码）。
 * 折叠态只渲染根节点，点箭头展开第一棵子树。
 */
test('组织架构树表：嵌套 rows 直接成层级，箭头展开子部门', async ({ page }) => {
  await page.goto('/#/ai-gallery/org-tree-table')

  // Element Plus 把折叠的子树留在 DOM 里（display:none），所以按「可见 + 层级类」断言；
  // 不能用 hasText 找子部门 —— 备注列里就写着「下设平台组、前端组、测试组」。
  // 注意：层级类只加在「有子树」的行上，叶子根节点（职能中心）没有 level 类，
  // 所以根节点按可见行数数，子节点才用 level-1。
  const body = page.locator('.el-table__body-wrapper').first()
  const visibleRows = body.locator('tbody tr.el-table__row:visible')
  const children = body.locator('tbody tr.el-table__row--level-1:visible')

  await expect(visibleRows).toHaveCount(3) // 三个根部门
  await expect(visibleRows.first()).toContainText('研发中心')
  await expect(children).toHaveCount(0) // 折叠态：子部门不可见

  await body.locator('.el-table__expand-icon').first().click()

  // 研发中心下挂 3 个子部门，顺序来自嵌套 JSON 本身（没有一行构树代码）
  await expect(visibleRows).toHaveCount(6)
  await expect(children).toHaveCount(3)
  await expect(children.locator('td:nth-child(1)')).toHaveText(['平台组', '前端组', '测试组'])
})

/**
 * 展开行 —— `expandConfig` 声明「展开后看哪几个字段」，内容是纯 JSON 字段表。
 * 行数不变（展开内容不是数据行），断言落在展开出来的文案上。
 */
test('展开行：expandConfig 的字段表在行下方展开', async ({ page }) => {
  await page.goto('/#/ai-gallery/expand-row')

  await expect(rows(page)).toHaveCount(8) // pagination.pageSize
  const body = page.locator('.el-table__body-wrapper').first()
  await expect(body).not.toContainText('条款摘要')

  await body.locator('.el-table__expand-icon').first().click()

  // expandConfig.title + 四个字段的标签（这几列都不在表格里，只可能来自展开区）
  await expect(body).toContainText('合同条款')
  await expect(body).toContainText('负责人')
  await expect(body).toContainText('条款摘要')
  await expect(body).toContainText('最近复核')
  await expect(rows(page)).toHaveCount(8) // 展开不改变数据行数
})

/**
 * 分组报表 —— `mergeConfig.rowsBy` 把「相邻同值」的部门/小组列合并。
 * 页大小 8，前端两页共 10 行；首屏是「研发中心 ×4 + 产品中心 ×4」，
 * 于是部门列应有 2 个 rowspan=4，小组列应有 4 个 rowspan=2。
 */
test('分组报表：mergeConfig 生成跨行合并的单元格', async ({ page }) => {
  await page.goto('/#/ai-gallery/grouped-report')

  await expect(rows(page)).toHaveCount(8)
  await expect(total(page)).toContainText('10')

  const deptSpans = page.locator('.el-table__body-wrapper td[rowspan="4"]')
  await expect(deptSpans).toHaveCount(2)
  await expect(deptSpans.filter({ hasText: '研发中心' })).toHaveCount(1)
  await expect(deptSpans.filter({ hasText: '产品中心' })).toHaveCount(1)

  // 每个部门两个小组，每组两名负责人
  await expect(page.locator('.el-table__body-wrapper td[rowspan="2"]')).toHaveCount(4)
})

/**
 * 异构后端接管 —— 老 ERP 的两处不兼容都用配置声明：
 *   · 列表信封 `{list,totalCount}` → `configTableOut`；
 *   · 供应商下拉走 `apiParams`（字段级远程取数，**读全局 httpRequest**，
 *     不是页面传给 `<es-crud-page>` 的 prop）→ 选项必须是 mock 的那 4 家。
 * 后者是这条用例真正防的回归：宿主没接管全局请求时，下拉会静默拿到无关数据。
 */
test('异构后端：信封映射出总条数，远端下拉拿到宿主 mock 的供应商', async ({ page }) => {
  await page.goto('/#/ai-gallery/legacy-erp-api')

  await expect(rows(page)).toHaveCount(10) // pagination.pageSize
  await expect(total(page)).toContainText('23') // configTableOut: totalCount → 总条数
  // 老 ERP 把名称冗余返回，表格直接显示 supplierName，不必前端做 id→name
  await expect(rows(page).first()).toContainText('华东供应链')

  await page.getByRole('button', { name: '新增', exact: true }).click()
  const dlg = dialog(page)
  await expect(dlg).toContainText('新增商品')

  await dlg.locator('.el-select .el-select__wrapper').click()
  const droplist = page.locator('.el-select-dropdown:visible')
  await expect(droplist.locator('.el-select-dropdown__item')).toHaveCount(4)
  await expect(droplist).toContainText('远航包装')
})

/**
 * 引擎实验室 —— `tableOptions.engine: 'vxe'` 一个枚举换来三件事：
 * 5000 行翻页只渲染 50 行（虚拟滚动 / 大数据量）、双击单元格原地编辑（editConfig）、
 * 以及与原引擎一致的列声明（columns[].editRender）。
 *
 * 注意两件事：
 *   1. 提交时机是**失焦**（点别的单元格），不是回车 —— Enter/Esc 只在 `keyboardConfig`
 *      开启时才由 vxe 处理，本案例没有开，回车在输入框里什么也不做（实测）。
 *   2. 这条用例**不**能把 claim 抬到 execute —— inlineEdit 在 AN-09 的 vue3 格子里是
 *      partial（vxe 侧 keepSource 不回写 data-source），按 §6 B2 该案例三端都停在 compile。
 */
test('引擎实验室：vxe 引擎 5000 行分页 50 行，双击原地编辑', async ({ page }) => {
  await page.goto('/#/ai-gallery/engine-lab')

  await expect(page.locator('.vxe-table')).toBeVisible()
  await expect(total(page)).toContainText('5000')
  await expect(page.locator('.vxe-table .vxe-body--row')).toHaveCount(50) // pagination.pageSize

  // 金额列（第 3 列）带 editRender：双击出输入框，失焦后单元格就地更新
  const firstRow = page.locator('.vxe-table .vxe-body--row').first()
  const cell = firstRow.locator('.vxe-body--column').nth(2)
  await expect(cell).toContainText('1000.5')
  await cell.dblclick()

  const input = firstRow.locator('input')
  await expect(input).toBeVisible()
  await input.fill('1234.5')

  // 点别的单元格 = 失焦提交（keepSource 只改表格内部副本，不回写 data-source）
  await page.locator('.vxe-table .vxe-body--row').nth(1).locator('.vxe-body--column').nth(1).click()
  await expect(firstRow.locator('input')).toHaveCount(0)
  await expect(cell).toContainText('1234.5')
})
