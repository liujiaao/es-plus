#!/usr/bin/env node
/**
 * 表格渲染性能基准（W4：「先可观测，不做门禁」）。
 *
 * 量的是两件事，1k / 5k / 20k 行各一遍，vue3（Element Plus）与 antdv（Ant Design Vue）
 * 各一遍：
 *   1. `firstRowMs` —— 从 `goto` 到「第一行真的进了 DOM」的墙钟时间（含 vite 模块加载、
 *      组件挂载、首屏渲染）。这是用户第一次看见数据的时刻。
 *   2. `scroll` —— 程序化滚动 1.8 s 期间的 `requestAnimationFrame` 间隔分布
 *      （p50 / p95 / 最长）。帧间隔直接对应「滚起来卡不卡」，比 FPS 平均值更抗单帧抖动。
 *
 * 刻意**不做门禁**：同一台机器上 dev server + 无头 Chromium 的绝对值噪声很大
 * （首次 optimizeDeps、机器负载、CI 容器都会漂），拿它当红线只会带来假红。
 * 产物落在 `docs/internal/bench-table-<YYYY-MM-DD>.json`，用来对比**同一台机器**、
 * **同一份 fixture** 前后的趋势。
 *
 * 用法：
 *   npm run bench:table
 *   node scripts/bench-table.mjs --rows 1000,5000   # 自定义行数
 *   node scripts/bench-table.mjs --libs vue3        # 只跑一条腿
 *
 * 实现要点：直接 spawn `node node_modules/vite/bin/vite.js`（而不是经 npx）——
 * 拿到的是真正的 node 进程，`kill()` 才是有效的；npx 留一层中间进程在 Windows 上
 * 会把 vite 留在后台占着端口（见 docs 里的「vite preview 端口/句柄残留」）。
 */
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { chromium } from '@playwright/test'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const FIXTURE_DIR = join(ROOT, '__tests__', 'e2e-runtime', 'table')
const VITE_BIN = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')
const PORT = 51741
const SCROLL_MS = 1800
// 单格上限：20k 行、无虚拟滚动的引擎在开发构建下确实要走几分钟 —— 实测 a-table
// 渲染 20k 行要 **518 s**（不是卡死，零报错，只是逐个单元格跑 bodyCell 插槽）。
// 上限给到 15 分钟，超过才记 `timedOut: true`（产物里"没渲染出来"本身是结论）。
const CASE_TIMEOUT_MS = 900_000

const require_ = createRequire(import.meta.url)

function parseArgs(argv) {
  const out = { rows: [1000, 5000, 20000], libs: ['vue3', 'antdv'] }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--rows' && argv[i + 1]) {
      out.rows = argv[++i]
        .split(',')
        .map((n) => Number(n.trim()))
        .filter((n) => Number.isFinite(n) && n > 0)
    } else if (arg === '--libs' && argv[i + 1]) {
      out.libs = argv[++i]
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s === 'vue3' || s === 'antdv')
    }
  }
  if (!out.rows.length) throw new Error('--rows 需要一个正整数列表')
  if (!out.libs.length) throw new Error('--libs 只能是 vue3 / antdv')
  return out
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitForServer(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) })
      if (res.ok) return
    } catch {
      // dev server 还没起：继续等
    }
    await sleep(250)
  }
  throw new Error(`vite dev server 在 ${timeoutMs}ms 内没起来（${url}）`)
}

function killTree(child) {
  if (!child || child.killed) return
  child.kill()
  if (process.platform === 'win32' && child.pid) {
    // Windows 下 esbuild 子进程可能活过父进程；按进程树强杀，避免端口/句柄残留
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  }
}

function percentile(sorted, p) {
  if (!sorted.length) return null
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return Number(sorted[idx].toFixed(2))
}

/** 在页面里采样 rAF 间隔，同时不断向下滚。 */
async function sampleScrollFrames(page, durationMs) {
  const deltas = await page.evaluate(async (ms) => {
    const out = []
    let last = performance.now()
    let alive = true
    const tick = (t) => {
      if (!alive) return
      out.push(t - last)
      last = t
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    const end = performance.now() + ms
    while (performance.now() < end) {
      window.scrollBy(0, 80)
      await new Promise((r) => setTimeout(r, 16))
    }
    alive = false
    await new Promise((r) => setTimeout(r, 120))
    return out.filter((d) => d > 0)
  }, durationMs)

  const sorted = [...deltas].sort((a, b) => a - b)
  return {
    frames: deltas.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    max: percentile(sorted, 100),
  }
}

async function measure(browser, baseUrl, lib, rowCount) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  // 页面级报错要收进产物：超时到底是「慢」还是「炸了」，只有这里分得清
  const errors = []
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`)
  })
  try {
    // `local=0` 关掉内建分页：bench 要的是「全部行都进 DOM」，不是每页 20 行
    const url = `${baseUrl}/?lib=${lib}&rows=${rowCount}&local=0`
    const startedAt = Date.now()
    await page.goto(url, { waitUntil: 'commit' })
    try {
      await page.waitForFunction(() => document.querySelector('#main-table tbody tr'), null, {
        timeout: CASE_TIMEOUT_MS,
        polling: 50,
      })
    } catch {
      // 没渲染出来也是一条**测量结果**（尤其 antdv 没有虚拟滚动）：记 null 并继续下一格，
      // 不让一格超时把整份产物吞掉。
      return {
        lib,
        rows: rowCount,
        firstRowMs: null,
        renderedRows: 0,
        scroll: null,
        timedOut: true,
        timeoutMs: CASE_TIMEOUT_MS,
        errors: errors.slice(0, 5),
      }
    }
    const firstRowMs = Date.now() - startedAt
    const renderedRows = await page.locator('#main-table tbody tr').count()
    const scroll = await sampleScrollFrames(page, SCROLL_MS)
    return { lib, rows: rowCount, firstRowMs, renderedRows, scroll, errors: errors.slice(0, 5) }
  } finally {
    await page.close()
  }
}

async function main() {
  const { rows, libs } = parseArgs(process.argv.slice(2))
  const baseUrl = `http://localhost:${PORT}`

  const server = spawn(process.execPath, [VITE_BIN, '--port', String(PORT), '--strictPort'], {
    cwd: FIXTURE_DIR,
    stdio: 'ignore',
    windowsHide: true,
  })
  const onExit = () => killTree(server)
  process.on('exit', onExit)
  process.on('SIGINT', () => {
    onExit()
    process.exit(130)
  })

  let browser
  try {
    await waitForServer(`${baseUrl}/`)
    browser = await chromium.launch()

    // 预热：让 vite 把两个库的依赖预打包完，避免第一条用例把 optimizeDeps 的
    // 时间算进 firstRowMs（否则 vue3 的数字会恒定比 antdv 难看，纯属顺序效应）
    for (const lib of libs) {
      const warm = await browser.newPage()
      await warm.goto(`${baseUrl}/?lib=${lib}&rows=10&local=0`, { waitUntil: 'commit' })
      await warm.waitForFunction(() => document.querySelector('#main-table tbody tr'), null, {
        timeout: 300_000,
      })
      await warm.close()
    }

    const cases = []
    for (const lib of libs) {
      for (const rowCount of rows) {
        process.stdout.write(`⏱  ${lib} / ${rowCount} rows ... `)
        const result = await measure(browser, baseUrl, lib, rowCount)
        cases.push(result)
        if (result.timedOut) {
          console.log(`timed out after ${result.timeoutMs}ms（未渲染出首行）`)
        } else {
          console.log(
            `firstRow ${result.firstRowMs}ms · rendered ${result.renderedRows} · ` +
              `frame p50 ${result.scroll.p50}ms / p95 ${result.scroll.p95}ms`,
          )
        }
      }
    }

    const today = new Date().toISOString().slice(0, 10)
    const payload = {
      generatedAt: new Date().toISOString(),
      note:
        'W4 可观测产物：不做门禁，只用于同机同 fixture 的前后对比。' +
        'vite dev server（未打包的 ESM）+ 无头 Chromium：firstRowMs 含模块加载与首屏渲染，' +
        '绝对值只在本机同一次环境内可比。',
      node: process.version,
      playwright: require_('@playwright/test/package.json').version,
      fixture: '__tests__/e2e-runtime/table（?local=0，全部行进 DOM）',
      viewport: { width: 1280, height: 800 },
      scrollSampleMs: SCROLL_MS,
      cases,
    }
    const outFile = join(ROOT, 'docs', 'internal', `bench-table-${today}.json`)
    mkdirSync(dirname(outFile), { recursive: true })
    writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    console.log(`\n✅ 已写入 ${outFile}`)
  } finally {
    if (browser) await browser.close()
    killTree(server)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
