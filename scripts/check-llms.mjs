#!/usr/bin/env node
/**
 * `llms.txt` 与 `.md` 镜像的完整性检查（路线图 Wave 3 · 3.4 的门禁）。
 *
 * 三类失败，都不是「跑一遍生成器再看一眼」能发现的：
 *
 *   1. **产物过期 / 被手改**。生成器输出是确定的，所以判据是「重新算一遍，与磁盘逐字节比对」。
 *      只比对生成器自己的输出 = 自己给自己判卷：人手往镜像里塞一句没在源里的话，
 *      生成器不知道、门禁也不知道。
 *   2. **索引与文件不对应**。`llms.txt` 列着的 `.md` 必须真的存在（否则 AI 工具点开是 404），
 *      磁盘上的 `.md` 也必须在索引里（否则文件存在但没人知道 —— 等于没发布）。两个方向都查。
 *   3. **索引里的地址不可打开**。站点是 hash 路由：页面地址必须是 `…/es-plus/#/route`，
 *      镜像地址必须是 `…/es-plus/md/…`。第一版生成器真的产出过
 *      `#/:pathMatch(.*)*` 这种「通配路由当地址」的条目 —— 类型的错误看着像数据。
 *
 * 校验项：
 *   1. 产物与「现在重新生成一遍」逐字节一致，且没有孤儿文件（复用生成器的 compareWithDisk）；
 *   2. 标题行 / 引用块摘要 / 分节结构符合 llms.txt 口径，条目格式 `- [标题](地址): 说明`；
 *   3. 每个地址都在站点基准之下、是站点里真实存在的路由或产物文件，且不重复；
 *   4. 指南 / 组件 / 高级用法三类页面的镜像**一个不少**：slug 集合与注册表相等；
 *   5. 指南镜像的正文与源 markdown 逐字节一致（镜像不许二次创作），front matter 的
 *      route / canonical 与站点基准对得上；
 *   6. 英文镜像严格对应「注册表里有 contentEn」的那几篇，多一篇少一篇都算漂移。
 *
 * 用法：node scripts/check-llms.mjs
 * 退出码：0 = 一致；1 = 有缺口。
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildAll, compareWithDisk, existingMirrors } from './gen-llms.mjs'
import { normalizeEol } from './lib/docs-mirror.mjs'
import { parseRoutes } from './lib/page-meta-parse.mjs'
import { loadSiteModule } from './lib/site-module-loader.mjs'
import { readSiteBase } from './gen-sitemap.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SITE = 'es-plus-docs'
const PUBLIC = join(ROOT, SITE, 'public')

let failed = false
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}
const toLF = (text) => normalizeEol(text)
const read = (path) => toLF(readFileSync(path, 'utf-8'))

const { files } = await buildAll()
const { origin, base } = readSiteBase()
const siteRoot = `${origin}${base}`

/**
 * 文章页的规范地址：构建期有静态 HTML（scripts/gen-prerender.mjs），
 * 所以是路径式且带结尾斜杠 —— 与 canonical、JSON-LD、sitemap 同一口径。
 * 镜像的 front matter 必须写这个地址，否则 AI 工具会拿到一个和页面 canonical
 * 不一致的来源地址。
 */
const articleUrl = (route) => `${siteRoot}${route}/`

// ── 1. 产物最新、无孤儿 ────────────────────────────────────────────────────
for (const problem of compareWithDisk(files)) fail(problem)

// ── 2. 索引结构 ───────────────────────────────────────────────────────────
const index = existsSync(join(PUBLIC, 'llms.txt')) ? read(join(PUBLIC, 'llms.txt')) : ''
if (!index) fail('es-plus-docs/public/llms.txt 缺失（运行 npm run llms:gen）')

const lines = index.split('\n')
if (!/^# \S/.test(lines[0] ?? '')) fail('llms.txt 第一行必须是一级标题（llmstxt.org：`# 项目名`）')
if (!lines.some((line) => line.startsWith('> '))) fail('llms.txt 缺少引用块摘要（`> 一句话说明`）')

const sections = lines.filter((line) => line.startsWith('## ')).map((line) => line.slice(3).trim())
for (const required of ['指南', '组件', '高级用法', '机器可读资源']) {
  if (!sections.includes(required)) fail(`llms.txt 缺少「## ${required}」小节`)
}

const entries = []
for (const line of lines) {
  if (!line.startsWith('- [')) continue
  const m = line.match(/^- \[(.+?)\]\((.+?)\): (.+)$/)
  if (!m) {
    fail(`llms.txt 条目格式不对（应为 \`- [标题](地址): 说明\`）：${line}`)
    continue
  }
  entries.push({ title: m[1], url: m[2], desc: m[3] })
}
if (entries.length === 0) fail('llms.txt 里一条条目都没有')

// ── 3. 地址可解析：都在站点基准下，且是真实存在的路由或文件 ────────────────
const router = read(join(ROOT, SITE, 'src/router/index.ts'))
const staticPaths = new Set(parseRoutes(router).map((route) => route.path))
const seen = new Set()
for (const { title, url, desc } of entries) {
  if (seen.has(url)) fail(`llms.txt 地址重复：${url}`)
  seen.add(url)
  if (!desc.trim()) fail(`条目「${title}」没有说明`)

  if (!url.startsWith(`${siteRoot}/`)) {
    fail(`条目不在站点基准之下：${url}（基准 ${siteRoot}）`)
    continue
  }
  const rest = url.slice(siteRoot.length + 1)
  if (rest.endsWith('.md') || rest.endsWith('.json') || rest.endsWith('.txt')) {
    if (!existsSync(join(PUBLIC, rest))) fail(`条目指向的产物文件不存在：public/${rest}`)
    continue
  }
  if (rest.startsWith('#/')) {
    const path = rest.slice(1)
    // 通配与参数路由不是「页面」：写进索引等于给读者一个 404
    if (path.includes(':') || path.includes('*')) {
      fail(`条目指向通配/参数路由（点开是 404）：${url}`)
      continue
    }
    if (!staticPaths.has(path)) fail(`条目指向路由表里没有的路径：${url}`)
    continue
  }
  fail(`条目地址既不是镜像文件也不是 hash 路由：${url}`)
}

// ── 4/5/6. 三类页面的镜像一个不少，指南正文与源逐字节一致 ──────────────────
const guides = await loadSiteModule(`${SITE}/src/docs/doc-registry.ts`, { site: SITE })
const components = await loadSiteModule(`${SITE}/src/views/component-doc.data.ts`, { site: SITE })
const advanced = await loadSiteModule(`${SITE}/src/views/advanced-doc.data.ts`, { site: SITE })

const mirrored = new Set([...files.keys()].filter((rel) => rel.startsWith('md/')))
const listed = new Set(entries.map((entry) => entry.url))

/** 检查「每篇都有镜像、且都进了索引」 */
function expectMirror(rel, what) {
  if (!mirrored.has(rel)) fail(`${what} 没有 md 镜像：public/${rel}`)
  const url = `${siteRoot}/${rel}`
  if (!listed.has(url)) fail(`${what} 的镜像没有进 llms.txt：${url}`)
}

/** 解析 front matter（本脚本只认生成器写的单引号标量） */
function frontMatterOf(rel) {
  const abs = join(PUBLIC, rel)
  if (!existsSync(abs)) return null
  const text = read(abs)
  const m = text.match(/^---\n([\s\S]*?)\n---\n/)
  if (!m) return { fields: {}, body: text }
  const fields = {}
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-z-]+): '(.*)'$/)
    if (kv) fields[kv[1]] = kv[2].replace(/''/g, "'")
  }
  return { fields, body: text.slice(m[0].length) }
}

for (const slug of guides.GUIDE_SLUGS ?? Object.keys(guides.docsData)) {
  const entry = guides.docsData[slug]
  const rel = `md/guide/${slug}.md`
  expectMirror(rel, `指南 ${slug}`)

  const parsed = frontMatterOf(rel)
  if (parsed) {
    const route = `/guide/${slug}`
    if (parsed.fields.route !== route) fail(`${rel} 的 front matter route 是 ${parsed.fields.route}，应为 ${route}`)
    if (parsed.fields.canonical !== articleUrl(route)) {
      fail(`${rel} 的 canonical 与站点基准不符：${parsed.fields.canonical}`)
    }
    // 镜像正文必须与源一致：只允许行尾差异与结尾空白
    if (parsed.body.trimEnd() !== toLF(entry.content).trimEnd()) {
      fail(`${rel} 的正文与 es-plus-docs/src/docs/${slug}.md 不一致 —— 镜像不是二次创作的地方`)
    }
  }

  // 英文镜像与 contentEn 严格对应
  const enRel = `md/guide/${slug}.en.md`
  const hasEn = Boolean(entry.titleEn && entry.contentEn)
  if (hasEn) expectMirror(enRel, `指南 ${slug} 的英文版`)
  else if (mirrored.has(enRel)) fail(`${enRel} 存在，但注册表里 ${slug} 没有英文正文`)
}

for (const [kind, data] of [
  ['component', components.docsData],
  ['advanced', advanced.docsData],
]) {
  const dir = kind === 'component' ? 'components' : 'advanced'
  for (const [slug, page] of Object.entries(data)) {
    const rel = `md/${dir}/${slug}.md`
    expectMirror(rel, `${kind} ${slug}`)

    const parsed = frontMatterOf(rel)
    if (!parsed) continue
    const route = `/${dir}/${slug}`
    if (parsed.fields.route !== route) fail(`${rel} 的 route 是 ${parsed.fields.route}，应为 ${route}`)
    if (parsed.fields.canonical !== articleUrl(route)) {
      fail(`${rel} 的 canonical 与站点基准不符：${parsed.fields.canonical}`)
    }
    // API 表的每一节都要在镜像里出现（少一节 = 读者以为这个组件没有这个 API）
    for (const name of Object.keys(page.api ?? {})) {
      if (!Array.isArray(page.api[name])) continue
      if (!parsed.body.includes(`### ${name}`)) fail(`${rel} 缺少 API 小节：${name}`)
    }
  }
}

// 反向：磁盘上每个镜像都必须在索引里（否则发布了没人知道）—— 扫的是磁盘而不是
// 生成器的键集合：这个方向要防的正是「文件在、索引里没有」，用生成器自查是循环论证
for (const rel of existingMirrors()) {
  if (rel === 'llms.txt') continue
  if (!listed.has(`${siteRoot}/${rel}`)) fail(`public/${rel} 没有进 llms.txt —— 镜像存在但索引里查不到`)
}

if (failed) {
  console.error('\n提示：llms 产物由 npm run llms:gen 从注册表生成，不要手改 public/md/**')
  process.exit(1)
}

console.log(
  `✅ llms.txt 与 md 镜像一致：${entries.length} 条条目，${mirrored.size} 个镜像（指南 / 组件 / 高级用法全覆盖）`,
)
