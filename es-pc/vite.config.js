import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  // 与 es-plus-docs 一致：默认走**源码模式**（改 monorepo 源码即时生效，无需重新 build），
  // 设 VITE_USE_DIST=true（.env.dist）则改用 packages/* 的打包产物。
  const useDist = env.VITE_USE_DIST === 'true'
  const esAntdvSrc = resolve(__dirname, '../packages/adapter-antdv/src')
  const esAntdvDist = resolve(__dirname, '../packages/adapter-antdv/dist/es-plus-antdv.js')
  const esAntdvDistCss = resolve(__dirname, '../packages/adapter-antdv/dist/style.css')
  // @es-plus/core：源码模式指向 src（全实时），dist 模式指向 build 产物。
  const esCoreTarget = useDist
    ? resolve(__dirname, '../packages/core/build')
    : resolve(__dirname, '../packages/core/src')
  const aliasTarget = useDist ? esAntdvDist : esAntdvSrc

  return {
    // 部署到 GitHub Pages 子路径（如 /es-plus/es-pc/）时经 VITE_BASE_URL 注入
    base: env.VITE_BASE_URL || '/',
    plugins: [vue(), vueJsx()],
    resolve: {
      // monorepo 源码（packages/adapter-antdv/src）里 import 的裸依赖位于本站之外，
      // 强制走本站 node_modules，避免多副本（尤其 vue 必须单例）。
      dedupe: ['vue', 'ant-design-vue', '@vxe-ui/core', 'xe-utils'],
      alias: [
        { find: '@', replacement: resolve(__dirname, 'src') },
        // 样式子路径必须先于包名别名，否则会被包名前缀匹配吞掉
        {
          find: '@es-plus/adapter-antdv/dist/style.css',
          replacement: useDist ? esAntdvDistCss : resolve(__dirname, 'src/styles/_empty.css'),
        },
        { find: '@es-plus/adapter-antdv', replacement: aliasTarget },
        { find: '@es-plus/core', replacement: esCoreTarget },
        // 裸依赖 pin 到本站 node_modules（源码模式下从 packages/ 解析会向上找到根部副本）
        { find: 'vue', replacement: resolve(__dirname, 'node_modules/vue') },
        { find: 'ant-design-vue', replacement: resolve(__dirname, 'node_modules/ant-design-vue') },
        { find: '@ant-design/icons-vue', replacement: resolve(__dirname, 'node_modules/@ant-design/icons-vue') },
        { find: 'dayjs', replacement: resolve(__dirname, 'node_modules/dayjs') },
        { find: 'vxe-table', replacement: resolve(__dirname, 'node_modules/vxe-table') },
        { find: 'vxe-pc-ui', replacement: resolve(__dirname, 'node_modules/vxe-pc-ui') },
        { find: '@vxe-ui/core', replacement: resolve(__dirname, 'node_modules/@vxe-ui/core') },
        { find: 'xe-utils', replacement: resolve(__dirname, 'node_modules/xe-utils') },
      ],
    },
    server: {
      port: 3000,
      open: true,
    },
    build: {
      // 分包：把体积最大的 ant-design-vue / vxe / 图标拆出主 chunk，降低首屏 index 体积。
      // 不做按需引入（风险大），仅按依赖边界拆分，可被浏览器并行缓存。
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-vue': ['vue', 'vue-router'],
            'vendor-antd': ['ant-design-vue'],
            'vendor-antd-icons': ['@ant-design/icons-vue'],
            'vendor-vxe': ['vxe-table', 'vxe-pc-ui', '@vxe-ui/core', 'xe-utils'],
          },
        },
      },
    },
  }
})
