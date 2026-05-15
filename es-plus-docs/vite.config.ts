import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const isProd = env.VITE_USE_PROD_PACKAGE === 'true'
  const esPlusRoot = isProd
    ? resolve(__dirname, '../packages/es-plus/dist')
    : resolve(__dirname, '../packages/es-plus/src')

  return {
    base: env.VITE_BASE_URL || '/',
    plugins: [
      vue(),
      vueJsx()
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        'es-plus/components/es-form': resolve(esPlusRoot, isProd ? 'es-plus.js' : 'components/es-form/index.ts'),
        'es-plus/components/es-table': resolve(esPlusRoot, isProd ? 'es-plus.js' : 'components/es-table/index.ts'),
        'es-plus/components/es-dialog': resolve(esPlusRoot, isProd ? 'es-plus.js' : 'components/es-dialog/index.ts'),
        'es-plus/components/svg-icon': resolve(esPlusRoot, isProd ? 'es-plus.js' : 'components/svg-icon/index.ts'),
        'es-plus': resolve(esPlusRoot, isProd ? 'es-plus.js' : 'index.ts')
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
