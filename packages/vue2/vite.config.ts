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
      // @vue/composition-api 必须 external：内联会让 dist 里出现一份独立的 polyfill，
      // 与消费者项目 node_modules 里的那份是两个 JS 模块实例，各自持有私有的 `$e`
      // (registered Vue)。Vue 2.6 下 Vue.use(EsPlus) 只能给其中一份注册 Vue，另一份
      // 在 setup() 里调 reactive() 时会抛 "[vue-composition-api] No vue dependency found."。
      // 代价：Vue 2.7+ 用户也需在依赖里装 @vue/composition-api（其 postinstall 会
      // redirect 到原生 vue；即便 redirect 失败，isVue27Plus 分支也不会调用 polyfill）。
      external: [
        'vue',
        'element-ui',
        '@es-plus/core',
        '@vue/composition-api',
      ],
      output: {
        exports: 'named',
        globals: {
          vue: 'Vue',
          'element-ui': 'ELEMENT',
          '@es-plus/core': 'EsPlusCore',
          '@vue/composition-api': 'VueCompositionAPI',
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
