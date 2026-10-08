import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['__tests__/**/*.spec.ts'],
    // 测试直接从 src/ 导入（非 build/），无需先构建——与 @es-plus/mcp-server 一致。
    environment: 'node',
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts', 'src/**/*.vue'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.d.ts', 'src/index.ts'],
      // 阈值 = 实测基线向下取整再减 2（基线是本配置、本包测试的真实值）：
      //   实测 45.04 / 74.19 / 61.11 / 45.04
      // 数值低是因为 CLI 的交互/文件系统分支大量依赖真实进程，阈值只锁「不许再掉」。
      thresholds: {
        statements: 43,
        branches: 72,
        functions: 59,
        lines: 43,
      },
    },
  },
})
