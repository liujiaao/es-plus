import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const useDist = env.VITE_USE_DIST === 'true'
  const esPlusSrc = resolve(__dirname, '../packages/es-plus/src')
  const esPlusDist = resolve(__dirname, '../packages/es-plus/dist/es-plus.js')
  const esPlusDistCss = resolve(__dirname, '../packages/es-plus/dist/style.css')

  const aliasTarget = useDist ? esPlusDist : esPlusSrc

  return {
    base: env.VITE_BASE_URL || '/',
    plugins: [
      vue(),
      vueJsx()
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        // 所有 es-plus 子路径统一指向同一入口（dist 模式指向打包产物，否则指向源码）
        'es-plus/components/es-form': aliasTarget,
        'es-plus/components/es-table': aliasTarget,
        'es-plus/components/es-dialog': aliasTarget,
        'es-plus/components/svg-icon': aliasTarget,
        'es-plus/types': aliasTarget,
        'es-plus': aliasTarget,
        // dist 模式下样式文件指向打包产物，源码模式下指向空文件（源码样式由 Vite 自动处理）
        'es-plus-ui/dist/style.css': useDist ? esPlusDistCss : resolve(__dirname, 'src/styles/_empty.css')
      }
    },
    server: {
      port: 3000,
      host: true
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
          additionalData: `@use "@/styles/variables.scss" as *;`
        }
      }
    }
  }
})
