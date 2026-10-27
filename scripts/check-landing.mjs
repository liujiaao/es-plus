#!/usr/bin/env node
/**
 * Landing 首屏守卫（路线图 2.1 + 2.3）
 *
 * 首屏是最容易被「优化」掉的一段代码：换文案、加第三个按钮、把演示换成一张截图 ——
 * 每次都看着更热闹，而路线图里那两条验收口径是**反过来**的：
 *
 *   2.1 首屏 = 价值 + 主 CTA + 产品实拍/可交互；1 屏内出现证据
 *   2.3 首屏「改 JSON → 三端变」组件：可改 3 个字段；三端预览同步；可重置；移动端可用
 *
 * 所以这里不查外观，只查会静默退化的四件事：
 *
 *   A. CTA 预算：首屏最多两个主按钮（主色 + 次色），其余是文字链接。
 *   B. 证据位：右侧挂的是可交互部件，不是静态代码窗口/截图。
 *   C. 部件的真实性：调的是真生成器（@es-plus/shared），三端都由它现算，
 *      三个输入 + 重置都在 —— 换成手写样例也能「看起来对」，只有断言能拦住。
 *   D. 文案齐全（三端名 + 三个字段 + 重置 + 脚注在两种语言里都存在），
 *      以及窄屏断点存在（移动端可用）。
 *
 * 退出码：0 = 通过；1 = 有缺失。
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const HOME = 'es-plus-docs/src/views/Home.vue'
const WIDGET = 'es-plus-docs/src/components/home/HeroTriRender.vue'
const LOCALES = ['es-plus-docs/src/locales/zh-CN.json', 'es-plus-docs/src/locales/en-US.json']

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

/** 取模板里从 `<div class="hero-section">` 起、到配对闭合标签的那一段。
 *  不做完整解析 —— 只需要知道「首屏里有什么」，用缩进配对足够稳。 */
function sliceHero(source) {
  const start = source.indexOf('<div class="hero-section">')
  if (start < 0) return ''
  let depth = 0
  const re = /<\/?div\b[^>]*>/g
  re.lastIndex = start
  let match
  while ((match = re.exec(source))) {
    depth += match[0].startsWith('</') ? -1 : 1
    if (depth === 0) return source.slice(start, match.index + match[0].length)
  }
  return source.slice(start)
}

const home = read(HOME)
const widget = read(WIDGET)
const hero = sliceHero(home)

/* ------------------------------------------------------------------ *
 * A. CTA 预算
 * ------------------------------------------------------------------ */
if (hero) {
  const buttons = hero.match(/<el-button\b/g) || []
  if (buttons.length > 2) {
    fail(`${HOME}：首屏有 ${buttons.length} 个 el-button —— 路线图 2.1 规定最多两个主 CTA，其余降级为文字链接`)
  }
  if (buttons.length < 2) {
    fail(`${HOME}：首屏只有 ${buttons.length} 个主 CTA（应为 2：主色 + 次色）`)
  }
  const links = hero.match(/class="hero-link"/g) || []
  if (!links.length) {
    fail(`${HOME}：首屏没有文字链接入口 —— 被砍掉的 CTA 应该降级为链接，而不是直接消失`)
  }
  if (!/href="https:\/\/github\.com\//.test(hero)) {
    fail(`${HOME}：首屏的 GitHub 入口必须是真实外链（跳转被写死成 router.push 时，中键/新标签全废）`)
  }
}

/* ------------------------------------------------------------------ *
 * B. 证据位：可交互部件，而不是静态代码窗口
 * ------------------------------------------------------------------ */
if (home) {
  if (!hero.includes('HeroTriRender')) {
    fail(`${HOME}：首屏没有 HeroTriRender —— 路线图 2.1 要求 1 屏内出现产品证据`)
  }
  if (!/import HeroTriRender from '@\/components\/home\/HeroTriRender\.vue'/.test(home)) {
    fail(`${HOME}：HeroTriRender 未 import（模板里有标签但组件没接上，Vue 会静默渲染成空）`)
  }
  for (const dead of ['code-window', 'hero-code']) {
    if (home.includes(dead)) {
      fail(`${HOME}：首屏仍在用静态代码窗口 ${dead} —— 证据必须是可交互的（2.3），一张写死的代码片段证明不了「三端」`)
    }
  }
  if (!hero.includes('<!-- 首屏证据')) {
    fail(`${HOME}：首屏证据位缺少说明注释 —— 下一次「优化」很容易把它当装饰删掉`)
  }
}

/* ------------------------------------------------------------------ *
 * C. 部件真实性
 * ------------------------------------------------------------------ */
if (widget) {
  if (!/import \{ generateFromConfig \} from '@es-plus\/shared'/.test(widget)) {
    fail(`${WIDGET}：必须 import { generateFromConfig } from '@es-plus/shared' —— 与 CLI / MCP 同一份实现，不是另写一个演示样例`)
  }
  if (!/target: tg\.key/.test(widget)) {
    fail(`${WIDGET}：三端产物必须由生成器逐个 target 现算（generateFromConfig({ ..., target: tg.key })）`)
  }
  if (!/mode: 'sfc'/.test(widget)) {
    fail(`${WIDGET}：演示配置必须是 mode:'sfc' —— schema 模式下三端产物逐字节相同，面板会「看着像没变」`)
  }
  for (const target of ['vue3', 'vue2', 'antdv']) {
    if (!widget.includes(`key: '${target}'`)) {
      fail(`${WIDGET}：缺少渲染端 ${target}（三端预览要同时在场）`)
    }
  }
  // 手写样例的指纹：出现这些字面量说明产物是贴上去的，不是算出来的
  for (const fake of ['ElMessageBox', 'import { useDialog', '<es-table']) {
    if (widget.includes(fake)) {
      fail(`${WIDGET}：出现手写产物片段「${fake}」—— 首屏的产物必须是生成器现算的，不能是贴的代码`)
    }
  }

  // 三个可编辑字段 + 重置：验收口径「可改 3 个字段」「可重置」
  const fields = widget.match(/\{ key: '(?:apiUrl|queryLabel|columnLabel)'/g) || []
  if (fields.length !== 3) {
    fail(`${WIDGET}：可编辑字段应为 3 个（实际 ${fields.length}）—— 多了首屏太碎，少了撑不起「一份配置」`)
  }
  if (!widget.includes('v-model="draft[f.key]"')) {
    fail(`${WIDGET}：编辑框未与配置绑定（v-model="draft[f.key]"）`)
  }
  if (!/@click="reset"/.test(widget) || !/const reset = /.test(widget)) {
    fail(`${WIDGET}：缺少重置控件（验收口径「可重置」）`)
  }
  if (!widget.includes(':disabled="!dirty"')) {
    fail(`${WIDGET}：重置按钮应在未改动时禁用，否则用户点了没反应，会以为坏了`)
  }

  // 移动端可用：两级断点都要在
  if (!/@media \(max-width: 992px\)/.test(widget)) {
    fail(`${WIDGET}：缺少 992px 断点 —— 双栏在窄屏必须塌成单栏，否则代码行无处可放`)
  }
  if (!/@media \(max-width: 560px\)/.test(widget)) {
    fail(`${WIDGET}：缺少 560px 断点 —— 三个输入框在手机上要竖排`)
  }
}

/* ------------------------------------------------------------------ *
 * D. 文案齐全（中英双语，缺一个 key 会渲染成裸 key）
 * ------------------------------------------------------------------ */
const used = new Set()
const reKey = /t\('home\.triRender\.([A-Za-z0-9]+)'\)/g
let m
while ((m = reKey.exec(widget))) used.add(m[1])

if (!used.size) fail(`${WIDGET}：没有引用 home.triRender.* 文案`)

const literals = ['tag', 'hint', 'reset', 'apiUrl', 'queryLabel', 'columnLabel', 'configTitle', 'targetsTitle', 'lines', 'onlyHere', 'foot']
for (const key of literals) used.add(key)

for (const rel of LOCALES) {
  let json
  try {
    json = JSON.parse(read(rel) || '{}')
  } catch (error) {
    fail(`${rel}：JSON 解析失败（${error.message}）`)
    continue
  }
  const block = json?.home?.triRender
  if (!block) {
    fail(`${rel}：缺少 home.triRender 文案块`)
    continue
  }
  for (const key of used) {
    if (!(key in block)) fail(`${rel}：缺少 home.triRender.${key}`)
  }
}

// 三端名是技术名词（不翻译），但必须与三站清单的称呼一致
for (const name of ['Vue 3 · Element Plus', 'Vue 2 · Element UI', 'Vue 3 · Ant Design Vue']) {
  if (!widget.includes(name)) fail(`${WIDGET}：渲染端称呼「${name}」与三站清单不一致`)
}

/* ------------------------------------------------------------------ *
 * 汇总
 * ------------------------------------------------------------------ */
if (failures.length) {
  console.error('❌ Landing 首屏不符合路线图 2.1 / 2.3：\n')
  for (const f of failures) console.error(`   - ${f}`)
  console.error('\n首屏证据 = 真跑一遍生成器（@es-plus/shared），不是截图、不是贴的代码。')
  process.exit(1)
}

console.log(
  `✅ Landing 首屏：两个主 CTA + 文字链接；证据位是 HeroTriRender（真生成器 · 三端现算 · ${used.size} 条文案齐备）`
)
