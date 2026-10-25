#!/usr/bin/env node
/**
 * 案例目录的站内链接 ↔ 各站真实路由 校验
 *
 * 背景：docs/cases/cases.json 是三站「核心案例」页的单一真源，每条案例都带三端链接
 * （vue3 / antdv / vue2）。但此前**没有任何门禁校验这些链接能否解析** ——
 * cases:check 只比对三站副本是否一致，check:site-nav 只管切换器数组。
 * 实际后果：L2 头号案例（标注「放 C 位」）的 antdv 链接写的是 "/"，点进去落在 es-pc
 * 的首页；而 es-pc 其实有承载该案例的页面（/advanced 内嵌 ZeroCodeQuery）。
 * 更糟的是 es-pc / es-eui 两个站点**没有 404 兜底路由**，链接写错就是白屏，
 * 连「找不到页面」都看不到。
 *
 * 本脚本把「链接必须指向本站真实存在的页面」变成可校验的断言：
 *   - 主文档站：路由是动态段（/guide/:name、/components/:name、/advanced/:name），
 *     光看路由表无法判断某篇文章是否存在，因此以侧栏的页面清单（AppSidebar.vue 的
 *     `path:` 列表）为权威页面集合，另加静态路由（首页/案例/Playground 等）；
 *   - es-pc / es-eui：路由是静态字面量，直接解析 router/index.js（含嵌套 children）。
 *
 * 第二轮（D12）：链接还要落到**具体那个示例**上，不能只指到组件文档首页。
 * 于是 `#anchor` 也变成断言，各站锚点的来源不同：
 *   - 主文档站 /components/:name、/advanced/:name：锚点由模板里的
 *     `:id="'demo-' + example.key"` 生成，key 来自 component-doc.data.ts /
 *     advanced-doc.data.ts 的 examples[].key —— 本脚本按同一规则按键反查；
 *   - 主文档站 /guide/:name：锚点是 markdown 标题（Doc.vue 渲染时按标题文本生成 id），
 *     本脚本用同一套 slug 规则从 .md 反查（含同名标题的 -2/-3 去重）；
 *   - es-pc：页内 `<section id="...">` / `<h3 id="...">` 静态字面量；
 *   - es-eui：文档页用 `:id="'demo-' + ex.key"` 批量渲染，key 来自
 *     src/examples/index.js 的 `<xxx>Examples` 数组。
 *
 * 防「空集恒绿」：任一站点解析出的路径集合为空即报错，不允许把「解析失败」
 * 静默降级成「全部链接合法」。
 *
 * 用法：node scripts/check-cases-links.mjs
 * 退出码：0 = 全部解析；1 = 有链接指向不存在的页面 / 锚点 / 解析失败。
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

let failed = false
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}
const read = (p) => {
  const abs = join(ROOT, p)
  if (!existsSync(abs)) {
    fail(`文件缺失：${p}`)
    return null
  }
  return readFileSync(abs, 'utf-8')
}

/** 主文档站：侧栏列出的页面路径就是「真实存在的页面」集合 */
function docsPages() {
  const src = read('es-plus-docs/src/components/layout/AppSidebar.vue')
  if (!src) return null
  const paths = new Set()
  for (const m of src.matchAll(/path:\s*'([^']+)'/g)) paths.add(m[1])
  // 侧栏之外的静态路由（首页 / 案例 / Playground / AI 生成器）
  for (const p of ['/', '/cases', '/quickstart', '/playground', '/ai-crud']) paths.add(p)
  if (!paths.size) fail('未能从 AppSidebar.vue 解析出任何页面路径（侧栏结构变了请同步本脚本）')
  return paths
}

/**
 * 解析 vue-router 路由文件里的 path 字面量，支持 children 嵌套。
 * 返回完整路径集合（含父路径本身，因为父级通常渲染 <router-view> 容器页）。
 *
 * 用**缩进**判断嵌套层级，而不是数花括号：手写路由表里除了路由对象还有
 * import、箭头函数、`export default createRouter({...})` 等一堆花括号，
 * 数花括号会把兄弟路由误判成父子（第一次实现就踩了：解析出
 * `/quickstart/cases/guide/es-form` 这种不存在的路径，于是所有真实链接都被判非法）。
 */
function routerPaths(relPath) {
  const src = read(relPath)
  if (!src) return null
  const paths = new Set()
  /** full path → 组件文件（相对仓库根）；供 #anchor 校验定位目标模板 */
  const files = new Map()
  // 顶层静态导入：`import Guide from '@/views/Guide.vue'`，路由里写 `component: Guide`
  // （es-pc 的 /guide 就是这样，只认 `component: () => import(...)` 会漏掉它）
  const namedImports = new Map()
  for (const m of src.matchAll(/^\s*import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/gm)) {
    namedImports.set(m[1], m[2])
  }
  const stack = [] // [{ indent, full }]，indent 是**路由对象**的缩进（不是 path 行的缩进）
  let pendingObjectIndent = null
  let lastFull = null
  for (const line of src.split('\n')) {
    // 记录「该路由渲染哪个文件」—— 带 #anchor 的链接要落到页内锚点，
    // 光知道路径存在不够，还得能证明目标组件的模板里真有那个 id。
    const comp = /component:\s*\(\)\s*=>\s*import\(\s*['"]([^'"]+)['"]\s*\)/.exec(line)
    // 单行路由 `{ path: 'guide', ..., component: Guide },` 同时带 path 与 component：
    // 这一行既要登记 path，也要登记文件，所以不能在这里 continue（/guide 曾因此整条消失）。
    if (comp && lastFull && !/\bpath\s*:/.test(line)) {
      files.set(lastFull, normalizeComponent(relPath, comp[1]))
      continue
    }
    const namedComp = /component:\s*(\w+)\s*[,}]/.exec(line)
    if (namedComp && lastFull && !/\bpath\s*:/.test(line) && namedImports.has(namedComp[1])) {
      files.set(lastFull, normalizeComponent(relPath, namedImports.get(namedComp[1])))
      continue
    }

    // 单行写法：{ path: 'quickstart', ... }  —— 对象缩进即 `{` 的缩进
    const single = /^(\s*)\{\s*path:\s*['"]([^'"]*)['"]/.exec(line)
    // 多行写法：对象以单独一行 `{` 开始，`path:` 在其下一行且缩进 +2。
    // 两者的缩进基准不同（6 vs 8），直接比较会把兄弟路由当成父子
    // （会解析出 /cases/es-form 这种不存在的路径）。所以统一换算到「对象缩进」。
    const multi = /^(\s*)path:\s*['"]([^'"]*)['"]/.exec(line)
    if (line.trim().endsWith('{')) pendingObjectIndent = line.match(/^(\s*)/)[1].length

    let objIndent = null
    let raw = null
    if (single) {
      objIndent = single[1].length
      raw = single[2]
    } else if (multi && pendingObjectIndent !== null) {
      objIndent = pendingObjectIndent
      raw = multi[2]
    } else {
      continue
    }
    pendingObjectIndent = null

    while (stack.length && stack[stack.length - 1].indent >= objIndent) stack.pop()
    const parent = stack.length ? stack[stack.length - 1].full : ''
    let full
    if (raw.startsWith('/')) full = raw
    else if (raw === '') full = parent || '/'
    else full = `${parent === '/' ? '' : parent}/${raw}`
    full = full.replace(/\/+$/, '') || '/'
    paths.add(full)
    lastFull = full
    // 单行路由写法把 path 与 component 放在同一行：这里补登记文件
    const inlineDyn = /component:\s*\(\)\s*=>\s*import\(\s*['"]([^'"]+)['"]\s*\)/.exec(line)
    const inlineNamed = /component:\s*(\w+)\s*[,}]/.exec(line)
    if (inlineDyn) files.set(full, normalizeComponent(relPath, inlineDyn[1]))
    else if (inlineNamed && namedImports.has(inlineNamed[1])) {
      files.set(full, normalizeComponent(relPath, namedImports.get(inlineNamed[1])))
    }
    if (parent) paths.add(parent.replace(/\/+$/, '') || '/')
    stack.push({ indent: objIndent, full })
  }
  if (!paths.size) fail(`未能从 ${relPath} 解析出任何路由（路由写法变了请同步本脚本）`)
  return { paths, files }
}

/** 把 `../views/docs/X.vue` / `@/views/X.vue` 解析成仓库相对路径 */
function normalizeComponent(routerPath, spec) {
  // `@` 是站点自身的 src 别名（vite/webpack 同义）；router 文件位于 <site>/src/router/
  if (spec.startsWith('@/')) {
    const srcDir = dirname(dirname(join(ROOT, routerPath)))
    return relative(ROOT, join(srcDir, spec.slice(2))).replace(/\\/g, '/')
  }
  if (!spec.startsWith('.')) return null // 包名导入，脚本不解析
  const dir = dirname(join(ROOT, routerPath))
  return relative(ROOT, join(dir, spec)).replace(/\\/g, '/')
}

// ───────────────────────── 锚点来源 ─────────────────────────

/**
 * 从主文档站的 doc 数据文件里取「页面 slug → examples[].key 集合」。
 *
 * 数据长这样（缩进固定 2 空格）：
 *   export const docsData: Record<string, any> = {
 *     'es-table': {
 *       ...
 *       examples: [ { key: 'basic', ... } ]
 *     }
 *   }
 * 用花括号配平找页面的结束位置，而不是「下一行到下一个页面开始」——
 * 后者在页面里再嵌套对象时会把别人的 key 算进来。
 */
function docPageKeys(relPath) {
  const src = read(relPath)
  const out = new Map()
  if (!src) return out
  let slug = null
  let depth = 0
  let keys = null
  for (const line of src.split('\n')) {
    if (slug === null) {
      const open = /^  '([^']+)':\s*\{/.exec(line)
      if (open) {
        slug = open[1]
        keys = new Set()
        depth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length
      }
      continue
    }
    depth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length
    if (depth <= 0) {
      out.set(slug, keys)
      slug = null
      keys = null
      continue
    }
    const m = /\bkey:\s*'([^']+)'/.exec(line)
    if (m) keys.add(m[1])
  }
  return out
}

/** 断言文档页模板确实把 examples[].key 渲染成了 id="demo-<key>"（否则锚点全是空头支票） */
function assertDemoIdBinding(viewFile) {
  const src = read(viewFile)
  if (!src) return
  const ok = src.split('\n').some((l) => /:id="'demo-'\s*\+\s*example\.key"/.test(l))
  if (!ok) {
    fail(`${viewFile} 没有再给每个示例渲染 id="demo-<key>" —— cases.json 的 #demo-xxx 锚点会全部落空`)
  }
}

/** es-eui 示例清单：`export const tableExamples = [ { key: 'Basic', ... } ]` */
function examplesIndexKeys(arrayName) {
  const src = read('es-eui/src/examples/index.js')
  if (!src) return null
  const lines = src.split('\n')
  const keys = new Set()
  let inside = false
  let depth = 0
  for (const line of lines) {
    if (!inside) {
      if (new RegExp(`^export const ${arrayName}\\s*=\\s*\\[`).test(line)) {
        inside = true
        depth = 0
      } else continue
    }
    depth += (line.match(/\[/g) || []).length - (line.match(/\]/g) || []).length
    const m = /\{\s*key:\s*'([^']+)'/.exec(line)
    if (m) keys.add(m[1])
    if (depth <= 0) return keys // 数组闭合（`]` 行）
  }
  return inside ? keys : null
}

/**
 * es-eui 文档页若用 `:id="'demo-' + ex.key"` 批量渲染示例，
 * 返回该页可用锚点后缀（示例 key）集合；否则返回 null（说明是静态 id 页面）。
 */
function euiDemoKeys(viewSrc, viewFile) {
  if (!/:id="'demo-'\s*\+\s*ex\.key"/.test(viewSrc)) return null
  const arr = /v-for="ex in (\w+)"/.exec(viewSrc)
  if (!arr) {
    fail(`${viewFile} 用了 demo- 动态锚点，但找不到 \`v-for="ex in <示例数组>"\` —— 锚点无法核对`)
    return null
  }
  const keys = examplesIndexKeys(arr[1])
  if (!keys) fail(`es-eui/src/examples/index.js 中找不到示例数组 ${arr[1]}（${viewFile} 依赖它）`)
  return keys
}

/** markdown 标题 → 锚点，规则与 Doc.vue 渲染时生成 id 的那段保持一致 */
function mdHeadingSlugs(src) {
  const seen = new Map()
  const slugs = new Set()
  for (const m of src.matchAll(/^(#{2,3})\s+(.+)$/gm)) {
    const base =
      m[2]
        .replace(/<[^>]+>/g, '')
        .replace(/[`*_]/g, '')
        .trim()
        .toLowerCase()
        .replace(/[^\w一-龥]+/g, '-')
        .replace(/^-|-$/g, '') || 'section'
    const n = (seen.get(base) || 0) + 1
    seen.set(base, n)
    slugs.add(n === 1 ? base : `${base}-${n}`)
  }
  return slugs
}

/**
 * 主文档站：动态段路由 → 锚点来源。
 * `/components/<x>`、`/advanced/<x>` 的锚点由 examples[].key 决定；
 * `/guide/<x>` 的锚点是 markdown 标题；其余静态页按字面 id 校验。
 */
function docsSite() {
  const paths = docsPages()
  if (!paths) return null
  const targets = new Map()
  for (const [dataFile, prefix, viewFile] of [
    ['es-plus-docs/src/views/component-doc.data.ts', '/components', 'es-plus-docs/src/views/ComponentDoc.vue'],
    ['es-plus-docs/src/views/advanced-doc.data.ts', '/advanced', 'es-plus-docs/src/views/AdvancedDoc.vue'],
  ]) {
    assertDemoIdBinding(viewFile)
    const pages = docPageKeys(dataFile)
    if (!pages.size) fail(`未能从 ${dataFile} 解析出任何页面（数据结构变了请同步本脚本）`)
    for (const [slug, keys] of pages) targets.set(`${prefix}/${slug}`, { kind: 'demoKeys', file: dataFile, keys })
  }
  for (const p of paths) {
    if (!p.startsWith('/guide/')) continue
    const file = `es-plus-docs/src/docs/${p.slice('/guide/'.length)}.md`
    if (existsSync(join(ROOT, file))) targets.set(p, { kind: 'md', file })
  }
  for (const [p, name] of [
    ['/', 'Home'],
    ['/cases', 'Cases'],
    ['/quickstart', 'QuickStart'],
    ['/playground', 'Playground'],
    ['/ai-crud', 'AiCrud'],
  ]) {
    targets.set(p, { kind: 'static', file: `es-plus-docs/src/views/${name}.vue` })
  }
  return { paths, targets }
}

/**
 * 某条链接的锚点是否存在。
 * 返回 null 表示「存在」，否则返回一句可读的失败原因。
 */
function anchorProblem(site, path, target, anchor) {
  if (!target || !target.file) {
    return (
      `脚本无法定位 ${path} 渲染的组件文件 —— 锚点无法校验` +
      '（docs 站的动态段路由需要先在本脚本里补「路径 → 组件文件」映射；' +
      '站点路由若改成别名/包名导入，也要在这里补解析）'
    )
  }
  if (target.kind === 'demoKeys') {
    const key = anchor.replace(/^demo-/, '')
    if (anchor.startsWith('demo-') && target.keys.has(key)) return null
    return (
      `锚点 #${anchor} 对应的示例不存在：${target.file} 里该页 examples[].key 没有「${key}」` +
      `（可用锚点示例：${[...target.keys].slice(0, 5).map((k) => `demo-${k}`).join(', ')}…）`
    )
  }
  if (target.kind === 'md') {
    const src = read(target.file)
    if (src === null) return `${target.file} 读不到，锚点无法校验`
    if (mdHeadingSlugs(src).has(anchor)) return null
    return (
      `锚点 #${anchor} 在 ${target.file} 的小节标题里不存在` +
      `（可用锚点示例：${[...mdHeadingSlugs(src)].slice(0, 5).join(', ')}…）`
    )
  }
  const src = read(target.file)
  if (src === null) return `${target.file} 读不到，锚点无法校验`
  if (new RegExp(`id=["']${anchor}["']`).test(src)) return null
  // es-eui 的文档页把示例锚点批量渲染成 `:id="'demo-' + ex.key"`
  if (anchor.startsWith('demo-')) {
    const keys = euiDemoKeys(src, target.file)
    if (keys && keys.has(anchor.slice(5))) return null
  }
  return (
    `锚点 #${anchor} 在 ${target.file} 中不存在` +
    '（静态 id 与 demo-<示例 key> 两种来源都没有）'
  )
}

/**
 * 跨端链接的 URL 构造校验。
 *
 * 案例卡的跨端链接由各站 utils/sites 的 `crossSiteUrl(key, path)` 拼出。
 * 三站都是 hash 路由，所以必须是 `${url}#${path}` 且 **path 保留前导斜杠**
 * （`#/es-form`）。少一个斜杠写成 `#es-form`，构建产物里看起来完全正常，
 * 但 vue-router 匹配不到该路径，会落到 404/兜底页 —— 这类错误只有真点一次
 * 或用浏览器按 hash 加载目标站才能发现（本轮就是先写成 `#es-form` 后靠
 * 逐条加载发现的）。这里把它变成静态断言。
 */
function checkCrossSiteUrlImpl() {
  const files = [
    'es-plus-docs/src/utils/sites.ts',
    'es-pc/src/utils/sites.js',
    'es-eui/src/utils/sites.js',
  ]
  const impls = []
  for (const f of files) {
    const src = read(f)
    if (!src) continue
    const m = src.match(/export function crossSiteUrl\([^)]*\)[^{]*\{([\s\S]*?)\n\}/)
    if (!m) {
      fail(`${f} 未找到 crossSiteUrl 实现（案例卡的跨端链接依赖它）`)
      continue
    }
    // 只比对**函数体**并去掉注释：一份是 .ts（签名带类型注解）、两份是 .js，
    // 直接比整段会把类型注解当成差异报出来。
    const body = m[1]
      .split('\n')
      .filter((l) => !/^\s*\/\//.test(l))
      .join('\n')
      .replace(/\s+/g, ' ')
      .trim()
    if (!/`\$\{site\.url\}#\$\{/.test(body)) {
      fail(`${f} 的 crossSiteUrl 未按 \`\${site.url}#\${path}\` 拼接（三站都是 hash 路由）`)
    }
    if (!/startsWith\('\/'\)/.test(body)) {
      fail(
        `${f} 的 crossSiteUrl 未保证 path 的前导斜杠 —— hash 路由需要 \`#/es-form\`，` +
          '写成 `#es-form` 会匹配不到路由并落到 404（构建产物里看不出来）',
      )
    }
    impls.push([f, body])
  }
  if (impls.length === files.length) {
    const [, ref] = impls[0]
    for (const [f, body] of impls.slice(1)) {
      if (body !== ref) fail(`${f} 的 crossSiteUrl 实现与 ${impls[0][0]} 不一致（三端应完全相同）`)
    }
    if (!failed) console.log('✅ 三站 crossSiteUrl 实现一致且保留 hash 路由的前导斜杠')
  }
}

function main() {
  const cases = JSON.parse(read('docs/cases/cases.json') || '{}')
  const pc = routerPaths('es-pc/src/router/index.js')
  const eui = routerPaths('es-eui/src/router/index.js')
  const docs = docsSite()
  const sites = {
    vue3: docs && { paths: docs.paths, targets: docs.targets },
    // es-pc / es-eui 的锚点是页面文件里的静态 id（或 es-eui 的 demo-<key> 批量渲染）
    antdv: pc && {
      paths: pc.paths,
      targets: new Map([...pc.files].map(([p, file]) => [p, { kind: 'static', file }])),
    },
    vue2: eui && {
      paths: eui.paths,
      targets: new Map([...eui.files].map(([p, file]) => [p, { kind: 'static', file }])),
    },
  }
  for (const [k, v] of Object.entries(sites)) {
    if (!v || !v.paths) fail(`未能取得 ${k} 站的路由集合`)
  }
  if (failed) {
    console.error('\n链接校验无法进行 —— 路由解析失败会让所有链接「看起来合法」，故直接失败。')
    process.exit(1)
  }

  let checked = 0
  let anchors = 0
  for (const level of cases.levels || []) {
    for (const c of level.cases || []) {
      for (const [site, link] of Object.entries(c.links || {})) {
        checked++
        const siteInfo = sites[site]
        if (!siteInfo) {
          fail(`案例 #${c.id}（${c.title}）的链接指向未知站点 key：${site}`)
          continue
        }
        // `#anchor` 是页内落点，不参与路由匹配；拆出来单独校验
        const [rawPath, anchor] = link.split('#')
        const norm = rawPath.replace(/\/+$/, '') || '/'
        // 「能解析」不等于「去对了地方」：指向站点根的链接能通过路由检查，
        // 但案例卡的「查看案例」落到首页等于没有落点。L2 头号案例此前就是这样
        // （antdv 写 "/"，而承载它的页面是 es-pc 的 /advanced）。
        if (norm === '/') {
          fail(
            `案例 #${c.id}「${c.title}」的 ${site} 链接是站点根 "/" —— ` +
              '案例卡应当指向承载该案例的具体页面；指向首页等于没有落点',
          )
          continue
        }
        if (!siteInfo.paths.has(norm)) {
          fail(
            `案例 #${c.id}「${c.title}」的 ${site} 链接 ${link} 在该站路由中不存在` +
              `（该站可用路径示例：${[...siteInfo.paths].slice(0, 6).join(', ')}…）` +
              ' —— 三站均已补 404 兜底路由，这类链接点进去会落到 404 页',
          )
          continue
        }
        if (!anchor) continue
        anchors++
        // 锚点也要能落地：路由存在但页内没有这个 id，链接会停在页首，
        // 看起来「指对了页面」实际没落到内容上（本轮 case 8 就是这样被发现的）。
        const problem = anchorProblem(site, norm, siteInfo.targets.get(norm), anchor)
        if (problem) fail(`案例 #${c.id}「${c.title}」的 ${site} 链接 ${link}：${problem}`)
      }
    }
  }

  if (failed) {
    console.error('\n案例目录存在指向不存在页面（或页内锚点）的链接。')
    process.exit(1)
  }
  console.log(
    `✅ 案例目录的 ${checked} 条站内链接在三站路由中全部存在` +
      `（其中 ${anchors} 条带锚点，已校验目标页含对应落点）`,
  )
}

checkCrossSiteUrlImpl()
main()
