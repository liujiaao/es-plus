#!/usr/bin/env node
/**
 * 品牌资产与站点 meta 校验
 *
 * 背景（三处都实测过）：
 *   1. 三站的图标各是一套、且都不是品牌色 —— es-plus-docs / es-eui 是 #409EFF
 *      （Element Plus 默认蓝）配「E+」，es-pc 是 #1677ff（Ant Design Vue 默认蓝）配「E」，
 *      文件还叫 vite.svg（脚手架遗留命名）。而三站顶栏的标记用的是「ES」方块 ——
 *      标签页图标与站内标记也对不上。
 *   2. es-pc 顶栏的 logo 用的是 Ant Design Vue 的 BookOutlined 图标 ——
 *      拿第三方 UI 库的图标当自己产品的 logo。
 *   3. 三站 index.html 里没有任何 description / og:* / canonical：
 *      - 主站把 meta 放在 unhead 里由 JS 注入 → 不执行 JS 的抓取器与社交平台抓不到；
 *      - es-pc / es-eui 连静态 meta 都没有 → 分享出去是无描述的裸链接；
 *      - 三站都没有 og:image → 没有分享卡片图（og:image 必须是 PNG/JPG，故由
 *        scripts/gen-og-image.mjs 用 Playwright 从品牌单源渲染，而不是同步 SVG）。
 *
 * 本脚本把这些不变量变成断言：
 *   A. favicon.svg 的渐变端点色 == docs/tokens/design-tokens.css 的品牌主色/强调色
 *      （SVG 读不到 CSS 变量，只能写字面量，所以必须靠门禁防漂移）；
 *   B. og-image 未过期（输入哈希对得上）+ 已发布到主站 public/；
 *   C. 三站 index.html 均有 favicon 链接、description、og:title/description/image、canonical，
 *      且 canonical 与 og:url 的域名 == es-plus-docs/vite.config.ts 的 SITE_HOSTNAME
 *      （与 check-site-nav 同一套规范域名来源）；
 *   D. 三站标题都带「ES-Plus」（不再出现旧产品名 ES-EUI 或命名不一致）；
 *   E. es-pc 顶栏不再用第三方库图标当 logo。
 *
 * 用法：node scripts/check-brand-assets.mjs
 * 退出码：0 = 全部通过；1 = 有漂移。
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

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

// ── A. favicon 用色 == 品牌 token ────────────────────────
function checkFavicon() {
  const tokens = read('docs/tokens/design-tokens.css')
  const favicon = read('docs/brand/favicon.svg')
  if (!tokens || !favicon) return
  const brand = tokens.match(/--es-brand-primary:\s*(#[0-9a-fA-F]{3,8})/)?.[1]
  const accent = tokens.match(/--es-brand-accent:\s*(#[0-9a-fA-F]{3,8})/)?.[1]
  if (!brand || !accent) {
    fail('未能从 docs/tokens/design-tokens.css 取到 --es-brand-primary / --es-brand-accent')
    return
  }
  const stops = [...favicon.matchAll(/stop-color="(#[0-9a-fA-F]{3,8})"/gi)].map((m) => m[1].toLowerCase())
  if (!stops.length) {
    fail('docs/brand/favicon.svg 里没有渐变端点（stop-color），无法核对是否用了品牌色')
    return
  }
  const want = [brand.toLowerCase(), accent.toLowerCase()]
  const missing = want.filter((c) => !stops.includes(c))
  if (missing.length) {
    fail(
      `docs/brand/favicon.svg 的配色与品牌 token 不一致：缺少 ${missing.join(', ')}` +
        `（favicon 现有 ${stops.join(', ')}；token 是 ${want.join(', ')}）。` +
        'SVG 读不到 CSS 变量，改品牌色时必须同步这个文件。',
    )
  } else {
    console.log(`✅ favicon 配色与品牌 token 一致（${want.join(' → ')}）`)
  }
}

// ── B. og-image 是否过期 / 是否已发布 ────────────────────
function checkOgImage() {
  const meta = read('docs/brand/og-image.meta.json')
  if (!meta) return
  if (!existsSync(join(ROOT, 'docs/brand/og-image.png'))) {
    fail('缺少 docs/brand/og-image.png（运行 `npm run og:gen` 生成）')
    return
  }
  if (!existsSync(join(ROOT, 'es-plus-docs/public/og-image.png'))) {
    fail('分享卡片未发布到 es-plus-docs/public/og-image.png（运行 `npm run brand:sync`）')
    return
  }
  // 新鲜度由生成脚本自己判定（它算得出输入哈希，这里不重复实现）
  console.log('ℹ️  分享卡片过期检查由 `npm run og:check` 负责（已并入 check:consistency）')
}

// ── C/D/E. 三站 index.html 与顶栏标记 ───────────────────
const SITE_HTML = [
  { key: 'es-plus-docs', html: 'es-plus-docs/index.html', canon: '/', logoFile: 'es-plus-docs/src/components/layout/AppHeader.vue' },
  { key: 'es-pc', html: 'es-pc/index.html', canon: '/es-pc/', logoFile: 'es-pc/src/layouts/DocLayout.vue' },
  { key: 'es-eui', html: 'es-eui/public/index.html', canon: '/es-eui/', logoFile: 'es-eui/src/App.vue' },
]

function siteOrigin() {
  const vite = read('es-plus-docs/vite.config.ts')
  const host = vite?.match(/SITE_HOSTNAME\s*=\s*'([^']+)'/)?.[1]
  return host ? host.replace(/\/$/, '') : null
}

function checkSiteMeta() {
  const origin = siteOrigin()
  if (!origin) return
  for (const site of SITE_HTML) {
    const html = read(site.html)
    if (!html) continue

    // 注意不能用 [^>]* 跨过 href：es-eui 用的是 webpack 模板语法
    // `<%= BASE_URL %>favicon.svg`，里面的 `%>` 含 `>`，会把匹配截断
    if (!/rel="icon"[\s\S]{0,160}?favicon\.svg/.test(html)) {
      fail(`${site.html} 未链接 favicon.svg`)
    }
    if (!/name="description"\s+content="[^"]{10,}"/.test(html)) {
      fail(`${site.html} 缺少静态 meta description（不执行 JS 的抓取器读不到 unhead 注入的那份）`)
    }
    for (const prop of ['og:title', 'og:description', 'og:image', 'og:url']) {
      if (!new RegExp(`property="${prop}"`).test(html)) {
        fail(`${site.html} 缺少 ${prop} —— 分享出去没有标题/描述/卡片图`)
      }
    }
    if (!/<meta name="twitter:card"/.test(html)) {
      fail(`${site.html} 缺少 twitter:card`)
    }

    const expectedUrl = `${origin}${site.canon}`
    const canon = html.match(/rel="canonical"\s+href="([^"]+)"/)?.[1]
    if (canon !== expectedUrl) {
      fail(`${site.html} 的 canonical 是 ${canon || '(缺失)'}，应为 ${expectedUrl}`)
    }
    const ogUrl = html.match(/property="og:url"\s+content="([^"]+)"/)?.[1]
    if (ogUrl !== expectedUrl) {
      fail(`${site.html} 的 og:url 是 ${ogUrl || '(缺失)'}，应为 ${expectedUrl}`)
    }
    const ogImg = html.match(/property="og:image"\s+content="([^"]+)"/)?.[1]
    if (ogImg !== `${origin}/og-image.png`) {
      fail(
        `${site.html} 的 og:image 是 ${ogImg || '(缺失)'}，应为 ${origin}/og-image.png` +
          '（三站是同一产品的三个渲染端，共用主站的卡片图）',
      )
    }

    // D. 标题必须带产品名（此前 es-eui 写的是并入前的旧名「ES-EUI」）
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] || ''
    if (!title.includes('ES-Plus')) {
      fail(`${site.html} 的标题是「${title}」—— 必须含产品名 ES-Plus（旧名 ES-EUI 已弃用）`)
    }
  }

  // E. 顶栏标记不得是第三方库图标
  const pcLayout = read('es-pc/src/layouts/DocLayout.vue')
  if (pcLayout) {
    if (/<BookOutlined\s+class="logo-icon"/.test(pcLayout)) {
      fail(
        'es-pc 顶栏仍用 Ant Design Vue 的 BookOutlined 当 logo —— ' +
          '拿第三方 UI 库的图标当自己产品的标记；另两站用的是「ES」方块',
      )
    } else if (!/logo-mark/.test(pcLayout)) {
      fail('es-pc 顶栏未使用统一的「ES」品牌标记（.logo-mark）')
    }
  }

  if (!failed) console.log(`✅ 三站 meta / canonical / og / 顶栏标记齐备且指向规范域名（${origin}）`)
}

checkFavicon()
checkOgImage()
checkSiteMeta()

if (failed) {
  console.error('\n品牌资产或站点 meta 存在漂移。')
  process.exit(1)
}
console.log('\n品牌资产与站点 meta ✅')
