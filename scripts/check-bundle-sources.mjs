#!/usr/bin/env node
/**
 * 首屏预算的**源码层前门**（路线图 3.6）。
 *
 * `check-bundle-budget.mjs` 称的是构建产物的重量，只有构建完才知道结果；
 * 而让首屏变重的那几件事，在源码里都长着同一副面孔 ——「一行看起来很正常的 import /
 * 一个 `eager: true`」。等产物称出来再回查，中间已经过了一轮构建、一次代码评审。
 * 这个脚本把两条判据前移到源码层：
 *
 *   1. **高亮器只注册文档用到的语言。**
 *      `import hljs from 'highlight.js'` 是**全集**入口（190 种语言，含 mathematica、
 *      isbl、gml、sqf），实测把文档路由的共享 chunk 从 ~24KB gz 撑到 311KB gz。
 *      判据有两层：
 *        a. 全部文档 markdown 里的每一条 fence 语言，`getLanguage(lang)` 都非空
 *           —— 少注册一种，那篇文档的代码块会静默失去着色（不报错，只是变灰）；
 *        b. 注册语言总数 ≤ 40 —— 谁把 import 换回全集，这条立刻红。
 *      只做一个方向都拦不住：只查 (a)，全集引入永远通过；只查 (b)，注册表被删到
 *      只剩三种也通过（而文档里 11 种语言，其中 8 种没了颜色）。
 *
 *   2. **示例组件与示例源码不许在指南路由里 eager 加载。**
 *      `/guide/*` 的正文里 `<demo>` 是稀疏的（18 篇共 ~40 处），但示例有 103 个。
 *      `{ eager: true }` 会让每一篇指南——哪怕一个 demo 都没有——下载全部示例组件
 *      （~145KB gz）与它们的源码文本（115KB gz）。判据按文件分档：
 *        · 指南注册表（example-registry.ts）：两个 glob 都不许 eager；
 *        · /components、/advanced 的注册表：组件 glob 不许 eager（它们渲染时同步需要
 *          源码文本，raw glob 允许 eager —— 这是已知的、待处理的另一笔账）。
 *
 *   3. **vxe 引擎只按需注册。** 全量注册 344.2KB gz，只有 `/advanced/vxe-table` 与
 *      `/ai-gallery/<id>` 用得到。判据是「入口不许值导入」+「清单与数据一致」两层，
 *      细节见下面第 3 节的注释。
 *
 *   4. **Element Plus 只注册站点用到的标签。** `app.use(ElementPlus)` 是 356.2KB gz 的
 *      全量注册，而站点模板只用三十来个标签。判据是「模板标签 ⊆ 显式清单」+「没有
 *      回退到全量插件」，细节见下面第 4 节的注释。
 *
 *   5. **指南正文与搜索索引都不在首屏。** 全部指南正文（343KB 原文）曾经跟着入口走：
 *      注册表被搜索索引静态引用，而搜索索引又被顶栏的搜索框静态引用。判据是
 *      「谁不许静态 import 语料」+「三处 slug 清单必须在同一份上」，见第 5 节。
 *
 *   6. **两个子站（es-pc / es-eui）与主站同构的若干件事**：Ant Design Vue 只有显式清单
 *      （`app.use(Antd)` 是全量，仅 es-pc），vxe 只在用到它的两条路由注册。判据见第 6 节。
 *
 * 用法：node scripts/check-bundle-sources.mjs
 * 退出码：0 = 六条判据都成立；1 = 有缺口（逐条列出文件与行号）。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadSiteModule } from './lib/site-module-loader.mjs'
import { normalizeEol } from './lib/docs-mirror.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SITE = 'es-plus-docs'
const SRC = join(ROOT, SITE, 'src')

const problems = []
const fail = (msg) => problems.push(msg)
const read = (path) => normalizeEol(readFileSync(path, 'utf-8'))
const rel = (path) => relative(ROOT, path).replace(/\\/g, '/')

/** 全集入口注册 190 种语言；只注册用到的十几个 —— 这条线是「别换回全集」的开关 */
const MAX_LANGUAGES = 40

// ── 1. 高亮器 ──────────────────────────────────────────────────────────────

/**
 * 解析 markdown 的 fence 语言。
 *
 * 必须是**状态机**而不是「每行扫 ```」：文档里有四重反引号包住三重反引号的例子，
 * 逐行扫会把它中间那些「看起来像 fence 的语言名」也算进来（曾把 `###`、`the`、
 * `works` 当成语言名报上来）。
 */
function fenceLanguages(text) {
  const found = []
  let open = null
  for (const line of text.split('\n')) {
    const m = line.match(/^[ \t]{0,3}(`{3,}|~{3,})[ \t]*([\w+#-]*)/)
    if (!m) continue
    if (open === null) {
      open = { marker: m[1][0], size: m[1].length }
      if (m[2]) found.push(m[2].toLowerCase())
      continue
    }
    // 关闭：同种标记、长度不短于开启、且后面不带语言名
    if (m[1][0] === open.marker && m[1].length >= open.size && !m[2]) open = null
  }
  return found
}

function markdownFiles(dir) {
  const found = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...markdownFiles(full))
    else if (extname(entry.name) === '.md') found.push(full)
  }
  return found
}

async function checkHighlight() {
  let module
  try {
    module = await loadSiteModule(`${SITE}/src/utils/highlight.mjs`, { site: SITE })
  } catch (error) {
    fail(`加载 ${SITE}/src/utils/highlight.mjs 失败：${error.message}`)
    return
  }
  const hljs = module.default
  const before = problems.length
  if (!hljs || typeof hljs.getLanguage !== 'function') {
    fail(`${SITE}/src/utils/highlight.mjs 没有默认导出可用的 hljs 实例`)
    return
  }

  const languages = hljs.listLanguages()
  if (languages.length > MAX_LANGUAGES) {
    fail(
      `高亮器注册了 ${languages.length} 种语言（上限 ${MAX_LANGUAGES}）—— 这是全集入口（highlight.js 主入口）的特征，`
        + '它会把文档路由的共享 chunk 从 ~24KB gz 撑到 311KB gz。改成 highlight.js/lib/core + 逐个 registerLanguage',
    )
  }

  // 文档里出现的每一种 fence 语言都必须点得亮
  const files = markdownFiles(SRC)
  if (!files.length) {
    fail(`${SITE}/src 下没有找到任何 markdown —— 扫描规则大概率已失效`)
    return
  }
  const used = new Map()
  for (const file of files) {
    for (const lang of fenceLanguages(read(file))) {
      if (!used.has(lang)) used.set(lang, file)
    }
  }
  if (!used.size) fail(`${SITE}/src/**/*.md 里一条 fence 都没扫到 —— 解析规则大概率已失效`)

  for (const [lang, file] of used) {
    if (!hljs.getLanguage(lang)) {
      fail(`\`\`\`${lang} 没有注册（首次出现在 ${rel(file)}）—— 在 ${SITE}/src/utils/highlight.mjs 里 registerLanguage 一下`)
    }
  }

  // 示例卡片的三个代码 tab 与纯文本兜底：由 CodePlayground 的 TAB_LANG 决定
  for (const lang of ['html', 'js', 'css', 'text']) {
    if (!hljs.getLanguage(lang)) fail(`示例卡片要用的 \`${lang}\` 高亮没有注册（CodePlayground.vue 的 TAB_LANG）`)
  }

  // 源码层面再挡一次「换回全集」：import 写法比行为更早暴露意图。
  // 判据是**语句**而不是「这一行里有没有这串字」——说明文字里引用 `import hljs from
  // 'highlight.js'` 是在讲这条判据本身（本文件就写着），不能把它自己判红。
  const FULL_BUNDLE_IMPORT = /^\s*(?:import\s+[^'"\n]*from\s+['"]highlight\.js['"]|import\s+['"]highlight\.js['"]|export\s+[^'"\n]*from\s+['"]highlight\.js['"]|(?:const|let|var)\s+\w+\s*=\s*require\(\s*['"]highlight\.js['"]\s*\))/
  const sources = []
  const collect = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) collect(full)
      else if (/\.(ts|tsx|js|mjs|vue)$/.test(entry.name)) sources.push(full)
    }
  }
  collect(SRC)
  for (const file of sources) {
    const text = read(file)
    text.split('\n').forEach((line, index) => {
      if (FULL_BUNDLE_IMPORT.test(line)) {
        fail(`${rel(file)}:${index + 1} 引入了 highlight.js 全集入口 —— 改成 from '@/utils/highlight.mjs'`)
      }
    })
  }

  if (problems.length > before) return
  console.log(
    `✅ 高亮器只注册用到的语言：${languages.length} 种（上限 ${MAX_LANGUAGES}），`
      + `覆盖 ${used.size} 种 fence 语言 / ${files.length} 篇 markdown；没有文件引入全集入口`,
  )
}

// ── 2. 示例的 eager 加载 ──────────────────────────────────────────────────

/**
 * 三个示例注册表各自的策略。
 * `eagerAllowed` 里的 glob 描述为什么允许 —— 写清楚理由，否则下一个人只会看到例外。
 */
const REGISTRIES = [
  {
    file: `${SITE}/src/components/doc/example-registry.ts`,
    label: '指南内嵌示例（/guide/*）',
    // 指南正文里 demo 稀疏、页面又不要求源码先到 —— 没有一条 glob 需要 eager
    eagerAllowed: [],
  },
  {
    file: `${SITE}/src/views/component-doc.data.ts`,
    label: '组件 API 页示例（/components/*）',
    // 渲染时同步要源码文本（raw），组件本体仍必须惰性
    eagerAllowed: ["query: '?raw'"],
  },
  {
    file: `${SITE}/src/views/advanced-doc.data.ts`,
    label: '高级用法页示例（/advanced/*）',
    eagerAllowed: ["query: '?raw'"],
  },
]

function checkEagerGlobs() {
  const before = problems.length
  let checked = 0
  for (const registry of REGISTRIES) {
    const abs = join(ROOT, registry.file)
    if (!existsSync(abs)) {
      fail(`${registry.file} 不存在 —— 注册表改名了就把这里一起改`)
      continue
    }
    const text = read(abs)
    // 每个 import.meta.glob( ... ) 调用取到配平的右括号
    const calls = []
    for (let at = text.indexOf('import.meta.glob('); at !== -1; at = text.indexOf('import.meta.glob(', at + 1)) {
      let depth = 0
      let end = at
      for (; end < text.length; end++) {
        if (text[end] === '(') depth++
        else if (text[end] === ')') {
          depth--
          if (depth === 0) break
        }
      }
      calls.push(text.slice(at, end + 1))
    }
    if (!calls.length) {
      fail(`${registry.file} 里没有 import.meta.glob —— 扫描规则大概率已失效`)
      continue
    }
    // 两个 glob 的模式必须逐字相同：组件与源码是按**同一个键**（文件路径）取的，
    // 模式一旦改成不一样，源码加载器就取不到对应条目 —— 页面不报错，只是源码面板空白
    const patterns = calls.map((call) => (call.match(/^\s*import\.meta\.glob\(\s*'([^']+)'/) || [])[1])
    if (new Set(patterns).size !== 1) {
      fail(`${registry.file} 里的 glob 模式不一致（${patterns.join(' vs ')}）—— 组件与源码的键会对不上，源码面板会空白`)
    }
    for (const call of calls) {
      if (!/components\/examples/.test(call)) continue
      checked++
      if (!/eager:\s*true/.test(call)) continue
      if (registry.eagerAllowed.some((allow) => call.includes(allow))) continue
      const line = text.slice(0, text.indexOf(call)).split('\n').length
      fail(
        `${registry.file}:${line} 的示例 glob 用了 eager: true（${registry.label}）`
          + ' —— 它会让每个路由入口一次性打包全部 103 个示例。改成惰性 glob + 需要时再 load',
      )
    }
  }
  if (checked === 0) fail('三个示例注册表里一个 glob 都没扫到 —— 扫描规则大概率已失效')
  if (problems.length > before) return
  console.log(`✅ 示例加载策略：${checked} 个 glob 已核对（指南注册表全惰性，API 页只允许 raw 文本 eager）`)
}

// ── 3. vxe 引擎的按需加载 ─────────────────────────────────────────────────

/**
 * vxe-table + vxe-pc-ui 全量注册是 344.2 KB gz。它曾经静态写在 `main.ts` 顶层，
 * 于是**每一页**（含首页与全部指南）都先付这笔钱，而真正渲染 `engine: 'vxe'` 的只有
 * `/advanced/vxe-table` 与 `/ai-gallery/<id>`（engine-lab 案例）。
 *
 * 这个块的判据分两层，缺一层就拦不住：
 *   a. **不许退回入口**：`main.ts` 不能值导入 vxe；除 `utils/vxe-install.ts` 外没有别的
 *      源文件值导入它（那个文件只被 `utils/vxe-loader.ts` 动态 import）。
 *   b. **清单要与数据一致**：`vxe-loader.ts` 里的路由清单是从数据反查的 ——
 *      `components/examples/<dir>/*.vue` 里写了 `engine: 'vxe'` 的目录、`cases/**` 里
 *      `engine: "vxe"` 的案例，都必须对应到清单里的路由。新增一个 vxe 示例却忘了改清单，
 *      页面会渲染出「未安装 vxe」的提示框（不是白屏，但也够难看），这里提前红。
 *
 * 为什么还要产物层那条（check-bundle-budget）：样式表被分到 vxe chunk 时，浏览器为了
 * 应用 CSS 会在入口静态 import 那个 JS 块 —— 源码层一条都看不出来，实测白改（993.7 →
 * 994.6）。两层各守一半。
 */
const VXE_PKGS = ['vxe-table', 'vxe-pc-ui']
const VXE_VALUE_IMPORT = new RegExp(`^\\s*import\\s+(?!type\\b)[^'"]*from\\s+['"](${VXE_PKGS.join('|')})['"]`)

/** 逐行去掉注释行：注释里写 `import VxeTable from 'vxe-table'` 是文档，不是引入 */
function codeLines(text) {
  return text
    .split('\n')
    .map((line, i) => ({ text: line, no: i + 1 }))
    .filter(({ text }) => {
      const t = text.trim()
      return t && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*') && !t.startsWith('<!--')
    })
}

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(abs))
    else out.push(abs)
  }
  return out
}

const hasVxeEngine = (node) => {
  if (!node || typeof node !== 'object') return false
  if (node.engine === 'vxe') return true
  return Object.values(node).some(hasVxeEngine)
}

function checkVxeOnDemand() {
  const before = problems.length
  const loaderPath = join(SRC, 'utils/vxe-loader.ts')
  const installPath = join(SRC, 'utils/vxe-install.ts')
  const mainPath = join(SRC, 'main.ts')

  // a. 谁在值导入 vxe
  const sourceFiles = walk(SRC).filter((f) => /\.(ts|vue|mjs|js)$/.test(f))
  for (const file of sourceFiles) {
    for (const { text, no } of codeLines(read(file))) {
      if (!VXE_VALUE_IMPORT.test(text)) continue
      if (file === installPath) continue
      fail(
        `${rel(file)}:${no} 值导入了 vxe —— 344.2KB 会跟着它所在的路由/入口一起下载。`
          + ' 需要注册就调 utils/vxe-loader.ts 的 ensureVxe(app)',
      )
    }
  }
  if (codeLines(read(mainPath)).some(({ text }) => VXE_VALUE_IMPORT.test(text))) {
    fail(`${rel(mainPath)} 又把 vxe 引回入口了 —— 首屏会重新多出 344.2KB`)
  }
  if (!existsSync(loaderPath) || !existsSync(installPath)) {
    fail('utils/vxe-loader.ts 与 utils/vxe-install.ts 必须同时存在（动态加载的落点）')
    return
  }

  // b. 清单 ← 数据
  const loader = read(loaderPath)
  const slug = (loader.match(/advancedVxeTable:\s*'([^']+)'/) || [])[1]
  const galleryName = (loader.match(/galleryCase:\s*'([^']+)'/) || [])[1]
  if (!slug || !galleryName) {
    fail(`${rel(loaderPath)} 里读不到 advancedVxeTable / galleryCase —— 清单结构变了就把这里一起改`)
    return
  }
  const routerSrc = read(join(SRC, 'router/index.ts'))
  if (!routerSrc.includes(`name: 'advanced'`)) fail('router/index.ts 里没有 name: \'advanced\' —— 清单里的 advanced 分支对不上')
  if (!routerSrc.includes(`name: '${galleryName}'`)) {
    fail(`router/index.ts 里没有 name: '${galleryName}' —— vxe-loader 的清单指向了一条不存在的路由`)
  }

  // 示例：哪些示例目录真的用了 vxe 引擎
  const examplesDir = join(SRC, 'components/examples')
  const vxeDirs = new Set()
  for (const file of walk(examplesDir)) {
    if (!file.endsWith('.vue')) continue
    if (!/engine:\s*['"]vxe['"]/.test(read(file))) continue
    vxeDirs.add(relative(examplesDir, file).split(/[\\/]/)[0])
  }
  if (vxeDirs.size === 0) {
    fail('一个 engine:"vxe" 的示例都没扫到 —— 扫描规则大概率已失效（或 vxe 示例被整体删了，那就把清单一起删）')
  }
  const advancedData = read(join(SRC, 'views/advanced-doc.data.ts'))
  for (const dir of vxeDirs) {
    if (!advancedData.includes(`getComponent('${dir}/`)) {
      fail(`components/examples/${dir} 用了 vxe，却没被 advanced-doc.data.ts 引用 —— 扫描规则可能已失效`)
    }
    if (dir !== slug) {
      fail(
        `components/examples/${dir} 用了 vxe，但 vxe-loader 只为 /advanced/${slug} 加载 vxe`
          + ` —— /advanced/${dir} 会渲染出「未安装 vxe」的提示`,
      )
    }
  }

  // 案例：哪些 JSON 配置用了 vxe 引擎
  const casesDir = join(SRC, 'cases')
  const registryPath = join(casesDir, 'generated/registry.js')
  const registry = existsSync(registryPath) ? read(registryPath) : ''
  const vxeCases = []
  for (const file of walk(casesDir)) {
    if (!file.endsWith('.json') || /\.(story|meta)\.json$/.test(file)) continue
    let json
    try {
      json = JSON.parse(read(file))
    } catch {
      continue
    }
    if (!hasVxeEngine(json)) continue
    const id = relative(casesDir, file).split('.')[0].replace(/\\/g, '/').split('/').pop()
    // `engine-lab.json`（渲染用）与 `engine-lab.config.json`（生成器输入）是同一条案例
    if (vxeCases.includes(id)) continue
    vxeCases.push(id)
    if (!registry.includes(id)) {
      fail(`${rel(file)} 用了 vxe 引擎，但它不在 ai-gallery 的 registry 里 —— 宿主若不渲染，清单里的 ${galleryName} 就是多余的`)
    }
  }
  if (!vxeCases.length) fail('一个 engine:"vxe" 的案例 JSON 都没扫到 —— 扫描规则大概率已失效')
  if (!loader.includes(galleryName)) fail(`${rel(loaderPath)} 里没有 ${galleryName} —— 案例宿主拿不到 vxe`)

  if (problems.length > before) return
  console.log(
    `✅ vxe 按需加载：入口无值导入；清单 = ${vxeDirs.size} 个示例目录（/advanced/${slug}）`
      + ` + ${vxeCases.length} 个案例（${vxeCases.join('/')} → ${galleryName}）`,
  )
}

// ── 4. Element Plus 的按需注册 ─────────────────────────────────────────────

/**
 * `app.use(ElementPlus)` 是**全量**注册：356.2 KB gz 的组件库跟着每一页下载，而站点自己的
 * 模板只用到三十来个标签（`@es-plus/*` 内部是直接 import 组件的，从不依赖全局注册）。
 *
 * 换成显式清单之后的失败模式是「页面看起来正常、某个组件突然不渲染」——它只会在
 * 恰好走到那个页面时暴露，而且常常是一个空格/一条分割线没了，肉眼很难归因。
 * 所以清单不能靠人维护：这个块扫**全部 .vue 模板里的 `<el-xxx>` 标签**，逐个映射成
 * PascalCase 去和 `install-app-plugins.ts` 的 ELEMENT_PLUS_COMPONENTS 对账。
 *
 * 也要挡住另一条退路：把 `app.use(ElementPlus)` 写回来（那会让 356 KB 悄悄回到首屏，
 * 而页面**看起来完全正常**，只有称产物才发现）。
 *
 * 图标不在此列：`@es-plus/vue3` 自己 `import * as` 了整个图标包，站点注册不注册都一样重。
 */
function checkElementPlusOnDemand() {
  const before = problems.length
  const pluginsPath = join(SRC, 'utils/install-app-plugins.ts')
  if (!existsSync(pluginsPath)) {
    fail('utils/install-app-plugins.ts 不存在 —— 改名了就把这里一起改')
    return
  }
  const plugins = read(pluginsPath)
  for (const { text, no } of codeLines(plugins)) {
    if (/^\s*import\s+\w+\s+from\s+['"]element-plus['"]/.test(text) || /app\.use\(\s*ElementPlus\b/.test(text)) {
      fail(
        `${rel(pluginsPath)}:${no} 又用回了 ElementPlus 全量插件 —— 首屏会多出 356.2KB`
          + '（页面看起来完全正常，只有构建产物称重才发现）。把标签加进 ELEMENT_PLUS_COMPONENTS',
      )
    }
  }

  const registryBlock = plugins.match(/ELEMENT_PLUS_COMPONENTS[^{]*\{([\s\S]*?)\n\}/)
  if (!registryBlock) {
    fail(`${rel(pluginsPath)} 里读不到 ELEMENT_PLUS_COMPONENTS 清单 —— 结构变了就把这里一起改`)
    return
  }
  const registered = new Set(
    registryBlock[1]
      .split('\n')
      .map((line) => (line.match(/^\s{2}(El\w+)/) || [])[1])
      .filter(Boolean),
  )
  if (registered.size < 10) {
    fail(`${rel(pluginsPath)} 的组件清单只解析到 ${registered.size} 个 —— 扫描规则大概率已失效`)
    return
  }

  // 模板标签 → 组件名：el-table-column → ElTableColumn
  const pascal = (tag) => 'El' + tag.slice(3).split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join('')

  const vueFiles = walk(SRC).filter((file) => file.endsWith('.vue'))
  const missing = new Map()
  for (const file of vueFiles) {
    for (const { text, no } of codeLines(read(file))) {
      for (const m of text.matchAll(/<(el-[a-z0-9-]+)[\s/>]/g)) {
        const name = pascal(m[1])
        if (!registered.has(name)) {
          const key = `${name}`
          if (!missing.has(key)) missing.set(key, [])
          missing.get(key).push(`${rel(file)}:${no}`)
        }
      }
    }
  }
  for (const [name, places] of missing) {
    fail(
      `模板里用了 <${name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}>（${places.slice(0, 3).join('、')}`
        + `${places.length > 3 ? ` 等 ${places.length} 处` : ''}），但 ELEMENT_PLUS_COMPONENTS 里没有 ${name}`
        + ' —— 那个组件会整块不渲染（页面其余部分看起来正常）',
    )
  }

  if (problems.length > before) return
  console.log(
    `✅ Element Plus 按需注册：模板用了 ${vueFiles.length} 个 .vue 里的全部 <el-*> 标签`
      + ` 都能在清单（${registered.size} 个组件）里找到；没有回退到全量插件`,
  )
}

// ── 5. 指南正文与搜索索引的按需加载 ───────────────────────────────────────

/**
 * 全部指南正文（343 KB 原文 / 120 KB gz）曾经**跟着每一页的入口走**：
 *
 *   AppHeader（入口）→ DocSearch.vue → utils/search-index.ts → docs/doc-registry.ts
 *                                                             → 18 篇 .md + 5 篇英文
 *
 * 没有任何一行「导入指南」，链路却让首页先读完整站正文。首屏 index 块 219.8 KB 里
 * 的大头就是它。现在分成两条按需路径：
 *
 *   · **正文**：`docs/doc-meta.ts`（几百字节的标题表）常驻；正文由
 *     `docs/doc-content.ts` 的惰性 glob 一次取一篇。
 *   · **搜索**：`utils/search-engine.ts` 装着 fuse + 全部正文，只在第一次打开搜索时
 *     被 `await import()` 取一次。
 *
 * 判据分三层，缺一层都能悄悄退化：
 *   a. **谁不许静态 import 语料**：`docs/doc-registry`（正文全集）、`utils/search-index`
 *      （案例目录 + 逐页 meta）、`fuse.js` 只允许出现在 `utils/search-engine.ts` 里，
 *      且 `Doc.vue` 不许再引用注册表。有第二个引用者，语料就跟着那个引用者进包。
 *   b. **搜索必须是动态 import**：`DocSearch.vue` 里要出现 `await import('@/utils/search-engine')`，
 *      并且不许静态引用上面那三个模块（写成 `import ... from` 就白改）。
 *   c. **三处 slug 清单必须同源**：`doc-meta.ts` 的 DOC_META、`doc-registry.ts` 的
 *      CONTENT（中文正文）、磁盘上的 `<slug>.md`，三者集合必须相等；每个 `enFile`
 *      必须在 CONTENT_EN 里有正文、磁盘上有文件。少一处就是「侧栏有、页面空」。
 */
const DOC_CORPUS_IMPORTS = [
  { spec: '@/docs/doc-registry', why: '它把全部指南正文静态打进包（343 KB 原文）' },
  { spec: '@/utils/search-index', why: '它带案例目录与逐页 meta，只有搜索用得到' },
  { spec: 'fuse.js', why: '搜索引擎本体，只有打开搜索时才需要' },
]
/** 唯一允许静态引用语料的模块：它自己只被 DocSearch 动态 import */
const CORPUS_OWNER = 'utils/search-engine.ts'

/** 从 `const X[: T] = {` 到配平的右花括号，返回顶层的 `'key':` 集合（`export` 可有可无） */
function objectLiteralKeys(text, name) {
  const decl = new RegExp(`(?:export\\s+)?const\\s+${name}\\b`).exec(text)
  if (!decl) return []
  const open = text.indexOf('{', decl.index)
  if (open === -1) return []
  let depth = 0
  let end = open
  for (; end < text.length; end++) {
    if (text[end] === '{') depth++
    else if (text[end] === '}') {
      depth--
      if (depth === 0) break
    }
  }
  const body = text.slice(open + 1, end)
  const keys = new Set()
  const re = /^\s{2}['"]?([A-Za-z0-9-]+)['"]?\s*:/gm
  let m
  while ((m = re.exec(body))) keys.add(m[1])
  return [...keys]
}

/**
 * 已知的孤儿正文（磁盘上有、注册表里没有）。**这是一份待办清单，不是允许清单**：
 * 每一项都会被打印出来，新增的孤儿一律判红。
 *
 * `crud-page.md`：626 行的「整页 CRUD」长文，从来没有接进任何注册表 —— 它既不在
 * /guide（没有路由），也不在 /components（那里的 es-crud-page 是另一份 API 页）。
 * 要么接成一篇指南（要同时进侧栏与 NAV_ORDER），要么删掉；性能批次不该顺手决定
 * 信息架构，所以先在这里挂个显式的名字。
 */
const KNOWN_ORPHAN_DOCS = ['crud-page']

function checkDocContentOnDemand() {
  const before = problems.length
  const sources = walk(SRC).filter((f) => /\.(ts|vue|mjs|js)$/.test(f))
  const relSrc = (file) => relative(SRC, file).replace(/\\/g, '/')

  // a. 谁在静态 import 语料（`import type` 编译后消失，不算）
  for (const file of sources) {
    const isOwner = relSrc(file) === CORPUS_OWNER
    for (const { text, no } of codeLines(read(file))) {
      for (const { spec, why } of DOC_CORPUS_IMPORTS) {
        // 只认静态 import / export from：动态 `import('x')` 正是我们要的形状
        const staticImport = new RegExp(
          `^\\s*(?:import\\s+(?!type\\b)[^'"\\n]*from\\s+|export\\s+(?!type\\b)[^'"\\n]*from\\s+)['"]${spec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`,
        )
        if (!staticImport.test(text)) continue
        if (isOwner) continue
        fail(
          `${rel(file)}:${no} 静态引用了 ${spec} —— ${why}。`
            + ` 只能由 ${SITE}/src/${CORPUS_OWNER} 引用，且它必须只被动态 import（否则首屏又背上整站正文）`,
        )
      }
    }
  }
  if (!existsSync(join(SRC, 'utils/search-engine.ts'))) {
    fail(`${SITE}/src/utils/search-engine.ts 不存在 —— 搜索的按需落点没了，改路径就把这里一起改`)
    return
  }

  // b. 搜索必须动态 import，且 Doc.vue 不许再碰注册表
  const searchVue = read(join(SRC, 'components/doc/DocSearch.vue'))
  if (!/await import\(\s*['"]@\/utils\/search-engine['"]\s*\)/.test(searchVue)) {
    fail('DocSearch.vue 没有动态 import @/utils/search-engine —— 搜索索引会跟着顶栏进入口')
  }
  const docVue = read(join(SRC, 'views/Doc.vue'))
  if (/'@\/docs\/doc-registry'/.test(docVue)) {
    fail('Doc.vue 又引用了 docs/doc-registry —— 指南路由会重新下载全部正文；正文请走 docs/doc-content')
  }
  if (!/'@\/docs\/doc-content'/.test(docVue)) {
    fail('Doc.vue 没有用 docs/doc-content 的 loadGuide —— 正文加载方式变了就把这里一起改')
  }

  // c. 三处 slug 清单同源
  const metaKeys = objectLiteralKeys(read(join(SRC, 'docs/doc-meta.ts')), 'DOC_META')
  const registry = read(join(SRC, 'docs/doc-registry.ts'))
  const zhKeys = objectLiteralKeys(registry, 'CONTENT')
  const enKeys = objectLiteralKeys(registry, 'CONTENT_EN')
  if (!metaKeys.length || !zhKeys.length) {
    fail('doc-meta.ts / doc-registry.ts 里解析不到 slug 清单 —— 扫描规则与源码结构脱节')
    return
  }
  const diskFiles = readdirSync(join(SRC, 'docs')).filter((f) => f.endsWith('.md'))
  const EN_FILE = /\.en\.md$/
  // 英文别名的历史例外：文件名不等于 <slug>.en.md 的，由 doc-meta 的 enFile 显式声明
  const aliasFiles = new Set(
    [...registry.matchAll(/from '@\/docs\/([^']+)\.md\?raw'/g)].map((m) => m[1]).filter((n) => /\.en$|^migrate-v1\.4$/.test(n)),
  )
  const diskZh = diskFiles
    .map((f) => f.replace(/\.md$/, ''))
    .filter((n) => !EN_FILE.test(`${n}.md`) && n !== 'migrate-v1.4')

  const diff = (a, b) => a.filter((x) => !b.includes(x))
  for (const slug of diff(metaKeys, zhKeys)) fail(`doc-meta.ts 声明了 '${slug}'，但 doc-registry.ts 的 CONTENT 里没有它的正文`)
  for (const slug of diff(zhKeys, metaKeys)) fail(`doc-registry.ts 有 '${slug}' 的正文，但 doc-meta.ts 没声明 —— 这个页面打不开`)
  for (const slug of diff(metaKeys, diskZh)) {
    fail(`doc-meta.ts 声明了 '${slug}'，但 src/docs/${slug}.md 不存在 —— 页面会渲染成空`)
  }
  for (const slug of diff(diskZh, metaKeys)) {
    if (KNOWN_ORPHAN_DOCS.includes(slug)) {
      console.log(`⚠️  已知孤儿正文：src/docs/${slug}.md 没有注册（待定：接成指南或删除）`)
      continue
    }
    fail(`src/docs/${slug}.md 存在，但 doc-meta.ts 没声明 —— 这篇正文永远不会被渲染（写漏了？）`)
  }
  for (const slug of diff(enKeys, metaKeys)) fail(`doc-registry.ts 有 '${slug}' 的英文正文，但 doc-meta.ts 没这个 slug`)

  // 带译文的 slug：声明、正文、磁盘文件三处都要有
  const declaredEn = [...read(join(SRC, 'docs/doc-meta.ts')).matchAll(/enFile:\s*'([^']+)'/g)].map((m) => m[1])
  for (const file of declaredEn) {
    if (!diskFiles.includes(`${file}.md`)) fail(`doc-meta.ts 的 enFile '${file}' 在 src/docs/ 下没有对应文件`)
    if (!aliasFiles.has(file)) fail(`doc-meta.ts 的 enFile '${file}' 没有在 doc-registry.ts 的 CONTENT_EN 里搬进来`)
  }
  for (const file of diskFiles.map((f) => f.replace(/\.md$/, '')).filter((n) => EN_FILE.test(`${n}.md`))) {
    if (!declaredEn.includes(file)) {
      fail(`src/docs/${file}.md 是一篇英文正文，但没有 slug 通过 doc-meta 的 enFile 指向它 —— 它会变成孤儿页`)
    }
  }

  if (problems.length > before) return
  console.log(
    `✅ 指南正文 / 搜索索引按需：${zhKeys.length} 篇中文正文（一次一篇）`
      + ` + ${enKeys.length} 篇英文；语料只被 ${CORPUS_OWNER} 引用，搜索走动态 import；`
      + ' doc-meta / doc-registry / 磁盘三处 slug 一致',
  )
}

// ── 6. 子站（es-pc / es-eui）的按需注册 / 按需加载 ──────────────────────────

/**
 * 上面第 3、4 块是主站 es-plus-docs 的。两个子站有同样两个坑，而且它们占首屏的比例
 * 更大（2026-10-28 实测入口：es-pc 1027.9 KB gz，es-eui 667.6 KB）：
 *
 *   a. **Ant Design Vue 只有显式清单**（仅 es-pc）。`app.use(Antd)` 是全量注册；站点模板
 *      只用到 26 组标签。ADV 的每个组件带 `install()`，会把子组件一起注册，所以这里
 *      对账的是**组名**（`Menu` 管 `a-menu-item` / `a-sub-menu`），与主站 Element Plus 的
 *      「一个标签一个组件」不同。失败模式一样：页面看起来正常，某个组件整块不渲染。
 *   b. **vxe 只在两条路由注册**（两站同构）。es-pc 是 `/es-vxe-table`（17 个示例）与
 *      `/ai-gallery/<id>`；es-eui 是 `/component/vxetable` 与 `/ai-gallery/<id>`。
 *      注册落在各自的 `utils/vxe-install.js`，只被 `utils/vxe-loader.js` 动态 import。
 *
 * 这里不复用主站的实现：三个站的目录结构、数据来源（`views/es-vxe/*` vs
 * `components/examples/*`）、插件 API（`app.use` vs `Vue.use`）都不同，硬套一份查询码
 * 只会让两边的判据互相将就。
 */
const PC_SRC = join(ROOT, 'es-pc/src')
const EUI_SRC = join(ROOT, 'es-eui/src')

/** `<a-tag>` → 注册它的组名。不在表里的标签一律判红（新标签要先把组名加进 install-antd.js） */
const ANTD_TAG_GROUPS = {
  alert: 'Alert',
  avatar: 'Avatar',
  button: 'Button',
  card: 'Card',
  checkbox: 'Checkbox',
  'checkbox-group': 'Checkbox',
  col: 'Col',
  'config-provider': 'ConfigProvider',
  descriptions: 'Descriptions',
  'descriptions-item': 'Descriptions',
  divider: 'Divider',
  dropdown: 'Dropdown',
  empty: 'Empty',
  form: 'Form',
  'form-item': 'Form',
  input: 'Input',
  layout: 'Layout',
  'layout-header': 'Layout',
  'layout-sider': 'Layout',
  'layout-content': 'Layout',
  'layout-footer': 'Layout',
  menu: 'Menu',
  'menu-item': 'Menu',
  'menu-divider': 'Menu',
  'sub-menu': 'Menu',
  modal: 'Modal',
  progress: 'Progress',
  radio: 'Radio',
  'radio-group': 'Radio',
  'radio-button': 'Radio',
  row: 'Row',
  select: 'Select',
  'select-option': 'Select',
  space: 'Space',
  step: 'Steps',
  steps: 'Steps',
  switch: 'Switch',
  'tab-pane': 'Tabs',
  table: 'Table',
  'table-column': 'Table',
  tabs: 'Tabs',
  tag: 'Tag',
}

/** 这一行是不是**值导入**某个包（`import type` 编译后消失，不算） */
const valueImportOf = (pkgs) =>
  new RegExp(`^\\s*import\\s+(?!type\\b)[^'"]*from\\s+['"](${pkgs.join('|')})['"]`)

/**
 * `.vue` 只扫 `<script>` 块，独立 `.js/.mjs` 整文件。
 *
 * 模板里的 `<pre v-pre>` 代码样例长着**一模一样**的 import 行（es-pc 的
 * `views/EsVxeTable.vue` 第 24/26 行就是「怎么装 vxe」的教程文字）。2026-10-28 装这个
 * 守卫时它先骗了守卫一次 —— 判据要盯的是「哪一行会真的执行」，不是「哪一行长得像」。
 */
function importScope(file) {
  const text = read(file)
  if (!file.endsWith('.vue')) return codeLines(text)
  const start = text.indexOf('<script')
  if (start === -1) return []
  const end = text.indexOf('</script>', start)
  return codeLines(text.slice(start, end === -1 ? text.length : end))
}

/**
 * 子站共用的 vxe 判据（es-pc 与 es-eui 结构不同，判据相同）。
 *
 *   a. **不许退回入口**：除 `utils/vxe-install.js` 外没有源文件值导入 vxe。
 *   b. **清单要指得到路由**：`vxe-loader.js` 的 `VXE_ROUTE_NAMES` 里每个名字都必须
 *      在 `router/index.js` 里存在 —— 清单写错一个字，页面就渲染「未安装 vxe」。
 *   c. **示例组件只被那一条路由用**（可选，只有 es-pc 是这种结构）：`views/es-vxe/*.vue`
 *      多一个引用者，就多一条需要 vxe 的路由。
 *   d. **案例 JSON**：engine 为 vxe 的案例必须由清单里的画廊详情路由渲染。
 */
function checkSubSiteVxe(cfg) {
  const before = problems.length
  const VXE_IMPORT = valueImportOf(['vxe-table', 'vxe-pc-ui'])
  const installRel = relative(ROOT, cfg.installPath).replace(/\\/g, '/')
  const loaderRel = relative(ROOT, cfg.loaderPath).replace(/\\/g, '/')

  // a. 谁在值导入 vxe
  if (existsSync(cfg.mainPath)) {
    for (const { text, no } of codeLines(read(cfg.mainPath))) {
      if (!VXE_IMPORT.test(text)) continue
      fail(`${relative(ROOT, cfg.mainPath).replace(/\\/g, '/')}:${no} 又把 vxe 引回入口了 —— 首屏会重新背上几百 KB`)
    }
  }
  for (const file of walk(cfg.src).filter((f) => /\.(vue|js|mjs)$/.test(f))) {
    if (file === cfg.installPath) continue
    for (const { text } of importScope(file)) {
      if (!VXE_IMPORT.test(text)) continue
      fail(
        `${rel(file)} 值导入了 vxe —— 整棵依赖会跟着它所在的路由/入口一起下载。`
          + ` 需要注册就调 ${loaderRel} 的 ensureVxe`,
      )
    }
  }
  if (!existsSync(cfg.loaderPath) || !existsSync(cfg.installPath)) {
    fail(`${loaderRel} 与 ${installRel} 必须同时存在（动态加载的落点）`)
    return
  }

  // b. 清单 → 路由
  const routeNames = [
    ...((read(cfg.loaderPath).match(/VXE_ROUTE_NAMES\s*=\s*\{([\s\S]*?)\n\}/) || [])[1] || '')
      .matchAll(/:\s*'([A-Za-z]+)'/g),
  ].map((m) => m[1])
  if (routeNames.length < 2) {
    fail(`${loaderRel} 里读不到路由清单 —— 清单结构变了就把这里一起改`)
    return
  }
  const routerSrc = read(cfg.routerPath)
  for (const name of routeNames) {
    if (!routerSrc.includes(`name: '${name}'`)) {
      fail(`${relative(ROOT, cfg.routerPath).replace(/\\/g, '/')} 里没有 name: '${name}' —— vxe-loader 的清单指向了一条不存在的路由`)
    }
  }

  // c. 示例组件只被那一条路由引用
  let exampleCount = 0
  if (cfg.example) {
    const { dir, specPrefix, ownerFile } = cfg.example
    const specs = existsSync(dir) ? readdirSync(dir).map((f) => `${specPrefix}${f}`) : []
    exampleCount = specs.length
    if (!specs.length) fail(`${relative(ROOT, dir).replace(/\\/g, '/')} 下一个示例都没有 —— 扫描规则大概率已失效`)
    for (const file of walk(cfg.src).filter((f) => /\.(vue|js)$/.test(f))) {
      if (file === ownerFile) continue
      for (const { text, no } of codeLines(read(file))) {
        for (const spec of specs) {
          if (!text.includes(`'${spec}'`)) continue
          fail(
            `${rel(file)}:${no} 引用了 ${spec}（vxe 示例），但 ${loaderRel} 的清单里没有这条路由`
              + ' —— 它会渲染出「未安装 vxe」的提示；把它的路由名加进清单',
          )
        }
      }
    }
  }

  // d. 案例
  const vxeCases = []
  const casesDir = join(cfg.src, 'cases')
  for (const file of existsSync(casesDir) ? walk(casesDir) : []) {
    if (!file.endsWith('.json') || /\.(story|meta)\.json$/.test(file)) continue
    let json
    try {
      json = JSON.parse(read(file))
    } catch {
      continue
    }
    if (!hasVxeEngine(json)) continue
    const id = relative(casesDir, file).split('.')[0].replace(/\\/g, '/').split('/').pop()
    if (!vxeCases.includes(id)) vxeCases.push(id)
  }
  if (!vxeCases.length) fail('一个 engine:"vxe" 的案例 JSON 都没扫到 —— 扫描规则大概率已失效')

  if (problems.length > before) return
  console.log(
    `✅ ${cfg.label} 的 vxe 按需：入口无值导入；清单 = ${routeNames.join(' / ')}`
      + (exampleCount ? `（${exampleCount} 个示例）` : '')
      + ` + ${vxeCases.length} 个案例（${vxeCases.join('/')}）`,
  )
}

function checkAntdvSiteOnDemand() {
  const before = problems.length
  const mainPath = join(PC_SRC, 'main.js')
  const installPath = join(PC_SRC, 'utils/install-antd.js')

  // a1. 不许退回全量插件
  for (const { text, no } of codeLines(read(mainPath))) {
    if (/^\s*import\s+Antd\s+from\s+['"]ant-design-vue['"]/.test(text) || /app\.use\(\s*Antd\b/.test(text)) {
      fail(
        `es-pc/src/main.js:${no} 又用回了 Ant Design Vue 全量插件 —— 首屏会多出 71 KB`
          + '（页面看起来完全正常，只有称产物才发现）。把标签的组名加进 utils/install-antd.js',
      )
    }
  }
  if (!existsSync(installPath)) {
    fail('es-pc/src/utils/install-antd.js 不存在 —— 改名了就把这里一起改')
    return
  }
  const install = read(installPath)
  // 清单是**简写属性**（`Alert,` 而不是 `Alert: Alert,`），所以不能用 objectLiteralKeys
  // ——那个助手只认 `key:`。这里按行取标识符，`//` 注释行跳过。
  const registryBlock = install.match(/ANT_DESIGN_VUE_COMPONENTS\s*=\s*\{([\s\S]*?)\n\}/)
  const registry = registryBlock
    ? registryBlock[1]
        .split('\n')
        .map((line) => (line.trim().match(/^([A-Za-z][A-Za-z0-9]*),?$/) || [])[1])
        .filter(Boolean)
    : []
  const imported = new Set(
    [...install.matchAll(/import\s*\{([\s\S]*?)\}\s*from\s*['"]ant-design-vue['"]/g)]
      .flatMap((m) => m[1].split(',').map((s) => s.trim()).filter(Boolean)),
  )
  if (registry.length < 10 || !imported.size) {
    fail('utils/install-antd.js 里解析不到组件清单 —— 扫描规则与源码结构脱节')
    return
  }
  for (const name of registry) {
    if (!imported.has(name)) fail(`install-antd.js 的清单里有 ${name}，但它没有从 ant-design-vue 导入 —— 运行时会注册 undefined`)
  }

  // a2. 模板标签 ⊆ 清单
  let tags = 0
  const unknownTags = new Map()
  const missingGroups = new Map()
  for (const file of walk(PC_SRC).filter((f) => f.endsWith('.vue'))) {
    for (const { text, no } of codeLines(read(file))) {
      for (const m of text.matchAll(/<(a-[a-z0-9-]+)[\s/>]/g)) {
        tags++
        const group = ANTD_TAG_GROUPS[m[1].slice(2)]
        if (!group) {
          if (!unknownTags.has(m[1])) unknownTags.set(m[1], `${rel(file)}:${no}`)
          continue
        }
        if (!registry.includes(group)) {
          if (!missingGroups.has(group)) missingGroups.set(group, [])
          missingGroups.get(group).push(`${rel(file)}:${no}`)
        }
      }
    }
  }
  for (const [tag, place] of unknownTags) {
    fail(`模板里用了 <${tag}>（${place}），但 ANTD_TAG_GROUPS 里没有它的组名 —— 先在 install-antd.js 里注册组名，再把映射写进本脚本`)
  }
  for (const [group, places] of missingGroups) {
    fail(
      `模板里用了需要 ${group} 的标签（${places.slice(0, 3).join('、')}`
        + `${places.length > 3 ? ` 等 ${places.length} 处` : ''}），但 ANT_DESIGN_VUE_COMPONENTS 里没有 ${group}`
        + ' —— 那个组件会整块不渲染（页面其余部分看起来正常）',
    )
  }

  if (problems.length > before) return
  console.log(
    `✅ es-pc 的 Ant Design Vue 按需注册：模板 ${tags} 个 <a-*> 标签全部落在 ${registry.length} 组清单里`,
  )
}

/** 两个子站的 vxe 配置：结构不同（views/es-vxe vs examples 中央注册表），判据相同 */
const PC_VXE = {
  label: 'es-pc',
  src: PC_SRC,
  mainPath: join(PC_SRC, 'main.js'),
  installPath: join(PC_SRC, 'utils/vxe-install.js'),
  loaderPath: join(PC_SRC, 'utils/vxe-loader.js'),
  routerPath: join(PC_SRC, 'router/index.js'),
  example: {
    dir: join(PC_SRC, 'views/es-vxe'),
    specPrefix: './es-vxe/',
    ownerFile: join(PC_SRC, 'views/EsVxeTable.vue'),
  },
}

const EUI_VXE = {
  label: 'es-eui',
  src: EUI_SRC,
  mainPath: join(EUI_SRC, 'main.js'),
  installPath: join(EUI_SRC, 'utils/vxe-install.js'),
  loaderPath: join(EUI_SRC, 'utils/vxe-loader.js'),
  routerPath: join(EUI_SRC, 'router/index.js'),
  // es-eui 的示例走 `src/examples/index.js` 中央注册表（全部页面共享一个模块），
  // 「某个示例只被某条路由引用」在这里不成立，所以不做那一层检查。
}

// ── 主流程 ─────────────────────────────────────────────────────────────────


checkEagerGlobs()
checkVxeOnDemand()
checkElementPlusOnDemand()
checkDocContentOnDemand()
checkAntdvSiteOnDemand()
checkSubSiteVxe(PC_VXE)
checkSubSiteVxe(EUI_VXE)
await checkHighlight()


if (problems.length) {
  for (const problem of problems) console.error(`❌ ${problem}`)
  console.error('\n提示：这六条是 check:bundle-budget 的源码层前门 —— 产物称重只能事后发现，这里在合入前就挡住')
  process.exit(1)
}
