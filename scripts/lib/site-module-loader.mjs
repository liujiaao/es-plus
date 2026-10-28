/**
 * 在 Node 里把站点里的 TS 数据模块真正**加载**出来。
 *
 * 背景：`doc-registry.ts` / `component-doc.data.ts` / `advanced-doc.data.ts` 是页面
 * 渲染用的唯一真源，而 `llms.txt` 与每页 `.md` 镜像要的正是同一批标题、同一批 API 表。
 * 两条路可选：
 *   a. 用正则把 `props: [...]` 抠出来 —— 等于在 Node 里再实现半遍 TS 解析器。嵌套对象、
 *      多行字符串、注释里的逗号，任何一处都会让抠出来的表格**悄悄少一行**，而产物里
 *      少一行的样子和「本来就这么多行」完全一样，没有门禁能发现；
 *   b. 编译后真 import —— 拿到的就是站点跑起来的同一份对象，少一行不可能不被察觉。
 *
 * 这里走 b。esbuild 是仓库已有依赖（@es-plus/core 的构建也用它），它只要替掉三处
 * Vite 专属写法就能在 Node 里跑：
 *   · `import.meta.glob(…, { query: '?raw', eager: true })` → 空对象
 *     （镜像只用标题与表格文本；示例源码另有单源，不在这里复制第二遍）
 *   · `@/…` 别名 → 站点 src 目录；`?raw` 的 markdown → 文本 loader
 *   · `vue` 的 `defineAsyncComponent` → 恒等 shim（数据模块只拿它包示例组件）
 *
 * 编译产物落在 `node_modules/.cache/`：它不是仓库产物，也不该被提交 —— 每次调用都
 * 重新编译，避免拿着上一次的旧对象。
 */
import { build } from 'esbuild'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CACHE = join(ROOT, 'node_modules', '.cache', 'site-module-loader')

let seq = 0

/**
 * 只替换数据模块真正用到的那几个 vue 导出。
 * 写成文件而不是 esbuild 的 `define`：`define` 只能换表达式，换不掉 import。
 */
const VUE_SHIM = `export const defineAsyncComponent = (x) => x
export const defineComponent = (options) => options
export const computed = (fn) => ({ value: fn })
export const ref = (value) => ({ value })
export const reactive = (value) => value
export const h = (...args) => args
`

/**
 * @param {string} entry 相对仓库根的入口，例如 `es-plus-docs/src/views/component-doc.data.ts`
 * @param {{ site: string }} options `site` 是站点目录名，用于推导 `@/` 别名
 * @returns {Promise<Record<string, unknown>>} 模块命名空间
 */
export async function loadSiteModule(entry, { site }) {
  mkdirSync(CACHE, { recursive: true })
  const shimPath = join(CACHE, 'vue-shim.mjs')
  writeFileSync(shimPath, VUE_SHIM)

  const srcDir = join(ROOT, site, 'src')
  const outName = `${site}-${entry.split('/').pop().replace(/\W+/g, '-')}-${seq++}.mjs`

  const result = await build({
    entryPoints: [join(ROOT, entry)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    absWorkingDir: ROOT,
    logLevel: 'warning',
    // Vite 的 glob 导入 → 空对象。`define` 只能换标识符，所以 banner 里补一个同名桩，
    // 让 `import.meta.glob(...)` 变成 `__globStub__(...)`。
    define: { 'import.meta.glob': '__globStub' },
    banner: { js: 'function __globStub() { return {} }' },
    plugins: [
      {
        name: 'es-plus-site-module',
        setup(pluginBuild) {
          // `@/docs/x.md?raw`：剥掉 `?raw`，剩下的交给下面的文本 loader
          pluginBuild.onResolve({ filter: /^@\// }, (args) => ({
            path: join(srcDir, args.path.slice(2).replace(/\?raw$/, '')),
          }))
          pluginBuild.onResolve({ filter: /^vue$/ }, () => ({ path: shimPath }))
          pluginBuild.onLoad({ filter: /\.md$/ }, (args) => ({
            contents: readFileSync(args.path, 'utf-8'),
            loader: 'text',
          }))
        },
      },
    ],
  })

  const outPath = join(CACHE, outName)
  writeFileSync(outPath, result.outputFiles[0].text)
  // 带查询串 import：同一进程里多次加载不会命中 ESM 模块缓存
  return import(`${pathToFileURL(outPath).href}?v=${Date.now()}-${seq++}`)
}

export { ROOT }
export const resolveSite = (...parts) => resolve(ROOT, ...parts)
