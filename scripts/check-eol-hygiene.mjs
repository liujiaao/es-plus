#!/usr/bin/env node
/**
 * 守卫：全仓行尾不做「二次转换」。
 *
 * 背景：这个仓里 Windows（CRLF）+ Linux/CI（LF）+ 若干生成器（自己拼 \n）长期混跑，
 * `\r\r\n` 已经真实出现过好几次 —— 一次是生成器在已转 CRLF 的文本上再做一次
 * `replace(/\n/g, '\r\n')`，一次是手工编辑把 CRLF 文件按 LF 写回又加回一层。
 * 这种行在编辑器里看不出来，但会让 diff 整文件变红、让「纯文本」的产物哈希对不上。
 *
 * 判据（只判行尾，不管 CRLF 还是 LF —— 两种都合法）：
 *   · `\r\r\n`：一行前面多了一个 CR；
 *   · 孤立的 `\r`（后面不是 `\n`）：老 Mac 行尾，混进来同样会破坏逐行处理。
 *
 * 不扫的：`.git` 与 `node_modules`（git ls-files 本来就不含）、二进制文件
 * （内容里有 NUL 字节即跳过：图片/字体/压缩产物）。
 *
 * 用法：node scripts/check-eol-hygiene.mjs
 * 退出码：0 = 干净；1 = 有坏行尾
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** 这些后缀一定是二进制，读成 utf8 没有意义 */
const BINARY_EXT = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'avif',
  'woff', 'woff2', 'ttf', 'eot', 'otf',
  'zip', 'gz', 'tgz', 'br', 'pdf', 'mp4', 'webm', 'wasm',
])

function trackedFiles() {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 })
  return out.toString('utf8').split('\0').filter(Boolean)
}

function main() {
  let files
  try {
    files = trackedFiles()
  } catch (e) {
    console.error(`❌ 取不到 git 文件清单（${e.message}）—— 守卫拒绝空跑`)
    process.exit(1)
  }
  if (files.length < 100) {
    console.error(`❌ git ls-files 只返回 ${files.length} 个文件 —— 目录不对或仓库坏了，守卫拒绝空跑`)
    process.exit(1)
  }

  const problems = []
  let scanned = 0
  for (const rel of files) {
    const ext = rel.includes('.') ? rel.slice(rel.lastIndexOf('.') + 1).toLowerCase() : ''
    if (BINARY_EXT.has(ext)) continue
    let buf
    try {
      buf = readFileSync(join(ROOT, rel))
    } catch {
      continue // 已删除但还在索引里：不归本守卫管
    }
    if (buf.includes(0)) continue // 二进制
    const text = buf.toString('utf8')
    scanned++

    const doubleCr = text.indexOf('\r\r\n')
    if (doubleCr !== -1) {
      const line = text.slice(0, doubleCr).split('\n').length
      problems.push({ rel, kind: '\\r\\r\\n', line, snippet: snippetAt(text, doubleCr) })
      continue
    }
    const loneCr = /(^|[^\r])\r(?!\n)/.exec(text)
    if (loneCr) {
      const at = loneCr.index + loneCr[1].length
      problems.push({ rel, kind: '孤立 \\r', line: text.slice(0, at).split('\n').length, snippet: snippetAt(text, at) })
    }
  }

  if (problems.length) {
    console.error(`❌ ${problems.length} 个文件的行尾被二次转换过：`)
    for (const p of problems) console.error(`   ${p.rel}:${p.line}  含 ${p.kind}   …${p.snippet}…`)
    console.error(
      '\nCRLF 与 LF 都合法，但 `\\r\\r\\n` 与孤立 `\\r` 是坏行尾：它们会让整文件 diff 变红，\n' +
        '也会让生成物哈希对不上。生成器归一化时先 toLF，再按目标行尾一次性转换。',
    )
    process.exit(1)
  }

  console.log(`✅ 全仓行尾干净（扫描 ${scanned} 个文本文件，均无 \\r\\r\\n / 孤立 \\r）`)
}

function snippetAt(text, at) {
  const start = Math.max(0, at - 20)
  return text.slice(start, at + 20).replace(/[\r\n]+/g, '⏎')
}

main()
