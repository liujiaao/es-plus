#!/usr/bin/env node
/**
 * 文档主题单源同步：docs/theme/* 为权威源，分发到三个文档站点。
 *
 *   - docs-content.css：正文排版/代码块/表格/提示框。各站给内容容器加
 *     `.es-doc-content` 类即可获得统一正文排版（docs/internal/改造三端站点.md §2.3/§5.1）。
 *   - docs-layout.css：外壳契约（shell 宽度、三栏宽度、正文度量）。路线图 1.2。
 *   - docs-chrome.css：文档 chrome 契约（面包屑/目录/上下篇/编辑反馈）。路线图 1.4。
 *   - doc-chrome.js：chrome 行为（标题发号、目录滚动高亮），无框架依赖。路线图 1.4。
 *   - code-block.js：代码块契约（语言/文件名/复制/折叠/行号/高亮行），无框架依赖。路线图 1.6。
 *   - docs-a11y.css：可访问性基线（skip link / focus-visible / reduced-motion / 读屏工具类）。路线图 1.7。
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
  {
    file: 'docs-chrome.css',
    targets: [
      join(ROOT, 'es-plus-docs', 'src', 'styles', 'docs-chrome.css'),
      join(ROOT, 'es-pc', 'src', 'styles', 'docs-chrome.css'),
      join(ROOT, 'es-eui', 'src', 'assets', 'docs-chrome.css'),
    ],
  },
  {
    // 可访问性基线（路线图 1.7）：skip link / focus-visible / reduced-motion。
    // 放在布局之后分发，但**必须最后 import**——它要压过站点自己的 `outline: none`。
    file: 'docs-a11y.css',
    targets: [
      join(ROOT, 'es-plus-docs', 'src', 'styles', 'docs-a11y.css'),
      join(ROOT, 'es-pc', 'src', 'styles', 'docs-a11y.css'),
      join(ROOT, 'es-eui', 'src', 'assets', 'docs-a11y.css'),
    ],
  },
  {
    // CSS 之外的唯一一份共享资源：chrome 的 DOM 行为。放 utils/ 而不是 styles/，
    // 因为它不是样式；三站同名同路径，便于「单源 ↔ 副本」一眼对照。
    file: 'doc-chrome.js',
    targets: [
      join(ROOT, 'es-plus-docs', 'src', 'utils', 'doc-chrome.js'),
      join(ROOT, 'es-pc', 'src', 'utils', 'doc-chrome.js'),
      join(ROOT, 'es-eui', 'src', 'utils', 'doc-chrome.js'),
    ],
  },
  {
    // 代码块的结构与行为（路线图 1.6）。与 doc-chrome.js 同理：不是样式，
    // 三站同名同路径，主站的 markdown 渲染器与两站的代码块组件都 import 这一份。
    file: 'code-block.js',
    targets: [
      join(ROOT, 'es-plus-docs', 'src', 'utils', 'code-block.js'),
      join(ROOT, 'es-pc', 'src', 'utils', 'code-block.js'),
      join(ROOT, 'es-eui', 'src', 'utils', 'code-block.js'),
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
          console.error(`❌ 文档主题资源漂移：${rel(target)} 与 docs/theme/${file} 不一致`)
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
    console.log(`✅ 全部 ${ASSETS.length} 份文档主题资源与单源逐字节一致`)
  } else {
    console.log(`✅ 已从单源同步 ${ASSETS.length} 份文档主题资源到各站点（共 ${synced} 个文件）`)
  }
}

main()
