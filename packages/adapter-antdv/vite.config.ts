import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'
import { buildSync } from 'esbuild'
import { copyFileSync } from 'fs'

/**
 * Ant Design Vue 4.x 适配器构建配置
 *
 * 与 packages/vue3 的关键差异：
 *  - external 列表改为 vue / ant-design-vue / @ant-design/icons-vue / @es-plus/core
 *  - UMD global 名改为 EsPlusAntdv
 *  - 输出文件名为 es-plus-antdv
 */

/**
 * 单独构建 resolver 子产物（esm + cjs + d.ts）
 *
 * package.json 的 exports["./resolver"] 声明了 dist/resolver.{mjs,cjs,d.ts}，
 * 用于 unplugin-vue-components 自动导入。主 lib 构建只产出 index 入口，
 * resolver 在此用 esbuild 单独编译，对齐 packages/vue3 的做法。
 */
function buildResolver() {
  return {
    name: 'build-resolver',
    closeBundle() {
      buildSync({
        entryPoints: [resolve(__dirname, 'src/resolver.ts')],
        outfile: resolve(__dirname, 'dist/resolver.mjs'),
        format: 'esm',
        platform: 'node',
        target: 'node14',
      })
      buildSync({
        entryPoints: [resolve(__dirname, 'src/resolver.ts')],
        outfile: resolve(__dirname, 'dist/resolver.cjs'),
        format: 'cjs',
        platform: 'node',
        target: 'node14',
      })
      copyFileSync(
        resolve(__dirname, 'src/resolver.d.ts'),
        resolve(__dirname, 'dist/resolver.d.ts')
      )
    },
  }
}

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
    buildResolver(),
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
        // dayjs 与 ant-design-vue 共用同一实例，避免 DatePicker 的
        // isDayjs / locale 跨实例失效（必须 external，不可打包进产物）
        'dayjs',
      ],
      output: {
        exports: 'named',
        globals: {
          vue: 'Vue',
          'ant-design-vue': 'AntDesignVue',
          '@ant-design/icons-vue': 'AntDesignIconsVue',
          '@es-plus/core': 'EsPlusCore',
          dayjs: 'dayjs',
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
