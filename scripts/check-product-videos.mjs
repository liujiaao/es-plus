#!/usr/bin/env node
/**
 * 产品录屏守卫（路线图 2.2：3 段 ≤30s 录屏）。
 *
 * 录屏比截图更容易悄悄变假：一张截图过期了还能看出「这里怎么不一样」，一段录屏
 * 过期了只会让人觉得「这功能本来就点不动」。所以这一页的每条主张都静态断言：
 *
 *   「3 段，每段 ≤30s」         → 清单条数下限 + 从 WebM 容器里**解析**出的真实时长
 *                                 （不是抄清单里的数字：清单写的和文件本身必须对得上）；
 *   「宽 ≤960」                → 同上，解析 TrackEntry 里的 PixelWidth / PixelHeight；
 *   「真的是录屏」             → EBML 魔数（1A 45 DF A3）+ VP9 轨道 + 有画面尺寸，
 *                                 一段空文件或一张改了后缀的 PNG 立刻红；
 *   「首帧即结果」             → 海报 PNG 与视频同尺寸，且海报确实存在于文件系统
 *                                 （页面靠它做封面，缺了就是一块白框）；
 *   「三站引用同一批字节」     → 三站 public/product/video/ 与单源逐字节一致、无孤儿；
 *   「录了就有人看」           → 清单里的每段至少被一处源码引用；反过来，源码里出现的
 *                                 每个 /product/video/ 引用都必须登记在清单里；
 *   「页面上的播放方式是对的」  → 引用视频的 <video> 必须 muted + playsinline + poster
 *                                 （不静音就自动播放会被浏览器拦，不 playsinline 在
 *                                 iOS 上会被强制全屏 —— 两者都会让「首屏证据」变成黑块）。
 *
 * 用法：node scripts/check-product-videos.mjs
 * 退出码：0 = 全部成立；1 = 任一断言失败。
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, basename, extname } from 'node:path'
import assert from 'node:assert/strict'
import { readBinary, sameBinary } from './lib/text-sync.mjs'
import { readWebmMeta } from './lib/webm.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')
const MANIFEST = 'docs/product/videos.json'
const SITES = ['es-plus-docs', 'es-pc', 'es-eui']

const MIN_VIDEOS = 3
const MAX_WIDTH = 960
const MAX_VIDEO_BYTES = 6 * 1024 * 1024
const MIN_POSTER_BYTES = 15 * 1024
const MAX_POSTER_BYTES = 800 * 1024
const VIEWPORT_RATIO = 1.6

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
const videos = manifest.videos || []
const maxMs = manifest.maxDurationMs || 30000

// Duration / PixelWidth / PixelHeight 由 scripts/lib/webm.mjs 从容器里读 ——
// 与生成器共用同一份解析，守卫断言的「时长」与清单里写的就是同一个来源。

function pngSize(buffer, label) {
  assert.ok(buffer.length > 33, `${label} 太小，不像 PNG`)
  assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${label} 不是 PNG（魔数不对）`)
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

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
check(`清单结构：至少 ${MIN_VIDEOS} 段、id 唯一、站点/主题/路由齐全、标题与说明非空`, () => {
  assert.ok(videos.length >= MIN_VIDEOS, `清单里只有 ${videos.length} 段录屏（路线图 2.2 要求 ${MIN_VIDEOS} 段）`)
  const ids = new Set()
  for (const v of videos) {
    assert.ok(!ids.has(v.id), `id 重复：${v.id}`)
    ids.add(v.id)
    assert.match(v.id, /^[a-z0-9-]+$/, `id 必须是 kebab-case：${v.id}`)
    assert.ok(SITES.includes(v.site), `${v.id} 的 site「${v.site}」不是三站之一`)
    assert.match(v.route, /^\//, `${v.id} 的 route 必须以 / 开头`)
    assert.equal(basename(v.file), `${v.id}.webm`, `${v.id} 的 file 与 id 不一致`)
    assert.equal(basename(v.poster), `${v.id}.png`, `${v.id} 的 poster 与 id 不一致`)
    assert.ok((v.title || '').trim().length >= 2, `${v.id} 缺 title`)
    assert.ok((v.caption || '').trim().length >= 12, `${v.id} 的 caption 太短（说明不了这段录屏证什么）`)
  }
})

// ── 2. 视频本体：真容器、真时长、真尺寸 ────────────────────────────────────
check(`视频本体：EBML 魔数、VP9 尺寸 ≤${MAX_WIDTH}、时长 ≤${maxMs / 1000}s、体积 ≤${MAX_VIDEO_BYTES / 1024 / 1024}MB`, () => {
  for (const v of videos) {
    const rel = v.file
    assert.ok(existsSync(join(ROOT, rel)), `${rel} 不存在（先跑 node scripts/gen-product-videos.mjs）`)
    const bytes = readBinary(join(ROOT, rel))
    assert.equal(bytes.subarray(0, 4).toString('hex'), '1a45dfa3', `${rel} 不是 WebM/EBML（魔数不对）`)
    const meta = readWebmMeta(bytes)
    assert.ok(meta.durationMs > 0, `${rel} 里读不到 Duration —— 不是 seekable 的成品，浏览器会无进度条`)
    const durationMs = meta.durationMs
    assert.ok(meta.width && meta.height, `${rel} 里读不到画面尺寸（没有视频轨道？）`)
    assert.ok(meta.width <= MAX_WIDTH, `${rel} 宽 ${meta.width}，超过 ${MAX_WIDTH}（审计要求宽 ≤960）`)
    assert.ok(
      Math.abs(meta.width / meta.height - VIEWPORT_RATIO) < 0.01,
      `${rel} 不是 16:10（${meta.width}×${meta.height}）—— 与产品截图同比例摆在一起，变形就露馅`,
    )
    assert.ok(durationMs <= maxMs, `${rel} 有 ${(durationMs / 1000).toFixed(1)} 秒，超过 ${maxMs / 1000} 秒上限`)
    assert.ok(durationMs >= 5000, `${rel} 只有 ${(durationMs / 1000).toFixed(1)} 秒，短到看不出流程`)

    // 清单里的数字是生成器写回的实测值 —— 它必须与文件本身对得上，否则页面上的
    // 「20 秒」是手写的，总有一天会与文件不符（重录时不更新数字最省事）。
    assert.equal(v.width, meta.width, `${rel} 的清单宽 ${v.width} ≠ 文件里的 ${meta.width}`)
    assert.equal(v.height, meta.height, `${rel} 的清单高 ${v.height} ≠ 文件里的 ${meta.height}`)
    assert.equal(v.durationMs, durationMs, `${rel} 的清单时长 ${v.durationMs}ms ≠ 文件里的 ${durationMs}ms`)

    const size = statSync(join(ROOT, rel)).size
    assert.ok(size <= MAX_VIDEO_BYTES, `${rel} 有 ${(size / 1024 / 1024).toFixed(1)} MB，超过 ${MAX_VIDEO_BYTES / 1024 / 1024} MB`)
  }
})

// ── 3. 海报 ────────────────────────────────────────────────────────────────
check('海报：PNG 魔数、尺寸与视频一致、体积在区间内', () => {
  for (const v of videos) {
    assert.ok(existsSync(join(ROOT, v.poster)), `${v.poster} 不存在 —— 首帧封面缺了，页面上的视频框就是一个白块`)
    const bytes = readBinary(join(ROOT, v.poster))
    const { width, height } = pngSize(bytes, v.poster)
    assert.equal(`${width}×${height}`, `${v.width}×${v.height}`, `${v.poster} 是 ${width}×${height}，视频是 ${v.width}×${v.height}`)
    const size = statSync(join(ROOT, v.poster)).size
    assert.ok(size >= MIN_POSTER_BYTES, `${v.poster} 只有 ${(size / 1024).toFixed(0)} KB，像一张空白帧`)
    assert.ok(size <= MAX_POSTER_BYTES, `${v.poster} 有 ${(size / 1024).toFixed(0)} KB，超过 ${MAX_POSTER_BYTES / 1024} KB`)
  }
})

// ── 4. 三站分发：逐字节一致、无孤儿 ────────────────────────────────────────
check('三站 public/product/video/ 与单源逐字节一致，且没有清单外的文件', () => {
  const names = new Set(videos.flatMap((v) => [basename(v.file), basename(v.poster)]))
  for (const site of SITES) {
    const dir = join(ROOT, site, 'public/product/video')
    assert.ok(existsSync(dir), `${site}/public/product/video 不存在 —— 运行 npm run product:sync`)
    for (const v of videos) {
      for (const rel of [v.file, v.poster]) {
        const name = basename(rel)
        const copy = join(dir, name)
        assert.ok(existsSync(copy), `${site}/public/product/video/${name} 缺失 —— 运行 npm run product:sync`)
        assert.ok(
          sameBinary(readBinary(join(ROOT, rel)), readBinary(copy)),
          `${site}/public/product/video/${name} 与单源不一致 —— 不要手改站点副本，跑 npm run product:sync`,
        )
      }
    }
    const orphans = readdirSync(dir).filter((n) => !names.has(n))
    assert.equal(orphans.length, 0, `${site}/public/product/video 有清单外的文件：${orphans.join(', ')}`)
  }
})

check('三站 src/product/videos.json 与单源逐字节一致', () => {
  const source = readBinary(join(ROOT, MANIFEST))
  for (const site of SITES) {
    const copy = join(ROOT, site, 'src/product/videos.json')
    assert.ok(existsSync(copy), `${site}/src/product/videos.json 缺失 —— 运行 npm run product:sync`)
    assert.ok(sameBinary(source, readBinary(copy)), `${site}/src/product/videos.json 与单源不一致`)
  }
})

// ── 5. 页面引用 ────────────────────────────────────────────────────────────
const sources = SITES.flatMap((site) => listSources(`${site}/src`))
const refRe = /(?:docs)?\/product\/video\/([A-Za-z0-9._-]+\.webm)/g

check('源码里出现的每个产品录屏引用都是清单条目', () => {
  const known = new Set(videos.map((v) => basename(v.file)))
  for (const rel of sources) {
    const text = read(rel)
    for (const m of text.matchAll(refRe)) {
      assert.ok(known.has(m[1]), `${rel}:${lineOf(text, m.index)} 引用了清单外的录屏 ${m[1]}`)
    }
  }
})

// 主站首屏的录屏区走清单驱动（与产品实拍画廊同一套路）：页面 import 清单、逐条渲染，
// 因此源码里没有字面的 /product/video/x.webm。这条断言就是「它真的走的是清单」的凭据 ——
// 没有它，「清单里的每段都被引用」会变成自证。
const VIDEO_PAGE = 'es-plus-docs/src/views/Home.vue'

check('主站首屏的录屏区由清单驱动（import videos.json 并逐条渲染 <video>）', () => {
  const text = read(VIDEO_PAGE)
  assert.match(text, /@\/product\/videos\.json/, `${VIDEO_PAGE} 没有读清单 src/product/videos.json`)
  assert.match(text, /v-for="video in demoVideos"/, `${VIDEO_PAGE} 没有逐条渲染清单里的录屏`)
  assert.match(text, /videoUrl\(video\.file\)/, `${VIDEO_PAGE} 没有用清单里的 file 字段当视频地址`)
  assert.match(text, /videoUrl\(video\.poster\)/, `${VIDEO_PAGE} 没有用清单里的 poster 字段当封面`)
})

check('清单里的每段录屏都至少被一处源码引用（没有录了没人看的）', () => {
  const used = new Set()
  for (const rel of sources) {
    for (const m of read(rel).matchAll(refRe)) used.add(m[1])
  }
  // 清单驱动的页面把「这一条被渲染了」交给上面的断言证明，这里不重复计入
  const driven = /v-for="video in demoVideos"/.test(read(VIDEO_PAGE))
  if (driven) for (const v of videos) used.add(basename(v.file))
  const dead = videos.map((v) => basename(v.file)).filter((n) => !used.has(n))
  assert.equal(dead.length, 0, `这些录屏没有任何页面引用：${dead.join(', ')}`)
})

check('引用录屏的 <video> 都带 muted / playsinline / poster（否则自动播不出来、iOS 会全屏）', () => {
  for (const rel of sources) {
    if (!rel.endsWith('.vue')) continue
    const text = read(rel)
    for (const m of text.matchAll(/<video\b[^>]*>/g)) {
      const tag = m[0]
      // 两种写法都要认：字面路径，或清单驱动页面的 videoUrl(...) 绑定
      if (!refRe.test(tag) && !/videoUrl\(/.test(tag)) {
        refRe.lastIndex = 0
        continue
      }
      refRe.lastIndex = 0
      const where = `${rel}:${lineOf(text, m.index)}`
      assert.match(tag, /\bmuted\b/, `${where} 的 <video> 没有 muted —— 自动播放会被浏览器直接拦掉`)
      assert.match(tag, /\bplaysinline\b/i, `${where} 的 <video> 没有 playsinline —— iOS 上会被强制全屏播放`)
      assert.match(tag, /(?<![:\w-])poster="[^"]+"|:poster="[^"]+"/, `${where} 的 <video> 没有 poster —— 加载前是一块黑框`)
    }
  }
})

if (failed > 0) {
  console.error(`\n[check-product-videos] 失败 ${failed} 项`)
  process.exit(1)
}

const totalMb = (videos.reduce((n, v) => n + statSync(join(ROOT, v.file)).size + statSync(join(ROOT, v.poster)).size, 0) / 1024 / 1024).toFixed(1)
const seconds = Math.round(videos.reduce((n, v) => n + v.durationMs, 0) / 1000)
console.log(
  `\n[check-product-videos] 通过：${videos.length} 段录屏（共 ${seconds} 秒、${totalMb} MB），` +
    `容器里解析出的时长/尺寸与清单一致，3 站逐字节一致、引用与播放属性齐全`,
)
