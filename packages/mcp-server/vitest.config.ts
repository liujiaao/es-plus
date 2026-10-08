import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['__tests__/**/*.spec.ts'],
    // The test files import from src/ directly (not build/), so we don't need
    // a build step before running tests — matches the pattern used by @es-plus/shared.
    environment: 'node',
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts', 'src/**/*.vue'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.d.ts', 'src/index.ts'],
      // 阈值 = 实测基线向下取整再减 2（基线是本配置、本包测试的真实值）：
      //   实测 29.63 / 79.43 / 29.72 / 29.63
      // 本包覆盖率是三端里最低的 —— 大量分支要真起 MCP 传输层才走得到，当前只到「不许再掉」。
      thresholds: {
        statements: 27,
        branches: 77,
        functions: 27,
        lines: 27,
      },
    },
  },
})
