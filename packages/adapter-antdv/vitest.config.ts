import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'

export default defineConfig({
  plugins: [vue(), vueJsx()],
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.spec.ts', '__tests__/**/*.spec.ts'],
    // 20 个 spec 各自加载 ant-design-vue + vxe-table（重依赖）到 happy-dom。
    // 多 worker 并行时 collection 阶段资源竞争会拖垮/超时，导致模块只加载
    // 一半、describe 未注册，vitest 误报 "No test suite found"（间歇性变红）。
    // 串行运行消除该 flaky，代价约 +30s，稳定性优先。
    fileParallelism: false,
  },
})
