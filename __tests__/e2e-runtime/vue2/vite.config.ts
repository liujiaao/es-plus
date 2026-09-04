import { createRequire } from 'node:module'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue2'

// Tier 2 fixture 的 vite 配置。
//
// 关键约束：本 monorepo 的【根】node_modules/vue 是 Vue 3（从 packages/vue3 提升上来），
// 若不干预，vite 会把 fixture 里所有 `import 'vue'` 解析到 Vue 3 —— 与 Vue 2.7 生态全面冲突。
// 因此这里把 `vue` 精确别名到 packages/vue2 自带的 Vue 2.7 runtime-esm 构建；
// element-ui / @vue/composition-api / @es-plus/vue2 dist 内部的 `import 'vue'` 也一并落到 2.7。
//
// 其余依赖走默认解析：
//   - @es-plus/vue2 → 根 node_modules 软链 → packages/vue2（package.json `module` = dist/es-plus-vue2.js，即发布产物）
//   - @es-plus/core → 软链 → packages/core（`import` = build/index.js）
//   - element-ui / @vue/composition-api / vxe-table → 根 node_modules（已提升）
const vue2Runtime = fileURLToPath(
  new URL('../../../packages/vue2/node_modules/vue/dist/vue.runtime.esm.js', import.meta.url)
)

// @vitejs/plugin-vue2 默认 resolveCompiler(root) 会从 fixture 目录向上解析 `vue/compiler-sfc`，
// 在本 monorepo 里会先命中【根】的 Vue 3 → 报 `currentInput.slice is not a function`。
// 故显式加载 packages/vue2 自带 Vue 2.7 的 compiler-sfc 传给插件，绕过错误解析。
const vue2PkgRequire = createRequire(
  fileURLToPath(new URL('../../../packages/vue2/package.json', import.meta.url))
)
const vue2Compiler = vue2PkgRequire('vue/compiler-sfc')

export default defineConfig({
  plugins: [vue({ compiler: vue2Compiler as any })],
  resolve: {
    alias: [{ find: /^vue$/, replacement: vue2Runtime }],
    // 去重，确保整个依赖图只有一份 Vue 2.7 实例
    dedupe: ['vue'],
  },
  optimizeDeps: {
    // 预打包时把 element-ui（CJS）与 composition-api 一并处理，别名指向的 2.7 也纳入
    include: ['element-ui', '@vue/composition-api'],
  },
  server: { fs: { allow: [fileURLToPath(new URL('../../../', import.meta.url))] } },
})
