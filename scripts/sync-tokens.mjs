#!/usr/bin/env node
/**
 * 设计 token 单源同步：docs/tokens/design-tokens.css 为权威源，分发到三个文档站点。
 *
 * 用法：
 *   node scripts/sync-tokens.mjs           # 同步：拷贝单源到各站点
 *   node scripts/sync-tokens.mjs --check   # 校验：各站点与单源逐字节一致（CI）
 *
 * 退出码：0 = 成功/一致；1 = 校验发现漂移。
 */
import { writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readText, sameText } from './lib/text-sync.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SOURCE = join(ROOT, 'docs', 'tokens', 'design-tokens.css')

const TARGETS = [
  join(ROOT, 'es-plus-docs', 'src', 'styles', 'design-tokens.css'),
  join(ROOT, 'es-pc', 'src', 'styles', 'design-tokens.css'),
  join(ROOT, 'es-eui', 'src', 'assets', 'design-tokens.css'),
]

const CHECK = process.argv.includes('--check')

/**
 * 必备 token 清单（路线图 1.1 的验收：新 token 全量存在）。
 *
 * 逐字节一致只能证明「三站相同」，证明不了「该有的都在」—— 单源里删掉一个
 * 名字，三份副本照样一致。这里逐个点名，少一个就红。
 * 可选值（如 --es-text-display）不在此列：清单只锁「被页面或守卫依赖的名字」。
 */
const REQUIRED_TOKENS = [
  // 字体栈
  '--es-font-sans', '--es-font-mono',
  // 字号阶梯
  '--es-text-xs', '--es-text-sm', '--es-text-base', '--es-text-md', '--es-text-lg',
  '--es-text-xl', '--es-text-2xl', '--es-text-3xl', '--es-text-4xl',
  '--es-display', '--es-display-sm',
  // 行高
  '--es-leading-tight', '--es-leading-snug', '--es-leading-normal', '--es-leading-relaxed',
  // 间距
  '--es-space-1', '--es-space-2', '--es-space-3', '--es-space-4', '--es-space-5',
  '--es-space-6', '--es-space-7', '--es-space-8', '--es-space-9',
  // 圆角
  '--es-radius-xs', '--es-radius-sm', '--es-radius-md', '--es-radius-lg', '--es-radius-full',
  // 阴影
  '--es-shadow-sm', '--es-shadow-md', '--es-shadow-lg',
  // 动效
  '--es-duration-fast', '--es-duration-base', '--es-duration-slow', '--es-ease',
  // 层级
  '--es-z-sticky', '--es-z-header', '--es-z-overlay', '--es-z-modal', '--es-z-toast',
  // 布局宽度
  '--es-layout-max', '--es-header-height', '--es-sidebar-width', '--es-content-width',
  '--es-content-wide', '--es-toc-width', '--es-gutter',
  // 断点
  '--es-bp-sm', '--es-bp-md', '--es-bp-lg', '--es-bp-xl', '--es-bp-2xl',
  // 语义色 / 焦点
  '--es-brand-strong', '--es-brand-tint', '--es-link', '--es-link-hover',
  '--es-text-tertiary', '--es-text-disabled', '--es-border-strong', '--es-bg-subtle',
  '--es-success-text', '--es-warning-text', '--es-danger-text', '--es-info-text',
  '--es-success-tint', '--es-warning-tint', '--es-danger-tint', '--es-info-tint',
  '--es-focus-ring',
]

function rel(p) {
  return p.replace(ROOT + '\\', '').replace(ROOT + '/', '').replace(/\\/g, '/')
}

/** 只认「声明」不认「引用」：`--es-link: var(--es-brand-strong)` 声明的是 --es-link */
function declaredNames(css) {
  const names = new Set()
  for (const m of css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)) names.add(m[1])
  return names
}

function main() {
  const srcContent = readText(SOURCE)
  let drift = false
  let synced = 0

  // 单源自己先过一遍：缺名字时不必再谈「三站一致」
  const declared = declaredNames(srcContent)
  const missing = REQUIRED_TOKENS.filter((t) => !declared.has(t))
  if (missing.length) {
    console.error(`❌ 单源缺少必备 token（${missing.length} 个）：${missing.join(', ')}`)
    process.exit(1)
  }

  for (const target of TARGETS) {
    if (CHECK) {
      // 三个站点均已纳入版本库与构建：目标缺失属异常，显式报错而非静默跳过
      // （此前误以为 es-eui/ 被 .gitignore，导致该站目标被删时漏检）。
      if (!existsSync(target)) {
        console.error(`❌ 目标不存在：${rel(target)}`)
        drift = true
        continue
      }
      const dstContent = existsSync(target) ? readText(target) : null
      if (!sameText(dstContent, srcContent)) {
        console.error(`❌ 漂移：${rel(target)} 与单源不一致`)
        drift = true
      }
    } else {
      const dir = dirname(target)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(target, srcContent)
      synced++
    }
  }

  if (CHECK) {
    if (drift) {
      console.error('\ntokens 与单源不同步。运行 `npm run tokens:sync` 重新生成，不要手改各站点副本。')
      process.exit(1)
    }
    console.log(`✅ 全部 ${TARGETS.length} 个站点 tokens 与单源逐字节一致`)
  } else {
    console.log(`✅ 已从单源同步 design-tokens.css 到 ${synced} 个站点`)
  }
}

main()
