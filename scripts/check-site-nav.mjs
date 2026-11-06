#!/usr/bin/env node
/**
 * 三站「站点切换器」一致性 + 正确性检查。
 *
 * 背景：三站顶栏的跨站切换器各有一份手写的 `const SITES = [...]`，内容必须一致。
 * 最初的检查只做了「三处数组字面量逐字符相同」—— 这是个**不够**的门禁：三处一起写错
 * 依然是绿的。实际发生过两件事，它都没拦住：
 *   1. 三站共同声明了一套腾讯云 EdgeOne 地址，但当时没有对应的部署与验证，
 *      实测 401 / 不解析 → UI 上挂着死链。现在 EdgeOne 是规范地址，判据也换成了
 *      「地址是各站域名根 + 主站与 SITE_HOSTNAME 同源」；
 *   2. `detectCurrentSite()` 按 hostname 反推当前站，凡不是 github.io 的环境
 *      （localhost、自有域名）都会猜错 → 顶栏显示错误的当前站
 *      （在 es-eui 上显示「Vue 3 · Element Plus」），并把用户送去死链。
 *
 * 因此本脚本在校验「一致」之外，还校验「正确」——把 UI 里公布的地址与
 * CI 实际部署的路径、以及站点自报的规范域名对齐：
 *   1. 三站 SITES 数组逐字符一致（忽略空白）；
 *   2. 每个站点显式声明 SITE_KEY，且与 SITES 中的 key 对得上
 *      （当前站不再靠 hostname 反推）；
 *   3. 不存在第二套「备用部署」字段（tencent / edgeone …）与按 hostname 选地址的
 *      分支 —— 每个站只公布一条规范地址，避免 UI 上出现两个入口；
 *   4. SITES 里每个 url 都是该站自己的域名根（EdgeOne Makers 生产域名），三个 origin
 *      互不相同；主站地址与 es-plus-docs/vite.config.ts 的 SITE_HOSTNAME 同源。
 *      GitHub Pages 上的 `/es-plus/` 部署是旧链接的**镜像**，不再出现在切换器里，
 *      但 deploy-docs.yml 仍必须覆盖三个站点目录（否则镜像会静默断掉）。
 *
 * 用法：node scripts/check-site-nav.mjs
 * 退出码：0 = 全部通过；1 = 漂移或接线错误。
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// 站点目录 → 该站在 SITES 里的身份 key。这是本脚本的输入，不是被校验对象：
// 它表达「哪个目录是哪个渲染端」，改这里意味着站点定位变了。
//
// SITES 已从三个布局组件抽到各站的 utils/sites 模块：案例卡也要用它拼跨端链接，
// 留在布局里就必须在案例页再抄一份（第 4 份副本），而门禁只覆盖布局那一份。
const SITE_TARGETS = [
  { dir: 'es-plus-docs', key: 'vue3', file: 'es-plus-docs/src/utils/sites.ts' },
  { dir: 'es-pc', key: 'antdv', file: 'es-pc/src/utils/sites.js' },
  { dir: 'es-eui', key: 'vue2', file: 'es-eui/src/utils/sites.js' },
]

const DEPLOY_WORKFLOW = '.github/workflows/deploy-docs.yml'
const VITE_CONFIG = 'es-plus-docs/vite.config.ts'

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

/** 抽取 `const SITES = [ ... ]` 的数组字面量（方括号配对，避免正则截断） */
function extractSites(src, rel) {
  const m = src.match(/const\s+SITES\s*=\s*\[/)
  if (!m) {
    fail(`未在 ${rel} 找到 const SITES = [`)
    return null
  }
  const open = src.indexOf('[', m.index)
  let depth = 0
  for (let i = open; i < src.length; i++) {
    const ch = src[i]
    if (ch === '[') depth++
    else if (ch === ']') {
      depth--
      if (depth === 0) return src.slice(open + 1, i)
    }
  }
  fail(`${rel} 的 SITES 数组未闭合`)
  return null
}

/** 从 SITES 字面量里解析出 key → url */
function parseEntries(literal, rel) {
  const entries = []
  for (const m of literal.matchAll(/\{([^{}]*)\}/g)) {
    const body = m[1]
    const key = body.match(/key:\s*'([^']+)'/)?.[1]
    const url = body.match(/url:\s*'([^']+)'/)?.[1]
    const label = body.match(/label:\s*'([^']+)'/)?.[1]
    if (!key) fail(`${rel} 的 SITES 有一项缺少 key`)
    else if (!url) fail(`${rel} 的 SITES 项 ${key} 缺少 url（切换器只应公布一条规范地址）`)
    else entries.push({ key, url, label, raw: body })
  }
  return entries
}

/** 从 deploy-docs.yml 的合成步骤解析「站点目录 → Pages 子路径」 */
function parseDeployPaths() {
  const src = read(DEPLOY_WORKFLOW)
  if (!src) return null
  const map = new Map()
  // 形如：  cp -r es-pc/dist/. _site/es-pc/
  for (const m of src.matchAll(/cp\s+-r\s+([\w.-]+)\/dist\/\.\s+_site\/([\w./-]*)/g)) {
    const dir = m[1]
    const sub = m[2].replace(/\/$/, '') // '' 表示部署在根
    map.set(dir, sub)
  }
  if (!map.size) {
    fail(
      `未能从 ${DEPLOY_WORKFLOW} 解析出「站点目录 → Pages 子路径」映射` +
        '（本脚本依赖该工作流的 cp -r <dir>/dist/. _site/<sub>/ 形式；改了写法请同步本脚本）',
    )
    return null
  }
  return map
}

function main() {
  const parsed = []
  for (const t of SITE_TARGETS) {
    const src = read(t.file)
    if (!src) continue
    const literal = extractSites(src, t.file)
    if (literal === null) continue

    // ── 2. 站点自报身份（不再由 hostname 反推）──
    const keyMatch = src.match(/const\s+SITE_KEY\s*=\s*'([^']+)'/)
    if (!keyMatch) {
      fail(
        `${t.file} 未声明 const SITE_KEY —— 当前站必须由站点自己声明。` +
          '按 hostname/pathname 反推覆盖不了 localhost 与自有域名，猜错会显示错误的当前站。',
      )
    } else if (keyMatch[1] !== t.key) {
      fail(`${t.file} 的 SITE_KEY 是 '${keyMatch[1]}'，但该站点应是 '${t.key}'`)
    }
    if (/detectCurrentSite|isGithubDeploy/.test(src)) {
      fail(
        `${t.file} 仍存在按 hostname 判断部署的分支（detectCurrentSite / isGithubDeploy）—— ` +
          '这正是「本地/自有域名下当前站识别错误 + 跳向备用地址」的来源。',
      )
    }

    // ── 3. 不得再有第二套「备用部署」地址 ──
    if (/tencent:|edgeone|\.github:/.test(literal)) {
      fail(
        `${t.file} 的 SITES 仍含备用部署字段（tencent / edgeone / github 双地址）—— ` +
          '未被 CI 维护的部署不应出现在 UI 上；确需恢复时请同时补上可验证的部署工作流。',
      )
    }
    for (const e of parseEntries(literal, t.file)) {
      // 先剥掉字符串字面量，否则 url 值里的 `https:` 会被当成一个属性名
      const stripped = e.raw.replace(/'[^']*'/g, "''")
      // 允许的字段：key / label / url（切换器用）+ short（案例卡的跨端链接用短标签）
      const extra = stripped.match(/\b(?!key\b|label\b|short\b|url\b)[A-Za-z_$][\w$]*\s*:/g)
      if (extra) {
        fail(`${t.file} 的 SITES 项 ${e.key} 含预期外字段：${extra.join(', ')}`)
      }
    }

    parsed.push({ ...t, literal: literal.replace(/\s+/g, ' ').trim(), entries: parseEntries(literal, t.file) })
  }

  // ── 1. 三处数组内容一致 ──
  if (parsed.length > 1) {
    const ref = parsed[0]
    for (const p of parsed.slice(1)) {
      if (p.literal !== ref.literal) {
        fail(
          `${p.dir} 的 SITES 数组与 ${ref.dir} 不一致：\n` +
            `   ${ref.dir}: ${ref.literal}\n   ${p.dir}: ${p.literal}`,
        )
      }
    }
    if (!failed) console.log(`✅ 三站 SITES 数组逐字一致（${parsed.length} 处）`)
  }

  // ── 4. 规范地址：各站域名根，三个 origin 互不相同 ──
  const entries = parsed[0]?.entries ?? []
  const entryByKey = new Map(entries.map((e) => [e.key, e]))
  const origins = new Map()
  for (const t of SITE_TARGETS) {
    const entry = entryByKey.get(t.key)
    if (!entry) {
      fail(`SITES 里没有 key='${t.key}' 的站点，无法核对 ${t.dir} 的规范地址`)
      continue
    }
    let url
    try {
      url = new URL(entry.url)
    } catch {
      fail(`SITES 里 ${t.key} 的 url 不是合法地址：${entry.url}`)
      continue
    }
    if (url.protocol !== 'https:') fail(`${t.key} 的规范地址必须是 https：${entry.url}`)
    if (url.pathname !== '/') {
      fail(
        `${t.key} 的规范地址是 ${entry.url}，但该站部署在自己的域名根 —— ` +
          '规范地址应为 https://<domain>/（Pages 镜像的子路径不进 SITES）',
      )
    }
    if (origins.has(url.origin)) {
      fail(`${t.key} 与 ${origins.get(url.origin)} 共用了 origin ${url.origin} —— 三个站必须是三个独立域名`)
    } else {
      origins.set(url.origin, t.key)
    }
  }

  // ── 5. 主站地址 == 站点自报的规范域名（SITE_HOSTNAME）──
  const mainEntry = entryByKey.get('vue3')
  const vite = read(VITE_CONFIG)
  if (vite && mainEntry) {
    const host = vite.match(/SITE_HOSTNAME\s*=\s*'([^']+)'/)
    if (!host) {
      fail(`未能在 ${VITE_CONFIG} 定位 SITE_HOSTNAME`)
    } else if (new URL(host[1]).origin !== new URL(mainEntry.url).origin) {
      fail(
        `SITES 里主站（vue3）的地址是 ${mainEntry.url}，而 ${VITE_CONFIG} 的 SITE_HOSTNAME ` +
          `推出 ${new URL(host[1]).origin} —— 两处都在声明「主站的规范地址」，换域名时必须同步`,
      )
    } else if (!failed) {
      console.log(`✅ 三站规范地址为独立域名根；主站与 SITE_HOSTNAME 同源（${new URL(mainEntry.url).origin}）`)
    }
  }

  // ── 6. GitHub Pages 镜像仍覆盖三个站点（虽不公布，删掉就会让旧链接变死链）──
  const deployPaths = parseDeployPaths()
  if (deployPaths) {
    for (const t of SITE_TARGETS) {
      if (!deployPaths.has(t.dir)) {
        fail(`${DEPLOY_WORKFLOW} 未把 ${t.dir} 拷进 Pages 产物（应有一行 cp -r ${t.dir}/dist/. _site/…）`)
      }
    }
    if (!failed) console.log(`✅ Pages 镜像仍发布三站（${[...deployPaths.keys()].join(' / ')}）`)
  }

  if (failed) {
    console.error('\n三站站点切换器存在漂移或接线错误。')
    process.exit(1)
  }
  console.log('\n三站站点切换器 ✅')
}

main()
