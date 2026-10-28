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
 * 用法：node scripts/check-bundle-sources.mjs
 * 退出码：0 = 三条判据都成立；1 = 有缺口（逐条列出文件与行号）。
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

// ── 主流程 ─────────────────────────────────────────────────────────────────

checkEagerGlobs()
checkVxeOnDemand()
await checkHighlight()


if (problems.length) {
  for (const problem of problems) console.error(`❌ ${problem}`)
  console.error('\n提示：这三条是 check:bundle-budget 的源码层前门 —— 产物称重只能事后发现，这里在合入前就挡住')
  process.exit(1)
}
