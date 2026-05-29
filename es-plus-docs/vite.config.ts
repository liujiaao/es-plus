import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import Sitemap from 'vite-plugin-sitemap'
import { resolve } from 'path'

const SITE_HOSTNAME = 'https://es-plus.dev'

// All static (non-param) routes + curated dynamic doc paths.
// Hash routing means crawlers won't auto-discover, so we list explicitly.
const sitemapRoutes = [
  '/',
  '/playground',
  '/ai-crud',
  // guide pages
  '/guide/getting-started',
  '/guide/installation',
  '/guide/usage',
  '/guide/vue2',
  '/guide/mcp-server',
  '/guide/cli',
  '/guide/permission-i18n',
  '/guide/schema-setup',
  '/guide/migration',
  '/guide/changelog',
  // component pages
  '/components/es-form',
  '/components/es-table',
  '/components/es-crud-page',
  // advanced pages
  '/advanced/use-dialog',
  '/advanced/linkage',
]

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
      vueJsx(),
      Sitemap({
        hostname: SITE_HOSTNAME,
        dynamicRoutes: sitemapRoutes,
        outDir: 'dist',
      }),
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        // @es-plus/shared 是 MCP server 真实 tool 实现所在的纯函数包；
        // AI CRUD 页面浏览器侧直接 import 这套，等于跑 MCP server 同一份逻辑。
        // 走 facade 文件（src/utils/shared-browser.ts）是因为 shared 的 index 顺带
        // re-export 了 node:fs 依赖的 schema-validator —— 浏览器 bundler 解析不了。
        '@es-plus/shared': resolve(__dirname, 'src/utils/shared-browser.ts'),
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
