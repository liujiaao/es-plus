#!/usr/bin/env node
/**
 * 标题里不许有 emoji（路线图 2.7「无 emoji 标题」）
 *
 * 为什么值得一个守卫：21 个 emoji（🎯 核心案例 / ⚡ 30 秒上手 / 📋 环境准备 …）散在
 * 三站 14 个文件里，逐页看都觉得「有点可爱」，但它们同时意味着三件事——
 *   · 三站没有一套图标系统：同一件事（案例）主站用 🎯、AntDV 站用 🎯、Vue2 站也用 🎯，
 *     而组件页用的是 Element 图标 / ant 图标，两套并存；
 *   · 视觉权重失控：emoji 自带饱和色，标题层的强调色因此变成「每个 emoji 一个颜色」；
 *   · 复制与检索失真：侧栏、TOC、搜索都按标题文本建索引，🎯 会跟着进 URL/hash/搜索结果。
 *
 * 校验项：
 *   A. 三站 .vue 里的 <h1>–<h6>（跨行也算）不含 emoji；
 *   B. 三站 .md 的 # 标题不含 emoji（**跳过代码围栏** —— CLI 文档里示例输出中的
 *      ✅ / ❌ 是终端内容，不是标题）；
 *   C. md frontmatter 的 title / sidebarTitle / description 不含 emoji（它们会进
 *      页面 <title> 与侧栏）；
 *   D. 扫描本身没空转：每个站点至少扫到若干文件，否则「0 处问题」是假绿。
 *
 * 用法：node scripts/check-heading-emoji.mjs
 * 退出码：0 = 通过；1 = 有标题含 emoji。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

/** 表情符号范围：emoji 主体 + dingbats + 杂项符号 + 变体选择符 */
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u

const SITES = [
  { dir: 'es-plus-docs/src', minFiles: 60 },
  { dir: 'es-pc/src', minFiles: 30 },
  { dir: 'es-eui/src', minFiles: 40 },
]

const failures = []
const fail = (msg) => failures.push(msg)

function walk(dir, out) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry)
    if (statSync(abs).isDirectory()) {
      if (!/node_modules|[\\/]dist$/.test(abs)) walk(abs, out)
    } else if (/\.(vue|md)$/.test(entry)) {
      out.push(abs)
    }
  }
}

/** 把代码围栏里的内容换成空行：行号仍然对得上，但围栏内的 ✅ / ❌ 不会被当成标题 */
function stripFences(text) {
  let inside = false
  return text.split('\n').map((line) => {
    if (/^\s*```/.test(line)) {
      inside = !inside
      return ''
    }
    return inside ? '' : line
  })
}

for (const site of SITES) {
  const files = []
  try {
    walk(join(ROOT, site.dir), files)
  } catch {
    fail(`${site.dir}：目录不存在`)
    continue
  }

  if (files.length < site.minFiles) {
    fail(`${site.dir}：只扫到 ${files.length} 个文件（预期 ≥ ${site.minFiles}）—— 扫描面缩小会让这条守卫假绿`)
  }

  for (const abs of files) {
    const rel = relative(ROOT, abs).split('\\').join('/')
    const raw = readFileSync(abs, 'utf8').replace(/\r\n/g, '\n')

    if (abs.endsWith('.vue')) {
      // A. 跨行标题也覆盖：按 <hN> … </hN> 取内容
      const re = /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/g
      let m
      while ((m = re.exec(raw))) {
        const text = m[1].replace(/\s+/g, ' ').trim()
        if (EMOJI.test(text)) {
          const line = raw.slice(0, m.index).split('\n').length
          fail(`${rel}:${line}：标题含 emoji ——「${text.slice(0, 40)}」（路线图 2.7：无 emoji 标题）`)
        }
      }
      continue
    }

    // B/C. markdown：先屏蔽代码围栏，再看 # 标题与 frontmatter
    const lines = stripFences(raw)
    lines.forEach((line, i) => {
      if (/^\s{0,3}#{1,6}\s/.test(line) && EMOJI.test(line)) {
        fail(`${rel}:${i + 1}：markdown 标题含 emoji ——「${line.trim().slice(0, 40)}」`)
      }
      if (/^\s*(title|sidebarTitle|description)\s*:/.test(line) && EMOJI.test(line)) {
        fail(`${rel}:${i + 1}：frontmatter 含 emoji ——「${line.trim().slice(0, 40)}」`)
      }
    })
  }
}

if (failures.length) {
  console.error('❌ 标题里仍有 emoji：\n')
  for (const f of failures) console.error(`   - ${f}`)
  console.error('\n标题层用文字与字重建立层级；要图标就进图标系统（SvgIcon / el-icon / ant 图标），不要在文案里塞表情。')
  process.exit(1)
}

console.log('✅ 三站标题无 emoji（<h1>–<h6>、md 标题、frontmatter 三处都扫过，代码围栏已跳过）')
