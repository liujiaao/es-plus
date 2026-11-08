#!/usr/bin/env node
/**
 * 顶栏搜索入口的三站齐备性（审计 P1-4）。
 *
 * 审计把「es-pc / es-eui 缺搜索」列为 P1，并且明确写了目标不是各做一套，
 * 而是**同一套 chrome**：主站有全量索引，另两站先用路由词表的站内检索。
 * 这一步最容易被下次「清理顶栏」顺手删掉 —— 它只是一个按钮，删了没有任何构建
 * 报错，只有读者发现搜不了。所以断言四件事：
 *
 *   1. 三站顶栏都真的有入口（主站 `.search-btn`，另两站 `DocSearch` 组件）；
 *   2. 另两站的词表来自**各自路由表**（`getRoutes()` / `$router.options.routes`），
 *      不是手写清单 —— 手写清单会随着新增页面静默过期；
 *   3. 两个组件的面板结构同名（`.es-search-panel` / `.es-search-item`），
 *      否则「同一套 chrome」在视觉上立刻分叉；
 *   4. 外观只在共享主题 `docs/theme/docs-chrome.css` 里出现一份，
 *      组件内不得再写 `<style>`（写进去就是第二套外观，且会绕过设计令牌守卫）。
 *
 * 只查静态结构：键盘行为（⌘K / ↑↓ / Enter / Esc）由浏览器腿覆盖，
 * 这里没有 dev server，不做运行时断言。
 *
 * 用法：node scripts/check-header-parity.mjs
 * 退出码：0 = 齐备；1 = 缺入口或接线漂移。
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const failures = []
const fail = (msg) => failures.push(msg)
const read = (rel) => {
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) {
    fail(`${rel}：文件不存在`)
    return ''
  }
  return readFileSync(abs, 'utf8').replace(/\r\n/g, '\n')
}

const MAIN_HEADER = 'es-plus-docs/src/components/layout/AppHeader.vue'
const PC_SEARCH = 'es-pc/src/components/doc/DocSearch.vue'
const PC_HEADER = 'es-pc/src/layouts/DocLayout.vue'
const EUI_SEARCH = 'es-eui/src/components/doc/DocSearch.vue'
const EUI_HEADER = 'es-eui/src/App.vue'
const SHARED_CSS = 'docs/theme/docs-chrome.css'

/* ── 1. 三站顶栏都有入口 ─────────────────────────────────────────── */
const main = read(MAIN_HEADER)
if (!/class="search-btn"/.test(main)) {
  fail(`${MAIN_HEADER}：顶栏没有 .search-btn —— 主站搜索入口被删掉了`)
}

for (const [header, label] of [
  [PC_HEADER, 'es-pc'],
  [EUI_HEADER, 'es-eui'],
]) {
  const src = read(header)
  if (!/<DocSearch\s*\/>/.test(src)) {
    fail(`${header}：顶栏没有渲染 <DocSearch /> —— ${label} 又回到「没有搜索」的状态`)
  }
  if (!/import DocSearch from '@\/components\/doc\/DocSearch\.vue'/.test(src)) {
    fail(`${header}：没有 import DocSearch（模板里有标签但组件没接上，Vue 会静默渲染成空）`)
  }
}

/* ── 2. 词表来自路由表，不是手写清单 ─────────────────────────────── */
const pc = read(PC_SEARCH)
const eui = read(EUI_SEARCH)

if (pc) {
  if (!/router\.getRoutes\(\)/.test(pc)) {
    fail(`${PC_SEARCH}：词表没有从 router.getRoutes() 取 —— 手写清单会随新增页面静默过期`)
  }
  if (!/meta[\s\S]{0,40}title/.test(pc)) {
    fail(`${PC_SEARCH}：没有读路由的 meta.title —— 搜索词表应直接来自路由表`)
  }
}
if (eui) {
  if (!/\$router\.options\.routes/.test(eui)) {
    fail(`${EUI_SEARCH}：词表没有从 $router.options.routes 取 —— 手写清单会随新增页面静默过期`)
  }
  if (!/meta\s*&&\s*r\.meta\.title|meta\.title/.test(eui)) {
    fail(`${EUI_SEARCH}：没有读路由的 meta.title —— 搜索词表应直接来自路由表`)
  }
}

/* ── 3. 面板结构与主站同构（两站必须共用同一组类名）──────────────── */
for (const [rel, src] of [
  [PC_SEARCH, pc],
  [EUI_SEARCH, eui],
]) {
  if (!src) continue
  for (const cls of ['es-search-trigger', 'es-search-overlay', 'es-search-panel', 'es-search-item', 'es-search-empty']) {
    if (!src.includes(cls)) fail(`${rel}：缺少共享类名 .${cls}（面板结构与另一站分叉了）`)
  }
  // 4. 外观只允许在共享主题里
  if (/<style[\s>]/.test(src)) {
    fail(`${rel}：出现了 <style> 块 —— 搜索外观必须只在 ${SHARED_CSS} 里维护一份`)
  }
}

const css = read(SHARED_CSS)
for (const cls of ['.es-search-trigger', '.es-search-overlay', '.es-search-panel', '.es-search-item', '.es-search-empty']) {
  if (css && !css.includes(cls)) fail(`${SHARED_CSS}：缺少 ${cls} —— 组件引用了共享外观，主题里却没有`)
}

if (failures.length) {
  console.error(`❌ 顶栏搜索入口不齐备（${failures.length} 项）：\n`)
  for (const f of failures) console.error(`   - ${f}`)
  console.error('\n口径见审计 P1-4：三站顶栏都要有搜索；另两站用路由词表，外观只维护共享主题一份。')
  process.exit(1)
}

console.log('✅ 顶栏搜索：三站都有入口；es-pc / es-eui 的词表来自各自路由表，面板外观只在共享主题维护一份')
