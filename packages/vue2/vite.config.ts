import { defineConfig } from 'vite'
import vue2 from '@vitejs/plugin-vue2'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'
import { copyFileSync } from 'fs'
import pkg from './package.json'

// vxe-types-augment.ts 是纯类型增强（declare module '@es-plus/core'），被
// tsconfig.build.json 的 exclude 排除在主 dts 之外，避免 vxe-table 类型依赖
// 泄漏进 index.d.ts、强加给所有消费者。package.json 的
// exports['./vxe-types-augment'] 单独暴露它，故在此手动拷贝到 dist —— 文件为
// 纯类型内容（import type / declare module / export {}），.ts 源可原样作为
// .d.ts。对齐 packages/vue3 中 resolver.d.ts 的 copyFileSync 做法。
function copyVxeTypesAugment() {
  return {
    name: 'copy-vxe-types-augment',
    closeBundle() {
      copyFileSync(
        resolve(__dirname, 'src/vxe-types-augment.ts'),
        resolve(__dirname, 'dist/vxe-types-augment.d.ts')
      )
    },
  }
}

/**
 * Vue 2 + Element UI 渲染层构建配置
 *
 * 与 packages/vue3 (Vue 3) 的 vite.config.ts 关键差异：
 *  - 使用 @vitejs/plugin-vue2 替代 @vitejs/plugin-vue
 *  - external 列表改为 vue / element-ui / @vue/composition-api / @es-plus/core
 *  - target 调整为 es2018 以匹配 Vue 2.6+ 用户的常见环境
 */
export default defineConfig({
  define: {
    __PKG_VERSION__: JSON.stringify(pkg.version),
  },
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
    copyVxeTypesAugment(),
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
