import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import Sitemap from 'vite-plugin-sitemap'
import { resolve } from 'path'
import { mkdirSync } from 'fs'

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
  '/advanced/vxe-table',
]

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const useDist = env.VITE_USE_DIST === 'true'
  const esPlusSrc = resolve(__dirname, '../packages/vue3/src')
  const esPlusDist = resolve(__dirname, '../packages/vue3/dist/es-plus.js')
  const esPlusDistCss = resolve(__dirname, '../packages/vue3/dist/style.css')
  // @es-plus/core 目标：源码模式指向 src（全实时，改核心无需重新 build），dist 模式指向 build 产物。
  // 不加此别名时 Vite 会把 @es-plus/core 当普通 node_modules 裸依赖预打包进 .vite/deps，
  // 与 monorepo 里刚重建的 build 产物脱节 —— 曾导致 patchHtmlRowSpans 等新导出加载到旧缓存版本
  // （表现：vxe 打印合并单元格失效，预览为扁平表格）。
  const esCoreTarget = useDist
    ? resolve(__dirname, '../packages/core/build')
    : resolve(__dirname, '../packages/core/src')

  const aliasTarget = useDist ? esPlusDist : esPlusSrc

  return {
    base: env.VITE_BASE_URL || '/',
    plugins: [
      // vite-plugin-sitemap 在 closeBundle 里直接 writeFileSync 到 outDir(dist)，不会自己
      // mkdir。腾讯云 edgeone 的 Linux/Node22 环境下 closeBundle 触发时 dist 尚未被 vite
      // 创建，导致 ENOENT(dist/robots.txt)。这里在 buildStart 先建好 dist 目录兜底。
      {
        name: 'ensure-dist-dir',
        buildStart() {
          mkdirSync(resolve(__dirname, 'dist'), { recursive: true })
        },
      },
      vue(),
      vueJsx(),
      Sitemap({
        hostname: SITE_HOSTNAME,
        dynamicRoutes: sitemapRoutes,
        outDir: 'dist',
      }),
    ],
    resolve: {
      // 强制 vxe-table / vxe-pc-ui 共享同一份 @vxe-ui/core 单例（避免双副本导致组件注册表分裂）
      dedupe: ['@vxe-ui/core', 'xe-utils', 'vue'],
      alias: [
        { find: '@', replacement: resolve(__dirname, 'src') },
        // packages/shared/src/structured-config.schema.ts 直接 import 'zod'，而该文件
        // 位于 es-plus-docs 之外的 monorepo 包里。Rollup 从「导入文件所在目录」向上找
        // node_modules，永远找不到 es-plus-docs/node_modules（兄弟目录）。edgeone 只装
        // es-plus-docs、不装 monorepo 根，所以必须显式把 zod 指向本站自己的 node_modules。
        { find: 'zod', replacement: resolve(__dirname, 'node_modules/zod') },
        // @es-plus/shared 是 MCP server 真实 tool 实现所在的纯函数包；
        // AI CRUD 页面浏览器侧直接 import 这套，等于跑 MCP server 同一份逻辑。
        // 走 facade 文件（src/utils/shared-browser.ts）是因为 shared 的 index 顺带
        // re-export 了 node:fs 依赖的 schema-validator —— 浏览器 bundler 解析不了。
        { find: '@es-plus/shared', replacement: resolve(__dirname, 'src/utils/shared-browser.ts') },
        // @es-plus/core 显式指向 monorepo 工作区（src 或 build），避免被当裸依赖预打包成陈旧副本。
        // 字符串前缀匹配同时覆盖子路径（如 @es-plus/core/shared）。
        { find: '@es-plus/core', replacement: esCoreTarget },
        // 所有 es-plus 子路径统一指向同一入口（dist 模式指向打包产物，否则指向源码）
        { find: 'es-plus/components/es-form', replacement: aliasTarget },
        { find: 'es-plus/components/es-table', replacement: aliasTarget },
        { find: 'es-plus/components/es-dialog', replacement: aliasTarget },
        { find: 'es-plus/components/svg-icon', replacement: aliasTarget },
        { find: 'es-plus/types', replacement: aliasTarget },
        { find: 'es-plus', replacement: aliasTarget },
        // dist 模式下样式文件指向打包产物，源码模式下指向空文件（源码样式由 Vite 自动处理）
        { find: 'es-plus-ui/dist/style.css', replacement: useDist ? esPlusDistCss : resolve(__dirname, 'src/styles/_empty.css') },
      ],
    },
    server: {
      port: 3000,
      host: true
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler'
        }
      }
    }
  }
})
