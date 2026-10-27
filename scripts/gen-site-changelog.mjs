#!/usr/bin/env node
/**
 * 站点更新日志生成 —— 从各包的 CHANGELOG.md（changesets 产出）合成，不手写第二份真相。
 *
 * 背景：站点 changelog.md 长期停在 `@es-plus/vue2 v1.1.1`（2026-06-05），而实际版本已是
 * vue3 1.7.0 / vue2 1.4.0 / adapter 1.3.0 / core 1.3.0 / mcp 1.4.1 / cli 1.4.0。
 * 读者点开「更新日志」看到的是一年半前的记录 —— 这比没有更新日志更伤信任。
 *
 * 为什么生成而不是手写：
 *   同一个 changeset 会同时写进 vue3 / vue2 / adapter 三份 CHANGELOG（onSubmit 移除就是三份
 *   逐字重复）。手写站点版要么抄三遍、要么漏两遍；抄完的那一刻就开始漂移。这里按「变更正文」
 *   去重、把受影响包合并成一行，版本号直接读各包 package.json。
 *
 * 口径：
 *   - 「当前版本」矩阵 = 各 workspace 包的 package.json version；
 *   - 「最近一次发布」= 每个包 CHANGELOG 的**最新**版本段落，按 Minor → Patch 排序并去重；
 *   - 更早的版本不在这里重排（GitHub Releases 是完整历史）。
 *
 * 用法：
 *   node scripts/gen-site-changelog.mjs           # 生成
 *   node scripts/gen-site-changelog.mjs --check   # 校验站点文件是否最新（CI）
 *
 * 退出码：0 = 成功/一致；1 = 缺文件或产出过期。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { readText, sameText } from './lib/text-sync.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const TARGET = join(ROOT, 'es-plus-docs', 'src', 'docs', 'changelog.md')

/** 展示顺序：先核心与渲染端，再共享/工具链 */
const PACKAGES = ['core', 'vue3', 'vue2', 'adapter-antdv', 'shared', 'cli', 'mcp-server']

const ORDER = ['Major', 'Minor', 'Patch']
const ORDER_LABEL = { Major: 'Major Changes（破坏性）', Minor: 'Minor Changes', Patch: 'Patch Changes' }

const toLF = (text) => text.replace(/\r\n?/g, '\n')

function pkgInfo(name) {
  const json = JSON.parse(readText(join(ROOT, 'packages', name, 'package.json')))
  return { name: json.name, version: json.version }
}

/** 解析 changesets 风格的 CHANGELOG：## version → ### Type Changes → `- [hash:] 正文` */
export function parseChangelog(text) {
  const lines = toLF(text).split('\n')
  const versions = []
  let cur = null
  let curType = null
  for (const line of lines) {
    const v = line.match(/^##\s+(\d+\.\d+\.\d+)(?:\s+[—–-]\s*(.*))?$/)
    if (v) {
      cur = { version: v[1], note: v[2] || '', changes: { Major: [], Minor: [], Patch: [] } }
      versions.push(cur)
      curType = null
      continue
    }
    const t = line.match(/^###\s+(Major|Minor|Patch)\s+Changes\s*$/i)
    if (t) {
      curType = t[1][0].toUpperCase() + t[1].slice(1).toLowerCase()
      continue
    }
    if (!cur || !curType) continue
    const b = line.match(/^-\s+(?:[0-9a-f]{7,}:\s*)?(.*)$/)
    if (b) {
      cur.changes[curType].push([b[1]])
      continue
    }
    if (cur.changes[curType].length) cur.changes[curType].at(-1).push(line)
  }
  // 去掉每条正文尾部空行
  for (const v of versions) {
    for (const type of ORDER) {
      v.changes[type] = v.changes[type]
        .map((body) => {
          while (body.length && body.at(-1).trim() === '') body.pop()
          return body
        })
        .filter((body) => body.length > 0)
    }
  }
  return versions
}

const isNoise = (body) => /^Updated dependencies\b/i.test((body[0] || '').trim())

/** 去重 key：正文首行（同一 changeset 在各包里逐字一致） */
const bodyKey = (body) => (body[0] || '').trim()

/** 正文首段（用于「升级提示」摘要） */
function firstParagraph(body) {
  const out = []
  for (const line of body) {
    if (line.trim() === '' && out.length) break
    out.push(line)
  }
  return out.join('\n').trim()
}

function build() {
  const rows = []
  // 单一 map + 最高严重度：同一个 changeset 在 runtime 包里记 Minor、在 shared/mcp 里记
  // Patch（它们不发运行时），按类型分桶会让同一条正文出现两次（升级提示里尤其明显）。
  const merged = new Map()
  const rank = (type) => ORDER.indexOf(type) // Major=0 最高

  for (const name of PACKAGES) {
    const info = pkgInfo(name)
    const file = join(ROOT, 'packages', name, 'CHANGELOG.md')
    if (!existsSync(file)) {
      console.error(`❌ 缺少 packages/${name}/CHANGELOG.md —— 更新日志无法核对`)
      process.exit(1)
    }
    const versions = parseChangelog(readText(file))
    const latest = versions.find((v) => v.version === info.version)
    rows.push({ ...info, latest: latest || null })
    if (!latest) {
      console.error(
        `❌ ${info.name} 的 package.json 是 ${info.version}，但 CHANGELOG.md 里没有这一版 ——` +
          ' 请先运行 changeset/version 或补齐包更新日志',
      )
      process.exit(1)
    }
    for (const type of ORDER) {
      for (const body of latest.changes[type]) {
        if (isNoise(body)) continue
        const key = bodyKey(body)
        const existing = merged.get(key)
        if (existing) {
          existing.packages.push(info.name)
          if (rank(type) < rank(existing.type)) existing.type = type
          // 同一条正文在不同包里可能详略不同：保留更完整的那份
          if (body.join('\n').length > existing.body.join('\n').length) existing.body = body
        } else {
          merged.set(key, { body, packages: [info.name], type })
        }
      }
    }
  }

  const lines = []
  lines.push('# 更新日志')
  lines.push('')
  lines.push(
    '> 本页由 `npm run changelog:gen` 从各包的 `CHANGELOG.md` 生成，**请勿手改**；' +
      '完整历史见 [GitHub Releases](https://github.com/liujiaao/es-plus/releases)。',
  )
  lines.push('')
  lines.push('## 当前版本')
  lines.push('')
  lines.push('| 包 | 版本 | 说明 |')
  lines.push('|---|---:|---|')
  const ROLE = {
    core: '框架无关核心（类型 / 布局 / 校验）',
    vue3: 'Vue 3 + Element Plus 渲染端',
    vue2: 'Vue 2 + Element UI 渲染端',
    'adapter-antdv': 'Vue 3 + Ant Design Vue 适配器',
    shared: '配置 schema / 生成器 / 修复环',
    cli: '命令行工具',
    'mcp-server': 'MCP Server（AI 工具面）',
  }
  for (const row of rows) {
    lines.push(`| \`${row.name}\` | ${row.version} | ${ROLE[row.name.split('/').pop()] || ''} |`)
  }
  lines.push('')

  // 升级提示：正文里明确讲迁移的条目
  const migration = []
  for (const item of merged.values()) {
    const text = item.body.join('\n')
    if (!/迁移|破坏性|breaking change/i.test(text)) continue
    migration.push({ type: item.type, item, summary: firstParagraph(item.body) })
  }
  migration.sort((a, b) => rank(a.type) - rank(b.type))
  if (migration.length) {
    lines.push('## 升级前请先读')
    lines.push('')
    for (const { type, item, summary } of migration) {
      const pkgs = [...new Set(item.packages)].join('、')
      lines.push(`- **${ORDER_LABEL[type]}**（${pkgs}）：${summary.replace(/^\*\*|\*\*$/g, '')}`)
    }
    lines.push('')
    lines.push('> 完整迁移代码见下方对应条目。')
    lines.push('')
  }

  lines.push('## 最近一次发布')
  lines.push('')
  lines.push('> 每个包只取 CHANGELOG 的最新一段；同一个 changeset 打在多个包上时合并为一条。')
  lines.push('')
  let printed = 0
  for (const type of ORDER) {
    const items = [...merged.values()].filter((item) => item.type === type)
    if (!items.length) continue
    lines.push(`### ${ORDER_LABEL[type]}`)
    lines.push('')
    for (const { body, packages } of items) {
      const pkgs = [...new Set(packages)].join(' / ')
      lines.push(`- ${body[0]}`)
      for (const line of body.slice(1)) lines.push(line)
      lines.push('')
      lines.push(`  <sub>影响：${pkgs}</sub>`)
      lines.push('')
      printed++
    }
  }
  if (!printed) {
    lines.push('（本版没有对外可见的变更）')
    lines.push('')
  }

  lines.push('## 更早的版本')
  lines.push('')
  lines.push('按包查看完整历史：')
  lines.push('')
  for (const row of rows) {
    lines.push(`- \`${row.name}\`：[CHANGELOG](https://github.com/liujiaao/es-plus/blob/master/packages/${row.name.split('/').pop()}/CHANGELOG.md)`)
  }
  lines.push('')

  return lines.join('\n')
}

function main() {
  const content = build()
  const CHECK = process.argv.includes('--check')
  if (CHECK) {
    if (!existsSync(TARGET)) {
      console.error('❌ 站点更新日志缺失（运行 npm run changelog:gen）')
      process.exit(1)
    }
    if (!sameText(readText(TARGET), content)) {
      console.error(
        '❌ es-plus-docs/src/docs/changelog.md 与各包 CHANGELOG 不一致 —— ' +
          '版本发布后请运行 `npm run changelog:gen`（不要手改站点这一份）',
      )
      process.exit(1)
    }
    console.log('✅ 站点更新日志与各包 CHANGELOG / package.json 一致')
    return
  }
  writeFileSync(TARGET, content)
  console.log(`✅ 已生成 ${TARGET.replace(ROOT + '\\', '').replace(ROOT + '/', '').replace(/\\/g, '/')}`)
}

// main-guard：被守卫脚本 import 时不得覆写产物（gen-one-config-diff.mjs 踩过这个坑）
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
