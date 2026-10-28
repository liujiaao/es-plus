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
export const use = () => {}
export const watchEffect = (fn) => { fn() }
export default { use: () => {} }
`

/**
 * vue-router 桩：只保留「调用方拿得到路由表」这一件事。
 *
 * 子站的 `router/index.js` 在模块顶层就 `createRouter({ history: createWebHashHistory() })`
 * —— 真模块在 Node 里会去摸 `window`。桩让这一步变成纯对象构造，`options.routes` 于是
 * 可以被读到：**路由表是真实求值出来的**，不是从源码里正则抠的（嵌套 children 的相对
 * 路径要靠父级拼接，正则抠出来的路径少一层前缀，而少一层前缀的 URL 照样「看起来对」）。
 *
 * 桩还会**留下**注册进来的 `afterEach` 回调（`router._afterEach`），这样门禁可以拿一个假
 * 路由对象调用它，验证「router → afterEach → document.head」整条链真的接上了 ——
 * 只测 `applyPageSeo` 本身测不出「router 忘了调它」这种接线缺失。
 */
const VUE_ROUTER_SHIM = `export const createRouter = (options) => ({
  options,
  _afterEach: null,
  afterEach(fn) { this._afterEach = fn },
  beforeEach() {},
})
export const createWebHashHistory = () => ({})
export const createWebHistory = () => ({})
export default function VueRouter(options) {
  this.options = options
  this._afterEach = null
  this.afterEach = (fn) => { this._afterEach = fn }
  this.beforeEach = () => {}
}
`

/** `.vue` 单文件组件在数据加载里只需要一个占位导出 */
const COMPONENT_SHIM = 'export default {}'

/**
 * @param {string} entry 相对仓库根的入口，例如 `es-plus-docs/src/views/component-doc.data.ts`
 * @param {{ site: string, stubComponents?: boolean, stubs?: Record<string, string> }} options
 *   `site` 是站点目录名，用于推导 `@/` 别名；`stubs` 是「裸模块名 → 桩源码」；
 *   `stubComponents` 把所有 `.vue` 导入换成空组件（读路由表时用）。
 * @returns {Promise<Record<string, unknown>>} 模块命名空间
 */
export async function loadSiteModule(entry, { site, stubComponents = false, stubs = {} }) {
  mkdirSync(CACHE, { recursive: true })
  const shimPath = join(CACHE, 'vue-shim.mjs')
  writeFileSync(shimPath, VUE_SHIM)

  // 虚拟模块：一次 build 内共享，key 即 esbuild 的 resolve 结果
  const virtual = new Map()
  const stubPath = (name, source) => {
    const id = `es-stub:${name}`
    virtual.set(id, source)
    return { path: id, namespace: 'es-stub' }
  }

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
          pluginBuild.onResolve({ filter: /^@\// }, (args) => {
            const path = join(srcDir, args.path.slice(2).replace(/\?raw$/, ''))
            // 别名解析会「吃掉」后面针对 `.vue` 的桩规则（onResolve 先返回者生效），
            // 所以在同一处直接换掉
            if (stubComponents && path.endsWith('.vue')) return stubPath(`component:${path}`, COMPONENT_SHIM)
            return { path }
          })
          pluginBuild.onResolve({ filter: /^vue$/ }, () => ({ path: shimPath }))
          for (const [name, source] of Object.entries(stubs)) {
            pluginBuild.onResolve({ filter: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }, () =>
              stubPath(name, source),
            )
          }
          if (stubComponents) {
            pluginBuild.onResolve({ filter: /\.vue$/ }, (args) => stubPath(`component:${args.path}`, COMPONENT_SHIM))
          }
          pluginBuild.onLoad({ filter: /.*/, namespace: 'es-stub' }, (args) => ({
            contents: virtual.get(args.path),
            loader: 'js',
          }))
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
export { VUE_ROUTER_SHIM }
export const resolveSite = (...parts) => resolve(ROOT, ...parts)
