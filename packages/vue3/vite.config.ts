import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'
import { buildSync } from 'esbuild'
import { copyFileSync } from 'fs'

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
    }
  }
}

export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    dts({
      insertTypesEntry: true,
      outDir: 'dist',
      include: ['src/**/*.ts', 'src/**/*.vue'],
      exclude: ['src/**/*.spec.ts', 'src/**/__tests__/**'],
      tsconfigPath: './tsconfig.build.json',
      skipDiagnostics: true,
      noEmitOnError: false
    }),
    buildResolver()
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'EsPlus',
      formats: ['es', 'umd'],
      fileName: (format) => `es-plus.${format === 'umd' ? 'umd.cjs' : 'js'}`
    },
    rollupOptions: {
      external: ['vue', 'element-plus', '@element-plus/icons-vue'],
      output: {
        exports: 'named',
        globals: {
          vue: 'Vue',
          'element-plus': 'ElementPlus',
          '@element-plus/icons-vue': 'ElementPlusIconsVue'
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'index.css') return 'style.css'
          return assetInfo.name || 'asset'
        }
      }
    },
    sourcemap: true,
    cssCodeSplit: false
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})
