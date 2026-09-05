import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue(), vueJsx()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      // 使用 dist 产物 (通过 node_modules symlink -> package.json main/module)
      // @es-plus/core 别名用于 dist 产物的外部依赖解析
      '@es-plus/core': resolve(__dirname, '../packages/core/build'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
})
