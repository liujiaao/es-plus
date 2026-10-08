import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['__tests__/**/*.spec.ts', 'src/**/*.spec.ts'],
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts', 'src/**/*.vue'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.d.ts', 'src/index.ts'],
      // 阈值 = 实测基线向下取整再减 2。基线是**带本配置**跑出来的（口径见上：
      // 排除 index.ts 这类纯 re-export 桶文件后，statements 实测 90.87）。
      //   实测 90.87 / 88.94 / 92.85 / 90.87
      // 减 2 是给 Node 版本 / 平台差异留余量 —— 同机同代码重复跑都实测到过
      // 0.07 个百分点的漂移，钉死整数分位会让 CI 因环境差异莫名变红。
      thresholds: {
        statements: 88,
        branches: 86,
        functions: 90,
        lines: 88,
      },
    }
  }
})
