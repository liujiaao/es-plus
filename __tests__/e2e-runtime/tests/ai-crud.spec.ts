import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect, type Page } from '@playwright/test'

/**
 * AI CRUD 工作台（`/#/ai-crud`，主站）—— 两条路径都要在真实浏览器里成立。
 *
 * ## 为什么这一条必须存在
 *
 * 主站的这句承诺是**双路径**的：「没配模型走本地规则引擎（与 CLI 同一实现），配了模型
 * 走 es-plus AI 原生全场景（整页 CRUD + 独立表格/表单/弹窗片段）」。此前这句话只有
 * 单测与静态守卫背书，而它们都看不见三件事：
 *
 *   1. **离线兜底真的出东西**：不填 Key 点预设，预览区要出现 es-crud-page 与产物驱动的
 *      表格，而不是空白/报错；
 *   2. **AI 路径的产物真的到得了预览**：整页配置里的 dialogs 必须在预览里点得开，
 *      片段信封必须渲染成 es-table 而不是被塞进整页 —— 这正是「字段白名单」年代
 *      静默丢掉的能力（见 `scripts/check-preview-parity.mjs` 的选择器侧对照）；
 *   3. **失败不冒充成功**：上游 500 时标签必须变成「规则引擎（AI 回退）」并提示，
 *      不能继续亮着「AI 引擎」。
 *
 * 模型调用一律用 `page.route` 打桩（确定、零成本、不碰真 key）；打桩只替换**上游响应**，
 * 解析 / 校验 / 信封路由 / 生成器 / 预览全部是站点的真代码。
 */

const AI_BASE = 'https://fake-gateway.test/v1'
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
}

/**
 * 可重放案例数直接从 manifest 读（单一真源）：「回放」能选到的条目必须正好是
 * `replay.kind === 'frozen-config'` 且有冻结配置的那些 —— 与画廊的「可机械重放」
 * 徽章同一批。写死数字的话，manifest 一更新这里就假红或假绿。
 */
const MANIFEST = JSON.parse(
  readFileSync(join(__dirname, '../../..', 'docs/cases/ai-cases.json'), 'utf8'),
) as { cases: Array<{ replay: { kind: string }; artifacts?: { config?: string } }> }
const REPLAYABLE = MANIFEST.cases.filter(
  (c) => c.replay.kind === 'frozen-config' && c.artifacts?.config,
).length

// 主站是源码模式（VITE_USE_PROD_PACKAGE=false）下的 vite dev：首屏要现编译
// element-plus / vxe 等重依赖，冷启动一次常超过默认 30s。等待交给断言（会自动重试），
// 这里只把导航的等待条件降到 domcontentloaded，避免把「编译慢」误报成「页面挂了」。
test.setTimeout(120_000)
const gotoCrud = (page: Page) => page.goto('/#/ai-crud', { waitUntil: 'domcontentloaded' })

/** 把上游 chat/completions 换成固定响应（可给 HTTP 状态码来模拟故障）。 */
async function stubModel(page: Page, payload: unknown, status = 200) {
  await page.route('**/v1/chat/completions', async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    return route.fulfill({
      status,
      headers: { ...CORS, 'content-type': 'application/json' },
      body: JSON.stringify(
        status === 200
          ? { choices: [{ message: { role: 'assistant', content: JSON.stringify(payload) } }] }
          : { error: { message: 'upstream boom' } },
      ),
    })
  })
}

/** 在设置弹窗里填好网关与 key（key 只留在内存，不落盘）。 */
async function configureAi(page: Page) {
  await page.getByRole('button', { name: 'AI 设置' }).click()
  const dlg = page.locator('.el-dialog:visible')
  await expect(dlg).toBeVisible()
  await dlg.locator('.el-form-item').filter({ hasText: 'API Key' }).locator('input').fill('sk-test')
  await dlg.locator('.el-form-item').filter({ hasText: 'Base URL' }).locator('input').fill(AI_BASE)
  await dlg.getByRole('button', { name: '保存' }).click()
  await expect(dlg).toBeHidden()
}

const previewTab = (page: Page) => page.getByRole('tab', { name: '实时预览' })

test('离线兜底：不配模型也能出整页预览，并如实标注能力边界', async ({ page }) => {
  await gotoCrud(page)

  // 六个离线预设全在（AI-only 的三个此时不该出现 —— 没配模型，点了一定没有产物）
  await expect(page.locator('[data-testid="preset-product-virtual"]')).toBeVisible()
  await expect(page.locator('[data-testid="preset-scene-table"]')).toHaveCount(0)

  await page.locator('[data-testid="preset-product-virtual"]').click()

  // 引擎标签跟**实际走通的路径**：没填 key 就是规则引擎，不是「AI 引擎」
  await expect(page.locator('[data-testid="engine-tag"]')).toHaveText('规则引擎')

  await previewTab(page).click()
  await expect(page.locator('[data-testid="preview-area"]')).toBeVisible()

  // 离线兜底的边界必须写在页面上（与 CLI 同一实现，只产 CRUD 整页）
  await expect(page.locator('[data-testid="preview-area"]')).toContainText('只生成 CRUD 整页')

  // 已知边界来自 shared 的 describeUnrenderedFeatures：virtual + cachePageSelection 两条
  await expect(page.locator('[data-testid="preview-area"]')).toContainText('虚拟滚动')
  await expect(page.locator('[data-testid="preview-area"]')).toContainText('cachePageSelection')

  // 产物驱动预览：es-crud-page 挂的是 mock 接口，5 行假数据要真的渲染出来。
  // 注意 virtual:true 时 el-table 走虚拟滚动的 DOM（不是 el-table__body-wrapper），
  // 所以断言落在**单元格内容**上 —— 这几行的值只有 mock 接口能产生。
  const area = page.locator('[data-testid="preview-area"]')
  await expect(area.getByText('商品名_1', { exact: true })).toBeVisible()
  await expect(area.getByText('商品名_5', { exact: true })).toBeVisible()
})

test('AI 整页：配置里的弹窗真的出现在预览里，点开用的是产物里的标题', async ({ page }) => {
  // 这份配置刻意带上 dialogs / actions / multiSelect —— 都是「字段白名单」年代被吞掉的能力
  await stubModel(page, {
    name: 'product',
    apiUrl: '/api/product',
    fields: [
      { prop: 'name', label: '商品名', formtype: 'Input' },
      { prop: 'stock', label: '库存', formtype: 'InputNumber' },
      { prop: 'status', label: '状态', formtype: 'Select' },
    ],
    actions: ['add', 'edit'],
    dialogs: {
      add: {
        title: '新增商品',
        // formItems 是 DialogConfig 的字段表，formtype 必填（与 fields 同一枚举）
        formItems: [
          { prop: 'name', label: '商品名', formtype: 'Input', required: true },
          { prop: 'stock', label: '库存', formtype: 'InputNumber' },
        ],
      },
    },
    tableOptions: { multiSelect: true, rowkey: 'id' },
  })

  await gotoCrud(page)
  await configureAi(page)
  await page.locator('[data-testid="preset-user-mgmt"]').click()

  await expect(page.locator('[data-testid="engine-tag"]')).toHaveText('AI 引擎')

  await previewTab(page).click()
  const area = page.locator('[data-testid="preview-area"]')
  await expect(area.locator('.el-table')).toBeVisible()

  // dialogs.add 来自上游配置 → es-crud-page 渲染出「新增」按钮，点开是「新增商品」
  await area.getByRole('button', { name: '新增', exact: true }).click()
  const dlg = page.locator('.el-dialog:visible').filter({ has: page.locator('.el-form') })
  await expect(dlg).toBeVisible()
  await expect(dlg.locator('.el-dialog__header')).toContainText('新增商品')
  await expect(dlg.locator('.el-form-item').filter({ hasText: '商品名' })).toHaveCount(1)

  // 弹窗是模态的：先关掉（否则遮罩会拦住后面的标签页点击）。
  // 弹窗按钮区同样来自产物（configBtn），这里只用它的「取消」。
  await dlg.getByRole('button', { name: '取消' }).click()
  await expect(dlg).toBeHidden()

  // 预览的 JSON 标签同样是产物本身（宿主拿到的就是这一份）
  await page.getByRole('tab', { name: 'JSON 配置' }).click()
  await expect(page.getByRole('tabpanel', { name: 'JSON 配置' }).locator('pre')).toContainText('"dialogs"')
})

test('AI 片段：表格信封渲染成独立表格，而不是塞进整页 CRUD 预览', async ({ page }) => {
  await stubModel(page, {
    tool: 'generate_table',
    args: {
      apiUrl: '/api/orders',
      fields: [
        { prop: 'orderNo', label: '订单号' },
        { prop: 'customer', label: '客户' },
        { prop: 'amount', label: '金额', formtype: 'InputNumber' },
        { prop: 'status', label: '状态', formtype: 'Select' },
      ],
      tableOptions: { border: true },
    },
  })

  await gotoCrud(page)
  await configureAi(page)

  // 配好模型后 AI-only 片段预设才出现（离线点它只会得到一段无关的 CRUD 整页）
  await page.locator('[data-testid="preset-scene-table"]').click()

  await expect(page.locator('[data-testid="engine-tag"]')).toHaveText('AI 引擎')
  await previewTab(page).click()

  const table = page.locator('[data-testid="fragment-preview-table"]')
  await expect(table).toBeVisible()
  await expect(table.locator('.el-table')).toHaveCount(1)
  // 片段自己的取数链路（es-table 的 httpRequest）→ 假数据真的出来了
  await expect.poll(async () => table.locator('.el-table__row').count()).toBeGreaterThan(0)
  await expect(table).toContainText('订单号')

  // 互斥：片段轮次不能再冒出整页预览（那会让用户以为生成错了）
  await expect(page.locator('[data-testid="preview-area"] .el-crud-page')).toHaveCount(0)

  // 代码标签里就是片段工具产物本身
  await page.getByRole('tab', { name: '生成代码' }).click()
  await expect(page.getByRole('tabpanel', { name: '生成代码' }).locator('pre')).toContainText('<es-table')
})

test('AI 故障：标签变成「规则引擎（AI 回退）」，不冒充 AI 产物', async ({ page }) => {
  await stubModel(page, null, 500)

  await gotoCrud(page)
  await configureAi(page)
  await page.locator('[data-testid="preset-user-mgmt"]').click()

  await expect(page.locator('[data-testid="engine-tag"]')).toHaveText('规则引擎（AI 回退）')
  // 回退不是静默的：页面必须说明「这一次不是 AI 生成的」
  await expect(page.locator('.el-message').last()).toBeVisible()
  // 原因挂在引擎标签的 tooltip 上。这条同时守住 ElTooltip 的按需注册 ——
  // 站点是逐组件注册 Element Plus 的，漏一个 `<el-tooltip>` 会静默变成不渲染的未知标签。
  await page.locator('[data-testid="engine-tag"]').hover()
  await expect(page.locator('.el-popper:visible').filter({ hasText: 'OpenAI 500' })).toBeVisible()

  await previewTab(page).click()
  // 回退产物仍是可用的整页（离线兜底的意义就在这里）
  await expect(page.locator('[data-testid="preview-area"] .el-table')).toBeVisible()
})

/**
 * 回放（B6）—— 零 key、零成本的「AI 路径」演示。
 *
 * 线上零 key 的访客原本只能看到规则引擎（只产 CRUD 整页）：片段、多 tab 弹窗、
 * 树表这些「AI 才做得到」的东西根本无法演示。回放把**录制下来的模型回答**喂进
 * 同一条 mcpFlow（校验 → 信封路由 → 生成 → 预览），于是：
 *
 *   · 标签必须写「回放（录制产物）」，不能冒充「AI 引擎」——它不是这一次的模型回答；
 *   · 产物必须过完整管线：预览里能看到录制配置里的弹窗/多选等能力，而不是一张平表；
 *   · 全程不发任何模型请求（这一条由「不填 key 也能跑通」本身证明）。
 */
test('回放：零 key 重放已录制的模型输出，标签如实标注', async ({ page }) => {
  // 任何模型请求都会让这条测试失败：回放不该碰网络
  let modelCalls = 0
  await page.route('**/chat/completions', async (route) => {
    modelCalls += 1
    return route.abort()
  })

  await gotoCrud(page)
  await page.locator('[data-testid="replay-open"]').click()

  const dlg = page.locator('.el-dialog:visible')
  await expect(dlg).toBeVisible()
  await expect(dlg).toContainText('不需要 API Key')
  // 条目来自 manifest 生成的 registry（7 个 frozen-config），不是页面里另写的清单
  const select = dlg.locator('[data-testid="replay-select"]')
  await expect(select).toBeVisible()
  // 录制元数据必须显示（录制日期 / 模型），否则「回放」和「实时」在界面上分不开。
  // 不钉具体模型名：清单顺序或某个案例换模型时，这条不该假红。
  // 它同时证明动态 import 的 registry 已经加载完 —— 等它再数选项，才不会数到空列表。
  await expect(dlg.locator('[data-testid="replay-meta"]')).toContainText('录制于')
  await expect(dlg.locator('[data-testid="replay-meta"]')).toContainText('模型')

  // 与画廊同一批：可选项数 === manifest 里可机械重放的案例数
  await select.click()
  await expect(page.locator('.el-select-dropdown__item')).toHaveCount(REPLAYABLE)
  await page.keyboard.press('Enter')

  await dlg.locator('[data-testid="replay-run"]').click()

  await expect(page.locator('[data-testid="engine-tag"]')).toHaveText('回放（录制产物）')
  // 重放后直接落到预览标签
  await expect(page.locator('[data-testid="preview-area"]')).toBeVisible()

  const area = page.locator('[data-testid="preview-area"]')
  await expect(area.locator('.el-table')).toBeVisible()
  // 录制配置（employee-roster）里有 add/edit/view 三个弹窗 → 按钮必须真的出现
  await expect(area.getByRole('button', { name: '新增', exact: true })).toBeVisible()

  expect(modelCalls).toBe(0)
})
