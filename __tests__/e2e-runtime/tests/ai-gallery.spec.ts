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
 * 服务端排序 —— `tableOptions.sortParam`（`defaultSort` 播种首屏，表头变化保留当前页重取）。
 *
 * 这条断言能成立的唯一原因是**参数真的到了后端**：mock 只在收到 `sortField` / `sortOrder`
 * 时才按参数排（收不到就回落到金额降序）。因此「点表头后行序变了」等价于「请求带上了
 * 排序参数」；首屏是降序同样来自参数（`defaultSort` 播种），不是本地排序凑出来的。
 *
 * 列序：multiSelect 前置选择列 → 订单号 / 客户 / 渠道 / **金额** / 状态 / 创建时间，
 * 所以金额是第 5 个 `td`。断言只比大小关系（升序 / 降序），不写死具体数字。
 */
test('订单批量：点金额表头按服务端排序重取，且保留当前页', async ({ page }) => {
  await page.goto('/#/ai-gallery/order-batch')
  await expect(rows(page)).toHaveCount(8)

  const amounts = async () =>
    (
      await page
        .locator('.el-table__body-wrapper')
        .first()
        .locator('tbody tr.el-table__row td:nth-child(5)')
        .allInnerTexts()
    ).map((t) => Number(t.replace(/[^\d.]/g, '')))
  const ascending = (xs: number[]) => xs.every((x, i) => i === 0 || xs[i - 1] <= x)
  const descending = (xs: number[]) => xs.every((x, i) => i === 0 || xs[i - 1] >= x)

  const header = page.locator('.el-table__header-wrapper th').filter({ hasText: '金额（元）' })
  // 产物里 amount 列 sortable:true + tableOptions.sortParam 声明 → 组件把列降为 'custom'：
  // 表头照常可点、指示器照常翻转，但数据由后端给（首屏已按 defaultSort 排好）。
  await expect(header).toHaveAttribute('aria-sort', 'descending')
  const page1Desc = await amounts()
  expect(descending(page1Desc)).toBe(true)

  // el-table 的点击循环是 descending → 清空 → ascending → descending（原生语义，不另造一套）：
  // 首屏被 defaultSort 播种成 descending，所以第 1 击是**清空**排序。清空后请求不带排序参数，
  // mock 回落到金额降序 —— 数据不变、指示器消失，正好证明「清空 ≠ 发空串参数」。
  await header.click()
  await expect(header).not.toHaveAttribute('aria-sort', 'descending')
  expect(descending(await amounts())).toBe(true)

  // 第 2 击 → 升序，按新排序重取（仍停在第 1 页）
  await header.click()
  await expect(header).toHaveAttribute('aria-sort', 'ascending')
  await expect.poll(async () => ascending(await amounts())).toBe(true)
  const page1Asc = await amounts()

  // 翻到第 2 页：升序下「第 2 页的每一行都大于第 1 页的每一行」只有在后端排了整份数据时
  // 才成立（本地排当前页的话，跨页之间根本不存在这种关系）。
  // 判据用 expect.poll 包住整个跨页关系：页码先翻、数据后到（mock 有 120ms 延迟），
  // 单读一次会把第 1 页的旧数据当成第 2 页（曾因此假通过又假失败）。
  await page.locator('.el-pager li').filter({ hasText: /^2$/ }).click()
  await expect(page.locator('.el-pager li.is-active')).toHaveText('2')
  await expect
    .poll(async () => {
      const xs = await amounts()
      return xs.length === 8 && ascending(xs) && Math.min(...xs) > Math.max(...page1Asc)
    })
    .toBe(true)

  // 第 3 击 → 降序：排序变化**保留当前页**（仍停在 2），数据换成降序的第二段
  await header.click()
  await expect(header).toHaveAttribute('aria-sort', 'descending')
  await expect(page.locator('.el-pager li.is-active')).toHaveText('2')
  await expect
    .poll(async () => {
      const xs = await amounts()
      return xs.length === 8 && descending(xs) && Math.max(...xs) < Math.min(...page1Desc)
    })
    .toBe(true)
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
 * 引擎实验室 —— `tableOptions.engine: 'vxe'` 一个枚举换掉整颗渲染引擎，顺带拿到三件事：
 * 与 el-table 同形状的列声明 / 事件契约、5000 条按页取数（每页 50 行）、
 * 以及双击单元格原地编辑（`editConfig` + `columns[].editRender`）。
 *
 * 三件容易搞错的事：
 *   1. 提交时机是**失焦**（点别的单元格），不是回车 —— Enter/Esc 只在 `keyboardConfig`
 *      开启时才由 vxe 处理，本案例没有开，回车在输入框里什么也不做（实测）。
 *   2. 编辑**确实**写回 `:data-source` 里的行对象：vxe 的 loadTableData 只对入参做
 *      `reactive(datas.slice(0))`（同一批引用），`keepSource` 另存的那份快照只供
 *      `revertData()` 回滚。旧的说法「改的是内部副本、不回写」是错的（已于 2026-10-26 更正）。
 *   3. 宿主要知道「改了哪一格、旧值多少」得靠 es-plus 归一的 `cell-edit`
 *      （vxe 原生 edit-closed 只有 { row, column }）—— 本用例断言这条事件真的到达宿主。
 *
 * 这条用例**不**把 claim 抬到 execute：`tableOptions.editConfig` 在 AN-09 能力矩阵里是
 * partial（只有部分引擎 / 子键生效），按 §6 B2 该案例三端都停在 compile。
 */
test('引擎实验室：一个枚举换 vxe，双击原地编辑并把改动回传宿主', async ({ page }) => {
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

  // 点别的单元格 = 失焦提交
  await page.locator('.vxe-table .vxe-body--row').nth(1).locator('.vxe-body--column').nth(1).click()
  await expect(firstRow.locator('input')).toHaveCount(0)
  await expect(cell).toContainText('1234.5')

  // 宿主收到 cell-edit({ row, prop, value, oldValue })，据此在提示里报出「哪一行、旧值 → 新值」
  const toast = page.locator('.el-message').last()
  await expect(toast).toContainText('SO-100000')
  await expect(toast).toContainText('1000.5 → 1234.5')
})

/**
 * S2 组合画廊（`/ai-gallery/composition`）—— 18 例组合语料（6 个逻辑案例 × 3 端）。
 *
 * 这一页的主张是 `measure + compile`，**不是** execute：它不运行生成的页面（那是每个
 * S1 案例自己的 e2e 在管），只证明两件事在浏览器里也成立 ——
 *
 *   1. **度量对得上**：逐项对照（语料声明 vs 实际组合事实）全绿，且成员关系高亮
 *      （`data-faces`）是生成器算出来的，不是页面自己又推了一遍；
 *   2. **三端一份配置**：切渲染端后 pageSchema 逐字节不变；片段形状只差渲染端包名。
 *
 * 数据单源在 `docs/cases/generated/composition-gallery.js`（`check:composition-gallery`
 * 重算并逐字节比对），所以这里可以「切下拉 → 对比文本」来钉主张，
 * 而不是把期望值抄一份进测试（抄的那份会先漂移、且仍然显示全绿）。
 */
test('S2 组合画廊：对照全绿、成员关系可读，切渲染端只差包名', async ({ page }) => {
  // 入口：画廊列表 → 组合画廊。路由加上了但没人链 = 隐形页面，所以从点击开始。
  await page.goto('/#/ai-gallery')
  await page.locator('a.ai-gallery-comp').click()
  await expect(page).toHaveURL(/\/ai-gallery\/composition$/)
  await expect(page.locator('[data-testid="composition-page"]')).toBeVisible()
  await expect(page.getByText('claim: measure + compile')).toBeVisible()

  const verdict = page.locator('[data-testid="composition-verdict"]')
  await expect(verdict).toHaveText('全部命中')

  // 成员关系：full 形状里至少有一个字段同时出现在 query/table/form 三个面，
  // 且「成员关系」那一行逐项对照是 ✓（两处都读生成器算好的值）。
  await expect(page.locator('[data-testid^="composition-field-"][data-faces="3"]').first()).toBeVisible()
  await expect(page.locator('[data-testid="composition-check-membership"]')).toContainText('✓')

  // 「三端一份配置」：full 形状的 pageSchema 与渲染端无关 —— 切到 antdv 后逐字节相同。
  const schema = page.locator('[data-testid="composition-page-schema"]')
  const asVue3 = await schema.textContent()
  expect(asVue3?.length ?? 0).toBeGreaterThan(0)
  await page.locator('[data-testid="composition-target"]').selectOption('antdv')
  await expect(page.locator('[data-testid="composition-target"]')).toHaveValue('antdv')
  await expect(verdict).toHaveText('全部命中')
  await expect(schema).toHaveText(asVue3!)

  // 切到片段形状（form+dialog）：同一份意图表发的是 dialog composable，不是 CRUD 页。
  await page.locator('[data-testid="composition-shape"]').selectOption('form+dialog')
  await expect(page.getByRole('heading', { name: /dialog composable/ })).toBeVisible()
  await expect(page.locator('h3', { hasText: 'useAddDialog' })).toBeVisible()
  await expect(verdict).toHaveText('全部命中')
  await expect(page.locator('[data-testid="composition-base"] option')).toHaveCount(2) // comp-form-dialog-01/02

  // 三端对照：渲染端包名逐行如实显示（这一列是页面唯一的端间差异来源）。
  const threeEnd = page.locator('section.cg-panel').filter({ hasText: '三端对照' })
  await expect(threeEnd).toContainText('@es-plus/vue2')
  await expect(threeEnd).toContainText('@es-plus/adapter-antdv')
  await expect(page.locator('[data-testid="composition-target-note"]')).toContainText('渲染端')

  // 片段产物跨端只差渲染端包名：归一化后逐字节相同（这是「一份配置」的准确说法）。
  const fragOf = () => page.locator('h3:has-text("useAddDialog") + pre').textContent()
  await page.locator('[data-testid="composition-target"]').selectOption('vue3')
  const fragVue3 = (await fragOf()) ?? ''
  await page.locator('[data-testid="composition-target"]').selectOption('vue2')
  const fragVue2 = (await fragOf()) ?? ''
  expect(fragVue3).toContain('@es-plus/vue3')
  expect(fragVue2).toContain('@es-plus/vue2')
  const normalize = (s: string) => s.replace(/@es-plus\/(vue3|vue2|adapter-antdv)/g, '@es-plus/RENDERER')
  expect(normalize(fragVue3)).toBe(normalize(fragVue2))
})
