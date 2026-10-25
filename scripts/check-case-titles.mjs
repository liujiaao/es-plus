#!/usr/bin/env node
/**
 * 守卫：案例标题「说清了什么」里**可判定**的那一半。
 *
 * §8 的原判据是「每条标题能在 12 字内说清它证明什么」—— 这是一条**人工**标准：
 * 204 条标题里 174 条 ≤ 12 字，超长的都因为含英文标识符（`rules` / `validator` /
 * `proxyConfig` / `render` / `vxeConfig`），按字面裁到 12 字会丢掉「手段」，反而更说不清。
 * 所以本守卫只判三件不需要品味的事：
 *
 *   1. 非空且不是占位词（`示例` / `Demo` / `基础用法` …）—— 占位标题等于没写；
 *   2. 同一页/同一组内不重名 —— 重名会让侧栏与 demo 锚点指向同一个东西；
 *   3. 把「超过 12 字」的条数**打印出来**（不失败）：数字要在，评审时有据可依。
 *
 * 覆盖四处标题台账：docs 组件页 / docs 进阶页 / eui 示例目录 / cases.json 旗舰卡。
 * es-pc 的标题散落在各页 `<h3 id>` 与 alert 文案里（没有台账），不在本守卫范围。
 *
 * 用法：node scripts/check-case-titles.mjs
 * 退出码：0 = 通过；1 = 有空标题 / 占位标题 / 同组重名 / 台账解析不出来
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** 只写通用词的标题：放在任何案例上都等于没写 */
const PLACEHOLDERS = new Set(['示例', '示例1', '示例 1', 'demo', 'Demo', 'DEMO', '用法', '基础用法', '高级用法', '未命名', 'TODO', 'test', 'Test'])

const LONG_LIMIT = 12

/** 从数组字面量里取 `title: '…'`（先做括号匹配，再在片段里抓） */
function arrayTitles(src, openIdx) {
  let depth = 0
  let i = openIdx
  for (; i < src.length; i++) {
    const c = src[i]
    if (c === '[') depth++
    else if (c === ']') {
      depth--
      if (!depth) break
    }
  }
  return [...src.slice(openIdx, i + 1).matchAll(/title:\s*'([^']*)'/g)].map((m) => m[1])
}

/** docs 的两份 data.ts：按顶层 `'page-key': {` 切页，取每页 examples 数组里的标题 */
function docsPageTitles(file) {
  if (!existsSync(file)) return null
  const src = readFileSync(join(ROOT, file), 'utf8')
  const pages = [...src.matchAll(/^\s*'([a-z0-9-]+)':\s*\{/gm)]
  if (!pages.length) return null
  const out = []
  pages.forEach((p, idx) => {
    const end = idx + 1 < pages.length ? pages[idx + 1].index : src.length
    const seg = src.slice(p.index, end)
    const at = seg.indexOf('examples: [')
    if (at === -1) return
    out.push({ group: `${file}#${p[1]}`, titles: arrayTitles(seg, seg.indexOf('[', at)) })
  })
  return out
}

/** eui 的示例目录：按 `export const xxxExamples = [` 分组 */
function euiExampleTitles(file) {
  if (!existsSync(file)) return null
  const src = readFileSync(join(ROOT, file), 'utf8')
  const decls = [...src.matchAll(/^export const (\w+)\s*=\s*\[/gm)]
  if (!decls.length) return null
  return decls.map((d) => ({
    group: `${file}#${d[1]}`,
    titles: arrayTitles(src, src.indexOf('[', d.index)),
  }))
}

function casesJsonTitles(file) {
  if (!existsSync(join(ROOT, file))) return null
  const data = JSON.parse(readFileSync(join(ROOT, file), 'utf8'))
  if (!Array.isArray(data.levels)) return null
  return data.levels.map((level) => ({
    group: `${file}#${level.id}`,
    titles: (level.cases || []).map((c) => c.title),
  }))
}

function main() {
  const sources = [
    ...(docsPageTitles('es-plus-docs/src/views/component-doc.data.ts') || []),
    ...(docsPageTitles('es-plus-docs/src/views/advanced-doc.data.ts') || []),
    ...(euiExampleTitles('es-eui/src/examples/index.js') || []),
    ...(casesJsonTitles('docs/cases/cases.json') || []),
  ]

  const groups = sources.filter((s) => s.titles.length)
  const total = groups.reduce((n, g) => n + g.titles.length, 0)
  // 反空集：这四处台账加起来有 200 条上下，解析失效时不能悄悄通过
  if (total < 150) {
    console.error(`❌ 只解析出 ${total} 条标题（应 ≥ 150）—— 台账结构变了就同步本脚本，别让它空着绿`)
    process.exit(1)
  }

  const problems = []
  for (const { group, titles } of groups) {
    const seen = new Map()
    titles.forEach((t, i) => {
      const len = [...t].length
      if (!len) problems.push(`${group} 第 ${i + 1} 条：标题为空`)
      else if (PLACEHOLDERS.has(t.trim())) problems.push(`${group} 第 ${i + 1} 条：「${t}」是占位词，没说清证明什么`)
      if (seen.has(t)) problems.push(`${group}：「${t}」重名（第 ${seen.get(t)} 与第 ${i + 1} 条）—— 侧栏与 demo 锚点会指向同一个`)
      else seen.set(t, i + 1)
    })
  }

  if (problems.length) {
    console.error(`❌ 案例标题有 ${problems.length} 处问题：`)
    for (const p of problems) console.error(`   ${p}`)
    console.error('\n标题要能一眼看出「这条证明了什么能力」；同页重名会让锚点与侧栏分不清。')
    process.exit(1)
  }

  const long = groups.flatMap((g) => g.titles).filter((t) => [...t].length > LONG_LIMIT)
  console.log(
    `✅ 案例标题 ${total} 条（${groups.length} 组）：无空标题 / 占位标题 / 同组重名；` +
      `超过 ${LONG_LIMIT} 字 ${long.length} 条（含英文标识符，人工评审项，不设门槛）`,
  )
}

main()
