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
  // `.ai-gallery-comp` 现在有两个（S2 组合画廊 / S3 工具工作流），按标题选中本卡片。
  await page.locator('a.ai-gallery-comp').filter({ hasText: '组合画廊' }).click()
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

/**
 * S3 工具工作流（`/ai-gallery/workflows`）—— 12 次真 handler 调用的入参与出参。
 *
 * 这一页的主张是 `compile`（数据是真实调用结果），**不是** execute：页面不调工具，
 * 它渲染的是生成器落盘的记录。所以这里验的是三件事：
 *
 *   1. **接线真的通了**：从画廊卡片点进来（路由加了没人链 = 隐形页面）；
 *   2. **渲染与记录一致**：工具数、每条工作流的步数、工具名、成功/预期失败分布，
 *      全部对照 `docs/cases/generated/ai-workflows.js`（单一真源），不是测试常量；
 *   3. **「预期失败」没有被悄悄洗白**：恰好一步是红色 err 徽章，且那一步是
 *      `validate_config`、出参里真有点名（`InputNumbr` / 未知键 `formFields`）——
 *      若哪天校验器对所有输入都放行，这条会立刻红。
 *
 * 数据模块是 ESM（root package 是 CJS，直接 import 会走错分支），故读文本后取
 * `export const AI_WORKFLOWS = {...}` 的对象部分 —— 与生成器写出的格式一一对应。
 */
const workflowsText = readFileSync(join(ROOT, 'docs/cases/generated/ai-workflows.js'), 'utf8')
const AI_WORKFLOWS = JSON.parse(workflowsText.slice(workflowsText.indexOf('= {') + 2)) as {
  tools: string[]
  zeroCaseTools: string[]
  workflows: Array<{
    id: string
    tools: string[]
    steps: Array<{ tool: string; ok: boolean; bytes: number; truncated: boolean }>
  }>
}

test('S3 工具工作流：12 次真调用与记录逐项一致，预期失败的那一步真的失败', async ({ page }) => {
  // 入口：画廊列表 → 工具工作流（S3 卡片）。
  await page.goto('/#/ai-gallery')
  await page.locator('a.ai-gallery-comp').filter({ hasText: '工具工作流' }).click()
  await expect(page).toHaveURL(/\/ai-gallery\/workflows$/)
  await expect(page.locator('[data-testid="workflows-page"]')).toBeVisible()
  // 主张写在页面上：能重放的是「调用记录」，模型那一步是冻结输入。
  await expect(page.getByText('claim: compile')).toBeVisible()

  // 工具覆盖：12 个 chip，其中 11 个是此前只有文档的工具（高亮）。
  const chips = page.locator('[data-testid="workflows-tools"] li')
  await expect(chips).toHaveCount(AI_WORKFLOWS.tools.length)
  await expect(chips.filter({ has: page.locator('code') }).filter({ hasText: 'doctor_page' })).toHaveCount(1)
  await expect(page.locator('[data-testid="workflows-tools"] li.zero')).toHaveCount(
    AI_WORKFLOWS.zeroCaseTools.length,
  )

  // 四条工作流、12 步，逐条对照记录里的工具名与步数。
  const allSteps = AI_WORKFLOWS.workflows.flatMap((w) => w.steps)
  await expect(page.locator('article.wf-step')).toHaveCount(allSteps.length)
  for (const wf of AI_WORKFLOWS.workflows) {
    const section = page.locator(`section[data-testid="workflow-${wf.id}"]`)
    await expect(section).toBeVisible()
    await expect(section.locator('article.wf-step')).toHaveCount(wf.steps.length)
    await expect(section.locator('.wf-step-tool')).toHaveText(wf.steps.map((s) => s.tool))
  }

  // 「预期失败」恰好一步：红色徽章 + validate_config，且出参真的点名了两处写错。
  const errorSteps = allSteps.filter((s) => !s.ok)
  expect(errorSteps).toHaveLength(1)
  const errBadge = page.locator('.wf-step-state.err')
  await expect(errBadge).toHaveCount(1)
  await expect(errBadge).toHaveText('expected error')
  const errStep = page.locator('article.wf-step.is-error')
  await expect(errStep.locator('.wf-step-tool')).toHaveText(errorSteps[0].tool)
  await expect(errStep.locator('.wf-step-out')).toContainText('/fields/2/formtype')
  await expect(errStep.locator('.wf-step-out')).toContainText('未知键 "formFields"')
  // 其余步骤全部 ok —— 否则页面会把「工具坏了」展示成「工具在纠错」。
  await expect(page.locator('.wf-step-state.ok')).toHaveCount(allSteps.length - 1)

  // 出参来自真 handler（不是示例文案）：W1 首步真做了目标探测，W3 末步真按 target 渲染了 API。
  await expect(page.locator('[data-testid="workflow-w1-out-0"]')).toContainText('Detected target: vue3')
  await expect(page.locator('[data-testid="workflow-w3-out-2"]')).toContainText('EsCrudPage API (@es-plus/vue3)')
  // W4 片段三件套：各自吐出一份可独立编译的产物（表单 SFC / 自动取数的表格 / 不依赖 JSX 的弹窗 SFC）。
  await expect(page.locator('[data-testid="workflow-w4-out-0"]')).toContainText('Generated standalone <es-form> block')
  await expect(page.locator('[data-testid="workflow-w4-out-1"]')).toContainText('Auto-fetch via apiParams: /api/orders')
  await expect(page.locator('[data-testid="workflow-w4-out-2"]')).toContainText('Generated standalone <es-dialog> SFC')
  // 截断是诚实的：长出参标了「预览截断」并给出完整字节数（阈值来自记录，不是测试常量）。
  await expect(page.locator('.wf-step-bytes').filter({ hasText: '预览截断' })).toHaveCount(
    allSteps.filter((s) => s.truncated).length,
  )
})

/**
 * A8 片段拼装仪表盘（`/fragment-dashboard`）—— 这是**唯一一条跑在 ai-gallery 之外的
 * spec**（入口是 Cases 页的 CTA，不是画廊），因为它演示的不是「清单里的配置」而是
 * 「片段能不能拼回页面」：
 *
 *   · 页面上**没有 schema**：宿主自己写布局、自己调 `httpRequest`、图表是原生 SVG；
 *   · 三个片段（filter / table / dialog）是工具产物，一行未改，靠 Vue 的属性透传接线
 *     （`:model` / `:config-btn` / `:data-source` / `:pagination` / `ref.open`）；
 *   · 片段自身不 emit、也不声明 props —— 这条用例断言的正是「宿主接管后功能真的成立」：
 *     筛选 → 宿主重取数 → 行与图表同步变、点行开弹窗并回填。
 *
 * 期望值三处来源，没有一处是「随手写的数字」：
 *   1. 结构类（claim 徽章 / 目标页签 / 接线行 / 边界条数）直接读产物
 *      `docs/cases/generated/fragment-dashboard.json`（单一真源）；
 *   2. 数据类（37 条 / 6 条 / ¥183,082 / ¥27,614）来自站点演示后端 `/api/demo/orders`
 *      的确定性语料（`scripts/lib` 里同一份 37 单：关键词「恒佳」命中 6 单）；
 *   3. 分页 8 行来自宿主页的 `pager.pageSize`（宿主是代码，不是产物 —— 这里如实标注）。
 *
 * 页面在 es-pc 上同样在跑，但本仓库没有 es-pc 的 e2e project，故该端 claim 停在
 * `compile`（见产物 `sites`）：跑过的才叫 execute，人工验证不算。
 */
const fdArtifact = JSON.parse(
  readFileSync(join(ROOT, 'docs/cases/generated/fragment-dashboard.json'), 'utf8'),
) as {
  sites: Record<string, string>
  frozenArgs: { targets: string[] }
  fragments: Record<string, { tool: string; label: string; file: string }>
  host: { wiring: Array<{ fragment: string; point: string }> }
  knownGaps: string[]
}

test('A8 片段拼装：三个生成片段拼进非 CRUD 分析页，筛选/图表/弹窗都靠宿主接线', async ({ page }) => {
  // 入口：Cases 页 → 片段拼装 CTA（路由加了没人链 = 隐形页面，所以从点击开始）
  await page.goto('/#/cases')
  await page.locator('a.fragment-cta').click()
  await expect(page).toHaveURL(/\/fragment-dashboard$/)
  await expect(page.locator('[data-testid="fragment-dashboard"]')).toBeVisible()

  // claim 徽章逐站来自产物：文案与 sites 一致（页面不许现编主张）
  const claim = page.locator('.fd-claim')
  for (const [site, level] of Object.entries(fdArtifact.sites)) {
    await expect(claim.locator('.fd-chip').filter({ hasText: `${site}: ${level}` })).toHaveCount(1)
  }

  // ① 片段即组件：首屏 37 条命中（演示后端语料），表格只渲染宿主给的 8 行（pager.pageSize）
  await expect(page.locator('[data-testid="fd-count"]')).toHaveText('37 条命中')
  await expect(rows(page)).toHaveCount(8)
  await expect(page.locator('[data-testid="fd-total"]')).toHaveText('合计 ¥183,082')

  // ③ 原生图表：三条柱（待发货/已发货/已签收），高度由这一批行算出来
  const bars = page.locator('[data-testid^="fd-bar-"]')
  await expect(bars).toHaveCount(3)
  const heightsBefore = await bars.evaluateAll((els) => els.map((e) => e.getAttribute('height')))

  // ① 宿主接管查询：片段不 emit，`:config-btn` 的 click 是宿主函数 → 带条件重新取数
  const filterPane = page.locator('.fd-pane--filter')
  await filterPane.locator('.el-input__inner').first().fill('恒佳')
  await filterPane.getByRole('button', { name: '查询' }).click()

  await expect(page.locator('[data-testid="fd-count"]')).toHaveText('6 条命中')
  await expect(rows(page)).toHaveCount(6)
  await expect(page.locator('[data-testid="fd-total"]')).toHaveText('合计 ¥27,614')
  // 条件只存在于宿主：页面上如实回显它实际发给后端的参数
  await expect(filterPane.locator('.fd-note')).toContainText('keyword=恒佳')
  await expect(rows(page).first()).toContainText('深圳恒佳电子')

  // 图表读同一批行：筛选后柱高必须变（否则就是「图表另拉了一遍」或根本没重算）
  await expect
    .poll(async () => (await bars.evaluateAll((els) => els.map((e) => e.getAttribute('height')))).join(','))
    .not.toBe(heightsBefore.join(','))

  // ② 行点击冒泡到宿主 → 弹窗片段 open('查看', row)：只读模式下只剩「关闭」，且行值被回填
  await rows(page).first().locator('td').nth(1).click()
  const dlg = dialog(page)
  await expect(dlg).toBeVisible()
  await expect(dlg.locator('.el-dialog__header')).toContainText('查看')
  await expect(dlg.getByRole('button', { name: '关闭' })).toHaveCount(1)
  await expect(dlg.getByRole('button', { name: '确定' })).toHaveCount(0)
  const items = dlg.locator('.el-form-item')
  await expect(items.filter({ hasText: '客户' }).locator('input')).toHaveValue('深圳恒佳电子')
  await expect(items.filter({ hasText: '金额' }).locator('input')).toHaveValue('2514')
  await dlg.getByRole('button', { name: '关闭' }).click()
  await expect(dlg).toBeHidden()

  // 产物未经手改：三片段 × 三个目标页签都来自产物，源码区逐块非空
  for (const target of fdArtifact.frozenArgs.targets) {
    await expect(page.locator(`[data-testid="fd-target-${target}"]`)).toHaveCount(1)
  }
  await expect(page.locator('[data-testid^="fd-source-"]')).toHaveCount(Object.keys(fdArtifact.fragments).length)
  for (const key of Object.keys(fdArtifact.fragments)) {
    await expect(page.locator(`[data-testid="fd-source-${key}"] pre`)).toContainText('<template>')
  }
  // 切到 vue2 目标：同一份字段表编译出的产物从 vue 导入 2.7 语义（es-eui 因此只做语法验证）
  await page.locator('[data-testid="fd-target-vue2"]').click()
  await expect(page.locator('[data-testid="fd-source-filter"] pre')).toContainText('defineComponent')

  // 接线表与边界清单同样由产物渲染：换一份产物，这两块跟着变，不需要改模板
  await expect(page.locator('[data-testid="fd-wiring"] tbody tr')).toHaveCount(fdArtifact.host.wiring.length)
  await expect(page.locator('[data-testid="fd-gaps"] li')).toHaveCount(fdArtifact.knownGaps.length)
})
