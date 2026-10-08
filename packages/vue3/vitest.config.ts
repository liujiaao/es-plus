import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue(), vueJsx()],
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['__tests__/**/*.spec.ts'],
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts', 'src/**/*.vue'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.d.ts', 'src/index.ts'],
      // 阈值 = 实测基线向下取整再减 2（基线是本配置、本包测试的真实值）：
      //   实测 88.62 / 77.54 / 67.80 / 88.62
      thresholds: {
        statements: 86,
        branches: 75,
        functions: 65,
        lines: 86,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})
