#!/usr/bin/env node
/**
 * 品牌文案单源同步：docs/brand/ 下的品牌资产为权威源，分发到三个文档站点。
 *
 * 分发的文件：
 *   - `slogan.json`：口号、定位与「三个承诺」文案（见 docs/internal/改造三端站点.md §5.1）；
 *   - `one-config-diff.json`：由 scripts/gen-one-config-diff.mjs 从
 *     `docs/brand/one-config/{native,esplus}.vue` **实测**生成的对比数据
 *     （两段完整源码 + 行数/降幅）。首页对比卡展示的就是它，数字不是硬编码。
 *
 * 三站首页从各自 `src/brand/` 读取，保证跨站文案与数字零漂移。
 *
 * 用法：
 *   node scripts/sync-brand.mjs           # 同步：拷贝单源到各站点
 *   node scripts/sync-brand.mjs --check   # 校验：各站点与单源逐字节一致（CI）
 *
 * 退出码：0 = 成功/一致；1 = 校验发现漂移。
 */
import { writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readText, sameText } from './lib/text-sync.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

/**
 * 分发的品牌资产清单（显式声明，缺失即报错）。
 * 与 sync-docs.mjs 同理：不能靠扫描目录，否则删掉一个文件就自动退出检查集合。
 */
const BRAND_FILES = ['slogan.json', 'one-config-diff.json']

/**
 * 需要发到各站 public/ 的品牌资产（文件名 → 各站目标路径）。
 * favicon 必须放在 public/ 而不是 src/：它由 index.html 直接引用、由构建原样拷贝。
 * 三站此前各有一套图标且都不是品牌色（详见 docs/brand/favicon.svg 的注释），
 * 这里统一为同一份单源。
 */
const PUBLIC_ASSETS = [
  {
    file: 'favicon.svg',
    targets: [
      'es-plus-docs/public/favicon.svg',
      'es-pc/public/favicon.svg',
      'es-eui/public/favicon.svg',
    ],
  },
  {
    // 分享卡片：三站的 og:url / og:image 都指向主文档站（同一产品的三个渲染端共用一张卡片），
    // 因此只有主站需要托管这份 PNG。
    file: 'og-image.png',
    targets: ['es-plus-docs/public/og-image.png'],
  },
]

const SITE_DIRS = ['es-plus-docs', 'es-pc', 'es-eui']

const CHECK = process.argv.includes('--check')

function rel(p) {
  return p.replace(ROOT + '\\', '').replace(ROOT + '/', '').replace(/\\/g, '/')
}

function main() {
  let drift = false
  let synced = 0

  // 单源缺失 = 品牌资产被删，必须报错（不能靠目录扫描，否则空集恒绿）
  const allFiles = [...BRAND_FILES, ...PUBLIC_ASSETS.map((a) => a.file)]
  const missing = allFiles.filter((f) => !existsSync(join(ROOT, 'docs', 'brand', f)))
  if (missing.length) {
    console.error(`❌ 单源缺失：docs/brand/${missing.join(', docs/brand/')}`)
    process.exit(1)
  }

  for (const file of BRAND_FILES) {
    const srcContent = readText(join(ROOT, 'docs', 'brand', file))
    for (const site of SITE_DIRS) {
      const target = join(ROOT, site, 'src', 'brand', file)
      if (CHECK) {
        // 三个站点均已纳入版本库与构建：目标缺失属异常，显式报错而非静默跳过
        // （此前误以为 es-eui/ 被 .gitignore，导致该站目标被删时漏检）。
        if (!existsSync(target)) {
          console.error(`❌ 目标不存在：${rel(target)}`)
          drift = true
          continue
        }
        if (!sameText(readText(target), srcContent)) {
          console.error(`❌ 品牌资产漂移：${rel(target)} 与单源不一致`)
          drift = true
        }
      } else {
        const dir = dirname(target)
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
        writeFileSync(target, srcContent)
        synced++
      }
    }
  }

  // public/ 资产（favicon 等）：目标路径写全，不做目录扫描
  for (const asset of PUBLIC_ASSETS) {
    const srcContent = readText(join(ROOT, 'docs', 'brand', asset.file))
    for (const relTarget of asset.targets) {
      const target = join(ROOT, relTarget)
      if (CHECK) {
        if (!existsSync(target)) {
          console.error(`❌ 目标不存在：${rel(relTarget)}`)
          drift = true
          continue
        }
        if (!sameText(readText(target), srcContent)) {
          console.error(`❌ 品牌资产漂移：${rel(relTarget)} 与单源不一致`)
          drift = true
        }
      } else {
        const dir = dirname(target)
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
        writeFileSync(target, srcContent)
        synced++
      }
    }
  }

  if (CHECK) {
    if (drift) {
      console.error('\n品牌资产与单源不同步。运行 `npm run brand:sync` 重新生成，不要手改各站点副本。')
      process.exit(1)
    }
    console.log(
      `✅ 全部 ${SITE_DIRS.length} 个站点的品牌资产与单源逐字节一致` +
        `（${BRAND_FILES.length} 个 src 资产 + ${PUBLIC_ASSETS.length} 个 public 资产）`,
    )
  } else {
    console.log(`✅ 已从单源同步品牌资产到 ${synced} 处`)
  }
}

main()
