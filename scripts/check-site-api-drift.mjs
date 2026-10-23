#!/usr/bin/env node
/**
 * 文档站 API 表 ↔ 组件源码 漂移守卫
 *
 * 背景：三端站点反复出现「文档教了一个源码里不存在的 API」——`height` /
 * `showDefaultButtons` / `setFormData` / `onClick` / `okType: 'warning'`……
 * 这类错误不报错、不红测试：读者照着抄，配置静默失效，排查成本落在使用者身上。
 * 靠人工复核对不齐，所以把「文档表的第一列必须是源码里真有的键」变成断言。
 *
 * 做法（确定性，不猜）：
 *   1. 从 vue2 组件源码解析三份键集：props（组件自身 props 块）、emits、expose；
 *   2. 从文档页解析三张表的第一列（Props / Events / Methods 区段下的表）；
 *   3. 断言两个方向：
 *      a. 文档里的键必须在源码键集中（否则 = 幻影 API，明确失败）；
 *      b. 源码里的键必须出现在文档中，或登记在 UNDOCUMENTED（附理由）——
 *         新增公开 API 却忘了写文档，同样失败（避免「文档只是越来越旧」）。
 *
 * 解析刻意保守：只认结构化写法（`props: {` / `emits: [` / `const exposed = {` /
 * `expose({`）。写法变了 → 直接失败并提示同步本脚本，而不是静默解析出空集
 * （空集恒绿是这类守卫最常见的失灵方式）。
 *
 * 用法：node scripts/check-site-api-drift.mjs
 * 退出码：0 = 文档与源码一致；1 = 存在幻影键或未登记的新键。
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

let failed = false
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}
const read = (p) => {
  const abs = join(ROOT, p)
  if (!existsSync(abs)) {
    fail(`文件缺失：${p}`)
    return null
  }
  return readFileSync(abs, 'utf-8')
}

// ─────────────────────────── 源码解析 ───────────────────────────

/** 从 `{` 或 `[` 开始做括号匹配，返回内部文本（不含外层括号） */
function blockAt(src, openIdx) {
  const open = src[openIdx]
  const close = open === '{' ? '}' : open === '[' ? ']' : '('
  let depth = 0
  let inStr = null
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i]
    if (inStr) {
      if (ch === '\\') i++
      else if (ch === inStr) inStr = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      inStr = ch
      continue
    }
    if (ch === '/' && src[i + 1] === '/') {
      // 行注释：跳到行尾
      const nl = src.indexOf('\n', i)
      i = nl < 0 ? src.length : nl
      continue
    }
    if (ch === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2)
      i = end < 0 ? src.length : end + 1
      continue
    }
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return src.slice(openIdx + 1, i)
    }
  }
  return null
}

/** 对象字面量的顶层键（支持 `key:` 与 shorthand `key,`） */
function topLevelKeys(body) {
  const keys = []
  let depth = 0
  let inStr = null
  let line = ''
  const flush = () => {
    const t = line.trim()
    if (t) {
      const m = /^([A-Za-z_$][\w$]*)\??\s*(?::|,|$)/.exec(t)
      if (m) keys.push(m[1])
      else if (/^'([^']+)'\s*:/.test(t)) keys.push(t.match(/^'([^']+)'/)[1])
    }
    line = ''
  }
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (inStr) {
      line += ch
      if (ch === '\\') {
        line += body[++i]
      } else if (ch === inStr) inStr = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      inStr = ch
      line += ch
      continue
    }
    if (ch === '{' || ch === '[' || ch === '(') depth++
    else if (ch === '}' || ch === ']' || ch === ')') depth--
    if (ch === ',' && depth === 0) {
      flush()
      continue
    }
    if (ch === '\n') {
      // 顶层换行 = 隐式分隔（如 shorthand 后无逗号的行）
      if (depth === 0) flush()
      line += ' '
      continue
    }
    line += ch
  }
  flush()
  return keys
}

/** 定位组件的 defineComponent 对象体（以 `name: 'X'` 为锚点） */
function componentBody(file, name) {
  const src = read(file)
  if (!src) return null
  const at = src.indexOf(`name: '${name}'`) >= 0 ? src.indexOf(`name: '${name}'`) : src.indexOf(`name: "${name}"`)
  if (at < 0) {
    fail(`${file} 中找不到组件名 "${name}"（用 name 锚定 props/emits 块，改名请同步本脚本）`)
    return null
  }
  const start = src.lastIndexOf('defineComponent(', at)
  if (start < 0) {
    fail(`${file} 中 "${name}" 之前没有 defineComponent(（写法变了请同步本脚本）`)
    return null
  }
  const brace = src.indexOf('{', start)
  const body = blockAt(src, brace)
  if (body === null) fail(`${file} 的 ${name} 组件对象括号不闭合`)
  return body
}

function sourceApi({ file, name, exposeAnchor }) {
  const body = componentBody(file, name)
  if (!body) return null

  const propsAt = body.indexOf('props: {')
  const props = propsAt >= 0 ? topLevelKeys(blockAt(body, body.indexOf('{', propsAt))) : []

  const emitsAt = body.indexOf('emits: [')
  const emits =
    emitsAt >= 0
      ? [...(blockAt(body, body.indexOf('[', emitsAt)) || '').matchAll(/'([^']+)'|"([^"]+)"/g)].map(
          (m) => m[1] || m[2],
        )
      : []

  let exposed = []
  if (exposeAnchor) {
    const at = body.indexOf(exposeAnchor)
    if (at < 0) fail(`${file} 中找不到 expose 锚点 ${exposeAnchor}（写法变了请同步本脚本）`)
    else exposed = topLevelKeys(blockAt(body, body.indexOf('{', at)))
  }

  for (const [kind, set] of Object.entries({ props, emits, exposed })) {
    // exposed 只在声明了锚点时才解析（EsDialog 的命令式实例不暴露 $refs 方法面）
    const required = kind === 'exposed' ? Boolean(exposeAnchor) : kind !== 'emits'
    if (required && set.length === 0) {
      fail(`${file} 的 ${name} 解析出空的 ${kind} 集合 —— 拒绝把「解析失败」当成「没有 API」`)
    }
  }
  return { props, emits, exposed }
}

// ─────────────────────────── 文档解析 ───────────────────────────

const stripTags = (s) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

/** 按 h2/h3 切块，返回 [{ title, body }] */
function headings(html) {
  const marks = []
  const re = /<h[23][^>]*>([\s\S]*?)<\/h[23]>/g
  let m
  while ((m = re.exec(html))) marks.push({ title: stripTags(m[1]), start: m.index, end: re.lastIndex })
  return marks.map((mark, i) => ({
    title: mark.title,
    body: html.slice(mark.end, i + 1 < marks.length ? marks[i + 1].start : html.length),
  }))
}

/** 取区段里第一张表的首列表头单元格（跳过表头行） */
function firstColumnCells(body) {
  const t = /<table[^>]*>([\s\S]*?)<\/table>/.exec(body)
  if (!t) return null
  const rows = [...t[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((tr) =>
    [...tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => stripTags(c[1])),
  )
  if (rows.length < 2) return null
  return rows.slice(1).flatMap((r) => splitKeys(r[0] || ''))
}

/**
 * 把一个首列单元格拆成若干 API 键：
 *   `key / prop` → [key, prop]；`edit / delete / view` → 三个；
 *   `refresh()` → refresh；`openDialog(key, row?)` → openDialog；
 *   说明性行（含「继承」/以 `{` 开头）→ 跳过。
 */
function splitKeys(cell) {
  const t = cell.replace(/`/g, '').trim()
  if (!t || t.includes('继承') || t.startsWith('{')) return []
  return t
    .split(/\s*[/、]\s*/)
    .flatMap((part) =>
      part
        .replace(/\([^)]*\)/g, '')
        .split(/\s*[,，]\s*/)
        .map((s) => s.trim())
        .filter(Boolean),
    )
}

/** 文档页配置：每个区段声明它校验哪个组件的哪种键集 */
const PAGES = [
  {
    file: 'es-eui/src/views/docs/EsTableDocs.vue',
    sections: [
      { title: 'Props', kind: 'props', component: 'EsTable' },
      { title: 'Methods', kind: 'exposed', component: 'EsTable' },
      { title: 'Events', kind: 'emits', component: 'EsTable' },
    ],
  },
  {
    file: 'es-eui/src/views/docs/EsFormDocs.vue',
    sections: [
      { title: 'Props', kind: 'props', component: 'EsForm' },
      { title: 'Methods', kind: 'exposed', component: 'EsForm' },
    ],
  },
  {
    file: 'es-eui/src/views/docs/EsDialogDocs.vue',
    sections: [
      {
        // 该页把「useDialog 调用参数」与「EsDialog 组件 props」合并在 Parameters 一张表里
        title: 'Parameters',
        kind: 'props',
        component: 'EsDialog',
        allow: { cacheKey: 'useDialog 调用参数，不是组件 prop' },
      },
      { title: 'Events', kind: 'emits', component: 'EsDialog' },
    ],
  },
  {
    file: 'es-eui/src/views/docs/EsCrudPageDocs.vue',
    sections: [
      { title: 'Props', kind: 'props', component: 'EsCrudPage' },
      { title: 'Events', kind: 'emits', component: 'EsCrudPage' },
      { title: '暴露方法 / 属性', kind: 'exposed', component: 'EsCrudPage' },
    ],
  },
  {
    // 开发者指南按编号分节，逐节声明
    file: 'es-eui/src/views/docs/EsEuiDeveloperGuide.vue',
    sections: [
      { title: '3.0 Props 速查表', kind: 'props', component: 'EsForm' },
      { title: '4.0 Props 速查表', kind: 'props', component: 'EsTable' },
      {
        title: '5.2 完整配置参数',
        kind: 'props',
        component: 'EsDialog',
        // 这张表混入了 useDialog 的调用参数与回调选项（onXxx → 事件订阅），不是组件 prop
        allow: {
          cacheKey: 'useDialog 调用参数',
          onOpen: 'useDialog 回调选项',
          onClosed: 'useDialog 回调选项',
        },
      },
    ],
  },
]

// ─────────────────────────── 组件清单与豁免 ───────────────────────────

const COMPONENTS = {
  EsTable: {
    file: 'packages/vue2/src/components/es-table/component.vue',
    name: 'EsTable',
    exposeAnchor: 'const exposed = {',
    undocumented: { props: [] },
  },
  EsForm: {
    file: 'packages/vue2/src/components/es-form/es-form.vue',
    name: 'EsForm',
    exposeAnchor: '.expose({',
    undocumented: { props: [] },
  },
  EsDialog: {
    file: 'packages/vue2/src/components/es-dialog/component.vue',
    name: 'EsDialog',
    undocumented: { props: ['passThroughAttrs'] },
  },
  EsCrudPage: {
    file: 'packages/vue2/src/components/es-crud-page/es-crud-page.vue',
    name: 'EsCrudPage',
    exposeAnchor: 'const exposed = {',
    undocumented: { props: [] },
  },
}

// ─────────────────────────── 校验 ───────────────────────────

const api = {}
for (const [key, cfg] of Object.entries(COMPONENTS)) {
  api[key] = sourceApi(cfg)
}

/** 文档键集：component → kind → Set */
const documented = {}
const addDoc = (component, kind, keys) => {
  documented[component] ??= { props: new Set(), emits: new Set(), exposed: new Set() }
  for (const k of keys) documented[component][kind].add(k)
}

let tableCount = 0
for (const page of PAGES) {
  const html = read(page.file)
  if (!html) continue
  const blocks = headings(html)
  for (const section of page.sections) {
    const block = blocks.find((b) => b.title === section.title)
    if (!block) {
      fail(`${page.file} 缺少「${section.title}」小节 —— 该组件的 ${section.kind} 需要在此成表`)
      continue
    }
    const cells = firstColumnCells(block.body)
    if (!cells) {
      fail(`${page.file} 的「${section.title}」小节下没有 API 表（或表为空）`)
      continue
    }
    tableCount++
    const componentApi = api[section.component]
    if (!componentApi) continue
    const allow = section.allow || {}
    for (const key of cells) {
      if (allow[key]) continue
      if (!componentApi[section.kind].includes(key)) {
        fail(
          `${page.file}「${section.title}」表里的 ${key} 在 ${section.component} 的 ${section.kind} 中不存在` +
            ` —— 读者照抄会静默失效（源码现有：${componentApi[section.kind].slice(0, 8).join(', ')}…）`,
        )
        continue
      }
      addDoc(section.component, section.kind, [key])
    }
  }
}

// 反向：源码有、文档没写，且未登记豁免 → 失败
for (const [component, cfg] of Object.entries(COMPONENTS)) {
  const componentApi = api[component]
  if (!componentApi) continue
  const doc = documented[component] || { props: new Set(), emits: new Set(), exposed: new Set() }
  for (const kind of ['props', 'emits', 'exposed']) {
    const waived = new Set(cfg.undocumented?.[kind] || [])
    for (const key of componentApi[kind]) {
      if (doc[kind].has(key) || waived.has(key)) continue
      fail(`${component} 的 ${kind}「${key}」在文档中未出现，也未登记豁免 —— 新 API 需要同步文档或显式豁免`)
    }
  }
}

// ─────────────────── 渲染端二：es-pc（@es-plus/adapter-antdv）───────────────────
//
// Vue 3 `<script setup>` 的声明写法与 vue2 完全不同，需要另一套解析：
//   props  → `defineProps<{ ... }>()` 的类型字面量
//   emits  → `defineEmits<{ 'x': [p: T] }>()`
//   expose → `defineExpose({ ... })`
// 文档侧也不是 HTML 表，而是 `<script setup>` 里喂给 `<a-table>` 的数组。
const ADAPTER_COMPONENTS = {
  // EsForm 不向外派发事件（查询/重置由按钮的 triggerEvent 在组件内部完成），因此没有 defineEmits
  EsForm: { file: 'packages/adapter-antdv/src/components/es-form/src/es-form.vue', noEmits: true },
  EsTable: { file: 'packages/adapter-antdv/src/components/es-table/src/component.vue' },
  EsDialog: { file: 'packages/adapter-antdv/src/components/es-dialog/src/component.vue' },
  EsCrudPage: { file: 'packages/adapter-antdv/src/components/es-crud-page/src/es-crud-page.vue' },
}

/** es-pc 页面里承载 API 的数组。`events` / `methods` 缺省表示该组件没有（不要求成表） */
const ADAPTER_PAGES = [
  { file: 'es-pc/src/views/EsForm.vue', component: 'EsForm', props: 'formProps', methods: 'formMethods' },
  { file: 'es-pc/src/views/EsTable.vue', component: 'EsTable', props: 'tableProps', events: 'tableEvents', methods: 'tableMethods' },
  { file: 'es-pc/src/views/EsDialog.vue', component: 'EsDialog', props: 'dialogProps', events: 'dialogEvents', methods: 'dialogMethods' },
  { file: 'es-pc/src/views/EsCrudPage.vue', component: 'EsCrudPage', props: 'crudProps', events: 'crudEvents', methods: 'crudMethods' },
]

/** 类型字面量的顶层键（`key: T` / `key?: T` / `'a:b': [..]`） */
function typeLiteralKeys(src, anchor) {
  const at = src.indexOf(anchor)
  if (at < 0) return null
  const body = blockAt(src, src.indexOf('{', at))
  return body === null ? null : topLevelKeys(body)
}

/** `const <name> = [ { prop: 'x' } ]` 里某个字段的取值 */
function docVarValues(src, varName, field) {
  const at = src.indexOf(`const ${varName} = [`)
  if (at < 0) return null
  const body = blockAt(src, src.indexOf('[', at))
  if (body === null) return null
  return [...body.matchAll(new RegExp(`\\b${field}:\\s*'([^']+)'`, 'g'))].map((m) => m[1])
}

const camelize = (s) => s.replace(/[-_](\w)/g, (_, c) => c.toUpperCase())

const adapterApi = {}
for (const [name, cfg] of Object.entries(ADAPTER_COMPONENTS)) {
  const src = read(cfg.file)
  if (!src) continue
  const props = typeLiteralKeys(src, 'defineProps<{')
  const emits = typeLiteralKeys(src, 'defineEmits<{')
  const exposed = typeLiteralKeys(src, 'defineExpose({')
  const parsed = { props, emits, exposed }
  for (const [kind, set] of Object.entries(parsed)) {
    if (set === null) {
      // 只有显式声明「本组件无事件」才允许缺 defineEmits；其余缺块一律按写法变化处理
      if (kind === 'emits' && cfg.noEmits && !/\.emit\(/.test(src)) continue
      fail(`${cfg.file} 中找不到 define${kind === 'props' ? 'Props' : kind === 'emits' ? 'Emits' : 'Expose'} 块 —— 写法变了请同步本脚本`)
    } else if (set.length === 0) {
      fail(`${cfg.file} 解析出空的 ${kind} 集合 —— 拒绝把「解析失败」当成「没有 API」`)
    }
  }
  adapterApi[name] = { props: props || [], emits: emits || [], exposed: exposed || [] }
}

for (const page of ADAPTER_PAGES) {
  const src = read(page.file)
  if (!src) continue
  const api = adapterApi[page.component]
  if (!api) continue

  const check = (kind, varName, sourceKeys, sourceLabel) => {
    if (!varName) return
    const values = docVarValues(src, varName, kind === 'events' ? 'event' : 'prop')
    if (!values || values.length === 0) {
      fail(`${page.file} 里找不到 ${varName} 数组（或为空）—— ${page.component} 的 ${sourceLabel} 需要在此成表`)
      return
    }
    for (const raw of values) {
      // `schema.formItems` 这类子键记在父键名下（父键必须是真实 prop）
      const key = kind === 'props' ? camelize(raw.split('.')[0]) : raw
      if (!sourceKeys.includes(key)) {
        fail(
          `${page.file} 的 ${varName} 里 ${raw} 在 ${page.component} 的 ${sourceLabel} 中不存在` +
            ` —— 读者照抄会静默失效（源码现有：${sourceKeys.slice(0, 8).join(', ')}…）`,
        )
      }
    }
    // 反向：source 有、文档没写
    const documented = new Set(values.map((v) => (kind === 'props' ? camelize(v.split('.')[0]) : v)))
    for (const key of sourceKeys) {
      if (!documented.has(key)) {
        fail(`${page.component}（es-pc）的 ${sourceLabel}「${key}」未出现在 ${page.file} 的 ${varName} 里`)
      }
    }
  }

  check('props', page.props, api.props, 'props')
  if (!page.events && api.emits.length > 0) {
    // 组件声明了事件却没有任何事件表：读者在 es-pc 站上查不到，等于没有
    fail(`${page.file} 没有事件表，但 ${page.component} 声明了 emits（${api.emits.join(', ')}）`)
  }
  check('events', page.events, api.emits, 'emits')
  check('methods', page.methods, api.exposed, 'exposed')
}

// ─────────────────── 渲染端三：es-plus-docs（Vue 3 + Element Plus）───────────────────
//
// 该站的 API 不是 HTML 表，而是 `component-doc.data.ts` 里喂给文档组件的结构化数据。
// 同一条规矩：数据里的每一项都必须是源码真实存在的键，源码新增的键也必须落到数据里。
const VUE3_DOC_FILE = 'es-plus-docs/src/views/component-doc.data.ts'
const VUE3_COMPONENTS = {
  'es-form': { file: 'packages/vue3/src/components/es-form/src/es-form.vue', noEmits: true },
  'es-table': { file: 'packages/vue3/src/components/es-table/src/component.vue' },
  'es-crud-page': { file: 'packages/vue3/src/components/es-crud-page/src/es-crud-page.vue' },
}

const vue3Doc = read(VUE3_DOC_FILE)
if (vue3Doc) {
  for (const [key, cfg] of Object.entries(VUE3_COMPONENTS)) {
    const src = read(cfg.file)
    if (!src) continue

    const sectionAt = vue3Doc.indexOf(`'${key}': {`)
    if (sectionAt < 0) {
      fail(`${VUE3_DOC_FILE} 里找不到组件「${key}」的 API 数据`)
      continue
    }
    const section = blockAt(vue3Doc, vue3Doc.indexOf('{', sectionAt))
    const apiAt = section === null ? -1 : section.indexOf('api: {')
    if (apiAt < 0) {
      fail(`${VUE3_DOC_FILE} 的「${key}」没有 api 块`)
      continue
    }
    const api = blockAt(section, section.indexOf('{', apiAt))

    const propsBody = typeLiteralKeys(src, 'defineProps<{')
    const emitsBody = typeLiteralKeys(src, 'defineEmits<{')
    const exposedBody = typeLiteralKeys(src, 'defineExpose({')

    const compare = (kind, arrName, sourceKeys, sourceLabel) => {
      const at = api.indexOf(`${arrName}: [`)
      if (at < 0) {
        fail(`${VUE3_DOC_FILE} 的「${key}」缺少 ${arrName} 数组`)
        return
      }
      const arrBody = blockAt(api, api.indexOf('[', at)) || ''
      const docKeys = [...arrBody.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1])
      for (const k of docKeys) {
        if (!sourceKeys.includes(k)) {
          fail(
            `${VUE3_DOC_FILE}「${key}」的 ${arrName} 里 ${k} 在源码 ${sourceLabel} 中不存在` +
              ` —— 读者照抄会静默失效（源码现有：${sourceKeys.slice(0, 8).join(', ')}…）`,
          )
        }
      }
      for (const k of sourceKeys) {
        if (!docKeys.includes(k)) {
          fail(`Vue 3 端 ${key} 的 ${sourceLabel}「${k}」未出现在 ${VUE3_DOC_FILE} 的 ${arrName} 里`)
        }
      }
    }

    compare('props', 'props', propsBody || [], 'props')
    if (!cfg.noEmits || /\bemit\(/.test(src)) compare('events', 'events', emitsBody || [], 'emits')
    compare('methods', 'methods', exposedBody || [], 'exposed')
  }
}

// ─────────────────── 嵌套配置类型（FormItemOption / TableColumn …）───────────────────
//
// 顶层 props/events/methods 之外，三站都还有「配置项表」（formItemList 的每一项、columns
// 的每一项……）。这些表此前完全无人校验：写了源码里不存在的键，读者照着抄，配置静默失效。
// 三端的权威声明是 TypeScript 接口：vue2 走 @es-plus/core，vue3 与 adapter-antdv 各有副本。
const TYPE_SOURCES = {
  core: 'packages/core/src/types.ts',
  vue3: 'packages/vue3/src/types/index.ts',
  antdv: 'packages/adapter-antdv/src/types/index.ts',
  // CRUD 的配置类型不在全局 types/index.ts，而是各渲染端各有一份
  vue2Crud: 'packages/vue2/src/components/es-crud-page/types.ts',
  vue3Crud: 'packages/vue3/src/components/es-crud-page/src/types.ts',
  antdvCrud: 'packages/adapter-antdv/src/components/es-crud-page/src/types.ts',
}

/** 接口体 → Map<顶层键, 内联对象子键集合 | null>。子键为 null 表示开放（Record / 交叉类型） */
function interfaceEntries(src, name, baseResolver = null) {
  const at = src.indexOf(`export interface ${name}`)
  if (at < 0) return null
  const braceAt = src.indexOf('{', at)
  const body = blockAt(src, braceAt)
  if (body === null) return null

  const out = new Map()
  let depth = 0
  let inStr = null
  let entry = ''
  const flush = () => {
    const t = entry.trim()
    entry = ''
    if (!t) return
    const m = /^([A-Za-z_$][\w$]*)\??\s*:\s*([\s\S]*)$/.exec(t)
    if (!m) return
    const val = m[2].trim().replace(/,$/, '')
    let children = null
    if (val.startsWith('{')) {
      const inner = blockAt(val, 0)
      if (inner !== null) children = new Set(topLevelKeys(inner))
    }
    out.set(m[1], children)
  }
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (inStr) {
      entry += ch
      if (ch === '\\') entry += body[++i]
      else if (ch === inStr) inStr = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      inStr = ch
      entry += ch
      continue
    }
    if (ch === '/' && body[i + 1] === '/') {
      const nl = body.indexOf('\n', i)
      i = nl < 0 ? body.length : nl
      continue
    }
    if (ch === '/' && body[i + 1] === '*') {
      const end = body.indexOf('*/', i + 2)
      i = end < 0 ? body.length : end + 1
      continue
    }
    if (ch === '{' || ch === '[' || ch === '(') {
      depth++
      entry += ch
      continue
    }
    if (ch === '}' || ch === ']' || ch === ')') {
      depth--
      entry += ch
      continue
    }
    if (ch === '\n') {
      // 保留换行：值的正则用 [\s\S]，而 topLevelKeys 依赖换行切分子键
      if (depth === 0) flush()
      else entry += ch
      continue
    }
    entry += ch
  }
  flush()

  // `interface X extends Y`：继承来的键也是合法配置（CrudBtnConfig extends BtnConfig），
  // 文档表按最终键集校验，否则 position / loading 这类继承键会被误判成幻影 API。
  const ext = /\bextends\s+([A-Za-z_$][\w$]*)/.exec(src.slice(at, braceAt))
  if (ext && baseResolver) {
    const base = baseResolver(ext[1])
    if (base) for (const [k, v] of base) if (!out.has(k)) out.set(k, v)
  }
  return out.size ? out : null
}

/** CRUD 类型继承的基接口在渲染端自己的 types/index.ts 里 */
const CRUD_BASE = { vue2Crud: 'core', vue3Crud: 'vue3', antdvCrud: 'antdv' }

const typeCache = {}
function typeEntries(sourceKey, typeName) {
  const file = TYPE_SOURCES[sourceKey]
  typeCache[file] ??= read(file)
  if (!typeCache[file]) return null
  const baseKey = CRUD_BASE[sourceKey]
  const baseResolver = baseKey
    ? (baseName) => {
        const baseFile = TYPE_SOURCES[baseKey]
        typeCache[baseFile] ??= read(baseFile)
        return typeCache[baseFile] ? interfaceEntries(typeCache[baseFile], baseName) : null
      }
    : null
  return interfaceEntries(typeCache[file], typeName, baseResolver)
}

/** `es-plus-docs` 的 `'TypeName': [ { name: 'x' } ]` */
function dataTypeValues(src, typeName) {
  const at = src.indexOf(`'${typeName}': [`)
  if (at < 0) return null
  const body = blockAt(src, src.indexOf('[', at))
  if (body === null) return null
  return [...body.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1])
}

let nestedCount = 0
function checkNested(where, typeName, sourceKey, keys, opts = {}) {
  const entries = typeEntries(sourceKey, typeName)
  if (!entries) {
    fail(`无法从 ${TYPE_SOURCES[sourceKey]} 解析出 ${typeName} —— 写法变了请同步本脚本`)
    return
  }
  nestedCount++
  for (const raw of keys) {
    const parts = raw.split('.')
    if (!entries.has(parts[0])) {
      fail(
        `${where} 里 ${typeName} 的「${raw}」在源码 ${typeName} 中不存在` +
          ` —— 读者照抄会静默失效（源码现有：${[...entries.keys()].slice(0, 8).join(', ')}…）`,
      )
      continue
    }
    if (parts.length > 1) {
      const children = entries.get(parts[0])
      if (children && !children.has(parts[1])) {
        fail(`${where} 里 ${typeName} 的「${raw}」在源码的 ${parts[0]} 里不存在`)
      }
    }
  }
  // 反向：源码有、文档没写。默认关闭 —— FormItemOption.components 这类「有类型但没人
  // 消费」的键刻意不写进文档；CRUD 的配置类型则全部是真实可配项，所以那里打开它。
  if (opts.reverse) {
    const seen = new Set(keys.map((raw) => raw.split('.')[0]))
    for (const key of entries.keys()) {
      if (!seen.has(key)) {
        fail(`${where} 缺少 ${typeName} 的「${key}」—— 源码里有这个配置键，读者在文档里查不到`)
      }
    }
  }
}

/**
 * 文档首列可能写成一格多键（`a / b / c`）或带 `(deprecated)` 后缀，拆成真实键再比对。
 * 这是三站各自的既有排版习惯，不改文档、只在解析层归一。
 */
function normalizeDocKeys(values) {
  return values.flatMap((v) =>
    v
      .replace(/\s*\(deprecated\)/gi, '')
      .split(/\s*\/\s*/)
      .map((s) => s.trim())
      .filter(Boolean),
  )
}

// 渲染端二（es-pc）：文档是喂给 <a-table> 的数组，权威声明是 adapter-antdv 的类型
const PC_NESTED = [
  { file: 'es-pc/src/views/EsForm.vue', arrays: [
    { varName: 'formItemOptions', typeName: 'FormItemOption' },
    { varName: 'layoutFormProps', typeName: 'LayoutFormProps' },
    { varName: 'formBtns', typeName: 'BtnConfig' },
  ] },
  { file: 'es-pc/src/views/EsTable.vue', arrays: [
    { varName: 'tableColumns', typeName: 'TableColumn' },
    { varName: 'tableOptions', typeName: 'TableOptions' },
  ] },
  { file: 'es-pc/src/views/EsDialog.vue', arrays: [{ varName: 'dialogBtns', typeName: 'BtnConfig' }] },
]

for (const page of PC_NESTED) {
  const src = read(page.file)
  if (!src) continue
  for (const entry of page.arrays) {
    const keys = docVarValues(src, entry.varName, 'prop')
    if (!keys || keys.length === 0) {
      fail(`${page.file} 里找不到 ${entry.varName} 数组（或为空）—— ${entry.typeName} 需要在此成表`)
      continue
    }
    checkNested(`${page.file} 的 ${entry.varName}`, entry.typeName, 'antdv', normalizeDocKeys(keys))
  }
}

// 渲染端三（es-plus-docs）：同一份数据文件里的嵌套类型表，权威声明是 vue3 的类型
const VUE3_NESTED = ['FormItemOption', 'LayoutFormProps', 'BtnConfig', 'TableColumn', 'TableOptions']
if (vue3Doc) {
  for (const typeName of VUE3_NESTED) {
    const keys = dataTypeValues(vue3Doc, typeName)
    if (!keys || keys.length === 0) {
      fail(`${VUE3_DOC_FILE} 里找不到 ${typeName} 的配置表 —— 该类型需要在此成表`)
      continue
    }
    checkNested(VUE3_DOC_FILE, typeName, 'vue3', normalizeDocKeys(keys))
  }
}

// 渲染端一（es-eui）：文档是 HTML 表，权威声明是 @es-plus/core 的类型
const EUI_NESTED = [
  { file: 'es-eui/src/views/docs/EsFormDocs.vue', section: 'FormItem 配置', typeName: 'FormItemOption' },
  { file: 'es-eui/src/views/docs/EsFormDocs.vue', section: 'LayoutFormProps 配置', typeName: 'LayoutFormProps' },
  { file: 'es-eui/src/views/docs/EsTableDocs.vue', section: 'Options 配置', typeName: 'TableOptions' },
  { file: 'es-eui/src/views/docs/EsTableDocs.vue', section: 'Column 配置', typeName: 'TableColumn' },
  { file: 'es-eui/src/views/docs/EsDialogDocs.vue', section: 'ConfigBtn 配置', typeName: 'BtnConfig' },
]

for (const page of EUI_NESTED) {
  const html = read(page.file)
  if (!html) continue
  const block = headings(html).find((b) => b.title === page.section)
  if (!block) {
    fail(`${page.file} 缺少「${page.section}」小节 —— ${page.typeName} 需要在此成表`)
    continue
  }
  const cells = firstColumnCells(block.body)
  if (!cells || cells.length === 0) {
    fail(`${page.file} 的「${page.section}」小节下没有 API 表（或表为空）`)
    continue
  }
  checkNested(`${page.file} 的「${page.section}」`, page.typeName, 'core', cells)
}

// ─────────────────── CRUD 配置类型（schema / dialogs / 按钮）───────────────────
//
// CRUD 的嵌套配置（schema 的每一项、dialogs 的每一项、按钮项）此前只有 Vue 3 站成表，
// vue2 / antdv 两站只在正文里散着提一句，三端键集无从对齐。这里把三站并到同一份权威
// 声明上：各渲染端自己的 `es-crud-page/types.ts`。
//
// TableBtnConfig / DialogBtnConfig 不单独成表：前者键集 = CrudBtnConfig（position/code
// 本就在 BtnConfig 里），后者 = BtnConfig + action，而 action 三站都在 configBtn 行内说明。
const CRUD_TYPES = ['CrudPageSchema', 'CrudBtnConfig', 'OperationColumnConfig', 'RowBtnConfig', 'CrudDialogConfig']

const CRUD_PC = {
  file: 'es-pc/src/views/EsCrudPage.vue',
  sourceKey: 'antdvCrud',
  arrays: [
    { varName: 'crudSchema', typeName: 'CrudPageSchema' },
    { varName: 'crudBtnConfigs', typeName: 'CrudBtnConfig' },
    { varName: 'crudOperationColumns', typeName: 'OperationColumnConfig' },
    { varName: 'crudRowBtns', typeName: 'RowBtnConfig' },
    { varName: 'crudDialogs', typeName: 'CrudDialogConfig' },
  ],
}

{
  const src = read(CRUD_PC.file)
  for (const entry of src ? CRUD_PC.arrays : []) {
    const keys = docVarValues(src, entry.varName, 'prop')
    if (!keys || keys.length === 0) {
      fail(`${CRUD_PC.file} 里找不到 ${entry.varName} 数组（或为空）—— ${entry.typeName} 需要在此成表`)
      continue
    }
    checkNested(`${CRUD_PC.file} 的 ${entry.varName}`, entry.typeName, CRUD_PC.sourceKey, normalizeDocKeys(keys), {
      reverse: true,
    })
  }
}

if (vue3Doc) {
  for (const typeName of CRUD_TYPES) {
    const keys = dataTypeValues(vue3Doc, typeName)
    if (!keys || keys.length === 0) {
      fail(`${VUE3_DOC_FILE} 里找不到 ${typeName} 的配置表 —— 该类型需要在此成表`)
      continue
    }
    checkNested(VUE3_DOC_FILE, typeName, 'vue3Crud', normalizeDocKeys(keys), { reverse: true })
  }
}

const EUI_CRUD = {
  file: 'es-eui/src/views/docs/EsCrudPageDocs.vue',
  sourceKey: 'vue2Crud',
  sections: [
    { section: 'Schema 结构', typeName: 'CrudPageSchema' },
    { section: 'CrudBtnConfig 按钮配置', typeName: 'CrudBtnConfig' },
    { section: 'OperationColumnConfig 操作列配置', typeName: 'OperationColumnConfig' },
    { section: 'RowBtnConfig 行按钮配置', typeName: 'RowBtnConfig' },
    { section: 'Dialogs 配置', typeName: 'CrudDialogConfig' },
  ],
}

{
  const html = read(EUI_CRUD.file)
  const blocks = html ? headings(html) : []
  for (const entry of html ? EUI_CRUD.sections : []) {
    const block = blocks.find((b) => b.title === entry.section)
    if (!block) {
      fail(`${EUI_CRUD.file} 缺少「${entry.section}」小节 —— ${entry.typeName} 需要在此成表`)
      continue
    }
    const cells = firstColumnCells(block.body)
    if (!cells || cells.length === 0) {
      fail(`${EUI_CRUD.file} 的「${entry.section}」小节下没有 API 表（或表为空）`)
      continue
    }
    checkNested(`${EUI_CRUD.file} 的「${entry.section}」`, entry.typeName, EUI_CRUD.sourceKey, cells, {
      reverse: true,
    })
  }
}

if (failed) {
  console.error('\n文档 API 表与源码存在漂移。')
  process.exit(1)
}
console.log(
  `✅ 文档 API 表与组件源码一致（vue2 ${Object.keys(COMPONENTS).length} 个组件 / ${tableCount} 张表` +
    ` · antdv ${Object.keys(ADAPTER_COMPONENTS).length} 个组件 / ${ADAPTER_PAGES.length} 页` +
    ` · vue3 ${Object.keys(VUE3_COMPONENTS).length} 个组件 / 1 份数据` +
    ` · 嵌套配置 ${nestedCount} 张表）`,
)
