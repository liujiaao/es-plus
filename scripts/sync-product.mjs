#!/usr/bin/env node
/**
 * 产品实拍分发：docs/product/ 为权威源，分发到三个站点的 public/product/。
 *
 * 与 sync-theme / sync-cases 同一个思路：图片只有一份，三站引用同一批字节。
 * 站点里手放一张截图 = 三端开始分叉，而「截图分叉」没人会看出来 —— 所以必须逐字节比对。
 *
 * 二进制按字节搬运（readBinary / sameBinary），绝不走文本解码：
 * UTF-8 解码非法字节会静默损坏 PNG（sync-brand 踩过，见 lib/text-sync.mjs）。
 *
 * 清单显式取自 docs/product/shots.json，而不是扫描目录：
 *   1. 删掉一条清单就等于删除一张图，目标端的旧文件必须跟着消失（不留孤儿）；
 *   2. 目录扫描会让「少同步一张」永远发现不了。
 *
 * 用法：
 *   node scripts/sync-product.mjs           # 同步
 *   node scripts/sync-product.mjs --check   # 校验：三站副本与单源逐字节一致
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, basename } from 'node:path'
import { readBinary, sameBinary } from './lib/text-sync.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const MANIFEST = join(ROOT, 'docs/product/shots.json')

/**
 * 每站两处落点：
 *   public/product/     图片本体（页面里以 /product/<file> 引用）
 *   src/product/shots.json  清单（页面读它来列标题/说明/分组，避免在页面里手抄一份）
 * 清单也走同步，是为了让「页面上列了什么」与「拍了什么」永远是同一份数据。
 */
const TARGETS = [
  { pub: join(ROOT, 'es-plus-docs/public/product'), src: join(ROOT, 'es-plus-docs/src/product') },
  { pub: join(ROOT, 'es-pc/public/product'), src: join(ROOT, 'es-pc/src/product') },
  { pub: join(ROOT, 'es-eui/public/product'), src: join(ROOT, 'es-eui/src/product') },
]

const check = process.argv.includes('--check')
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
const files = manifest.shots.map((shot) => shot.file || `docs/product/${shot.id}.png`)

if (files.length === 0) {
  console.error('[product:sync] docs/product/shots.json 里没有截图 —— 清单被清空时不能当作「同步成功」')
  process.exit(1)
}

let failures = 0
let written = 0

for (const target of TARGETS.map((t) => t.pub)) {
  const rel = target.slice(ROOT.length + 1).replace(/\\/g, '/')
  if (!check) mkdirSync(target, { recursive: true })

  for (const file of files) {
    const source = join(ROOT, file)
    const dest = join(target, basename(file))
    const expected = existsSync(source) ? readBinary(source) : null
    const actual = existsSync(dest) ? readBinary(dest) : null

    if (expected === null) {
      console.error(`  ❌ 单源缺失：${file}（先跑 node scripts/gen-product-shots.mjs）`)
      failures++
      continue
    }
    if (sameBinary(expected, actual)) continue

    if (check) {
      console.error(`  ❌ ${rel}/${basename(file)} 与单源不一致 —— 运行 npm run product:sync，不要手改站点副本`)
      failures++
    } else {
      writeFileSync(dest, expected)
      written++
    }
  }

  // 目标端的孤儿文件：清单里没有、public 里还留着 —— 页面可能还在引用（引用检查在
  // check:product-assets 里），也可能只是没人再用的死图。两种都不该留在站点里。
  if (existsSync(target)) {
    const known = new Set(files.map((f) => basename(f)))
    for (const name of readdirSync(target)) {
      if (!name.endsWith('.png') || known.has(name)) continue
      if (check) {
        console.error(`  ❌ ${rel}/${name} 不在清单里 —— 删除它，或把它登记进 docs/product/shots.json`)
        failures++
      } else {
        unlinkSync(join(target, name))
        console.log(`  🗑  删除孤儿 ${rel}/${name}`)
      }
    }
  }
}

// 清单本体：与图片一起分发，页面读的是自己 src 里的副本
const manifestBuffer = readBinary(MANIFEST)
for (const target of TARGETS) {
  const dest = join(target.src, 'shots.json')
  const rel = dest.slice(ROOT.length + 1).replace(/\\/g, '/')
  const actual = existsSync(dest) ? readBinary(dest) : null
  if (sameBinary(manifestBuffer, actual)) continue
  if (check) {
    console.error(`  ❌ ${rel} 与单源不一致 —— 运行 npm run product:sync`)
    failures++
  } else {
    mkdirSync(target.src, { recursive: true })
    writeFileSync(dest, manifestBuffer)
    written++
  }
}

if (failures > 0) {
  console.error(`\n[product:sync] 失败 ${failures} 项`)
  process.exit(1)
}

console.log(
  check
    ? `[product:sync] 一致：${files.length} 张截图 × ${TARGETS.length} 个站点`
    : `[product:sync] 完成：${files.length} 张 × ${TARGETS.length} 站（写入 ${written} 个文件）`,
)
