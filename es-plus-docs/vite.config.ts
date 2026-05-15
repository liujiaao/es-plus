import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, process.cwd())

  // 生产模式使用打包后的包，开发模式使用源码
  const isProd = env.VITE_USE_PROD_PACKAGE === 'true'

  return {
    plugins: [
      vue(),
      vueJsx()
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        // 生产模式使用 npm 包，开发模式使用源码
        'es-plus': isProd
          ? resolve(__dirname, '../packages/es-plus/dist')
          : resolve(__dirname, '../packages/es-plus/src')
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
