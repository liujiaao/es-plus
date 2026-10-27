#!/usr/bin/env node
/**
 * 文档主题单源同步：docs/theme/*.css 为权威源，分发到三个文档站点。
 *
 *   - docs-content.css：正文排版/代码块/表格/提示框。各站给内容容器加
 *     `.es-doc-content` 类即可获得统一正文排版（docs/internal/改造三端站点.md §2.3/§5.1）。
 *   - docs-layout.css：外壳契约（shell 宽度、三栏宽度、正文度量）。路线图 1.2。
 *
 * 用法：
 *   node scripts/sync-theme.mjs           # 同步：拷贝单源到各站点
 *   node scripts/sync-theme.mjs --check   # 校验：各站点与单源逐字节一致（CI）
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
 * 分发清单（显式声明，缺失即报错）。
 * 不能靠扫描 docs/theme/ 目录：删掉一个文件就自动退出检查集合，守卫会恒绿。
 */
const ASSETS = [
  {
    file: 'docs-content.css',
    targets: [
      join(ROOT, 'es-plus-docs', 'src', 'styles', 'docs-content.css'),
      join(ROOT, 'es-pc', 'src', 'styles', 'docs-content.css'),
      join(ROOT, 'es-eui', 'src', 'assets', 'docs-content.css'),
    ],
  },
  {
    file: 'docs-layout.css',
    targets: [
      join(ROOT, 'es-plus-docs', 'src', 'styles', 'docs-layout.css'),
      join(ROOT, 'es-pc', 'src', 'styles', 'docs-layout.css'),
      join(ROOT, 'es-eui', 'src', 'assets', 'docs-layout.css'),
    ],
  },
]

const CHECK = process.argv.includes('--check')

function rel(p) {
  return p.replace(ROOT + '\\', '').replace(ROOT + '/', '').replace(/\\/g, '/')
}

function main() {
  let drift = false
  let synced = 0

  for (const { file, targets } of ASSETS) {
    const source = join(ROOT, 'docs', 'theme', file)
    // 单源缺失 = 文件被删，必须报错（不能靠目录扫描，否则空集恒绿）
    if (!existsSync(source)) {
      console.error(`❌ 单源缺失：docs/theme/${file}`)
      process.exit(1)
    }
    const srcContent = readText(source)

    for (const target of targets) {
      if (CHECK) {
        // 三个站点均已纳入版本库与构建：目标缺失属异常，显式报错而非静默跳过
        // （此前误以为 es-eui/ 被 .gitignore，导致该站目标被删时漏检）。
        if (!existsSync(target)) {
          console.error(`❌ 目标不存在：${rel(target)}`)
          drift = true
          continue
        }
        const dstContent = readText(target)
        if (!sameText(dstContent, srcContent)) {
          console.error(`❌ 文档主题漂移：${rel(target)} 与 docs/theme/${file} 不一致`)
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
      console.error('\n文档主题与单源不同步。运行 `npm run theme:sync` 重新生成，不要手改各站点副本。')
      process.exit(1)
    }
    console.log(`✅ 全部 ${ASSETS.length} 份文档主题与单源逐字节一致`)
  } else {
    console.log(`✅ 已从单源同步 ${ASSETS.length} 份文档主题到各站点（共 ${synced} 个文件）`)
  }
}

main()
