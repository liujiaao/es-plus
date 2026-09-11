import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue2'

export default defineConfig({
  // Vue 2 SFC 编译。此前本配置刻意不装该插件（单测不挂载组件，真实挂载行为由
  // __tests__/e2e-runtime 的 Playwright harness 覆盖）。加入插件是为了能对
  // **接线层**做单元级验证（例如 es-form 是否真的把 required/rules 注入到
  // el-form-item）—— 这类断言在浏览器 e2e 里跑代价太高。
  // 浏览器内的真实渲染/交互行为仍以 e2e harness 为准。
  plugins: [vue()],
  test: {
    // happy-dom is needed just to import @es-plus/vue2 — element-ui touches
    // `document` at module top level (its util.js does feature detection).
    environment: 'happy-dom',
    include: ['__tests__/**/*.spec.ts'],
  },
})
