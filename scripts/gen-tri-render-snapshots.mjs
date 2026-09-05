#!/usr/bin/env node
/**
 * 三端渲染快照生成：对三个文档站点截图，产出一致命名的一组 PNG 到 docs/tri-render/。
 *
 * 背景（docs/改造三端站点.md §5.4 / §6.3）：
 *   Element UI/Vue2 是 Vue2-only，无法挂进 Vue3 应用，因此「单页三端活体切换」不可行。
 *   唯一稳妥方案是「同一份 Schema 源码 + 三端渲染快照」——本脚本就是构建期生成快照的一环。
 *
 * 依赖 Playwright（`npm i -D playwright` 后 `npx playwright install chromium`）。
 * 未安装时会给出清晰提示，不静默失败。
 *
 * 用法：
 *   node scripts/gen-tri-render-snapshots.mjs
 *   node scripts/gen-tri-render-snapshots.mjs --only vue3,antdv
 *
 * 产物（供 sync-tri-render.mjs 分发到三站，被 TriRenderTabs 消费）：
 *   docs/tri-render/vue3.png    ← es-plus-docs 渲染快照
 *   docs/tri-render/vue2.png    ← es-eui 渲染快照
 *   docs/tri-render/antdv.png   ← es-pc 渲染快照
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT_DIR = join(ROOT, 'docs', 'tri-render')

/** 三个站点的截图目标：dev 命令 / 端口 / 要截图的页面 URL / 输出文件名 */
const TARGETS = [
  {
    key: 'vue3',
    label: 'Vue 3 · Element Plus',
    dir: join(ROOT, 'es-plus-docs'),
    command: 'npm',
    args: ['run', 'dev', '--', '--port', '4173', '--strictPort'],
    url: 'http://localhost:4173/',
    out: join(OUT_DIR, 'vue3.png'),
  },
  {
    key: 'antdv',
    label: 'Vue 3 · Ant Design Vue',
    dir: join(ROOT, 'es-pc'),
    command: 'npm',
    args: ['run', 'dev', '--', '--port', '4174', '--strictPort'],
    url: 'http://localhost:4174/',
    out: join(OUT_DIR, 'antdv.png'),
  },
  {
    key: 'vue2',
    label: 'Vue 2 · Element UI',
    dir: join(ROOT, 'es-eui'),
    command: 'npm',
    args: ['run', 'serve', '--', '--port', '4175'],
    url: 'http://localhost:4175/',
    out: join(OUT_DIR, 'vue2.png'),
  },
]

const onlyArg = process.argv.find((a) => a.startsWith('--only='))
const only = onlyArg ? onlyArg.split('=')[1].split(',').map((s) => s.trim()) : null

async function ensurePlaywright() {
  try {
    const { chromium } = await import('playwright')
    return chromium
  } catch {
    console.error(
      '\n❌ 未安装 Playwright。请先执行：\n' +
        '   npm i -D playwright\n' +
        '   npx playwright install chromium\n'
    )
    process.exit(1)
  }
}

function waitForServer(url, timeoutMs = 120000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const probe = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`等待 dev server 超时：${url}`))
        return
      }
      fetch(url)
        .then((res) => {
          if (res.ok) resolve()
          else setTimeout(probe, 500)
        })
        .catch(() => setTimeout(probe, 500))
    }
    probe()
  })
}

async function main() {
  const chromium = await ensurePlaywright()
  mkdirSync(OUT_DIR, { recursive: true })

  const targets = only ? TARGETS.filter((t) => only.includes(t.key)) : TARGETS
  const browser = await chromium.launch()
  const servers = []

  try {
    for (const t of targets) {
      console.log(`\n▶ 生成 ${t.label} 快照 (${t.url})`)
      const child = spawn(t.command, t.args, { cwd: t.dir, stdio: 'ignore', shell: process.platform === 'win32' })
      servers.push(child)
      try {
        await waitForServer(t.url)
      } catch (err) {
        child.kill()
        throw err
      }

      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
      await page.goto(t.url, { waitUntil: 'networkidle' })
      // 给首屏渲染留出稳定时间，避免截图到加载中的骨架屏
      await page.waitForTimeout(800)
      await page.screenshot({ path: t.out, fullPage: false })
      await page.close()
      console.log(`   ✅ ${t.out.replace(ROOT, '.')}`)

      child.kill()
    }
  } finally {
    servers.forEach((s) => {
      try { s.kill() } catch {}
    })
    await browser.close()
  }

  console.log('\n✅ 快照生成完毕。运行 `npm run tri-render:sync` 分发到三站。')
}

main().catch((err) => {
  console.error(`\n❌ ${err.message}`)
  process.exit(1)
})
