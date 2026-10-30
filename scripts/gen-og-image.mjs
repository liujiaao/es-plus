#!/usr/bin/env node
/**
 * 分享卡片图（og:image）生成：由品牌单源渲染 1200×630 PNG。
 *
 * 背景：三站都没有 og:image —— 链接分享到微信/Twitter/Slack/掘金时没有卡片图，
 * 只有一行裸文字。而 og:image 必须是 PNG/JPG（平台不认 SVG），所以没法像 favicon
 * 那样直接同步一个 SVG 过去。
 *
 * 做法：用 Playwright 把一段由**品牌单源**驱动的 HTML 渲染成 PNG：
 *   - 文案取自 docs/brand/slogan.json（定位 + 主张 + 副标题）；
 *   - 配色取自 docs/tokens/design-tokens.css 的 --es-brand-primary / --es-brand-accent。
 * 因此改品牌文案或品牌色 → 重跑本脚本即得到新卡片，不会出现「卡上写的还是旧口号」。
 *
 * 产出两份 PNG，同一份品牌单源、同一套配色：
 *   · docs/brand/og-image.png（1200×630）—— 站点 og:image，由 sync-brand 分发到三站 public/；
 *   · docs/brand/social-preview.png（1280×640）—— GitHub 仓库 Social preview，
 *     只用于 GitHub（上传是仓库设置里的手工步骤），**不分发**。
 * 新鲜度由 scripts/check-brand-assets.mjs 校验：它把本脚本的两个输入做哈希存进
 * docs/brand/og-image.meta.json，输入变了但图没重生成就会失败（两张图共用一份哈希）。
 *
 * 用法：
 *   node scripts/gen-og-image.mjs           # 生成两张（需要 Playwright + chromium）
 *   node scripts/gen-og-image.mjs --check   # 只校验输入哈希是否与已生成的图一致
 *
 * 退出码：0 = 成功/一致；1 = 依赖缺失或输入已过期。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readText, normalizeEol } from './lib/text-sync.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SLOGAN = join(ROOT, 'docs', 'brand', 'slogan.json')
const TOKENS = join(ROOT, 'docs', 'tokens', 'design-tokens.css')
const OUT_PNG = join(ROOT, 'docs', 'brand', 'og-image.png')
const OUT_META = join(ROOT, 'docs', 'brand', 'og-image.meta.json')
/**
 * GitHub 仓库的 Social preview（Settings → Social preview）—— **1280×640**，与
 * og:image 的 1200×630 是两个尺寸，不能共用一张：GitHub 的卡片按 2:1 裁切，
 * 1200×630 贴上去上下会被切掉，标题正好落在被切的那条线上。
 *
 * 这张图只用于 GitHub（站点 og:image 仍用 1200×630），所以它**不**分发到三个站的
 * public/ —— 上传是仓库设置里的手工步骤，脚本能做的只有「把图按品牌单源画出来」。
 */
const OUT_SOCIAL = join(ROOT, 'docs', 'brand', 'social-preview.png')

const CHECK = process.argv.includes('--check')

/**
 * 可选：指定 Playwright 用哪个浏览器内核渲染（如 `OG_BROWSER_CHANNEL=msedge`）。
 * 默认留空 = 用 Playwright 自带的 chromium（CI 上就是这样）；本机没装内置内核时
 * 可以用系统已装的 Edge/Chrome，否则脚本只能报「Executable doesn't exist」。
 * 渲染内核与字体不同 → PNG 像素可能不同，这是必然的；门禁比对的是**输入哈希**，
 * 不是 PNG 字节，所以不影响一致性判定。
 */
const CHANNEL = process.env.OG_BROWSER_CHANNEL || ''

/** 输入指纹：文案 + 配色变了就必须重新生成，否则卡片上会是旧口号/旧颜色 */
function inputHash() {
  // 行尾符是 **git 检出的产物**，不是内容（见 scripts/lib/text-sync.mjs 的说明）：
  // 直接用 readText 的结果做哈希，同一份内容在 Windows（CRLF）与 Linux CI（LF）
  // 会算出不同的值 → `og:check` 在本机恒红、AI 只能靠人记住「这是假阳性」。
  // 归一化之后哈希只反映内容，跨平台一致。
  const slogan = normalizeEol(readText(SLOGAN))
  const tokens = normalizeEol(readText(TOKENS))
  const brand = tokens.match(/--es-brand-primary:\s*(#[0-9a-fA-F]{3,8})/)?.[1] || ''
  const accent = tokens.match(/--es-brand-accent:\s*(#[0-9a-fA-F]{3,8})/)?.[1] || ''
  return {
    hash: createHash('sha256').update(slogan + '|' + brand + '|' + accent).digest('hex').slice(0, 16),
    brand,
    accent,
  }
}

function cardHtml({ brand, accent }) {
  const s = JSON.parse(readText(SLOGAN))
  const p = s.promises.find((x) => x.key === 'one-config')
  const cross = s.promises.find((x) => x.key === 'cross-renderer')
  const ai = s.promises.find((x) => x.key === 'ai-native')
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    width:1200px; height:630px; overflow:hidden;
    font-family:"Microsoft YaHei","PingFang SC","Helvetica Neue",Arial,sans-serif;
    background:#0f172a; color:#e5eaf3; position:relative;
  }
  .glow { position:absolute; border-radius:50%; filter:blur(90px); opacity:.55; }
  .g1 { width:620px; height:620px; left:-160px; top:-220px; background:${brand}; }
  .g2 { width:520px; height:520px; right:-140px; bottom:-240px; background:${accent}; }
  .wrap { position:relative; padding:70px 76px; height:100%; display:flex; flex-direction:column; }
  .brand { display:flex; align-items:center; gap:16px; margin-bottom:40px; }
  .mark {
    width:56px; height:56px; border-radius:14px;
    background:linear-gradient(135deg,${brand},${accent});
    display:flex; align-items:center; justify-content:center;
    font-size:22px; font-weight:800; color:#fff; letter-spacing:.5px;
  }
  .name { font-size:30px; font-weight:800; letter-spacing:.5px; }
  h1 { font-size:62px; line-height:1.15; font-weight:800; margin-bottom:20px; }
  h1 em { font-style:normal; background:linear-gradient(135deg,${brand},${accent});
    -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
  .sub { font-size:27px; color:#a9b4c4; margin-bottom:14px; }
  .en { font-size:22px; color:#7d8899; margin-bottom:auto; }
  .promises { display:flex; gap:18px; }
  .card {
    flex:1; background:rgba(255,255,255,.055); border:1px solid rgba(255,255,255,.12);
    border-radius:16px; padding:20px 22px;
  }
  .card .t { font-size:21px; font-weight:700; margin-bottom:8px; color:#fff; }
  .card .c { font-size:19px; color:${accent}; font-weight:700; margin-bottom:6px; }
  .card .d { font-size:16px; color:#96a1b1; line-height:1.5; }
</style></head><body>
  <div class="glow g1"></div><div class="glow g2"></div>
  <div class="wrap">
    <div class="brand"><div class="mark">ES</div><div class="name">${esc(s.name)}</div></div>
    <h1><em>${esc(s.positioning)}</em></h1>
    <div class="sub">${esc(s.slogan.subtitle)}</div>
    <div class="en">${esc(s.slogan.en)}</div>
    <div class="promises">
      <div class="card"><div class="t">${esc(p.title)}</div><div class="c">${esc(p.claim)}</div><div class="d">${esc(p.desc)}</div></div>
      <div class="card"><div class="t">${esc(cross.title)}</div><div class="c">${esc(cross.claim)}</div><div class="d">${esc(cross.desc)}</div></div>
      <div class="card"><div class="t">${esc(ai.title)}</div><div class="c">${esc(ai.claim)}</div><div class="d">${esc(ai.desc)}</div></div>
    </div>
  </div>
</body></html>`
}

/**
 * GitHub social preview 的画布（1280×640）。
 *
 * 与 og:image 共用同一份品牌文案与配色，但**版式另写**：GitHub 在仓库卡片和链接
 * 预览里会把它缩到 500px 上下，og:image 那三张 promise 卡在这个尺寸下只剩糊字。
 * 这里只留三层 —— 主张、一句副标题、三个渲染器 —— 保证缩到一半仍读得出来。
 */
function socialHtml({ brand, accent }) {
  const s = JSON.parse(readText(SLOGAN))
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const renders = ['Vue 3 + Element Plus', 'Vue 2 + Element UI', 'Vue 3 + Ant Design Vue']
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    width:1280px; height:640px; overflow:hidden;
    font-family:"Microsoft YaHei","PingFang SC","Helvetica Neue",Arial,sans-serif;
    background:#0f172a; color:#e5eaf3; position:relative;
  }
  .glow { position:absolute; border-radius:50%; filter:blur(110px); opacity:.5; }
  /* 两团光都放右半边：标题在左侧，压在亮色光斑上会掉对比度（缩到 GitHub 卡片尺寸
     后尤其明显）。左边保持深色，右边才是品牌色。 */
  .g1 { width:720px; height:720px; right:-260px; top:-320px; background:${brand}; }
  .g2 { width:600px; height:600px; right:-140px; bottom:-320px; background:${accent}; }
  .wrap { position:relative; padding:76px 88px; height:100%; display:flex; flex-direction:column; }
  .brand { display:flex; align-items:center; gap:20px; }
  .mark {
    width:70px; height:70px; border-radius:18px;
    background:linear-gradient(135deg,${brand},${accent});
    display:flex; align-items:center; justify-content:center;
    font-size:28px; font-weight:800; color:#fff; letter-spacing:.5px;
  }
  .name { font-size:38px; font-weight:800; letter-spacing:.5px; }
  .url { margin-left:auto; font-size:24px; color:#8f9aab; white-space:nowrap; }
  h1 { font-size:86px; line-height:1.12; font-weight:800; margin-top:auto; color:#f5f8ff; }
  .sub { font-size:34px; color:#a9b4c4; margin-top:22px; }
  .foot { display:flex; align-items:center; gap:14px; margin-top:auto; }
  .chip {
    font-size:24px; color:#d7dee9; padding:10px 20px; border-radius:999px;
    background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.14);
    white-space:nowrap;
  }
</style></head><body>
  <div class="glow g1"></div><div class="glow g2"></div>
  <div class="wrap">
    <div class="brand">
      <div class="mark">ES</div><div class="name">${esc(s.name)}</div>
      <span class="url">liujiaao.github.io/es-plus</span>
    </div>
    <h1>${esc(s.positioning)}</h1>
    <div class="sub">${esc(s.slogan.subtitle)}</div>
    <div class="foot">
      ${renders.map((r) => `<span class="chip">${esc(r)}</span>`).join('')}
    </div>
  </div>
</body></html>`
}

async function main() {
  const input = inputHash()

  if (CHECK) {
    if (!existsSync(OUT_PNG) || !existsSync(OUT_META) || !existsSync(OUT_SOCIAL)) {
      console.error(
        '❌ 分享卡片未生成（docs/brand/og-image.png / social-preview.png）—— 运行 `npm run og:gen`',
      )
      process.exit(1)
    }
    const meta = JSON.parse(readText(OUT_META))
    if (meta.inputHash !== input.hash) {
      console.error(
        `❌ 分享卡片已过期：品牌文案或品牌色改了（输入哈希 ${meta.inputHash} → ${input.hash}），` +
          '但 docs/brand/og-image.png 没有重新生成 —— 卡上写的会是旧口号/旧配色。' +
          '运行 `npm run og:gen`。',
      )
      process.exit(1)
    }
    console.log(`✅ 分享卡片与品牌单源一致（输入哈希 ${input.hash}）`)
    return
  }

  let chromium
  try {
    ;({ chromium } = await import('playwright'))
  } catch {
    console.error('❌ 未安装 playwright —— 本脚本需要它把 HTML 渲染成 PNG（npm i -D playwright）')
    process.exit(1)
  }

  const browser = await chromium.launch(CHANNEL ? { channel: CHANNEL } : {})
  /** 同一个浏览器按各自视口渲染：图上的尺寸就是 CSS 里写的尺寸（deviceScaleFactor 1） */
  const render = async (html, width, height) => {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
    await page.setContent(html, { waitUntil: 'load' })
    await page.waitForTimeout(300)
    const buf = await page.screenshot({ type: 'png' })
    await page.close()
    return buf
  }
  const buf = await render(cardHtml(input), 1200, 630)
  const social = await render(socialHtml(input), 1280, 640)
  await browser.close()

  if (!existsSync(dirname(OUT_PNG))) mkdirSync(dirname(OUT_PNG), { recursive: true })
  writeFileSync(OUT_PNG, buf)
  writeFileSync(OUT_SOCIAL, social)
  writeFileSync(
    OUT_META,
    JSON.stringify(
      {
        $comment:
          '由 scripts/gen-og-image.mjs 生成：记录生成时的输入指纹，用于判断卡片是否已过期',
        inputHash: input.hash,
        brandPrimary: input.brand,
        brandAccent: input.accent,
        size: '1200x630',
        socialPreview: 'social-preview.png (1280x640，GitHub Settings → Social preview)',
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`✅ 已生成 docs/brand/og-image.png（1200×630，输入哈希 ${input.hash}）`)
  console.log('✅ 已生成 docs/brand/social-preview.png（1280×640，上传到 GitHub 仓库设置）')
}

main()
