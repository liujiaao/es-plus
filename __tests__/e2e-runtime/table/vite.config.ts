import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Tier 2 表格 fixture（vue3 / antdv 两条腿共用一个 dev server，靠 `?lib=` 选库）。
//
// 与 `../vue2/vite.config.ts` 的差别：这里**不需要** Vue 2 的别名与 compiler 修补 ——
// 根 node_modules 的 vue 本来就是 Vue 3，默认解析即可。两个库都通过 workspace 软链
// 消费发布产物（`@es-plus/vue3` → dist/es-plus.js、`@es-plus/adapter-antdv` →
// dist/es-plus-antdv.js），所以跑测前必须先 `npm run build:libs`。
//
// 站点不在根 workspaces 里，但 vxe 相关的三个包现在已是 `packages/vue3` 的
// devDependencies（随 hoist 落到根 node_modules），fixture 直接 import 不会有
// 「本地能跑、CI 解析不到」的分叉。
export default defineConfig({
  plugins: [vue()],
  server: {
    fs: {
      // 允许读仓库根的 node_modules 与 packages/*（dist 产物、vxe 样式）
      allow: ['../../../..'],
    },
  },
})
