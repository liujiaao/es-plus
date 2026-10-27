#!/usr/bin/env node
/**
 * 组件 API 模板守卫（路线图 2.4 · T3 Reference）
 *
 * T3 给组件页定了六件必须长出来的东西：状态徽章 + since、实时示例、Props/Events/Slots/Expose、
 * 主题变量、可访问性、相关组件。这六件里有一半是**最容易被写成漂亮空话**的：
 *
 *   · 「Stable」可以手填，填完就过期 → 这里要求徽章由三端 since 反推（模板里不许出现写死的徽章类名）；
 *   · 「支持主题定制」可以瞎写 → 这里把主题变量表里的每个变量 grep 回组件源码，查不到就红；
 *   · 「已做可访问性」可以瞎写 → 每一条都必须带证据文件 + 该文件里真的出现的片段（absent 断言真的不存在）。
 *
 * 还有一个更隐蔽的退化：某张 API 表「没有」时整节静默消失 —— 读者看到的是「文档没写」而不是
 * 「没有」。所以 Props / Events / Slots / Expose 四张表要么有数据，要么在 notes 里交代原因。
 *
 * 校验项：
 *   A. 每个组件页都有 since（三端版本号或空串）+ reviewed（日期，不能是未来）；
 *   B. 状态徽章是反推的（模板里没有写死的 is-stable/is-beta），三端版本都渲染在页面上；
 *   C. 主题变量表里的每个变量都能在 packages/vue3/src/components/<key>/** 里 grep 到；
 *      没有自有变量的组件必须老实写继承关系（note 非空）；
 *   D. 可访问性每条都有证据：文件存在 + contains 真的出现 + absent 真的不出现；
 *   E. 四张 API 表要么有数据、要么 notes 里写了为什么没有；
 *   F. 相关组件指向的页面存在、不指向自己、why 非空；
 *   G. 页面真的渲染了这六块（徽章 / since / Since 列 / 主题 / 可访问性 / 相关组件），
 *      实时示例带复制与沙箱；
 *   H. 扫描面：组件页 ≥ 5，否则「0 处问题」是假绿。
 *
 * 用法：node scripts/check-component-api.mjs
 * 退出码：0 = 通过；1 = 有缺失。
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const DATA = 'es-plus-docs/src/views/component-doc.data.ts'
const PAGE = 'es-plus-docs/src/views/ComponentDoc.vue'
const PLAYGROUND = 'es-plus-docs/src/components/doc/CodePlayground.vue'
const LOCALES = ['es-plus-docs/src/locales/zh-CN.json', 'es-plus-docs/src/locales/en-US.json']
const COMPONENT_SRC = 'packages/vue3/src/components'

const failures = []
const fail = (msg) => failures.push(msg)

function read(rel) {
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) {
    fail(`${rel}：文件不存在`)
    return ''
  }
  return readFileSync(abs, 'utf8').replace(/\r\n/g, '\n')
}

/** 从 open 处的 { 或 [ 起，配对到闭合位置（返回含两端的内容） */
function sliceBalanced(source, open) {
  const openCh = source[open]
  const closeCh = openCh === '{' ? '}' : ']'
  let depth = 0
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === openCh) depth += 1
    else if (source[i] === closeCh) {
      depth -= 1
      if (depth === 0) return source.slice(open, i + 1)
    }
  }
  return ''
}

/** 取 `key: {` / `key: [` 之后配对的整段（键名后允许任意空白） */
function fieldBlock(source, key, bracket = '{') {
  const re = new RegExp(`\\b${key}:\\s*\\${bracket}`)
  const m = re.exec(source)
  if (!m) return ''
  return sliceBalanced(source, m.index + m[0].length - 1)
}

/** 组件源码里出现过某个 CSS 变量？（递归扫 <key>/**） */
function sourceUses(dir, token) {
  const out = []
  const walk = (d) => {
    for (const entry of readdirSync(d)) {
      const abs = join(d, entry)
      if (statSync(abs).isDirectory()) walk(abs)
      else if (/\.(vue|ts|scss|css)$/.test(entry)) out.push(readFileSync(abs, 'utf8'))
    }
  }
  walk(join(ROOT, COMPONENT_SRC, dir))
  return out.some((text) => text.includes(token))
}

/* ------------------------------------------------------------------ *
 * 解析组件页数据
 * ------------------------------------------------------------------ */
const data = read(DATA)
const docsStart = data.indexOf('export const docsData')
const body = docsStart >= 0 ? data.slice(docsStart) : ''
const keys = [...body.matchAll(/^ {2}'([a-z][a-z0-9-]*)': \{$/gm)].map((m) => m[1])

const docs = new Map()
keys.forEach((key, i) => {
  const start = body.indexOf(`  '${key}': {`)
  const end = i + 1 < keys.length ? body.indexOf(`  '${keys[i + 1]}': {`) : body.length
  docs.set(key, body.slice(start, end))
})

if (docs.size < 5) {
  fail(`${DATA}：只解析出 ${docs.size} 个组件页（预期 ≥ 5）—— 解析失败不能当成「全部通过」`)
}

// 用**本地**日期，不用 toISOString()：UTC+8 的凌晨在 UTC 里还是前一天，
// 「核对于今天」会被误判成未来日期（本守卫自己踩过一次）
const now = new Date()
const TODAY = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
const SEMVER = /^\d+\.\d+\.\d+$/
const TARGETS = ['vue3', 'vue2', 'antdv']
const API_TABLES = ['props', 'events', 'slots', 'methods']

for (const [key, block] of docs) {
  const where = `${key}`

  /* A. since + reviewed ------------------------------------------------ */
  const since = fieldBlock(block, 'since', '{')
  if (!since) {
    fail(`${where}：缺少 since —— T3 要求 H1 标 since 版本，状态徽章也从它反推`)
  } else {
    for (const tg of TARGETS) {
      const m = new RegExp(`\\b${tg}:\\s*'([^']*)'`).exec(since)
      if (!m) {
        fail(`${where}：since 缺 ${tg} —— 三端各写一次（确无发布写空串），不能漏端`)
        continue
      }
      if (m[1] && !SEMVER.test(m[1])) fail(`${where}：since.${tg} = '${m[1]}' 不是 x.y.z`)
    }
  }

  const reviewed = /\breviewed:\s*'([^']*)'/.exec(block)
  if (!reviewed) fail(`${where}：缺少 reviewed —— 手写 API 表必须带最后核对日期（T3）`)
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewed[1])) fail(`${where}：reviewed = '${reviewed[1]}' 不是 YYYY-MM-DD`)
  else if (reviewed[1] > TODAY) fail(`${where}：reviewed = ${reviewed[1]} 在未来（今天是 ${TODAY}）`)

  /* C. theme ----------------------------------------------------------- */
  const theme = fieldBlock(block, 'theme', '{')
  if (!theme) {
    fail(`${where}：缺少 theme —— T3 要求主题变量表；没有自有变量也要写清楚继承关系`)
  } else {
    const note = /\bnote:\s*'([^']*)'/.exec(theme)
    if (!note || note[1].trim().length < 20) {
      fail(`${where}：theme.note 缺失或过短 —— 主题段必须说清楚「变量从哪来」`)
    }
    const vars = fieldBlock(theme, 'vars', '[')
    const names = [...vars.matchAll(/\bname:\s*'(--[a-z0-9-]+)'/g)].map((m) => m[1])
    for (const m of vars.matchAll(/\bname:\s*'([^']*)'/g)) {
      if (!/^--[a-z0-9-]+$/.test(m[1])) fail(`${where}：主题变量名 '${m[1]}' 不是 --kebab-case`)
    }
    for (const name of names) {
      if (!sourceUses(key, name)) {
        fail(`${where}：主题变量 ${name} 在 ${COMPONENT_SRC}/${key}/** 里找不到 —— 变量表不许写没在用的变量`)
      }
    }
    // 变量表为空时必须**声明原因**：inherit（继承自谁）或 fixedColors（颜色写死了，
    // 需要宿主自己覆盖）。两者都没有，读者会以为「主题支持没做」而不是「没有变量」。
    if (!names.length && !/\binherit:/.test(theme) && !/\bfixedColors:\s*true/.test(theme)) {
      fail(`${where}：主题变量表为空时必须写明 inherit 或 fixedColors: true —— 说明为什么没有变量表`)
    }
  }

  /* D. a11y ------------------------------------------------------------ */
  const a11y = fieldBlock(block, 'a11y', '[')
  if (!a11y) {
    fail(`${where}：缺少 a11y —— T3 要求可访问性说明`)
  } else {
    const items = [
      ...a11y.matchAll(
        /\{\s*text:\s*'([^']*)',\s*evidence:\s*\{\s*file:\s*'([^']*)',\s*contains:\s*'([^']*)'\s*\}(?:\s*,\s*absent:\s*\{\s*file:\s*'([^']*)',\s*contains:\s*'([^']*)'\s*\})?\s*\}/g
      )
    ]
    if (items.length < 2) {
      fail(`${where}：a11y 只解析到 ${items.length} 条（预期 ≥ 2，且必须是 text + evidence 结构）`)
    }
    for (const [, text, file, contains, absentFile, absentContains] of items) {
      const evidence = read(file)
      if (!evidence) continue // read() 已报错
      if (!evidence.includes(contains)) {
        fail(`${where}：可访问性证据失效 ——「${text.slice(0, 30)}…」说 ${file} 里有 ` + `「${contains}」，实际没有`)
      }
      if (absentFile) {
        const absentSrc = read(absentFile)
        if (absentSrc && absentSrc.includes(absentContains)) {
          fail(`${where}：可访问性边界不成立 ——「${text.slice(0, 30)}…」说没有「${absentContains}」，实际有`)
        }
      }
    }
  }

  /* E. 四张 API 表 ------------------------------------------------------ */
  const notes = fieldBlock(block, 'notes', '{')
  for (const table of API_TABLES) {
    const has = new RegExp(`\\b${table}:\\s*\\[`).test(block)
    const empty = new RegExp(`\\b${table}:\\s*\\[\\s*\\]`).test(block)
    if (has && !empty) continue
    if (!new RegExp(`\\b${table}:\\s*'`).test(notes)) {
      fail(
        `${where}：${table} 表${empty ? '是空的' : '不存在'}，但 notes 里没交代为什么 —— 整节静默消失会被读成「文档没写」`
      )
    }
  }

  /* F. related --------------------------------------------------------- */
  const related = fieldBlock(block, 'related', '[')
  if (!related) {
    fail(`${where}：缺少 related —— T3 要求「相关组件」`)
  } else {
    const links = [...related.matchAll(/\{\s*key:\s*'([^']*)',\s*why:\s*'([^']*)'\s*\}/g)]
    if (!links.length) fail(`${where}：related 解析到 0 条（预期 ≥ 1，结构必须是 { key, why }）`)
    for (const [, target, why] of links) {
      if (target === key) fail(`${where}：related 指向自己`)
      if (!docs.has(target)) fail(`${where}：related 指向不存在的组件页 '${target}'`)
      if (!why.trim()) fail(`${where}：related.${target} 没有 why —— 只说「相关」等于没说`)
    }
  }
}

/* ------------------------------------------------------------------ *
 * G. 页面真的渲染了这六块
 * ------------------------------------------------------------------ */
const page = read(PAGE)
if (page) {
  const need = [
    ['状态徽章', /class="component-badge"/],
    ['徽章由 since 反推', /'is-' \+ status\.kind/],
    ['三端 since 渲染', /v-for="tg in TARGETS"/],
    ['核对日期', /component-reviewed/],
    ['Since 列', /label="Since"/],
    ['缺表落点', /missingApiKeys/],
    ['主题变量段', /id="theme"/],
    ['可访问性段', /id="a11y"/],
    ['相关组件段', /id="related"/],
    ['Expose 表名', /methods: 'Expose/]
  ]
  for (const [label, re] of need) {
    if (!re.test(page)) fail(`${PAGE}：模板里缺「${label}」（${re}）`)
  }
  // 反推的对立面：写死的徽章类名
  if (/class="component-badge is-/.test(page)) {
    fail(`${PAGE}：徽章类名写死了 —— Stable/Beta 必须由三端 since 反推，手填的状态会过期`)
  }
  for (const tg of ['vue3', 'vue2', 'antdv']) {
    if (!new RegExp(`key: '${tg}'`).test(page)) fail(`${PAGE}：TARGETS 缺 ${tg}`)
  }
}

const playground = read(PLAYGROUND)
if (playground) {
  if (!/copyCode|copyToClipboard/.test(playground)) fail(`${PLAYGROUND}：实时示例缺复制（T3：预览 / 代码 / 复制 / 沙箱）`)
  if (!/openInCodeSandbox|sandbox/i.test(playground)) fail(`${PLAYGROUND}：实时示例缺沙箱`)
  if (!/preview/.test(playground)) fail(`${PLAYGROUND}：实时示例缺预览区`)
}

/* ------------------------------------------------------------------ *
 * H. 文案：页面用到的新 key 在两种语言里都在
 * ------------------------------------------------------------------ */
const usedKeys = new Set()
if (page) {
  // 拼接出来的 key（'componentDoc.status.' + status.kind）不以点结尾，正好被过滤掉；
  // 三种状态单独补，它们是三选一，静态扫描看不到
  for (const m of page.matchAll(/'(componentDoc\.[A-Za-z0-9.]+)'/g)) {
    if (!m[1].endsWith('.')) usedKeys.add(m[1])
  }
}
for (const kind of ['stable', 'beta', 'legacy']) usedKeys.add(`componentDoc.status.${kind}`)

for (const rel of LOCALES) {
  const raw = read(rel)
  if (!raw) continue
  let json
  try {
    json = JSON.parse(raw)
  } catch (error) {
    fail(`${rel}：JSON 解析失败（${error.message}）`)
    continue
  }
  for (const key of usedKeys) {
    const path = key.split('.')
    let node = json
    for (const seg of path) node = node && node[seg]
    if (typeof node !== 'string') fail(`${rel}：缺少文案 ${key}`)
  }
}

/* ------------------------------------------------------------------ *
 * 汇总
 * ------------------------------------------------------------------ */
if (failures.length) {
  console.error('❌ 组件 API 页不符合路线图 2.4 / T3 Reference：\n')
  for (const f of failures) console.error(`   - ${f}`)
  console.error('\n组件页的每一句结论都要能被复核：since 有发布版本、主题变量在源码里、可访问性有证据文件。')
  process.exit(1)
}

console.log(
  `✅ 组件 API 模板：${docs.size} 个组件页（状态徽章反推 · since 三端 · 主题变量回查源码 · a11y 带证据 · 四表齐全 · 相关组件）`
)
