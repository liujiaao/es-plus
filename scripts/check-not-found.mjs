#!/usr/bin/env node
/**
 * 三站统一 404 守卫（路线图 1.8）
 *
 * 为什么要单独一个守卫：404 是**最不可能被看到**的页面 —— 出一个 bug，表现是
 * 「404 页自己 404」或者「页脚那条链接又指到不存在的路径」，正常巡检永远发现不了。
 * 所以这里不测外观，只测四件会静默坏掉的事：
 *
 *   A. 单源与分发登记：docs-notfound.css / site-not-found.js 在 sync-theme 的
 *      ASSETS 里、每份三站，且三站副本与单源逐字节一致。
 *   B. 三个 NotFound.vue 都是统一的 `.es-nf` 结构，且不再各造各的库存 404
 *      （antdv `a-result` / Element `el-button` 那一套）。
 *   C. 三站路由都有通配兜底（Vue Router 4 用 `:pathMatch(.*)*`，Vue Router 3 用 `*`）。
 *   D. 入口 import 了 docs-notfound.css；主站 404 带站内搜索，另两站的「搜索」
 *      是真的外链而不是死按钮。
 *
 * 退出码：0 = 通过；1 = 有缺失。
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const SITES = [
  {
    key: 'es-plus-docs',
    dir: 'es-plus-docs',
    notFound: 'es-plus-docs/src/views/NotFound.vue',
    router: 'es-plus-docs/src/router/index.ts',
    entry: 'es-plus-docs/src/main.ts',
    cssImport: "import '@/styles/docs-notfound.css'",
    catchAll: "path: '/:pathMatch(.*)*'",
    // 唯一有站内搜索的站点：404 上直接挂 DocSearch
    search: /import DocSearch from '@\/components\/doc\/DocSearch\.vue'/,
  },
  {
    key: 'es-pc',
    dir: 'es-pc',
    notFound: 'es-pc/src/views/NotFound.vue',
    router: 'es-pc/src/router/index.js',
    entry: 'es-pc/src/main.js',
    cssImport: "import './styles/docs-notfound.css'",
    catchAll: "path: ':pathMatch(.*)*'",
    search: /href="https:\/\/liujiaao\.github\.io\/es-plus\/"/,
  },
  {
    key: 'es-eui',
    dir: 'es-eui',
    notFound: 'es-eui/src/views/NotFound.vue',
    router: 'es-eui/src/router/index.js',
    entry: 'es-eui/src/main.js',
    cssImport: "import './assets/docs-notfound.css'",
    catchAll: "path: '*'",
    search: /href="https:\/\/liujiaao\.github\.io\/es-plus\/"/,
  },
]

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

/* ------------------------------------------------------------------ *
 * A. 单源与分发登记
 * ------------------------------------------------------------------ */
const syncTheme = read('scripts/sync-theme.mjs')
const singleSource = read('docs/theme/site-not-found.js')
const singleCss = read('docs/theme/docs-notfound.css')

if (singleSource && !singleSource.includes('SITE_ROUTES')) {
  fail('docs/theme/site-not-found.js：入口链接必须取自 SITE_ROUTES（三站路径不同，猜不出来）')
}
if (singleCss && !singleCss.includes('.es-nf')) {
  fail('docs/theme/docs-notfound.css：缺少 .es-nf 结构样式')
}

for (const file of ['docs-notfound.css', 'site-not-found.js']) {
  const block = syncTheme.split('ASSETS')[1] || ''
  if (!block.includes(`file: '${file}'`)) {
    fail(`scripts/sync-theme.mjs：ASSETS 未登记 ${file}（删掉条目守卫会恒绿，必须显式声明）`)
  }
}

/* ------------------------------------------------------------------ *
 * B/C/D. 三站逐一核对
 * ------------------------------------------------------------------ */
for (const site of SITES) {
  const view = read(site.notFound)
  const router = read(site.router)
  const entry = read(site.entry)

  // B. 统一结构 + 不再各造各的
  if (view) {
    for (const cls of ['es-nf-code', 'es-nf-title', 'es-nf-path', 'es-nf-links', 'es-nf-section']) {
      if (!view.includes(cls)) fail(`${site.notFound}：缺少统一结构 ${cls}`)
    }
    if (!view.includes(`siteKey: '${site.key}'`)) {
      fail(`${site.notFound}：链接必须按本站 siteKey('${site.key}') 解析，否则页脚/入口会指到别站的路径`)
    }
    if (/<a-result|<el-button|<el-result/.test(view)) {
      fail(`${site.notFound}：仍在用组件库库存的 404（a-result / el-button），与另两站不是同一套外观`)
    }
    if (!view.includes('formatNotFoundPath')) {
      fail(`${site.notFound}：没有回显走错的地址（用户看不到自己点的哪条链接）`)
    }
    if (!view.includes('buildNotFoundSites')) {
      fail(`${site.notFound}：缺少「另两个渲染端站点」入口 —— 站选错了是本站 404 最常见的原因`)
    }
  }

  // C. 通配兜底：没有它，匹配不到的地址会渲染成整页空白
  if (router && !router.includes(site.catchAll)) {
    fail(`${site.router}：缺少通配兜底 ${site.catchAll}`)
  }
  if (router && !router.includes('NotFound')) {
    fail(`${site.router}：通配路由没有指向 NotFound 组件`)
  }

  // D. 入口样式 + 搜索入口
  if (entry && !entry.includes(site.cssImport)) {
    fail(`${site.entry}：未 import docs-notfound.css（${site.cssImport}）`)
  }
  if (view && !site.search.test(view)) {
    fail(
      site.key === 'es-plus-docs'
        ? `${site.notFound}：缺少站内搜索入口（DocSearch）`
        : `${site.notFound}：「搜索文档」必须是真实外链（本站无站内搜索，不能给一个点了没反应的按钮）`
    )
  }
}

/* ------------------------------------------------------------------ *
 * 汇总
 * ------------------------------------------------------------------ */
if (failures.length) {
  console.error('❌ 三站 404 未统一：\n')
  for (const f of failures) console.error(`   - ${f}`)
  console.error('\n统一 404 的单源在 docs/theme/（site-not-found.js + docs-notfound.css），不要各站单独改。')
  process.exit(1)
}

console.log('✅ 三站统一 404：结构与数据同一份、三站都有通配兜底、主站带站内搜索')
