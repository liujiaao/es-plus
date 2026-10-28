#!/usr/bin/env node
/**
 * 产品录屏生成器（路线图 2.2：3 段 ≤30s 录屏）。
 *
 * 清单在 docs/product/videos.json：每个条目 = 一段真实操作的录屏（站点 + 路由 + 流程名）。
 * 这个脚本用无头 Chromium 录下三段流程，再用 ffmpeg 转成 WebM/VP9 并抽一张首帧海报。
 *
 * 为什么录屏也要有生成器：截图会过期，录屏过期得更快 —— 流程里点不动一个按钮，
 * 观众只会觉得「这功能坏了」，而维护者不会因为「视频没重录」去看一眼。把「录」
 * 变成一条命令，重录才有成本上的可行性（与 gen-product-shots.mjs 同一思路）。
 *
 * 为什么是 WebM 而不是审计里首选的 MP4/H.264：本机与 CI 都没有带 libx264 的 ffmpeg，
 * 只有 Playwright 自带的裁剪版（编码器仅 png / libvpx-vp9，复用器仅 webm，
 * 滤镜只有 crop / format / pad / scale / trim）。与其为了扩展名硬塞一个别的容器，
 * 不如给一个所有现代浏览器都能播的真 WebM，并在页面上把格式写清楚。
 *
 * 首帧即结果：海报（poster）就是「结果」那一帧，页面上视频不自动播放 ——
 * 观众第一眼看到的是成品定位里那张表，点播放才看操作过程。
 * 之所以不做「先放 2 秒静帧再放流程」：这个 ffmpeg 既没有 concat 滤镜也没有
 * concat 复用器，也解不了 PNG，硬拼只能靠重编码两次再手工接容器，不值得。
 *
 * 前置：三个站点要能访问（默认用本地预览端口）：
 *   es-plus-docs  DOCS_URL（默认 http://localhost:4390）
 *   es-pc         PC_URL  （默认 http://localhost:4391）
 *   es-eui        EUI_URL （默认 http://localhost:4175）
 * ffmpeg 默认取 Playwright 自带的那个（ms-playwright 下的 ffmpeg-<版本> 目录），可用 FFMPEG 环境变量覆盖。
 *
 * 用法：node scripts/gen-product-videos.mjs [--only <id,id>]
 * 退出码：0 = 全部录完；1 = 有页面打不开、流程跑不通或编码失败。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { homedir, tmpdir } from 'node:os'
import { chromium } from '@playwright/test'
import { readWebmMeta } from './lib/webm.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const MANIFEST = 'docs/product/videos.json'

const SITE_URL = {
  'es-plus-docs': process.env.DOCS_URL || 'http://localhost:4390',
  'es-pc': process.env.PC_URL || 'http://localhost:4391',
  'es-eui': process.env.EUI_URL || 'http://localhost:4175',
}

/** 录屏的目标帧率。原始录制是「画面变了才出一帧」的变帧率，转成固定帧率才能被播放器好好拖。 */
const FPS = 25

// ── ffmpeg：Playwright 自带的裁剪版 ─────────────────────────────
//
// 本机可能同时有几个 ms-playwright/ffmpeg-<版本> 目录（装了几版 Chromium 就有几个），
// 而它们的裁剪方向不一样：ffmpeg-1011 只有 VP8 编解码，ffmpeg-1013 有 VP9 编码器
// 却**没有 VP8 解码器**。Playwright 录出来的是 VP8，于是「取最新的那个」会在
// 转码时直接报 no decoder found。所以不按版本号拍脑袋，按能力选：
// 能解 VP8（必须）> 能编 VP9（更好，体积小一半）> 版本号高。
function capsOf(bin) {
  const run = (flag) => {
    try {
      return execFileSync(bin, ['-hide_banner', flag], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (err) {
      // 有的构建把清单打到 stderr
      return String((err.stdout || '') + (err.stderr || ''))
    }
  }
  const decoders = run('-decoders')
  const encoders = run('-encoders')
  return {
    vp8Decode: /\bvp8\b/i.test(decoders),
    vp9Encode: /libvpx-vp9/.test(encoders),
  }
}

function findFfmpeg() {
  if (process.env.FFMPEG) return { bin: process.env.FFMPEG, encoder: capsOf(process.env.FFMPEG).vp9Encode ? 'libvpx-vp9' : 'libvpx' }
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    join(homedir(), 'AppData', 'Local', 'ms-playwright'),
    join(homedir(), '.cache', 'ms-playwright'),
    join(homedir(), 'Library', 'Caches', 'ms-playwright'),
    '/ms-playwright',
  ].filter(Boolean)

  const candidates = []
  for (const root of roots) {
    if (!existsSync(root)) continue
    const dirs = readdirSync(root)
      .filter((dir) => /^ffmpeg-\d+$/.test(dir))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
    for (const dir of dirs) {
      const abs = join(root, dir)
      for (const bin of readdirSync(abs)) {
        // Windows 包叫 ffmpeg-win64.exe，Linux/macOS 包叫 ffmpeg：按前缀认，不按全名认
        if (/^ffmpeg/.test(bin) && statSync(join(abs, bin)).isFile()) candidates.push(join(abs, bin))
      }
    }
  }

  const scored = candidates
    .map((bin, i) => {
      const caps = capsOf(bin)
      return { bin, caps, score: (caps.vp8Decode ? 2 : 0) + (caps.vp9Encode ? 1 : 0), order: i }
    })
    .filter((c) => c.caps.vp8Decode)
    .sort((a, b) => b.score - a.score || a.order - b.order)

  if (scored.length === 0) {
    console.error(
      '[gen-product-videos] 找不到能解 VP8 的 ffmpeg（Playwright 录的是 VP8）。\n' +
        '设置 FFMPEG=/path/to/ffmpeg（需要 libvpx 解码器），或跑 npx playwright install chromium 让它把配套的 ffmpeg 装上。',
    )
    process.exit(1)
  }
  return { bin: scored[0].bin, encoder: scored[0].caps.vp9Encode ? 'libvpx-vp9' : 'libvpx' }
}

const { bin: FFMPEG, encoder: VIDEO_ENCODER } = findFfmpeg()

const onlyArg = process.argv.indexOf('--only')
const ONLY = onlyArg > -1 ? new Set(process.argv[onlyArg + 1].split(',').map((s) => s.trim())) : null

const manifest = JSON.parse(readFileSync(join(ROOT, MANIFEST), 'utf8'))
const { width, height } = manifest.viewport
const jobs = ONLY ? manifest.videos.filter((v) => ONLY.has(v.id)) : manifest.videos

if (jobs.length === 0) {
  console.error(`[gen-product-videos] --only 没匹配到任何条目（清单里是：${manifest.videos.map((v) => v.id).join(', ')}）`)
  process.exit(1)
}

mkdirSync(join(ROOT, 'docs/product/video'), { recursive: true })

/** 录完/转完把实测数据写回清单 —— 页面上的时长与守卫的断言都读这里，不读则无从校验。 */
function saveMeasured(id, patch) {
  const fresh = JSON.parse(readFileSync(join(ROOT, MANIFEST), 'utf8'))
  const target = fresh.videos.find((v) => v.id === id)
  if (!target) return
  Object.assign(target, patch)
  writeFileSync(join(ROOT, MANIFEST), `${JSON.stringify(fresh, null, 2)}\n`)
}

/**
 * 把原始录制裁成成品：统一尺寸、固定帧率、VP9、无音轨。
 * `-ss` 放在 -i 前（输入定位）：webm 的索引允许，且比输出定位快得多。
 */
function encode({ raw, out, startSec, lengthSec }) {
  execFileSync(
    FFMPEG,
    [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-ss', startSec.toFixed(2), '-t', lengthSec.toFixed(2), '-i', raw,
      '-vf', `scale=${width}:${height},format=yuv420p`,
      '-r', String(FPS),
      // Playwright 自带的是裁剪版 libvpx：没有 row-mt 这类多线程选项，认它有的那几个
      '-c:v', VIDEO_ENCODER, '-b:v', '0', '-crf', '40',
      '-deadline', 'good', '-cpu-used', '4',
      '-an',
      out,
    ],
    { stdio: 'inherit' },
  )
}

/**
 * 把某个元素顶到「吸顶导航下方」——每段录屏的收尾帧都靠它定景。
 *
 * 不能直接用 scrollIntoView({ block: 'start' })：本站头部是 56px 的 fixed 条，
 * 按视口顶端对齐会把标题和表格第一行藏到导航条底下（实测海报里第一行是半截的）。
 * 这里按头部实测高度补偿，再夹到可滚动范围内；顺带把元素所在滚动容器的 scrollTop 归零，
 * 否则外面滚到位了、里面还停在半截表格上。
 */
async function frameBelowHeader(page, target, padAbove = 0) {
  await target.first().evaluate((el, pad) => {
    for (let node = el.parentElement; node; node = node.parentElement) {
      const { overflowY } = getComputedStyle(node)
      if (overflowY === 'auto' || overflowY === 'scroll') node.scrollTop = 0
    }
    const header = document.querySelector('.app-header')
    const headH = header ? header.getBoundingClientRect().height : 56
    const top = el.getBoundingClientRect().top + window.scrollY - headH - pad
    const max = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo({ top: Math.max(0, Math.min(top, max)) })
  }, padAbove)
}

/**
 * 三段流程。每段只做「一个动作 → 一个可见结果」，中间不夹解说词：
 * 观众看的是产品自己会说话，而不是一段配了字幕的幻灯片。
 *
 * 返回值不需要 —— 海报统一在流程结束后由调用方截当前视口（那正是「结果」那一帧）。
 */
const FLOWS = {
  /** 一句话 → 页面：点预置需求，trace 逐条滚动，切到预览看到刚生成的那张表。 */
  async 'one-sentence'(page, { settle }) {
    await settle(1200)
    await page.locator('.preset-card').first().click()
    // 助手的回答里带字段数/列数统计，出现它就说明生成完成（不是「正在生成」）
    await page.waitForSelector('.message.role-assistant .message-stats', { timeout: 30000 })
    await settle(2200)
    await page.locator('.output-tabs .el-tabs__item', { hasText: '实时预览' }).click()
    await page.waitForSelector('.preview-area .el-table__body tr', { timeout: 15000 })
    // 定在右侧整块输出区（含 tab 条）而不是表格本身：观众要能看出「这是预览 tab 里的表」
    await frameBelowHeader(page, page.locator('.ai-crud-output-pane'))
    await settle(2500)
  },

  /** 改配置 → 立刻重渲染：整段换成一份订单表单，点「应用配置」看预览重建。 */
  async 'config-live'(page, { settle }) {
    await settle(1500)
    // 必须**真的点一下**编辑器：只调 textarea.focus() 时 Monaco 拿不到「已获得焦点」，
    // 后续 Ctrl+A / 粘贴全部落空（试过：编辑器内容一个字都没变，预览也照旧）。
    await page.locator('.monaco-wrapper .monaco-editor').click({ position: { x: 120, y: 40 } })
    await settle(300)
    await page.keyboard.press('Control+A')
    await page.keyboard.press('Backspace')
    await settle(250)

    // 走剪贴板 Ctrl+V，而不是 keyboard.insertText：
    // insertText 是「一次输入一串字符」，Monaco 会把多行文本按光标所在行的缩进逐行重排，
    // 一份 26 行的 JSON 会被撑到三倍长并带上不配对的中括号（实测：1900 字符、JSON 当场报错）。
    // 粘贴事件则整体作为一次编辑插入，缩进原样保留 —— 也正好是观众自己会做的动作。
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.evaluate((text) => navigator.clipboard.writeText(text), PLAYGROUND_CONFIG)
    await page.keyboard.press('Control+V')
    await settle(1400)
    await page.locator('button', { hasText: '应用配置' }).first().click()
    // 预览换了一份配置：等新字段真的画出来，而不是傻等固定时长
    await page.locator('.preview-area', { hasText: '订单号' }).waitFor({ timeout: 15000 })
    // 定在「预览面板」并往上留 110px：960px 宽时这个页面的两栏会折成上下两段
    // （实测面板高 1045px，单列），对齐整块面板只能看到配置栏。留出这 110px，
    // 「应用配置」按钮、成功提示和新渲染的表单就在同一帧里 —— 换的配置与换出来的结果同框。
    await frameBelowHeader(page, page.locator('.playground-panel > .panel-section').nth(1), 110)
    await settle(2500)
  },

  /** 一份说明书 → 三份源码：同一段产物在 vue3 / vue2 / antdv 之间逐个切换。 */
  async 'three-targets'(page, { settle }) {
    await settle(800)
    await page.locator('[data-testid="fd-target-vue3"]').evaluate((el) => el.scrollIntoView({ block: 'start' }))
    await settle(1800)
    await page.locator('[data-testid="fd-target-vue2"]').click()
    await settle(2200)
    await page.locator('[data-testid="fd-target-antdv"]').click()
    await settle(2200)
    // 定在三个目标按钮那一行（上方留出小标题的位置）：观众一眼看到「切到 antdv 了」，
    // 而不是一堆没有上下文的源码
    await frameBelowHeader(page, page.locator('.fd-tabs'), 96)
    await settle(1800)
  },
}

/**
 * 视频里替换上去的那份表单配置。用真实业务字段（订单号 / 金额 / 付款时间 / 加急 / 备注），
 * 且覆盖四种不同类型 —— 观众一眼能看出「换的是配置，不是换了一张图」。
 */
const PLAYGROUND_CONFIG = JSON.stringify(
  [
    { prop: 'orderNo', label: '订单号', formtype: 'Input', span: 12 },
    { prop: 'amount', label: '金额', formtype: 'InputNumber', span: 12 },
    { prop: 'paidAt', label: '付款时间', formtype: 'DatePicker', span: 12 },
    { prop: 'urgent', label: '加急', formtype: 'Switch', span: 12 },
    { prop: 'remark', label: '备注', formtype: 'Input', span: 24, attrs: { type: 'textarea', rows: 2 } },
  ],
  null,
  2,
)

const browser = await chromium.launch()
let failed = 0

for (const video of jobs) {
  const base = SITE_URL[video.site]
  if (!base) {
    console.error(`  ❌ ${video.id}：未知站点 ${video.site}`)
    failed++
    continue
  }
  const flow = FLOWS[video.id]
  if (!flow) {
    console.error(`  ❌ ${video.id}：没有对应的录屏脚本（可用的有：${Object.keys(FLOWS).join(', ')}）`)
    failed++
    continue
  }

  const rawDir = join(tmpdir(), `es-plus-video-${video.id}-${Date.now()}`)
  mkdirSync(rawDir, { recursive: true })
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    recordVideo: { dir: rawDir, size: { width, height } },
  })
  await context.addInitScript(() => {
    try {
      localStorage.setItem('theme', 'light')
      localStorage.setItem('language', 'zh-CN')
    } catch {
      // 隐私模式下不可写：站点回落到系统偏好，录制仍继续
    }
  })

  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (err) => pageErrors.push(err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') pageErrors.push(msg.text())
  })

  const t0 = Date.now()
  try {
    // 查询串破缓存：同 hash 的再次导航不会重新加载文档（踩过的坑），录制必须从冷启动开始
    await page.goto(`${base}/?video=${video.id}#${video.route}`, { waitUntil: 'networkidle', timeout: 45000 })
    await page.evaluate(() => document.fonts?.ready)
    await page.waitForTimeout(800)

    const flowStart = Date.now()
    await flow(page, { settle: (ms = 400) => page.waitForTimeout(ms) })
    const flowEnd = Date.now()

    if (pageErrors.length > 0) {
      throw new Error(`录制期间页面报错：${pageErrors[0].split('\n')[0].slice(0, 160)}`)
    }

    // 海报就是「结果」那一帧：先拍下来，它同时是视频的首帧与页面上的封面
    await page.screenshot({ path: join(ROOT, video.poster), type: 'png' })

    const rawPath = join(rawDir, 'raw.webm')
    const videoHandle = page.video()
    await context.close()
    await videoHandle.saveAs(rawPath)

    // 只留流程本身那段画面：页面加载、字体就绪、切 tab 的空转都裁掉
    encode({
      raw: rawPath,
      out: join(ROOT, video.file),
      startSec: (flowStart - t0) / 1000,
      lengthSec: Math.min((flowEnd - flowStart) / 1000, (manifest.maxDurationMs || 30000) / 1000),
    })

    // 清单里写的是**从成品文件里读出来**的时长与尺寸：手抄的数字总有一天会与文件不符
    const measured = readWebmMeta(readFileSync(join(ROOT, video.file)))
    const bytes = statSync(join(ROOT, video.file)).size
    saveMeasured(video.id, {
      width: measured.width,
      height: measured.height,
      durationMs: measured.durationMs,
      bytes,
    })
    console.log(
      `  ✅ ${video.id} → ${video.file}（${(bytes / 1024 / 1024).toFixed(2)} MB，` +
        `${((measured.durationMs || 0) / 1000).toFixed(1)} 秒，${measured.width}×${measured.height}）`,
    )
  } catch (err) {
    console.error(`  ❌ ${video.id}：${err.message.split('\n')[0]}`)
    failed++
    try {
      await context.close()
    } catch {
      // context 可能已经关过
    }
  }
}

await browser.close()

if (failed > 0) {
  console.error(`\n[gen-product-videos] 失败 ${failed} 段`)
  process.exit(1)
}
console.log('\n[gen-product-videos] 完成。下一步：npm run product:sync')
