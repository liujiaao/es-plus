import { defineConfig, devices } from '@playwright/test'

// Tier 2 运行时 E2E（Playwright）——目前仅覆盖 vue2（vue3/antdv 已由 Tier 1 vitest 覆盖）。
// webServer 自动起 fixture 的 vite dev server；真实 Chromium 渲染真实 Element UI + 真实 @es-plus/vue2 dist。
const PORT = 51730

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx --no-install vite --port 51730 --strictPort',
    cwd: './vue2',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
