#!/usr/bin/env node
/**
 * 品牌文案单源同步：docs/brand/ 下的品牌资产为权威源，分发到三个文档站点。
 *
 * 分发的文件：
 *   - `slogan.json`：口号、定位与「三个承诺」文案（见 docs/改造三端站点.md §5.1）；
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

const SITE_DIRS = ['es-plus-docs', 'es-pc', 'es-eui']

const CHECK = process.argv.includes('--check')

function rel(p) {
  return p.replace(ROOT + '\\', '').replace(ROOT + '/', '').replace(/\\/g, '/')
}

function main() {
  let drift = false
  let synced = 0

  // 单源缺失 = 品牌资产被删，必须报错（不能靠目录扫描，否则空集恒绿）
  const missing = BRAND_FILES.filter((f) => !existsSync(join(ROOT, 'docs', 'brand', f)))
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

  if (CHECK) {
    if (drift) {
      console.error('\n品牌资产与单源不同步。运行 `npm run brand:sync` 重新生成，不要手改各站点副本。')
      process.exit(1)
    }
    console.log(
      `✅ 全部 ${SITE_DIRS.length} 个站点品牌资产与单源逐字节一致（${BRAND_FILES.length} 个文件）`,
    )
  } else {
    console.log(`✅ 已从单源同步 ${BRAND_FILES.length} 个品牌资产到 ${synced} 处`)
  }
}

main()
