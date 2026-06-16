import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

/**
 * Ant Design Vue 4.x 适配器构建配置
 *
 * 与 packages/vue3 的关键差异：
 *  - external 列表改为 vue / ant-design-vue / @ant-design/icons-vue / @es-plus/core
 *  - UMD global 名改为 EsPlusAntdv
 *  - 输出文件名为 es-plus-antdv
 */
export default defineConfig({
  plugins: [
    vue(),
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
      name: 'EsPlusAntdv',
      formats: ['es', 'umd'],
      fileName: (format) => `es-plus-antdv.${format === 'umd' ? 'umd.cjs' : 'js'}`,
    },
    rollupOptions: {
      external: [
        'vue',
        'ant-design-vue',
        '@ant-design/icons-vue',
        '@es-plus/core',
      ],
      output: {
        exports: 'named',
        globals: {
          vue: 'Vue',
          'ant-design-vue': 'AntDesignVue',
          '@ant-design/icons-vue': 'AntDesignIconsVue',
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
