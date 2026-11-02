#!/usr/bin/env node
/**
 * 分析统计一致性（审计 3.5）—— GoatCounter，无 Cookie、无需同意横幅。
 *
 * 单一真源是 `docs/analytics/analytics.json`（端点 + 8 个事件名）。三站各有一份运行时
 * （各站 src/utils/analytics.ts 或 .js）、一份 index.html 脚本、router afterEach 的 pageview
 * 触发、main 里的 `initAnalytics()`，以及散落在模板上的 `data-track="<事件名>"`。这些极容易
 * 悄悄漂：改了端点只改一处、事件名拼错、某站漏装委托、或有人为了「按会话去重」在运行时里
 * 动 `document.cookie` —— 后者直接破坏「无同意负担」这个前提。本脚本把这些变成会红的断言：
 *
 *   1. 单源 JSON：provider=goatcounter、有端点与脚本、events 恰好 8 个且名字唯一；
 *   2. 三份 index.html：都带 `data-goatcounter="<端点>"`、`no_onload`、同一个 count.js；
 *   3. 三份运行时：`ANALYTICS_ENDPOINT` == 单源端点、`EVENT_NAMES` 集合 == 单源事件集，
 *      且装了 pageview / event / 委托三件；
 *   4. 无同意负担：运行时里不出现 `document.cookie` / `localStorage`（GoatCounter 本就不设 Cookie）；
 *   5. 接线：三站 router 都在 afterEach 调 `trackPageview`，三站 main 都调 `initAnalytics`；
 *   6. 事件名收敛：三站模板里所有 `data-track` 值都 ∈ 单源事件集（挡拼错 / 未登记）；
 *   7. 非空底：实际用到的事件 ≥ 4 个（否则守卫空过 —— 整套接线等于没接）。
 *
 * 用法：node scripts/check-analytics.mjs
 * 退出码：0 = 一致；1 = 有漂移。
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, extname } from 'node:path'
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

const SITES = [
  { key: 'es-plus-docs', html: 'es-plus-docs/index.html', runtime: 'es-plus-docs/src/utils/analytics.ts', router: 'es-plus-docs/src/router/index.ts', main: 'es-plus-docs/src/main.ts', src: 'es-plus-docs/src' },
  { key: 'es-pc', html: 'es-pc/index.html', runtime: 'es-pc/src/utils/analytics.js', router: 'es-pc/src/router/index.js', main: 'es-pc/src/main.js', src: 'es-pc/src' },
  { key: 'es-eui', html: 'es-eui/public/index.html', runtime: 'es-eui/src/utils/analytics.js', router: 'es-eui/src/router/index.js', main: 'es-eui/src/main.js', src: 'es-eui/src' },
]

// ── 1. 单一真源 ──────────────────────────────────────────
function readSource() {
  const raw = read('docs/analytics/analytics.json')
  if (!raw) {
    fail('缺少 docs/analytics/analytics.json（分析统计单一真源）')
    return null
  }
  let doc
  try {
    doc = JSON.parse(raw)
  } catch (e) {
    fail(`docs/analytics/analytics.json 不是合法 JSON：${e.message}`)
    return null
  }
  if (doc.provider !== 'goatcounter') fail(`单源 provider 是 ${doc.provider}，预期 goatcounter`)
  if (!doc.endpoint || !/^https:\/\/[\w.-]+\/count$/.test(doc.endpoint)) {
    fail(`单源 endpoint 不是合法 GoatCounter 端点：${doc.endpoint}`)
  }
  if (!doc.script) fail('单源缺少 script（count.js 地址）')
  const names = (doc.events || []).map((e) => e.name)
  if (names.length !== 8) fail(`单源事件数是 ${names.length}，审计 3.5 要求 8 个关键事件`)
  if (new Set(names).size !== names.length) fail('单源事件名有重复')
  return { endpoint: doc.endpoint, script: doc.script, names: new Set(names) }
}

// ── 2. index.html 脚本 ───────────────────────────────────
function checkHtml(site, src) {
  const html = read(site.html)
  if (!html) {
    fail(`缺少 ${site.html}`)
    return
  }
  const ep = html.match(/data-goatcounter="([^"]+)"/)?.[1]
  if (ep !== src.endpoint) fail(`${site.html} 的 data-goatcounter 是 ${ep || '(缺失)'}，应为 ${src.endpoint}`)
  if (!/no_onload\s*:\s*true/.test(html)) {
    fail(`${site.html} 未设 no_onload —— 不设它 count.js 会在硬加载时自动计一次，与 afterEach 的显式计数重复`)
  }
  if (!html.includes(src.script)) fail(`${site.html} 未加载 ${src.script}`)
}

// ── 3/4. 运行时 ──────────────────────────────────────────
function parseNames(text) {
  const block = text.match(/EVENT_NAMES\s*=\s*\[([\s\S]*?)\]/)?.[1]
  if (!block) return null
  return new Set((block.match(/'([^']+)'/g) || []).map((s) => s.slice(1, -1)))
}

function checkRuntime(site, src) {
  const text = read(site.runtime)
  if (!text) {
    fail(`缺少 ${site.runtime}`)
    return
  }
  const ep = text.match(/ANALYTICS_ENDPOINT\s*=\s*'([^']+)'/)?.[1]
  if (ep !== src.endpoint) fail(`${site.runtime} 的 ANALYTICS_ENDPOINT 是 ${ep || '(缺失)'}，应为 ${src.endpoint}`)
  const names = parseNames(text)
  if (!names) {
    fail(`${site.runtime} 未找到 EVENT_NAMES 数组`)
  } else {
    const missing = [...src.names].filter((n) => !names.has(n))
    const extra = [...names].filter((n) => !src.names.has(n))
    if (missing.length || extra.length) {
      fail(`${site.runtime} 的 EVENT_NAMES 与单源不一致：${missing.length ? `缺 [${missing.join(', ')}]；` : ''}${extra.length ? `多 [${extra.join(', ')}]` : ''}`)
    }
  }
  for (const fn of ['trackPageview', 'trackEvent', 'initAnalytics']) {
    if (!new RegExp(`export function ${fn}\\b`).test(text)) fail(`${site.runtime} 未导出 ${fn}`)
  }
  if (!/addEventListener\(\s*['"]click['"]/.test(text) || !/data-track/.test(text)) {
    fail(`${site.runtime} 未装 data-track 的委托点击监听`)
  }
  // 无同意负担：不许碰 Cookie / 本地存储（只看代码，先剥注释 —— 本文件注释里就提到这些词）
  const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
  for (const forbidden of ['document.cookie', 'localStorage', 'sessionStorage']) {
    if (code.includes(forbidden)) {
      fail(`${site.runtime} 出现 ${forbidden} —— 分析必须无 Cookie / 无存储（否则就有了同意负担）`)
    }
  }
}

// ── 5. 接线（router / main）──────────────────────────────
function checkWiring(site) {
  const router = read(site.router)
  if (router && !/trackPageview\s*\(/.test(router)) fail(`${site.router} 的 afterEach 未调 trackPageview`)
  const main = read(site.main)
  if (main && !/initAnalytics\s*\(\s*\)/.test(main)) fail(`${site.main} 未调 initAnalytics()`)
}

// ── 6/7. data-track 收敛 + 非空底 ────────────────────────
function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue
    const abs = join(dir, name)
    const st = statSync(abs)
    if (st.isDirectory()) walk(abs, out)
    else if (['.vue', '.ts', '.js', '.jsx', '.tsx'].includes(extname(name))) out.push(abs)
  }
  return out
}

function checkDataTrack(src) {
  const used = new Set()
  for (const site of SITES) {
    const abs = join(ROOT, site.src)
    if (!existsSync(abs)) continue
    for (const file of walk(abs, [])) {
      const text = readFileSync(file, 'utf-8')
      for (const m of text.matchAll(/data-track="([^"]+)"/g)) {
        const name = m[1]
        used.add(name)
        if (!src.names.has(name)) {
          fail(`${file.replace(ROOT, '').replace(/\\/g, '/')} 用了未登记的 data-track="${name}"（见 docs/analytics/analytics.json）`)
        }
      }
    }
  }
  if (used.size < 4) {
    fail(`实际接线的事件只有 ${used.size} 个（${[...used].join(', ') || '无'}）—— 至少接 4 个，否则整套分析等于没接`)
  }
  return used
}

const src = readSource()
if (src) {
  for (const site of SITES) {
    checkHtml(site, src)
    checkRuntime(site, src)
    checkWiring(site)
  }
  const used = checkDataTrack(src)
  if (!failed) {
    console.log(`✅ 分析统计三站一致：GoatCounter 无 Cookie；端点单源 ${src.endpoint}；8 个事件词表齐平，已接线 ${used.size} 个（${[...used].sort().join(', ')}）；pageview 走 router afterEach`)
  }
}

if (failed) {
  console.error('\n分析统计存在漂移。')
  process.exit(1)
}
