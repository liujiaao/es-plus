#!/usr/bin/env node
/**
 * docs/ 目录约定 + 文档内链接校验
 *
 * 背景：根 docs/ 此前是混放状态 —— 对外文档、内部审计报告、设计方案、投稿稿、
 * 以及被站点消费的单源数据目录平铺在一起，只靠文件名区分。既没有「产品文档的
 * 单一真源在哪」的答案，也让对外文档与内部报告混在一起被检索。
 * 更隐蔽的是**文档里的相对链接从来没人校验**：这次整理时发现 3 处断链，
 * 其中 2 处（site-structure.md、tri-render/README.md 各 1 处）是**本来就已经断的** ——
 * 它们指向了仓库外的路径，只是因为没人点过而一直存在。
 *
 * 本脚本做两件事：
 *   1. 布局约定：根 docs/ 下只允许约定的对外文档与 README；内部材料必须在
 *      docs/internal/，投稿稿必须在 docs/articles/；
 *   2. 链接可解析：docs/**\/*.md 里所有 `](相对路径)` 必须指向真实存在的文件。
 *      同时校验被镜像到站点的对外文档（why-es-plus / migration.en）确实在
 *      sync-docs.mjs 的 MIRRORED_DOCS 清单里 —— 否则「单源在根 docs/」只是说法，
 *      实际站点读的是另一份没人维护的副本。
 *
 * 链接校验不止看「本地是否存在」：一个指向 dist/ 或 node_modules/ 的链接在
 * 开发机上照样 existsSync===true（本地构建/安装产物都在），却会在 CI 全新检出时
 * 断掉。这类 Windows-本地绿 / Linux-CI-红 的分歧实际咬过两次 —— 所以这里再加一道
 * `git check-ignore` 门禁：凡指向被 git 忽略的路径（生成物/依赖）一律判为断链，
 * 让本地跑守卫就能复现 CI 全新检出的结果，而不是等推上去才红。
 *
 * 用法：node scripts/check-docs-layout.mjs
 * 退出码：0 = 符合约定且无断链；1 = 违反约定或存在断链。
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve, relative, sep } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DOCS = join(ROOT, 'docs')

let failed = false
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}

/** 根 docs/ 下允许出现的 .md（对外文档 + 目录说明） */
const ALLOWED_ROOT_MD = new Set(['README.md', 'why-es-plus.md', 'why-es-plus.en.md', 'migrate-v1.4.md'])

/** 必须在 docs/internal/ 里的（内部材料）——写死清单，移动/新增需同步本脚本 */
const REQUIRED_INTERNAL = [
  'deep-analysis-report.md',
  'es-plus-evaluation-report.md',
  'refactor-design.md',
  'site-structure.md',
  'source-audit-report.md',
  'three-sites-audit-report.md',
  'vue2-adaptation-analysis.md',
  'vue2-integration-testing-guide.md',
  '改造三端站点.md',
]
/** 必须在 docs/articles/ 里的（投稿稿） */
const REQUIRED_ARTICLES = ['juejin-article.md', 'juejin-mcp-article.md']

function walkMarkdown(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walkMarkdown(p, out)
    else if (e.name.endsWith('.md')) out.push(p)
  }
  return out
}

// ── 1. 布局约定 ──────────────────────────────────────────
function checkLayout() {
  for (const e of readdirSync(DOCS, { withFileTypes: true })) {
    if (!e.isFile() || !e.name.endsWith('.md')) continue
    if (!ALLOWED_ROOT_MD.has(e.name)) {
      fail(
        `docs/${e.name} 不在约定的根级清单里 —— 对外文档请加进 ALLOWED_ROOT_MD 与 ` +
          'sync-docs.mjs 的 MIRRORED_DOCS，内部材料请放 docs/internal/，投稿稿请放 docs/articles/',
      )
    }
  }
  for (const [dir, list] of [
    ['internal', REQUIRED_INTERNAL],
    ['articles', REQUIRED_ARTICLES],
  ]) {
    for (const f of list) {
      if (!existsSync(join(DOCS, dir, f))) {
        fail(`docs/${dir}/${f} 缺失 —— 该文件属于「${dir}」类，不应被移走或删除（清单见本脚本）`)
      }
    }
  }
  if (!failed) console.log(`✅ 根 docs/ 分层符合约定（对外 ${ALLOWED_ROOT_MD.size - 1} 份 / 内部 ${REQUIRED_INTERNAL.length} 份 / 投稿 ${REQUIRED_ARTICLES.length} 份）`)
}

// 给定一组绝对路径，返回其中被 git 忽略的那些（规范化后的绝对路径集合）。
// 无法判定时（git 不可用 / 不在 work tree 内）返回 null —— 调用方据此跳过忽略门禁，
// 保持旧行为而不是让守卫自己崩掉。
function gitIgnoredSet(targets) {
  if (targets.length === 0) return new Set()
  // 必须喂「仓库内 + 相对 ROOT 的 POSIX 路径」给 git check-ignore：
  //  - 绝对 Windows 路径（E:\..）会被 git 当成含反斜杠的串做 C-quoting，输出被 "" 包裹、
  //    \ 翻倍，匹配不回来；
  //  - 正斜杠绝对路径（E:/..）在 Git-Bash/MSYS 下被改写成 /e/.. 直接 fatal。
  // 相对 POSIX 路径（packages/vue2/dist）喂进去、原样吐出来，跨平台最稳。
  const rels = new Map() // posixRel -> 规范化绝对 target
  for (const t of targets) {
    const rel = relative(ROOT, t)
    if (!rel || rel.startsWith('..')) continue // 仓库外：不是「生成物/依赖」门禁的目标
    rels.set(rel.split(sep).join('/'), resolve(t))
  }
  if (rels.size === 0) return new Set()
  // git 对含特殊字符的路径仍会 C-quoting；最小化反转义，纯 ASCII 正斜杠路径不受影响。
  const unquote = (raw) => {
    const s = raw.trim()
    if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
      return s.slice(1, -1).replace(/\\(.)/g, '$1')
    }
    return s
  }
  const parse = (out) => {
    const set = new Set()
    for (const raw of String(out).split('\n')) {
      const line = unquote(raw)
      if (!line) continue
      set.add(rels.get(line) || resolve(ROOT, line))
    }
    return set
  }
  try {
    // check-ignore --stdin：逐行读入路径，打印其中被忽略者；
    // 退出码 0=有命中，1=无命中（二者都正常），128=出错（非 work tree 等）。
    const out = execFileSync('git', ['check-ignore', '--stdin'], {
      cwd: ROOT,
      input: [...rels.keys()].join('\n'),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    })
    return parse(out)
  } catch (e) {
    if (e && e.status === 1) return parse(e.stdout || '') // 无命中
    return null // git 不可用 / 非 work tree → 降级，不启用忽略门禁
  }
}

// ── 2. 链接可解析 ────────────────────────────────────────
function checkLinks() {
  const files = walkMarkdown(DOCS)
  let checked = 0
  const entries = []
  for (const f of files) {
    const text = readFileSync(f, 'utf-8')
    for (const m of text.matchAll(/\]\((\.\.?\/[^)#\s]*)\)/g)) {
      checked++
      entries.push({ f, link: m[1], target: resolve(dirname(f), m[1]) })
    }
  }
  // 只对「本地存在」的目标判定是否被忽略：不存在的已经是断链；被忽略的（dist/、
  // node_modules/ 等生成物）本地虽在、CI 全新检出时同样不在 —— 本地提前拦下。
  const existing = entries.filter((e) => existsSync(e.target)).map((e) => e.target)
  const ignored = gitIgnoredSet(existing)
  const broken = []
  for (const e of entries) {
    const rel = relative(ROOT, e.f).replace(/\\/g, '/')
    if (!existsSync(e.target)) {
      broken.push(`${rel} → ${e.link}（目标不存在）`)
    } else if (ignored && ignored.has(resolve(e.target))) {
      broken.push(`${rel} → ${e.link}（指向被 git 忽略的生成物/依赖，CI 全新检出时不存在）`)
    }
  }
  if (broken.length) {
    fail(`docs/ 内有 ${broken.length} 处断链：\n    ${broken.join('\n    ')}`)
  } else if (checked) {
    console.log(`✅ docs/ 内 ${checked} 处相对链接全部可解析（且无一指向被忽略的生成物）`)
  }
  return checked
}

// ── 3. 对外文档确实在镜像清单里 ──────────────────────────
function checkMirrored() {
  const src = readFileSync(join(ROOT, 'scripts/sync-docs.mjs'), 'utf-8')
  const m = src.match(/MIRRORED_DOCS\s*=\s*\[([^\]]*)\]/)
  if (!m) {
    fail('未能在 sync-docs.mjs 定位 MIRRORED_DOCS')
    return
  }
  const listed = new Set((m[1].match(/'[^']+'/g) || []).map((s) => s.slice(1, -1)))
  // 根 docs/ 下的对外文档（除 README）都应当被镜像到站点
  for (const name of ALLOWED_ROOT_MD) {
    if (name === 'README.md') continue
    if (!listed.has(name)) {
      fail(
        `docs/${name} 是根级对外文档，但不在 sync-docs.mjs 的 MIRRORED_DOCS 里 —— ` +
          '「单源在根 docs/」会变成一句空话：站点读的是另一份没人维护的副本',
      )
    }
  }
  if (!failed) console.log(`✅ 根级对外文档都在镜像清单里（${[...listed].join(', ')}）`)
}

checkLayout()
checkLinks()
checkMirrored()

if (failed) {
  console.error('\ndocs/ 目录约定或链接存在问题。')
  process.exit(1)
}
console.log('\ndocs/ 布局与链接 ✅')
