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
 *      ④仓库地址。三个站的域名**从 `es-plus-docs/vite.config.ts` 的 SITE_HOSTNAME
 *      推出来**，不在这里另写一遍（换域名时只改一处）。
 *
 *   2. **MCP 注册表条目**（`packages/mcp-server/server.json`）。官方 registry 的
 *      发布靠 `mcp-publisher` 读这个文件，而它的 `version` 与 `identifier` 是**手抄
 *      package.json 的**：改版本号时忘了同步，注册表就会一直让人装旧版本，且没有
 *      任何构建会失败。这里把它钉回 package.json，并按官方 schema 的两条最易踩的
 *      约束（`description` ≤ 100 字符、name 是 `namespace/server` 反 DNS 形式）断言。
 *
 * 不在这里的三件事，因为都不是代码能保证的：GitHub Discussions 的分类、掘金/知乎
 * 文章的 URL、npm 包页本身要等下一次发布才会更新（拿到手的是仓库里的 README）。
 *
 * 用法：node scripts/check-distribution.mjs
 * 退出码：0 = 一致；1 = 有漂移。
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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

/** 规范域名：与 check-brand-assets / check-site-seo 同源（es-plus-docs/vite.config.ts） */
function siteOrigin() {
  const vite = read('es-plus-docs/vite.config.ts')
  const host = vite?.match(/SITE_HOSTNAME\s*=\s*'([^']+)'/)?.[1]
  if (!host) {
    fail('未能从 es-plus-docs/vite.config.ts 取到 SITE_HOSTNAME')
    return null
  }
  return host.replace(/\/$/, '')
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
  const origin = siteOrigin()
  if (!origin) return
  const required = [
    { url: `${origin}/`, what: '在线文档（Vue 3 + Element Plus 站）' },
    { url: `${origin}/es-pc/`, what: 'Vue 3 + Ant Design Vue 站' },
    { url: `${origin}/es-eui/`, what: 'Vue 2 + Element UI 站' },
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
    console.log(`✅ 外部分发互链齐备：${ok} 份 README 都指向三站与仓库（${origin}）`)
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

checkReadmeLinks()
checkMcpRegistry()
if (failed) {
  console.error('\n外部分发入口存在漂移。')
  process.exit(1)
}
