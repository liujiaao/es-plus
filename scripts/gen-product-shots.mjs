#!/usr/bin/env node
/**
 * 产品实拍生成器（路线图 2.2）。
 *
 * 清单在 docs/product/shots.json：每个条目 = 一张真实界面截图（站点 + 路由 + 主题）。
 * 这个脚本用无头 Chromium 打开对应页面现拍，写到 docs/product/<id>.png。
 *
 * 为什么要有这个脚本，而不是把截图放进仓库就完事：
 *   截图是最容易过期的东西 —— 页面改了文案、改了布局，图还停在上一版，
 *   而没人会因为「图没更新」去看一眼。把「拍」变成一条命令，重拍才有成本上的可行性。
 *
 * 前置：三个站点要能访问（默认用本地预览端口）：
 *   es-plus-docs  DOCS_URL（默认 http://localhost:4390）
 *   es-pc         PC_URL  （默认 http://localhost:4391）
 *   es-eui        EUI_URL （默认 http://localhost:4175）
 * 拍完跑 npm run product:sync 分发到三站 public/product/。
 *
 * 用法：node scripts/gen-product-shots.mjs [--only <id,id>]
 * 退出码：0 = 全部拍完；1 = 有页面打不开或截图失败。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { chromium } from '@playwright/test'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const MANIFEST = 'docs/product/shots.json'

const SITE_URL = {
  'es-plus-docs': process.env.DOCS_URL || 'http://localhost:4390',
  'es-pc': process.env.PC_URL || 'http://localhost:4391',
  'es-eui': process.env.EUI_URL || 'http://localhost:4175',
}

/**
 * 每站的「站点外壳」处理：藏掉顶栏 / 侧栏 / 升级横幅，**并**抹掉它们留下的避让。
 *
 * 产品实拍要的是**产品**，不是把网站再套一层网站：截图里带着本站的顶栏和侧栏，
 * 放进首页首屏后就会与外层导航重复（像截图里嵌了张截图）。
 *
 * 但只 display:none 是不够的 —— 三站的正文都为固定顶栏留了 padding-top、为常驻侧栏
 * 留了 margin-left（或「外壳宽 − 侧栏宽」的减法）。外壳藏了而避让还在，正文就会
 * 缩在右下角。所以每条外壳规则都配一条等量的复位规则。
 */
const SITE_CHROME = {
  'es-plus-docs': [
    'header.app-header, aside.app-sidebar { display: none !important }',
    '.app-content { margin-left: 0 !important; padding-top: 0 !important }',
  ],
  'es-pc': [
    'header.doc-header, aside.doc-sider { display: none !important }',
    // 正文上限原本是「外壳宽 − 260px 侧栏」的减法，侧栏不在时这条减法会把卡片缩在左半边
    '.doc-content { padding: 0 !important }',
    '.content-wrapper { max-width: none !important; margin: 0 !important; border-radius: 0 !important }',
    // 旗舰页自带 1400 的阅读宽度；antdv 表格 12 列在 1400 下会横向滚动，
    // 最右一列被固定列盖住半截。截图里放宽到视口宽，让整张表一次看完。
    '.flagship-approval { max-width: none !important }',
  ],
  'es-eui': [
    'header.header, div.upgrade-banner { display: none !important }',
    '.main, .main.banner-visible { padding-top: 0 !important }',
  ],
}

const onlyArg = process.argv.indexOf('--only')
const ONLY = onlyArg > -1 ? new Set(process.argv[onlyArg + 1].split(',').map((s) => s.trim())) : null

const manifest = JSON.parse(readFileSync(join(ROOT, MANIFEST), 'utf8'))
const { width, height } = manifest.viewport
/** 宽表页（旗舰工作台 12 列）在 1440 下会横向滚动、切掉最右一列 —— 允许单张覆盖视口，
 *  仍然保持 16:10，页面里按同一比例显示，不会变形。 */
const viewportOf = (shot) => shot.viewport || { width, height }
const shots = ONLY ? manifest.shots.filter((s) => ONLY.has(s.id)) : manifest.shots

if (shots.length === 0) {
  console.error(`[gen-product-shots] --only 没匹配到任何条目（清单里是：${manifest.shots.map((s) => s.id).join(', ')}）`)
  process.exit(1)
}

mkdirSync(join(ROOT, 'docs/product'), { recursive: true })

console.log(`[gen-product-shots] 拍 ${shots.length} 张（${width}×${height}）`)
const browser = await chromium.launch()
let failed = 0

for (const shot of shots) {
  const base = SITE_URL[shot.site]
  if (!base) {
    console.error(`  ❌ ${shot.id}：未知站点 ${shot.site}`)
    failed++
    continue
  }
  const context = await browser.newContext({
    viewport: viewportOf(shot),
    deviceScaleFactor: 1,
    // 深色截图靠站点自己的主题存储：三站都读 localStorage.theme，与服务端无关
    colorScheme: shot.theme === 'dark' ? 'dark' : 'light',
  })
  await context.addInitScript((theme) => {
    try {
      localStorage.setItem('theme', theme)
      localStorage.setItem('language', 'zh-CN')
    } catch {
      // 隐私模式下 localStorage 可能不可写；截图仍能拍，只是主题回落到系统偏好
    }
  }, shot.theme)

  const page = await context.newPage()
  // 页面抛错时截图仍然是「成功」的：路由组件崩了，截到的是一张只有页脚的空白图
  // （docs 首页踩过：模板里读了清单里可选的 file 字段，整页白屏，18 张里悄悄坏了一张）。
  // 所以把运行时报错当成这次拍摄失败 —— 拍不了能用的页面，就不该产出图。
  const pageErrors = []
  page.on('pageerror', (err) => pageErrors.push(err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') pageErrors.push(msg.text())
  })
  // 查询串用来破缓存：同 hash 的再次导航不会重新加载文档（踩过的坑）
  const url = `${base}/?shot=${shot.id}#${shot.route}`
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 })
    // 字体、图表、表格首屏数据都在 networkidle 之后才画完
    await page.evaluate(() => document.fonts?.ready)
    // 藏掉站点外壳：拍的是产品，不是「装了产品的网站」。放在首帧稳定之后再注入，
    // 免得影响页面对视口宽度的首次测量（三站都按 CSS 断点排版）。
    const chrome = shot.hide ? shot.hide.map((selector) => `${selector} { display: none !important }`) : SITE_CHROME[shot.site]
    if (chrome && chrome.length > 0) {
      await page.addStyleTag({ content: chrome.join('\n') })
    }
    await page.waitForTimeout(900)

    if (pageErrors.length > 0) {
      throw new Error(`页面运行时报错（截图会是一张空白图）：${pageErrors[0].split('\n')[0].slice(0, 160)}`)
    }
    // 双保险：即使没有报错，正文几乎没字也说明路由组件没渲染出来
    const textLength = await page.evaluate(() => document.body.innerText.trim().length)
    if (textLength < 200) {
      throw new Error(`页面正文只有 ${textLength} 个字符，路由组件没有渲染（截不出东西）`)
    }

    const file = join(ROOT, shot.file || `docs/product/${shot.id}.png`)

    // 数字滚动的 hero 统计、迟到的表格行会让「第一张」停在半路：连拍两张，
    // 字节相同才算画完（本仓库已无无限动画，所以正常情况下第二轮就稳定）。
    let buffer = await page.screenshot({ type: 'png' })
    let stable = false
    for (let attempt = 0; attempt < 4 && !stable; attempt++) {
      await page.waitForTimeout(600)
      const next = await page.screenshot({ type: 'png' })
      stable = next.equals(buffer)
      buffer = next
    }
    if (!stable) console.warn(`  ⚠️  ${shot.id}：画面 4 次连拍仍未稳定（可能有动画或持续加载），用的是最后一张`)

    writeFileSync(file, buffer)
    if (!existsSync(file) || statSync(file).size < 4096) {
      throw new Error(`截图疑似空白：${file}`)
    }
    const kb = (statSync(file).size / 1024).toFixed(0)
    console.log(`  ✅ ${shot.id} → ${shot.file || `docs/product/${shot.id}.png`}（${kb} KB）`)
  } catch (err) {
    console.error(`  ❌ ${shot.id}：${err.message.split('\n')[0]}`)
    failed++
  } finally {
    await context.close()
  }
}

await browser.close()

if (failed > 0) {
  console.error(`\n[gen-product-shots] 失败 ${failed} 张`)
  process.exit(1)
}
console.log('\n[gen-product-shots] 完成。下一步：npm run product:sync')
