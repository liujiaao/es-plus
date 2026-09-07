import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { resolve } from 'path'
import { existsSync } from 'fs'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  // 本地存在 core 构建产物时指向本地（开发预览最新代码）；否则回退到 npm 包。
  const coreBuild = resolve(__dirname, '../packages/core/build')
  const alias = { '@': resolve(__dirname, 'src') }
  if (existsSync(coreBuild)) {
    alias['@es-plus/core'] = coreBuild
  }
  return {
    // 部署到 GitHub Pages 子路径（如 /es-plus/es-pc/）时经 VITE_BASE_URL 注入
    base: env.VITE_BASE_URL || '/',
    plugins: [vue(), vueJsx()],
    resolve: { alias },
    server: {
      port: 3000,
      open: true,
    },
  }
})
