#!/usr/bin/env node
/**
 * 产品实拍守卫（路线图 2.2 / T1 首屏「产品实拍」）。
 *
 * 截图是站点的「证据」，也是最容易悄悄变假的东西：拍完就没人再看它一眼。
 * 这一页的主张都能静态断言，所以全部断言：
 *
 *   「核心 8 个页面各 2 张（浅/深）」→ 清单里 8 条 docs 路由各自成对成组，
 *                                      且深色图与浅色图字节不同（防止「深色图其实是浅色」）；
 *   「每张图都是现拍的真页面」        → route 在对应站点的路由表里真实存在
 *                                      （页面改名/删页后，旧的实拍立刻变红）；
 *   「图不是空白/不是设计稿」          → PNG 魔数 + IHDR 尺寸 == 清单声明的视口，
 *                                      比例固定 16:10（三站首屏按同一比例摆，变形就露馅），
 *                                      体积落在 20 KB–500 KB；
 *   「三站引用同一批字节」            → 3 站 public/product/ 与单源逐字节一致、无孤儿文件；
 *   「页面引用都登记在清单里」        → src 里出现的每个 /product/*.png 都是清单条目；
 *   「每张图都真的有人用」            → 反过来：清单里的每张图至少被一处源码引用
 *                                      （否则就是拍了没人用的死资产）；
 *   「截图可达」                      → 每个 <img> 引用 /product/ 的标签都有非空 alt；
 *   「三站首屏都有产品实拍」          → docs 首屏走清单驱动的画廊，pc/eui 首屏是字面引用。
 *
 * 用法：node scripts/check-product-assets.mjs
 * 退出码：0 = 全部成立；1 = 任一断言失败。
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, basename, extname } from 'node:path'
import assert from 'node:assert/strict'
import { readBinary, sameBinary } from './lib/text-sync.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')
const MANIFEST = 'docs/product/shots.json'

const SITES = ['es-plus-docs', 'es-pc', 'es-eui']

/** 核心 8 个页面：路线图 2.2 点名的那 8 个（截图清单必须覆盖它们，且浅深成对）。 */
const DOCS_CORE_ROUTES = [
  '/',
  '/cases',
  '/flagship-approval',
  '/ai-generated',
  '/components/es-form',
  '/components/es-table',
  '/components/es-crud-page',
  '/playground',
]

/** 每站首屏：产品实拍必须出现在第一屏的 DOM 里（T1 规则）。 */
const LANDINGS = {
  'es-plus-docs': { file: 'es-plus-docs/src/views/Home.vue', gallery: true },
  'es-pc': { file: 'es-pc/src/views/Home.vue', gallery: false },
  'es-eui': { file: 'es-eui/src/views/home/index.vue', gallery: false },
}

const ROUTERS = {
  'es-plus-docs': 'es-plus-docs/src/router/index.ts',
  'es-pc': 'es-pc/src/router/index.js',
  'es-eui': 'es-eui/src/router/index.js',
}

/** 组件页的 /components/<name> 是动态路由，名字的真源是 docsData 的键。 */
const COMPONENT_REGISTRY = 'es-plus-docs/src/views/component-doc.data.ts'

const VIEWPORT_RATIO = 1.6 // 16:10
const MIN_BYTES = 20 * 1024
const MAX_BYTES = 500 * 1024

let failed = 0
function check(label, fn) {
  try {
    fn()
    console.log(`  ✅ ${label}`)
  } catch (err) {
    failed++
    console.error(`  ❌ ${label}\n     ${err.message.split('\n')[0]}`)
  }
}

const manifest = JSON.parse(read(MANIFEST))
const shots = manifest.shots
const fileOf = (shot) => shot.file || `docs/product/${shot.id}.png`
const expectedViewport = (shot) => shot.viewport || manifest.viewport

/** PNG 的真尺寸只能从 IHDR 读：不看文件名、不看清单 —— 清单写错了这里才发现。 */
function pngSize(buffer, label) {
  assert.ok(buffer.length > 33, `${label} 太小，不像 PNG`)
  assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${label} 不是 PNG（魔数不对）`)
  assert.equal(buffer.subarray(12, 16).toString('utf8'), 'IHDR', `${label} 的第一个块不是 IHDR`)
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

/** 递归列出目录下的源码文件（跳过 node_modules / dist）。 */
function listSources(dir, acc = []) {
  const abs = join(ROOT, dir)
  if (!existsSync(abs)) return acc
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) listSources(rel, acc)
    else if (['.vue', '.ts', '.js', '.json'].includes(extname(entry.name))) acc.push(rel)
  }
  return acc
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length

// ── 1. 清单结构 ────────────────────────────────────────────────────────────
check('清单结构：id 唯一、站点/主题/路由齐全、标题与说明非空', () => {
  assert.ok(Array.isArray(shots) && shots.length > 0, 'shots.json 没有截图条目')
  const ids = new Set()
  for (const shot of shots) {
    assert.ok(!ids.has(shot.id), `id 重复：${shot.id}`)
    ids.add(shot.id)
    assert.match(shot.id, /^[a-z0-9-]+$/, `id 必须是 kebab-case：${shot.id}`)
    assert.ok(SITES.includes(shot.site), `${shot.id} 的 site「${shot.site}」不是三站之一`)
    assert.ok(['light', 'dark'].includes(shot.theme), `${shot.id} 的 theme 必须是 light 或 dark`)
    assert.match(shot.route, /^\//, `${shot.id} 的 route 必须以 / 开头`)
    assert.equal(basename(fileOf(shot)), `${shot.id}.png`, `${shot.id} 的 file 与 id 不一致（会分裂成两张图）`)
    assert.ok((shot.title || '').trim().length >= 2, `${shot.id} 缺 title`)
    assert.ok((shot.caption || '').trim().length >= 12, `${shot.id} 的 caption 太短（说明不了这张图证什么）`)
  }
  assert.equal(new Set(shots.map((s) => s.site)).size, SITES.length, '有一站完全没拍产品实拍')
})

check('核心 8 个页面各 2 张（浅/深），且深色与浅色字节不同', () => {
  const docsShots = shots.filter((s) => s.site === 'es-plus-docs')
  for (const route of DOCS_CORE_ROUTES) {
    const pair = docsShots.filter((s) => s.route === route)
    assert.ok(pair.length > 0, `核心页面 ${route} 没有截图`)
    for (const theme of ['light', 'dark']) {
      assert.ok(
        pair.some((s) => s.theme === theme),
        `核心页面 ${route} 缺 ${theme} 截图（路线图 2.2 要求浅/深各一张）`,
      )
    }
  }
  const stray = docsShots.filter((s) => !DOCS_CORE_ROUTES.includes(s.route))
  assert.equal(stray.length, 0, `清单里有不属于核心 8 页的 docs 截图：${stray.map((s) => s.id).join(', ')}`)

  // 「深色图其实是浅色」是最隐蔽的假货：两张图字节相同就说明主题没生效
  for (const shot of docsShots.filter((s) => s.theme === 'light')) {
    const dark = docsShots.find((s) => s.route === shot.route && s.theme === 'dark')
    if (!dark) continue
    const lightBytes = readBinary(join(ROOT, fileOf(shot)))
    const darkBytes = readBinary(join(ROOT, fileOf(dark)))
    assert.ok(!sameBinary(lightBytes, darkBytes), `${shot.route} 的深色截图与浅色截图逐字节相同（主题没生效）`)
  }
})

// ── 2. 图片本体 ────────────────────────────────────────────────────────────
check('图片本体：PNG 魔数、IHDR 尺寸 == 清单视口、16:10、体积在区间内', () => {
  for (const shot of shots) {
    const rel = fileOf(shot)
    assert.ok(existsSync(join(ROOT, rel)), `${rel} 不存在（先跑 node scripts/gen-product-shots.mjs）`)
    const bytes = readBinary(join(ROOT, rel))
    const { width, height } = pngSize(bytes, rel)
    const want = expectedViewport(shot)
    assert.equal(width, want.width, `${rel} 宽 ${width} ≠ 清单声明的 ${want.width}`)
    assert.equal(height, want.height, `${rel} 高 ${height} ≠ 清单声明的 ${want.height}`)
    assert.ok(
      Math.abs(width / height - VIEWPORT_RATIO) < 0.001,
      `${rel} 不是 16:10（${width}×${height}）—— 三站首屏按 16:10 摆，变了会拉伸`,
    )
    const size = statSync(join(ROOT, rel)).size
    assert.ok(size >= MIN_BYTES, `${rel} 只有 ${(size / 1024).toFixed(0)} KB，像是空白页`)
    assert.ok(size <= MAX_BYTES, `${rel} 有 ${(size / 1024).toFixed(0)} KB，超过 ${MAX_BYTES / 1024} KB 上限`)
  }
})

check('三站 public/product/ 与单源逐字节一致，且没有孤儿文件', () => {
  const names = new Set(shots.map((s) => basename(fileOf(s))))
  for (const site of SITES) {
    const dir = join(ROOT, site, 'public/product')
    assert.ok(existsSync(dir), `${site}/public/product 不存在 —— 运行 npm run product:sync`)
    for (const shot of shots) {
      const name = basename(fileOf(shot))
      const copy = join(dir, name)
      assert.ok(existsSync(copy), `${site}/public/product/${name} 缺失 —— 运行 npm run product:sync`)
      assert.ok(
        sameBinary(readBinary(join(ROOT, fileOf(shot))), readBinary(copy)),
        `${site}/public/product/${name} 与单源不一致 —— 不要手改站点副本，跑 npm run product:sync`,
      )
    }
    const orphans = readdirSync(dir).filter((n) => n.endsWith('.png') && !names.has(n))
    assert.equal(orphans.length, 0, `${site}/public/product 有清单外的图：${orphans.join(', ')}`)
  }
})

check('三站 src/product/shots.json 与单源逐字节一致', () => {
  const source = readBinary(join(ROOT, MANIFEST))
  for (const site of SITES) {
    const copy = join(ROOT, site, 'src/product/shots.json')
    assert.ok(existsSync(copy), `${site}/src/product/shots.json 缺失 —— 运行 npm run product:sync`)
    assert.ok(sameBinary(source, readBinary(copy)), `${site}/src/product/shots.json 与单源不一致`)
  }
})

// ── 3. 路由可达 ────────────────────────────────────────────────────────────
check('截图路由在对应站点的路由表里真实存在（页面改名/删页会立刻变红）', () => {
  for (const shot of shots) {
    const routerSrc = read(ROUTERS[shot.site])
    const segments = shot.route.split('/').filter(Boolean)
    const last = segments[segments.length - 1] || ''

    // /components/<name>：路由是 :name 动态段，名字的真源是 docsData 的键
    if (shot.site === 'es-plus-docs' && segments[0] === 'components') {
      const registry = read(COMPONENT_REGISTRY)
      assert.ok(
        new RegExp(`'${last}'\\s*:\\s*\\{`).test(registry),
        `${shot.id} 指向的组件文档「${last}」不在 component-doc.data.ts 里`,
      )
      continue
    }

    // 首页 route 是 '/'，没有段可匹配，直接找根路由
    const pattern = last ? new RegExp(`path:\\s*'/?${last}'`) : /path:\s*'\/'/
    assert.ok(
      pattern.test(routerSrc),
      `${shot.id} 的 route ${shot.route} 在 ${ROUTERS[shot.site]} 里找不到${last ? `（最后一段 ${last}）` : ''}`,
    )
  }
})

// ── 4. 页面引用 ────────────────────────────────────────────────────────────
const sources = SITES.flatMap((site) => listSources(`${site}/src`))
const refRe = /(?:docs)?\/product\/([A-Za-z0-9._-]+\.png)/g

check('源码里出现的每个 /product/*.png 都是清单条目', () => {
  const known = new Set(shots.map((s) => basename(fileOf(s))))
  for (const rel of sources) {
    const text = read(rel)
    for (const m of text.matchAll(refRe)) {
      assert.ok(
        known.has(m[1]),
        `${rel}:${lineOf(text, m.index)} 引用了清单外的截图 ${m[1]}（图要么登记进 shots.json，要么删掉引用）`,
      )
    }
  }
})

check('清单里的每张图都至少被一处源码引用（没有拍了没人用的死资产）', () => {
  const used = new Set()
  for (const rel of sources) {
    for (const m of read(rel).matchAll(refRe)) used.add(m[1])
  }
  // docs 首屏的画廊由清单驱动：清单里每一张 docs 截图都算「被用到」，
  // 但它必须真的走的是清单（下面第 6 项断言），否则这里就成了自证。
  for (const shot of shots.filter((s) => s.site === 'es-plus-docs')) used.add(basename(fileOf(shot)))
  const dead = shots.map((s) => basename(fileOf(s))).filter((n) => !used.has(n))
  assert.equal(dead.length, 0, `这些截图没有任何页面引用：${dead.join(', ')}`)
})

/** 文件名 → PNG 真尺寸（写死的 width/height 要跟它对上）。 */
const pngSizeByName = new Map()
for (const shot of shots) {
  const rel = fileOf(shot)
  pngSizeByName.set(basename(rel), pngSize(readBinary(join(ROOT, rel)), rel))
}

check('每个引用 /product/ 的 <img> 都有非空 alt，且写死的宽高等于图片真尺寸', () => {
  for (const rel of sources) {
    if (!rel.endsWith('.vue')) continue
    const text = read(rel)
    for (const m of text.matchAll(/<img\b[^>]*>/g)) {
      const tag = m[0]
      const ref = tag.match(/(?:docs)?\/product\/([A-Za-z0-9._-]+\.png)/)
      if (!ref) continue
      const where = `${rel}:${lineOf(text, m.index)}`
      const alt = tag.match(/\b:?alt="([^"]*)"/)
      assert.ok(alt && alt[1].trim().length > 0, `${where} 的产品截图缺 alt（读屏用户只能听到「图片」）`)

      // 写死的 width/height 是首帧的占位比例：与真实文件不一致，图片加载前后会跳一下。
      // 动态绑定（:width）不在这里断言 —— 运行时的值由清单决定。
      const w = tag.match(/(?<![:\w-])width="(\d+)"/)
      const h = tag.match(/(?<![:\w-])height="(\d+)"/)
      if (!w || !h) continue
      const actual = pngSizeByName.get(ref[1])
      assert.ok(actual, `${where} 引用了清单外的截图 ${ref[1]}`)
      assert.equal(
        `${w[1]}×${h[1]}`,
        `${actual.width}×${actual.height}`,
        `${where} 的 width/height 是 ${w[1]}×${h[1]}，但 ${ref[1]} 实际是 ${actual.width}×${actual.height}`,
      )
    }
  }
})

check('三站首屏都出现产品实拍（T1：首屏内要看到产品）', () => {
  for (const [site, landing] of Object.entries(LANDINGS)) {
    const text = read(landing.file)
    if (landing.gallery) {
      // docs 首屏的画廊不写字面文件名，而是读分发的清单 —— 断言它真的读清单
      assert.match(text, /@\/product\/shots\.json/, `${landing.file} 没有读清单 src/product/shots.json`)
      assert.match(text, /currentShot/, `${landing.file} 没有渲染当前选中的截图`)
      // 清单里的 file 是可选的（默认 docs/product/<id>.png）：页面直接读 .file
      // 会在绝大多数条目上拿到 undefined（首屏直接白屏，踩过一次）
      assert.match(text, /\.file \|\| /, `${landing.file} 假设清单里每条都写了 file（它其实是可选的）`)
    }
    assert.match(
      text,
      /\/product\/[A-Za-z0-9._-]+\.png|currentShotSrc|currentShot\.(file|value\.file)/,
      `${landing.file} 首屏没有产品实拍`,
    )
    assert.match(text, /hero-shot|shots-figure/, `${landing.file} 首屏的截图没有承载元素（hero-shot / shots-figure）`)
  }
})

if (failed > 0) {
  console.error(`\n[check:product-assets] 失败 ${failed} 项`)
  process.exit(1)
}

const kb = (shots.reduce((n, s) => n + statSync(join(ROOT, fileOf(s))).size, 0) / 1024 / 1024).toFixed(1)
console.log(
  `\n[check:product-assets] 通过：${shots.length} 张实拍（${DOCS_CORE_ROUTES.length} 个核心页面 × 浅/深 + ` +
    `另两端旗舰页）、共 ${kb} MB，3 站逐字节一致、引用与 alt 齐全、三站首屏均已出现产品`,
)
