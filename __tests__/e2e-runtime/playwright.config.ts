import { defineConfig, devices } from '@playwright/test'

// Tier 2 运行时 E2E（Playwright）——两个真实浏览器 fixture：
//
//   1. `vue2`  —— vue2 的片段/CRUD（真实 Element UI + 真实 @es-plus/vue2 dist）。
//      vue3/antdv 的同类断言已由 Tier 1 vitest 覆盖，这里只补 vue2 不可行的部分。
//   2. `es-plus-docs` —— AI 案例画廊（`/ai-gallery`）：真实 vite + 真实 Element Plus，
//      验证「manifest 生成的清单 → 通用宿主 → 真实 CRUD 页面」这条链在浏览器里真的成立
//      （断言见 tests/ai-gallery.spec.ts；manifest 的 `e2e[]` 会被 scripts/check-ai-cases.mjs
//      按本文件的 testDir/testMatch 校验，写进 manifest 却跑不起来的 spec 会当场变红）。
const PORT = 51730
const DOCS_PORT = 51731

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
      testIgnore: /ai-gallery\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${PORT}` },
    },
    {
      name: 'ai-gallery-docs',
      testMatch: /ai-gallery\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${DOCS_PORT}` },
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
  ],
})
