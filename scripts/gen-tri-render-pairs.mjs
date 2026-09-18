#!/usr/bin/env node
/**
 * 三端示例配对实测 —— 为「同一份配置，换一行 import」提供**可核对的证据**。
 *
 * 背景：三站首页的 TriRenderTabs 此前只展示 schema 源码 + 一句
 * 「实际渲染效果见本站示例页」。但每个站点只承载自己那一个渲染器，访客在
 * es-pc 永远看不到同一份配置在 Element Plus 下长什么样 —— 也就是说，
 * 产品最核心的卖点在三站上**没有任何证据**，删掉占位 UI 之后只剩散文。
 *
 * 而证据其实就在仓库里：三站各有一套同名的示例文件，把同一份配置交给各自的
 * EsForm/EsTable。本脚本逐对量出「同名示例之间的差异行数」，并把差异最小的那一对
 * 完整带出来（含逐行变更标记），让站点可以直接展示"两边只差这几行"。
 *
 * 产出 docs/tri-render/pairs.json（由 sync-tri-render.mjs 分发到三站）。
 *
 * 重要：产出的是**实测量**，不是宣称。因此它同时会暴露出 Vue 2 端示例与另两端
 * 尚未对齐（并入前的手写版本）—— 这不是库能力问题（vue2 渲染器同样支持
 * formItemList / attrs，见 packages/vue2/src/composables/use-form-inputs.ts 的
 * `{ ...(row.attrs || {}) }`），而是站点示例没回填。宁可把数字摆出来，也不要
 * 让站点继续宣称一个无法验证的「三端完全一致」。
 *
 * 用法：
 *   node scripts/gen-tri-render-pairs.mjs           # 生成
 *   node scripts/gen-tri-render-pairs.mjs --check   # 校验产出是否为最新（CI）
 *
 * 退出码：0 = 成功/一致；1 = 映射中的文件缺失或产出过期。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readText, sameText } from './lib/text-sync.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const TARGET = join(ROOT, 'docs', 'tri-render', 'pairs.json')

const CHECK = process.argv.includes('--check')

/**
 * 示例目录映射：以「主站（Element Plus）的示例分组」为基准，给出另两端承载
 * 同名示例的目录。三端的目录结构历史上不同名（如 crud-page ↔ combination），
 * 因此必须显式声明，不能靠猜。
 */
const GROUPS = [
  { id: 'form', vue3: 'es-plus-docs/src/components/examples/form', antdv: 'es-pc/src/views/es-form', vue2: 'es-eui/src/examples/form' },
  { id: 'table', vue3: 'es-plus-docs/src/components/examples/table', antdv: 'es-pc/src/views/es-table', vue2: 'es-eui/src/examples/table' },
  { id: 'dialog', vue3: 'es-plus-docs/src/components/examples/dialog', antdv: 'es-pc/src/views/es-dialog', vue2: 'es-eui/src/examples/dialog' },
  { id: 'crud-page', vue3: 'es-plus-docs/src/components/examples/crud-page', antdv: 'es-pc/src/views/es-crud', vue2: 'es-eui/src/examples/combination' },
  { id: 'vxe-table', vue3: 'es-plus-docs/src/components/examples/vxe-table', antdv: 'es-pc/src/views/es-vxe', vue2: 'es-eui/src/examples/vxe-table' },
]

const RENDERERS = [
  { key: 'antdv', label: 'Vue 3 · Ant Design Vue', pkg: '@es-plus/adapter-antdv', dir: 'antdv' },
  { key: 'vue2', label: 'Vue 2 · Element UI', pkg: '@es-plus/vue2', dir: 'vue2' },
]

const SOURCE_LABEL = 'Vue 3 · Element Plus'

// ── 行级 diff（LCS）────────────────────────────────────
// 自实现而不调用外部 `diff`：本脚本要同时跑在 Windows（Git Bash）与 CI（Linux），
// 且示例文件都很小（≤300 行），O(n·m) 完全够用。
function diffLines(a, b) {
  const n = a.length
  const m = b.length
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const changedA = []
  const changedB = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      changedA.push(i)
      i++
    } else {
      changedB.push(j)
      j++
    }
  }
  while (i < n) changedA.push(i++)
  while (j < m) changedB.push(j++)
  return { changedA, changedB }
}

const splitLines = (text) => text.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n')

function listVue(dir) {
  if (!existsSync(join(ROOT, dir))) return null
  return readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.vue'))
}

const rel = (p) => p.replace(/\\/g, '/')

/** 逐组比对：返回每个渲染端与主站的配对统计 */
function measure() {
  const perRenderer = new Map(RENDERERS.map((r) => [r.key, { pairs: [], missingDirs: [] }]))

  for (const g of GROUPS) {
    const vue3Files = listVue(g.vue3)
    if (!vue3Files) {
      console.error(`❌ 主站示例目录不存在：${g.vue3}`)
      process.exit(1)
    }
    for (const r of RENDERERS) {
      const files = listVue(g[r.dir])
      if (!files) {
        perRenderer.get(r.key).missingDirs.push(g[r.dir])
        continue
      }
      const set = new Set(files)
      for (const name of vue3Files) {
        if (!set.has(name)) continue
        const aPath = join(g.vue3, name)
        const bPath = join(g[r.dir], name)
        const a = splitLines(readText(aPath))
        const b = splitLines(readText(bPath))
        const { changedA, changedB } = diffLines(a, b)
        perRenderer.get(r.key).pairs.push({
          group: g.id,
          name,
          pathA: rel(aPath),
          pathB: rel(bPath),
          deltaA: changedA.length,
          deltaB: changedB.length,
          changedA,
          changedB,
        })
      }
    }
  }
  return perRenderer
}

const median = (nums) => {
  if (!nums.length) return 0
  const s = [...nums].sort((x, y) => x - y)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

function summarize(pairs) {
  const deltas = pairs.map((p) => p.deltaA)
  return {
    pairs: pairs.length,
    medianDelta: median(deltas),
    le10: deltas.filter((d) => d <= 10).length,
    le20: deltas.filter((d) => d <= 20).length,
    ge100: deltas.filter((d) => d >= 100).length,
  }
}

function build() {
  const perRenderer = measure()

  const renderers = RENDERERS.map((r) => {
    const { pairs, missingDirs } = perRenderer.get(r.key)
    if (missingDirs.length) {
      console.error(`❌ ${r.label} 的示例目录缺失：${missingDirs.join(', ')}`)
      console.error('（GROUPS 里声明的目录必须存在；目录改名后请同步本脚本，否则统计会静默缩水）')
      process.exit(1)
    }
    const stat = summarize(pairs)
    // 差异最小的那一对作为「证据样例」
    const best = [...pairs].sort((x, y) => x.deltaA - y.deltaA)[0]
    return { key: r.key, label: r.label, pkg: r.pkg, ...stat, best: best ? `${best.group}/${best.name}` : null }
  })

  // 证据样例：取差异最小的那一对，带出两侧完整源码与逐行变更位置
  let proof = null
  const allBest = []
  for (const r of RENDERERS) {
    for (const p of perRenderer.get(r.key).pairs) {
      allBest.push({ renderer: r, pair: p })
    }
  }
  allBest.sort((x, y) => x.pair.deltaA - y.pair.deltaA)
  if (allBest.length) {
    const { renderer, pair } = allBest[0]
    proof = {
      renderer: renderer.key,
      rendererLabel: renderer.label,
      rendererPkg: renderer.pkg,
      title: `${pair.group}/${pair.name}`,
      deltaLines: pair.deltaA + pair.deltaB,
      source: {
        label: SOURCE_LABEL,
        path: pair.pathA,
        changed: pair.changedA,
        code: readText(join(ROOT, pair.pathA)),
      },
      target: {
        label: renderer.label,
        path: pair.pathB,
        changed: pair.changedB,
        code: readText(join(ROOT, pair.pathB)),
      },
    }
  }

  const totalPairs = renderers.reduce((s, r) => s + r.pairs, 0)
  return {
    $comment:
      '由 scripts/gen-tri-render-pairs.mjs 从三端真实示例文件测得，禁止手改。' +
      '数值是可核对的实测（同名示例之间的差异行数），不是宣称。',
    metric:
      'delta = 单侧变更行数（LCS 逐行比对；一处替换记 1 行，不两侧重复计数）。' +
      'medianDelta = 该渲染端全部同名示例 delta 的中位数。',
    sourceLabel: SOURCE_LABEL,
    totalPairs,
    renderers,
    proof,
  }
}

function main() {
  const data = build()
  const content = JSON.stringify(data, null, 2) + '\n'

  if (CHECK) {
    if (!existsSync(TARGET)) {
      console.error(`❌ 产出缺失：docs/tri-render/pairs.json（运行 npm run tri-render:pairs）`)
      process.exit(1)
    }
    if (!sameText(readText(TARGET), content)) {
      console.error(
        '❌ docs/tri-render/pairs.json 与实测不一致 —— 三端示例改过了，' +
          '请运行 `npm run tri-render:pairs` 重新生成（站点上展示的配对数字必须与仓库实况一致）。',
      )
      process.exit(1)
    }
    console.log('✅ 三端示例配对实测与产出一致')
    return
  }

  const dir = dirname(TARGET)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(TARGET, content)
  const summary = data.renderers.map((r) => `${r.label}: ${r.pairs} 对 / 中位差 ${r.medianDelta} 行`).join('；')
  console.log(`✅ 已生成 docs/tri-render/pairs.json（${summary}）`)
  if (data.proof) {
    console.log(`   证据样例：${data.proof.title}（${data.proof.source.label} ↔ ${data.proof.rendererLabel}，共差 ${data.proof.deltaLines} 行）`)
  }
}

main()
