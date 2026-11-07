#!/usr/bin/env node
/**
 * 外部分发入口（审计 P2-6 的「增长基础设施为零」）—— 守卫两件会悄悄漂移的事。
 *
 * 审计原文：*没有外部分发入口：npm 包页、GitHub Discussions、MCP 注册表都没有互链*。
 * 三处里能靠代码守住的只有两处：
 *
 *   1. **npm 包页 → 三站**。npm 包页展示的是 `packages/<pkg>/README.md` 本身，
 *      所以「包页上没有三端演示链接」不是一个配置问题，是**那个文件里没写**。
 *      它极容易漂：新增一个包、复制一份 README 当模板、或者某次改写把链接行删掉，
 *      都不会有任何报错 —— 只是那个包页从此变成孤岛。这里逐文件断言：仓库 README
 *      与**每个已发布包的 README** 都要有 ①在线文档 ②Ant Design Vue 站 ③Vue 2 站
 *      ④仓库地址。三个站的域名**从 `es-plus-docs/src/utils/sites.ts` 的 SITES 推出**
 *      （三站是三个独立域名根），不在这里另写一遍（换域名时只改一处）。
 *
 *   2. **MCP 注册表条目**（`packages/mcp-server/server.json`）。官方 registry 的
 *      发布靠 `mcp-publisher` 读这个文件，而它的 `version` 与 `identifier` 是**手抄
 *      package.json 的**：改版本号时忘了同步，注册表就会一直让人装旧版本，且没有
 *      任何构建会失败。这里把它钉回 package.json，并按官方 schema 的两条最易踩的
 *      约束（`description` ≤ 100 字符、name 是 `namespace/server` 反 DNS 形式）断言。
 *
 *   3. **tsc 产物在普通 Node 里能 import**。打包器会替我们补扩展名，Node 不会 ——
 *      `@es-plus/core` 1.3.0 / 1.4.0 的 `build/` 里 33 处 `from './shared'` 在三个
 *      站点里永远看不见（vite 解析得动），却让 `import '@es-plus/core'` 直接
 *      ERR_MODULE_NOT_FOUND。判据有两条，缺一不可：产物里没有无扩展名的**相对**
 *      说明符；无 bin 的库包真的被动态 import 一次（只有真加载才能证明用户那条
 *      import 会成功）。
 *
 * 不在第三条范围内的：`element-ui/lib/message-box` 这类**外部包**说明符 —— 那是
 * 打包器消费者的职责（vue2 的 dist 就是为 bundler 构建的），不是 Node ESM 的契约。
 *
 * 不在这里的三件事，因为都不是代码能保证的：GitHub Discussions 的分类、掘金/知乎
 * 文章的 URL、npm 包页本身要等下一次发布才会更新（拿到手的是仓库里的 README）。
 *
 * 用法：node scripts/check-distribution.mjs
 * 退出码：0 = 一致；1 = 有漂移。
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readSites, siteByKey } from './lib/sites.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

let failed = false
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}
const read = (p) => {
  const abs = join(ROOT, p)
  return existsSync(abs) ? readFileSync(abs, 'utf-8') : null
}

/** 三站规范地址（单源：es-plus-docs/src/utils/sites.ts） */
function siteOrigins() {
  try {
    const sites = readSites()
    return {
      main: siteByKey(sites, 'vue3').url,
      antdv: siteByKey(sites, 'antdv').url,
      vue2: siteByKey(sites, 'vue2').url,
    }
  } catch (error) {
    fail(error.message)
    return null
  }
}

const REPO_URL = 'https://github.com/liujiaao/es-plus'

/** 已发布且带 README 的包（`private: true` 的不对外，不要求互链） */
function publishedPackages() {
  const out = []
  for (const dir of readdirSync(join(ROOT, 'packages'))) {
    const pkgJson = join(ROOT, 'packages', dir, 'package.json')
    const readme = join(ROOT, 'packages', dir, 'README.md')
    if (!existsSync(pkgJson) || !existsSync(readme)) continue
    const pkg = JSON.parse(readFileSync(pkgJson, 'utf-8'))
    if (pkg.private) continue
    out.push({ dir, name: pkg.name, readme: `packages/${dir}/README.md` })
  }
  return out
}

// ── 1. README 互链（仓库 README ×2 + 每个已发布包的 README）────────────
function checkReadmeLinks() {
  const origins = siteOrigins()
  if (!origins) return
  const required = [
    { url: origins.main, what: '在线文档（Vue 3 + Element Plus 站）' },
    { url: origins.antdv, what: 'Vue 3 + Ant Design Vue 站' },
    { url: origins.vue2, what: 'Vue 2 + Element UI 站' },
    { url: REPO_URL, what: 'GitHub 仓库' },
  ]
  const targets = ['README.md', 'README.en.md', ...publishedPackages().map((p) => p.readme)]
  let ok = 0
  for (const file of targets) {
    const src = read(file)
    if (src == null) {
      fail(`缺少 ${file}`)
      continue
    }
    const missing = required.filter((r) => !src.includes(r.url))
    if (missing.length) {
      fail(
        `${file} 缺少外部分发入口：${missing.map((m) => `${m.what}（${m.url}）`).join('、')}` +
          ' —— npm 包页展示的就是这个文件，缺了链接那个包页就是孤岛。' +
          ' 照其它 README 顶部那行「三端线上演示」补齐。',
      )
    } else {
      ok++
    }
  }
  if (ok === targets.length) {
    console.log(
      `✅ 外部分发互链齐备：${ok} 份 README 都指向三站与仓库` +
        `（${origins.main} / ${origins.antdv} / ${origins.vue2}）`,
    )
  }
}

// ── 2. MCP 注册表条目 ↔ package.json ────────────────────────────────
function checkMcpRegistry() {
  const file = 'packages/mcp-server/server.json'
  const raw = read(file)
  if (raw == null) {
    fail(`缺少 ${file} —— 官方 MCP registry 发布靠它（mcp-publisher），没有它这个 server 进不了注册表`)
    return
  }
  let doc
  try {
    doc = JSON.parse(raw)
  } catch (e) {
    fail(`${file} 不是合法 JSON：${e.message}`)
    return
  }
  const pkg = JSON.parse(read('packages/mcp-server/package.json'))

  // name：反 DNS 形式，且恰好一个斜杠（schema 的 pattern）
  if (!/^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/.test(doc.name ?? '')) {
    fail(`${file} 的 name「${doc.name}」不合规：须为 namespace/server（如 io.github.owner/server）`)
  }
  // description ≤ 100 字符 —— schema 的硬上限，超了 mcp-publisher 直接拒
  if (typeof doc.description !== 'string' || doc.description.length > 100) {
    fail(`${file} 的 description 有 ${doc.description?.length ?? 0} 字符，官方 schema 上限 100`)
  }
  // 版本与包名：手抄的，必须与 package.json 一致
  if (doc.version !== pkg.version) {
    fail(`${file} 的 version 是 ${doc.version}，package.json 是 ${pkg.version} —— 发版时忘了同步（注册表会让人装旧版本）`)
  }
  const entry = doc.packages?.[0]
  if (!entry) {
    fail(`${file} 没有 packages[0] —— 注册表条目必须声明怎么装（registryType/identifier/version/transport）`)
    return
  }
  if (entry.registryType !== 'npm' || entry.identifier !== pkg.name) {
    fail(`${file} 的 packages[0] 是 ${entry.registryType}://${entry.identifier}，应为 npm://${pkg.name}`)
  }
  if (entry.version !== pkg.version) {
    fail(`${file} 的 packages[0].version 是 ${entry.version}，package.json 是 ${pkg.version}`)
  }
  if (entry.transport?.type !== 'stdio') {
    fail(`${file} 的 packages[0].transport.type 是 ${entry.transport?.type}，本 server 是 stdio`)
  }
  // npm 包的归属校验：registry 会读**已发布 tarball** 里 package.json 的 mcpName，
  // 要求它等于 server.json 的 name。少了这一行，publish 停在
  // 「Registry validation failed for package」—— 而它只能在发布时才发现。
  if (pkg.mcpName !== doc.name) {
    fail(
      `packages/mcp-server/package.json 的 mcpName 是 ${pkg.mcpName ?? '(缺失)'}，` +
        `${file} 的 name 是 ${doc.name} —— 两者必须逐字相同，否则 registry 的 npm 归属校验不通过`,
    )
  }
  if (!failed) {
    console.log(`✅ MCP 注册表条目与 package.json 一致（${doc.name} ${pkg.version}，stdio，mcpName 已登记）`)
  }
}

/**
 * 递归列出目录下的 .js 文件（`build/` 里没有软链，无需防环）。
 */
function walkJs(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walkJs(abs))
    else if (entry.name.endsWith('.js')) out.push(abs)
  }
  return out
}

// ── 3. tsc 产物在普通 Node 里能 import ────────────────────────────────
async function checkPlainNodeImportable() {
  const problems = []
  const runtimeTargets = []

  for (const dir of readdirSync(join(ROOT, 'packages'))) {
    const pkgPath = join(ROOT, 'packages', dir, 'package.json')
    const buildDir = join(ROOT, 'packages', dir, 'build')
    if (!existsSync(pkgPath) || !existsSync(buildDir)) continue
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))

    // ① 静态：ESM 产物里的相对说明符必须带扩展名。
    //    逐行判 `import`/`export` 语句 —— tsc 每条语句独占一行，且这样不会把生成器
    //    里 `./${n.renamed.path}` 这类**字符串字面量**误判成导入（也显式跳过 `${`）。
    for (const file of walkJs(buildDir)) {
      if (file.includes(`${sep}cjs${sep}`)) continue
      for (const line of readFileSync(file, 'utf-8').split(/\r?\n/)) {
        if (!/^\s*(?:import|export)\b/.test(line)) continue
        const m = /from\s*['"](\.[^'"]*)['"]|\bimport\s*['"](\.[^'"]*)['"]/.exec(line)
        const spec = m?.[1] ?? m?.[2]
        if (!spec || spec.includes('${') || /\.[cm]?js$|\.json$/.test(spec)) continue
        problems.push(
          `${relative(ROOT, file)} → '${spec}'（Node ESM 不补扩展名，请写成 '${spec}.js'）`,
        )
      }
    }

    // ② 运行时：只对「无 bin、入口在 build/」的库包真加载一次。
    //    带 bin 的包 import 会执行 CLI/启动 server，不能当冒烟用例。
    if (pkg.private || pkg.bin) continue
    const entry = pkg.exports?.['.']?.import
    if (typeof entry === 'string' && entry.startsWith('./build/')) {
      runtimeTargets.push({ dir, name: pkg.name, entry })
    }
  }

  for (const { dir, name, entry } of runtimeTargets) {
    const abs = join(ROOT, 'packages', dir, entry)
    try {
      await import(pathToFileURL(abs).href)
    } catch (error) {
      problems.push(`${name} 的 ESM 入口 ${entry} 加载失败：${error.code || error.message}`)
    }
  }

  if (problems.length) {
    for (const p of problems) fail(p)
    return
  }
  console.log(
    `✅ tsc 产物可被普通 Node 直接 import（${runtimeTargets.length} 个库包入口；相对说明符均带扩展名）`,
  )
}

checkReadmeLinks()
checkMcpRegistry()
await checkPlainNodeImportable()
if (failed) {
  console.error('\n外部分发入口存在漂移。')
  process.exit(1)
}
