import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { resolve } from 'path'

// 站点规范域名：三站切换器（scripts/check-site-nav.mjs）与 sitemap 生成
// （scripts/gen-sitemap.mjs）都以它为「本站地址」的单一来源 —— 换域名只改这一处。
const SITE_HOSTNAME = 'https://liujiaao.github.io/es-plus'

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
      vue(),
      vueJsx(),
      // sitemap 由 `npm run sitemap:gen` 从路由表与各注册表生成到 public/sitemap.xml
      // （Vite 会把 public/ 原样拷到 dist）。此前的 vite-plugin-sitemap 只能产出路径式
      // URL，而本站是 hash 路由 —— 19 条 URL 在 GitHub Pages 上全是 404。
    ],
    resolve: {
      // 强制 vxe-table / vxe-pc-ui 共享同一份 @vxe-ui/core 单例（避免双副本导致组件注册表分裂）
      dedupe: ['@vxe-ui/core', 'xe-utils', 'vue'],
      alias: [
        { find: '@', replacement: resolve(__dirname, 'src') },
        // packages/{vue3,core,shared}/src 里 import 的裸依赖（vue / element-plus / vxe-table /
        // zod 等），都位于 es-plus-docs 之外的 monorepo 包里。Rollup 从「导入文件所在目录」
        // 向上找 node_modules，永远找不到 es-plus-docs/node_modules（兄弟目录）。edgeone 只装
        // es-plus-docs、不装 monorepo 根，所以必须显式把这些裸依赖指向本站自己的 node_modules。
        { find: 'zod', replacement: resolve(__dirname, 'node_modules/zod') },
        { find: 'vue', replacement: resolve(__dirname, 'node_modules/vue') },
        { find: 'element-plus', replacement: resolve(__dirname, 'node_modules/element-plus') },
        { find: '@element-plus/icons-vue', replacement: resolve(__dirname, 'node_modules/@element-plus/icons-vue') },
        { find: 'vxe-table', replacement: resolve(__dirname, 'node_modules/vxe-table') },
        // @es-plus/shared 是 MCP server 真实 tool 实现所在的纯函数包；
        // AI CRUD 页面浏览器侧直接 import 这套，等于跑 MCP server 同一份逻辑。
        // 走 facade 文件（src/utils/shared-browser.ts）是因为 shared 的 index 顺带
        // re-export 了 node:fs 依赖的 schema-validator —— 浏览器 bundler 解析不了。
        { find: '@es-plus/shared', replacement: resolve(__dirname, 'src/utils/shared-browser.ts') },
        // codegen-escape.ts 顶层 `import { transformSync } from 'esbuild'`（扩展点语法闸）。
        // esbuild 是 Node 原生包，其 JS 入口引用 `process` —— 打进浏览器包会让首页路由
        // 加载直接抛 `ReferenceError: process is not defined`。Node 侧（CLI/MCP/eval/测试）
        // 仍用真 esbuild；只有文档站这个浏览器宿主换成配平+形态判断的近似闸。
        // 用正则精确匹配，避免误伤潜在的 `esbuild-wasm` 等子包。
        { find: /^esbuild$/, replacement: resolve(__dirname, 'src/utils/esbuild-browser-shim.ts') },
        // @es-plus/core 显式指向 monorepo 工作区（src 或 build），避免被当裸依赖预打包成陈旧副本。
        // 字符串前缀匹配同时覆盖子路径（如 @es-plus/core/shared）。
        { find: '@es-plus/core', replacement: esCoreTarget },
        // 示例代码里写的是**发布包名** `@es-plus/vue3`（与安装文档一致，复制即用），
        // 站点内部沿用历史别名 `es-plus`（file: 依赖）。两个名字都指向同一入口，
        // 避免「示例可跑但复制到项目里 Cannot find module」这类文档与事实分叉。
        { find: '@es-plus/vue3/components/es-form', replacement: aliasTarget },
        { find: '@es-plus/vue3/components/es-table', replacement: aliasTarget },
        { find: '@es-plus/vue3/components/es-dialog', replacement: aliasTarget },
        { find: '@es-plus/vue3/components/svg-icon', replacement: aliasTarget },
        { find: '@es-plus/vue3/types', replacement: aliasTarget },
        { find: '@es-plus/vue3', replacement: aliasTarget },
        // 所有 es-plus 子路径统一指向同一入口（dist 模式指向打包产物，否则指向源码）
        { find: 'es-plus/components/es-form', replacement: aliasTarget },
        { find: 'es-plus/components/es-table', replacement: aliasTarget },
        { find: 'es-plus/components/es-dialog', replacement: aliasTarget },
        { find: 'es-plus/components/svg-icon', replacement: aliasTarget },
        { find: 'es-plus/types', replacement: aliasTarget },
        { find: 'es-plus', replacement: aliasTarget },
        // 库样式入口：dist 模式指向打包产物 style.css，源码模式指向空文件
        // （源码样式由 Vite 的 SCSS 管道自动处理）。用站点自有别名而非旧包名
        // `es-plus-ui/dist/style.css`（该包已不存在，纯误导）。
        { find: '@es-plus/style.css', replacement: useDist ? esPlusDistCss : resolve(__dirname, 'src/styles/_empty.css') },
      ],
    },
    server: {
      port: 3000,
      host: true,
      proxy: {
        // 浏览器直连 https://api.openai.com 会被 CORS 拦截。开发态提供同源代理：
        // AI CRUD 默认 baseUrl = /openai/v1 → https://api.openai.com/v1。
        // 生产环境没有这层代理，需用户自备同源网关（页面内有显著提示）。
        '/openai': {
          target: 'https://api.openai.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/openai/, ''),
          configure: (proxy) => {
            // 去掉浏览器带上的 Origin，避免目标站按来源拒绝（Host 已由 changeOrigin 改写）。
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.removeHeader('origin')
            })
          },
        },
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler'
        }
      }
    },
    build: {
      rollupOptions: {
        output: {
          // 把体积最大的第三方库拆成独立 chunk，避免全部塞进 index-*.js，
          // 并让浏览器可长期缓存。Element Plus / 全部图标仍全量引入（见
          // src/utils/install-app-plugins.ts），按需引入风险大，暂不改造。
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return
            if (id.includes('monaco-editor')) return 'monaco'
            if (
              id.includes('element-plus') ||
              id.includes('@element-plus') ||
              id.includes('@floating-ui') ||
              id.includes('lodash-es') ||
              id.includes('async-validator')
            ) {
              return 'element-plus'
            }
            if (
              id.includes('vxe') ||
              id.includes('@vxe-ui') ||
              id.includes('xe-utils') ||
              id.includes('dom-zindex')
            ) {
              return 'vxe'
            }
          }
        }
      }
    }
  }
})
