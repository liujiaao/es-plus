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
 * 产出 docs/brand/og-image.png（单一真源），由 sync-brand 分发到三站的 public/。
 * 新鲜度由 scripts/check-brand-assets.mjs 校验：它把本脚本的两个输入做哈希存进
 * docs/brand/og-image.meta.json，输入变了但图没重生成就会失败。
 *
 * 用法：
 *   node scripts/gen-og-image.mjs           # 生成（需要 Playwright + chromium）
 *   node scripts/gen-og-image.mjs --check   # 只校验输入哈希是否与已生成的图一致
 *
 * 退出码：0 = 成功/一致；1 = 依赖缺失或输入已过期。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readText } from './lib/text-sync.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SLOGAN = join(ROOT, 'docs', 'brand', 'slogan.json')
const TOKENS = join(ROOT, 'docs', 'tokens', 'design-tokens.css')
const OUT_PNG = join(ROOT, 'docs', 'brand', 'og-image.png')
const OUT_META = join(ROOT, 'docs', 'brand', 'og-image.meta.json')

const CHECK = process.argv.includes('--check')

/** 输入指纹：文案 + 配色变了就必须重新生成，否则卡片上会是旧口号/旧颜色 */
function inputHash() {
  const slogan = readText(SLOGAN)
  const tokens = readText(TOKENS)
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

async function main() {
  const input = inputHash()

  if (CHECK) {
    if (!existsSync(OUT_PNG) || !existsSync(OUT_META)) {
      console.error('❌ 分享卡片未生成（docs/brand/og-image.png）—— 运行 `npm run og:gen`')
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

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
  await page.setContent(cardHtml(input), { waitUntil: 'load' })
  await page.waitForTimeout(300)
  const buf = await page.screenshot({ type: 'png' })
  await browser.close()

  if (!existsSync(dirname(OUT_PNG))) mkdirSync(dirname(OUT_PNG), { recursive: true })
  writeFileSync(OUT_PNG, buf)
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
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`✅ 已生成 docs/brand/og-image.png（1200×630，输入哈希 ${input.hash}）`)
}

main()
