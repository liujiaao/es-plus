import { defineConfig } from 'vite'
import vue2 from '@vitejs/plugin-vue2'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

/**
 * Vue 2 + Element UI 渲染层构建配置
 *
 * 与 packages/vue3 (Vue 3) 的 vite.config.ts 关键差异：
 *  - 使用 @vitejs/plugin-vue2 替代 @vitejs/plugin-vue
 *  - external 列表改为 vue / element-ui / @vue/composition-api / @es-plus/core
 *  - target 调整为 es2018 以匹配 Vue 2.6+ 用户的常见环境
 */
export default defineConfig({
  plugins: [
    vue2(),
    dts({
      insertTypesEntry: true,
      outDir: 'dist',
      include: ['src/**/*.ts', 'src/**/*.vue'],
      exclude: ['src/**/*.spec.ts', 'src/**/__tests__/**'],
      tsconfigPath: './tsconfig.build.json',
      skipDiagnostics: true,
      noEmitOnError: false,
    }),
  ],
  build: {
    target: 'es2018',
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'EsPlusVue2',
      formats: ['es', 'umd'],
      fileName: (format) => `es-plus-vue2.${format === 'umd' ? 'umd.cjs' : 'js'}`,
    },
    rollupOptions: {
      // 注意：@vue/composition-api 故意不放进 external —— 把它内联进 dist。
      // 原因：vue-compat.ts 顶层有 `import * as ... from '@vue/composition-api'`，
      // 若 external 则消费者必须装这个包，与"Vue 2.7+ 用户无需安装"的承诺冲突。
      // 内联后 Vue 2.7 用户不装也能 build；运行时 isVue27Plus 分支让 polyfill 代码 dead-but-resident。
      external: [
        'vue',
        'element-ui',
        '@es-plus/core',
      ],
      output: {
        exports: 'named',
        globals: {
          vue: 'Vue',
          'element-ui': 'ELEMENT',
          '@es-plus/core': 'EsPlusCore',
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'index.css') return 'style.css'
          return assetInfo.name || 'asset'
        },
      },
    },
    sourcemap: true,
    cssCodeSplit: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
