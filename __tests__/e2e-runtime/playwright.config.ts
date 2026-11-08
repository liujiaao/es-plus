import { defineConfig, devices } from '@playwright/test'

// Tier 2 运行时 E2E（Playwright）——真实浏览器 project：
//
//   1. `vue2`  —— vue2 的片段/CRUD（真实 Element UI + 真实 @es-plus/vue2 dist）。
//      vue3/antdv 的同类断言已由 Tier 1 vitest 覆盖，这里只补 vue2 不可行的部分。
//   2. `es-plus-docs` —— AI 案例画廊（`/ai-gallery`）与 AI CRUD 工作台（`/ai-crud`）：
//      真实 vite + 真实 Element Plus。前者验证「manifest 生成的清单 → 通用宿主 → 真实 CRUD
//      页面」这条链（tests/ai-gallery.spec.ts；manifest 的 `e2e[]` 会被
//      scripts/check-ai-cases.mjs 按本文件的 testDir/testMatch 校验），后者验证离线规则引擎
//      兜底与 AI 路径（整页 / 片段 / 故障回退）在浏览器里的真实产物（tests/ai-crud.spec.ts）。
//   3. `mobile-docs` —— 同一站点、真 390×844：窄屏的可达性与无横向溢出
//      （断言见 tests/mobile.spec.ts；源码侧的对应守卫是 scripts/check-mobile.mjs）。
//      与 2 共用 webServer，不增加启动成本。
//   4. `layout` —— 版式回归（tests/layout.spec.ts）：首页 section 数/总高/H1/首屏实拍、
//      390 下无横向溢出、演示表格可横滑。也跑在 `es-plus-docs` 那条 webServer 上；
//      它自己 setViewportSize，所以只挂了一个 project，不随 `mobile-docs` 再跑一遍。
//      为什么不挂 `vue2`：那个 fixture 只服务片段/CRUD，没有文档站。
//   5. `vue3-table` / `antdv-table`（W4）—— 表格交互：排序 / 选择 / 分页 / 导出 /
//      行内编辑各一条，用真实 Element Plus / Ant Design Vue 渲染两个包的 dist 产物。
//      这两条腿补的是「Tier 1 vitest+happy-dom 覆盖不到」的浏览器行为：表头点击后
//      真的重排、真实下载事件、vxe 行内编辑真的进编辑器。共用一台 dev server
//      （`e2e-runtime/table`，`?lib=vue3|antdv`），不增加启动成本。
const PORT = 51730
const DOCS_PORT = 51731
// 表格 fixture（vue3 / antdv 共用）：`?lib=` 选库，见 table/src/main.ts。
const TABLE_PORT = 51740

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: './playwright-report' }]]
    : 'list',
  projects: [
    {
      name: 'vue2',
      // 窄屏腿（mobile.spec.ts）打的是主站，不属于 vue2 fixture —— 两个都要排除，
      // 否则 vue2 那条 dev server 会去跑一个它根本不服务的站点。
      testIgnore: /(ai-gallery|ai-crud|mobile|layout|contrast|table-vue3|table-antdv)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${PORT}` },
    },
    {
      name: 'ai-gallery-docs',
      testMatch: /(ai-gallery|ai-crud|layout|contrast)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${DOCS_PORT}` },
    },
    {
      // 窄屏行为腿：真 390×844（Pixel 5），跑在主站上。桌面腿（ai-gallery-docs）
      // 与它共用同一个 webServer，所以这条 project 不增加任何 CI 启动成本。
      // 断言与分工见 tests/mobile.spec.ts 头注；静态四条见 scripts/check-mobile.mjs。
      name: 'mobile-docs',
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices['Pixel 5'], baseURL: `http://localhost:${DOCS_PORT}` },
    },
    {
      // vue3 表格交互腿（W4）：排序 / 选择 / 分页 / 导出 / 行内编辑各一条。
      // 用真实 Element Plus 渲染 `@es-plus/vue3` 的 dist 产物 —— Tier 1 的
      // vitest+happy-dom 覆盖不到「点击表头后浏览器里真的重排」这类行为。
      name: 'vue3-table',
      testMatch: /table-vue3\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${TABLE_PORT}` },
    },
    {
      // antdv 表格交互腿（W4）：同一套五条交互，换成 Ant Design Vue 的适配器。
      // 与 vue3-table 共用同一台 dev server（`?lib=antdv`），不增加启动成本。
      name: 'antdv-table',
      testMatch: /table-antdv\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${TABLE_PORT}` },
    },
  ],
  webServer: [
    {
      // AI-44：先把 golden 语料生成为 vue2 片段落到 fixture 的 src/fragments/，
      // 再起 dev server。生成失败必须阻断启动（否则页面会以「模块不存在」的方式
      // 报一个与真正原因无关的错）。
      command: 'node ./scripts/gen-fragments.mjs && npx --no-install vite --port 51730 --strictPort',
      cwd: './vue2',
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      // 主文档站（hash 路由）：AI 案例画廊要在真实站点里跑，而不是在 fixture 里模拟 ——
      // 画廊的清单来自 `src/cases/generated/registry.js`（由 manifest 生成），
      // 只有真站点才能证明「同步 → registry → 宿主」这条链没断。
      command: 'npx --no-install vite --port 51731 --strictPort',
      cwd: '../../es-plus-docs',
      url: `http://localhost:${DOCS_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      // 表格 fixture：一台 dev server 同时服务 vue3-table / antdv-table 两条腿。
      // 它消费 `@es-plus/{vue3,adapter-antdv}` 的 dist（workspace 软链），
      // 由 `pretest:e2e:runtime` 负责先构建。
      command: 'npx --no-install vite --port 51740 --strictPort',
      cwd: './table',
      url: `http://localhost:${TABLE_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
