import { defineConfig } from 'vite'
import vue2 from '@vitejs/plugin-vue2'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

/**
 * Vue 2 + Element UI 渲染层构建配置
 *
 * 与 packages/es-plus (Vue 3) 的 vite.config.ts 关键差异：
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
      external: [
        'vue',
        '@vue/composition-api',
        'element-ui',
        '@es-plus/core',
      ],
      output: {
        exports: 'named',
        globals: {
          vue: 'Vue',
          '@vue/composition-api': 'VueCompositionAPI',
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
