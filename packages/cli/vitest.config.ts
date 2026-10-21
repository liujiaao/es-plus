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
      //   实测 75.32 / 76.74 / 95.00 / 75.32
      // 旧基线（45.04 / 74.19 / 61.11 / 45.04）已过时：命令层与 AI 路径补上接线测试后
      // 大幅抬升，故按同一公式上收，锁住「不许再掉」。仍是宽松值——CLI 的交互/文件系统
      // 分支大量依赖真实进程（prompts、终端写入），阈值只锁回归不追求高分。
      thresholds: {
        statements: 73,
        branches: 74,
        functions: 93,
        lines: 73,
      },
    },
  },
})
