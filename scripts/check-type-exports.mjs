#!/usr/bin/env node
/**
 * CI 断言：三个渲染器（vue3 / vue2 / adapter-antdv）必须导出完全一致的
 * 「跨渲染器契约类型」集合。权威清单来自 packages/core/src/public-types.ts
 * 的 PUBLIC_CONTRACT_TYPES 常量。
 *
 * 目的：兑现“换渲染器只换 import 路径”的家族承诺，防止某个包漏导出/多导出
 * 契约类型而悄悄漂移。
 *
 * 四条断言：
 *   1. 每个渲染器 ⊇ PUBLIC_CONTRACT_TYPES（漏导出）；
 *   2. 三端的导出集合彼此一致 —— 只存在于某一端的类型必须登记在 RENDERER_SPECIFIC
 *      并写明原因（多导出）；
 *   3. **成员级比对**：同名契约类型在 core 与各端特化版本之间的成员名集合必须一致 ——
 *      少一个成员（core 有、本端特化无）或多一个成员，都要登记在 MEMBER_DEVIATIONS /
 *      MEMBER_ADDITIONS 并写明原因；
 *   4. **共享增强比对**：三端各自 `declare module '@es-plus/core'` 引入、core 里没有的成员，
 *      登记进 SHARED_AUGMENT_MEMBERS（见该表注释：为什么它既不是缺项也不是端特化）。
 *
 * 为什么第 2 条是「三端两两一致」而不是「⊆ 契约清单」：index.ts 本来就会导出契约
 * 清单之外的类型（`EsFormProps`/`EsTableExpose` 之类），断言子集会立刻误报。
 * 但「**只有一端**导出某名字」恰恰是承诺被破坏的形状：使用者按 vue3 写完再换 import
 * 路径到 vue2，那个名字就消失了 —— 而此前只查缺失，这种不对称无人发现。
 *
 * 为什么需要第 3 条：第 1、2 条验证的是**名字**。core/public-types.ts 明确允许
 * vue3/antdv 对配置类类型做「形状兼容的特化」，而「形状兼容」只能靠成员名集合来验。
 * 实测（2026-09）：只查名字时，`EsPlusOptions` 三端齐名但 vue3/antdv 少 5 个成员、
 * `PaginationConfig` 少 `layout`、`ApiParams` 少 `labelField/valueField` —— 全绿。
 * 其中后两项在各端**没有**索引签名兜底，是**硬类型错误**：照文档写
 * `apiParams: { labelField: 'name' }` 的 vue3 用户直接编译失败。
 *
 * 本守卫自身踩过的三个坑（都实测过，别再退回去）：
 *  - **不能把 core 的成员集按引用交给「本端没有特化」的分支**（见 rendererMembers 的
 *    viaCore）：那样比的是同一个 Set，extra / missing 恒为空 —— vue2 的契约类型全部
 *    re-export core，于是它 35 项成员比对此前全是空转，永远不会红。
 *  - **不能把 `<` / `>` 计入成员扫描深度**：`render?: (...) => AnyVNode` 里的 `=>`
 *    会让深度跑负，把参数名（`h`、`ctx`）与 btns 子对象的键误判成顶层成员。
 *  - **「解析不出对象体」不等于「解析失败」**：`type EsButtonSize = '' | 'large' | …`
 *    这类联合 / 工具类型本就没有成员可比，报成盲区是用错的守卫掩盖对的代码；
 *    用 hasDecl 区分「没有声明」与「声明非对象形态」。
 *
 * 用法：node scripts/check-type-exports.mjs
 * 退出码：0 = 全部一致；1 = 有缺失/漂移。
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

/** 仓库根相对路径，统一成正斜杠（报告里好读，也避免 Windows 反斜杠转义） */
const rel = (target) => relative(ROOT, target).split('\\').join('/')

const RENDERERS = [
  { name: '@es-plus/vue3', dir: 'packages/vue3', index: 'packages/vue3/src/index.ts' },
  { name: '@es-plus/vue2', dir: 'packages/vue2', index: 'packages/vue2/src/index.ts' },
  {
    name: '@es-plus/adapter-antdv',
    dir: 'packages/adapter-antdv',
    index: 'packages/adapter-antdv/src/index.ts',
  },
]

/** core 契约类型的权威声明文件 */
const CORE_TYPES = 'packages/core/src/types.ts'

/**
 * 允许「只有某一端导出」的端特化类型登记表。
 * key = `渲染器包名.类型名`，value = 原因。新增条目请写明为什么它不该三端共有。
 */
const RENDERER_SPECIFIC = new Map([
  [
    '@es-plus/adapter-antdv.CrudPageProps',
    'antdv 的 es-crud-page 以独立 types 文件声明 Props/Emits/Expose 并对外导出；vue3/vue2 的对应组件未导出这三个类型',
  ],
  ['@es-plus/adapter-antdv.CrudPageEmits', '同上（antdv 端特化）'],
  ['@es-plus/adapter-antdv.CrudPageExpose', '同上（antdv 端特化）'],
  [
    '@es-plus/adapter-antdv.EsPlusGlobalConfig',
    'antdv 的插件全局配置类型（注释写明「对齐 vue3 最小集」）；vue3/vue2 未导出同名类型',
  ],
  [
    '@es-plus/vue2.TableBtnConfig',
    'vue2 的 crud-page 在 CrudBtnConfig 之上再声明 position/code（types.ts:56）；vue3/antdv 未导出该扩展名',
  ],
])

/**
 * 成员级差异登记表（core 有、该端特化**没有**）。
 * key = `类型名.渲染器包名.成员名`，value = 原因（必须写清「本端为什么不实现它」）。
 *
 * 注意方向：只登记**减少**的成员。多出来的成员请登记在 MEMBER_ADDITIONS。
 */
const MEMBER_DEVIATIONS = new Map([
  [
    'PaginationConfig.@es-plus/adapter-antdv.layout',
    'a-pagination 没有 layout 字符串 prop —— 对应能力由 showTotal / showSizeChanger / showQuickJumper 三个布尔表达，本端无对应物。' +
      '（vue3 / vue2 的 el-pagination 有 layout，且已让 `:pagination="{ layout }"` 经 computed 回落生效；antdv 若照抄声明就是撒谎。）' +
      '与「virtual 在 vue2/antdv 忽略」「分页 size 在本端只认 small」同属一个取舍：不是漏实现，是底层组件无此概念。',
  ],
  [
    'DialogOptions.@es-plus/adapter-antdv.cacheKey',
    'antdv 的 use-dialog 没有实例缓存机制（vue3 的 useDialog 有 instanceCache + TTL 回收）。' +
      '本端传入 cacheKey 会被 eslint 之外的所有路径静默忽略，故不声明 —— 声明了等于承诺一个不存在的功能。',
  ],
  [
    'DialogOptions.@es-plus/adapter-antdv.loading',
    'antdv 弹窗没有主体 loading 遮罩（只有底部按钮的 :loading）。vue3 的弹窗组件声明了 loading prop 并绑 v-loading，故 vue3 声明此成员。',
  ],
])

/**
 * 成员级新增登记表（该端特化有、core **没有**）。
 * key = `类型名.渲染器包名.成员名`，value = 原因。
 */
const MEMBER_ADDITIONS = new Map([
  [
    'TableColumn.@es-plus/adapter-antdv.cellClassName',
    '列级单元格类名 —— a-table 的列支持 className（core 的 TableColumn 只有表级 cellClassName，在 TableOptions 上）。' +
      '消费点：column-adapter.ts 把 col.cellClassName 映射到 a-table 列的 className。',
  ],
  [
    'TableColumn.@es-plus/adapter-antdv.headerCellClassName',
    '列级表头类名 —— 同上，映射到 a-table 列的 headerClassName（column-adapter.ts）。',
  ],
])

/**
 * 共享增强成员登记表（三端**都**通过 `declare module '@es-plus/core'` 引入、core 里没有）。
 * key = `类型名.成员名`，value = 原因（写清为什么 core 不能声明它）。
 *
 * 为什么要单独一张表而不是塞进 MEMBER_ADDITIONS：MEMBER_ADDITIONS 的语义是
 * 「该端特化」——换 import 路径到别的端，那个成员就没了。而 vxeConfig / vxeOn /
 * vxeColumn 三端**各自**都提供了同一份增强（三端都随包发布 vxe-types-augment.ts），
 * 换端并不会丢 —— 它们不是端特化，只是 core 声明的盲区：类型要写成
 * `Partial<Omit<VxeGridProps, ...>>`，依赖 vxe-table 自身的类型，而 core 必须零依赖。
 * 按「每端一条」登记会伪造出 9 条并不存在的差异。
 */
const SHARED_AUGMENT_MEMBERS = new Map([
  [
    'TableOptions.vxeConfig',
    'vxe-grid 原生配置逃生舱。类型为 Partial<Omit<VxeGridProps, ...>>，依赖 vxe-table 自身的类型；' +
      'core 的硬约束是零依赖，故只能由三端各自 declare module 增强 core。',
  ],
  [
    'TableOptions.vxeOn',
    'vxe 事件配置式写法（替代 @event）。与 vxeConfig 同因 —— 键名来自 vxe-table 的事件表，core 不能引入该类型。',
  ],
  [
    'TableColumn.vxeColumn',
    'vxe 列原生配置逃生舱。与 vxeConfig 同因（Partial<Omit<VxeColumnProps, ...>>）。',
  ],
])

// ============================================================================
// 源码解析（轻量、无依赖）
// ============================================================================

/** 去掉注释，保留字符串字面量（成员名可能被引号包裹） */
function stripComments(src) {
  let out = ''
  let i = 0
  let inStr = null
  while (i < src.length) {
    const c = src[i]
    const n = src[i + 1]
    if (inStr) {
      if (c === '\\') {
        out += c + (n ?? '')
        i += 2
        continue
      }
      if (c === inStr) inStr = null
      out += c
      i++
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      inStr = c
      out += c
      i++
      continue
    }
    if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') i++
      continue
    }
    if (c === '/' && n === '*') {
      i += 2
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++
      i += 2
      continue
    }
    out += c
    i++
  }
  return out
}

/**
 * 定位 `interface NAME` / `type NAME =` 的对象体（大括号配对扫描），返回体内文本。
 * 找不到对象体（如 `type X = A | B`）时返回 null。
 */
function findObjectBody(src, name) {
  const re = new RegExp(`(?:export\\s+)?(?:interface|type)\\s+${name}\\b`)
  const m = re.exec(src)
  if (!m) return null
  let i = m.index + m[0].length
  // 跳过 extends / 泛型参数，直到第一个 '{'
  while (i < src.length && src[i] !== '{') {
    // `type X = A & B` 之类没有对象体：只要本行内出现 `=` 且无 '{' 就放弃
    if (src[i] === '\n') {
      const lineEnd = src.indexOf('\n', i + 1)
      const next = src.slice(i, lineEnd === -1 ? undefined : lineEnd)
      if (!next.includes('{')) return null
    }
    if (src[i] === '=' || src[i] === '|' || src[i] === '&') {
      const lineEnd = src.indexOf('\n', i)
      const rest = src.slice(i, lineEnd === -1 ? undefined : lineEnd)
      if (!rest.includes('{')) return null
    }
    i++
  }
  const start = i
  let depth = 0
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') {
      depth--
      if (depth === 0) return src.slice(start + 1, i)
    }
  }
  return null
}

/**
 * 从对象体提取 depth-1 的成员名。
 *
 * 两个坑，都有实测教训：
 *  - **不能**把 `<` / `>` 计入深度：`render?: (...) => AnyVNode` 里的 `=>` 会让深度跑负，
 *    把参数名（`h`、`ctx`）与 `btns` 子对象里的键（`clickEvent`）误当成顶层成员。
 *  - 索引签名 `[key: string]: unknown` 不是具名成员，单独记为 `[index]` 并在比对时排除：
 *    它的存在与否决定了「缺字段是否硬报错」，但本身不是契约的一部分。
 */
function extractMembers(body) {
  const out = new Set()
  let depth = 0
  let cur = ''
  const entries = []
  for (const ch of body) {
    if (ch === '{' || ch === '(' || ch === '[') depth++
    else if (ch === '}' || ch === ')' || ch === ']') depth--
    if (depth === 0 && (ch === '\n' || ch === ';')) {
      entries.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  entries.push(cur)
  for (const raw of entries) {
    const e = raw.trim()
    if (!e) continue
    if (e.startsWith('[')) continue
    const m = e.match(/^(?:readonly\s+)?(?:'([^']+)'|"([^"]+)"|([A-Za-z0-9_$]+))\s*[?:(<]/)
    if (m) out.add(m[1] ?? m[2] ?? m[3])
  }
  return out
}

/** 提取一个文件里 NAME 的成员集合（该文件自己声明的，不含再导出） */
function declMembers(src, name) {
  const body = findObjectBody(src, name)
  return body === null ? null : extractMembers(body)
}

/**
 * 解析 `export { ... } from '...'` / `export type { ... } from '...'` 块。
 * 同时覆盖 `export { type A } from` 这种内联 type 修饰符写法（旧实现只认 `export type {`）。
 */
function parseExportBlocks(src) {
  const blocks = []
  const re = /export\s+(?:type\s+)?\{([\s\S]*?)\}\s*(?:from\s+['"]([^'"]+)['"])?/g
  let m
  while ((m = re.exec(src)) !== null) {
    const names = []
    for (const raw of m[1].split(',')) {
      const part = raw.trim().replace(/^type\s+/, '')
      if (!part) continue
      const asMatch = part.match(/\bas\s+([A-Za-z0-9_$]+)/)
      const name = asMatch ? asMatch[1] : part.replace(/[^A-Za-z0-9_$]/g, '')
      if (name) names.push(name)
    }
    blocks.push({ names, spec: m[2] ?? null })
  }
  return blocks
}

/** 把相对 specifier 解析成实际文件（支持 ./x、./x/index.ts、./x.vue） */
function resolveSpecifier(baseDir, spec) {
  const target = resolve(baseDir, spec)
  for (const cand of [`${target}.ts`, join(target, 'index.ts'), `${target}.vue`, target]) {
    if (existsSync(cand) && cand.endsWith('.ts')) {
      // .vue 不参与类型成员解析
      return cand
    }
    if (existsSync(cand) && cand.endsWith('.vue')) return cand
  }
  return null
}

/** 递归收集目录下的文件 */
function walk(dir, out) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
}

/** 取 openIndex 处 `{` 所配对的大括号**内部**文本（含嵌套），失败返回 null */
function braceBody(src, openIndex) {
  let depth = 0
  for (let i = openIndex; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') {
      depth--
      if (depth === 0) return src.slice(openIndex + 1, i)
    }
  }
  return null
}

/**
 * 收集某端对 `@es-plus/core` 的 `declare module` 增强块。
 *
 * 为什么必须解析：`vxeConfig` / `vxeOn` / `vxeColumn` 的类型要写成
 * `Partial<Omit<VxeGridProps, ...>>`，依赖 vxe-table 自身的类型；而 @es-plus/core
 * 的硬约束是**零依赖**，所以它们只能以「各端自行 declare module 增强 core」的形态存在
 * —— 这恰恰是 vue3 / antdv 相对 vue2 的真实增量，也是唯一一处「同一契约类型在不同端
 * 因增强而成员不同」的地方。不解析等于守卫对这套机制完全失明（此前 antdv 的 vxeConfig /
 * vxeOn 就因为写在增强文件里而被守卫漏掉，只报了 vue3 一侧，报告是半真的）。
 */
function augmentSources(pkgDir) {
  if (AUGMENT_SOURCES_CACHE.has(pkgDir)) return AUGMENT_SOURCES_CACHE.get(pkgDir)
  const files = []
  walk(join(ROOT, pkgDir, 'src'), files)
  const blocks = []
  for (const f of files) {
    if (!f.endsWith('.ts') || f.endsWith('.d.ts')) continue
    const src = stripComments(readFileSync(f, 'utf-8'))
    if (!src.includes('declare module')) continue
    const re = /declare\s+module\s+['"]@es-plus\/core['"]\s*/g
    let m
    while ((m = re.exec(src)) !== null) {
      const braceAt = src.indexOf('{', m.index + m[0].length)
      if (braceAt === -1) continue
      const body = braceBody(src, braceAt)
      if (body) blocks.push(body)
    }
  }
  AUGMENT_SOURCES_CACHE.set(pkgDir, blocks)
  return blocks
}
const AUGMENT_SOURCES_CACHE = new Map()
const AUGMENT_MEMBERS_CACHE = new Map()

/** 某端通过 declare module 增强为 `name` 贡献的成员集合 */
function augmentMembers(pkgDir, name) {
  const key = `${pkgDir}::${name}`
  if (AUGMENT_MEMBERS_CACHE.has(key)) return AUGMENT_MEMBERS_CACHE.get(key)
  const out = new Set()
  for (const block of augmentSources(pkgDir)) {
    const ib = findObjectBody(block, name)
    if (ib) for (const x of extractMembers(ib)) out.add(x)
  }
  AUGMENT_MEMBERS_CACHE.set(key, out)
  return out
}

const CORE_SRC = stripComments(readFileSync(join(ROOT, CORE_TYPES), 'utf-8'))

/** 该源码里是否存在 NAME 的 `interface` / `type` 声明 */
function hasDecl(src, name) {
  return new RegExp(`(?:export\\s+)?(?:interface|type)\\s+${name}\\b`).test(src)
}

/**
 * 解析某个渲染器实际导出的 `name` 的类型成员 —— 跟着 index.ts 的 `from` 走一跳到两跳。
 *
 * 返回 `{ members, where, declExists }`：
 *   - `declExists`：是否**定位到了声明处**。false 表示找到了导出名却找不到声明
 *     （守卫盲区，判红）；
 *   - `members === null` 且 `declExists === true`：声明存在但**不是对象形态**
 *     （`type EsButtonSize = '' | 'large' | …` 这类联合 / 工具类型），成员级比对不适用；
 *   - `members` 为 Set：对象形态，逐成员比对。
 * 整条解析路径断掉（`null`）同样是盲区。
 *
 * 关键区分（曾经误判过）：`members === null` **不等于**「解析失败」。把七个别名类型
 * 当成盲区报红，等于用错误的守卫掩盖正确的代码。
 *
 * @param coreInfo `{ members, declExists }` —— core 侧同一类型的形态
 */
function rendererMembers(r, name, coreInfo) {
  const indexPath = join(ROOT, r.index)
  const indexSrc = stripComments(readFileSync(indexPath, 'utf-8'))
  const indexDir = dirname(indexPath)
  /**
   * 直接落在 @es-plus/core 上的分支：成员集与 core 完全一致。
   *
   * **必须复制一份**（`new Set(...)`），不能把 coreInfo.members 原样交出去：
   *   - 交引用会让「本端 vs core」的比对退化成同一个 Set 自比 —— extra / missing 恒为空，
   *     该端从此**永远**不会被判红。vue2 的契约类型全部是 re-export core 的，
   *     于是它的 35 项比对此前全是空转（这正是「只报 vue3/antdv、从不报 vue2」的原因）。
   *   - 调用方随后还要把 declare module 增强的成员并进这个集合（vxeConfig 等），
   *     交引用会顺手改掉 core 的那一份，污染同一契约类型后续几端的比对。
   */
  const viaCore = (note) => ({
    members: coreInfo.members ? new Set(coreInfo.members) : null,
    where: note,
    declExists: coreInfo.declExists,
  })

  for (const b of parseExportBlocks(indexSrc)) {
    if (!b.names.includes(name)) continue
    if (!b.spec) {
      if (!hasDecl(indexSrc, name)) return null
      return { members: declMembers(indexSrc, name), where: rel(indexPath), declExists: true }
    }
    if (!b.spec.startsWith('.')) {
      // 外部包：本项目里只有 @es-plus/core 是权威源
      return b.spec.startsWith('@es-plus/core') ? viaCore('@es-plus/core') : null
    }
    const file = resolveSpecifier(indexDir, b.spec)
    if (!file) return null
    const src = stripComments(readFileSync(file, 'utf-8'))
    if (hasDecl(src, name)) {
      return { members: declMembers(src, name), where: rel(file), declExists: true }
    }
    // 未在本文件声明 → 跟本文件自己的再导出块走第二跳
    for (const b2 of parseExportBlocks(src)) {
      if (!b2.names.includes(name) || !b2.spec) continue
      if (b2.spec.startsWith('@es-plus/core')) {
        return viaCore(`@es-plus/core（经 ${rel(file)} 再导出）`)
      }
      if (b2.spec.startsWith('.')) {
        const f2 = resolveSpecifier(dirname(file), b2.spec)
        if (!f2) continue
        const src2 = stripComments(readFileSync(f2, 'utf-8'))
        if (hasDecl(src2, name)) {
          return { members: declMembers(src2, name), where: rel(f2), declExists: true }
        }
      }
    }
    return viaCore(`@es-plus/core（经 ${rel(file)} 再导出）`)
  }
  return null
}

// ============================================================================
// 名字级：现有两条断言
// ============================================================================

/** 从 public-types.ts 提取权威契约类型清单 */
function readContractList() {
  const src = readFileSync(join(ROOT, 'packages/core/src/public-types.ts'), 'utf-8')
  const m = src.match(/PUBLIC_CONTRACT_TYPES\s*=\s*\[([\s\S]*?)\]\s*as const/)
  if (!m) throw new Error('未能在 public-types.ts 中定位 PUBLIC_CONTRACT_TYPES 常量')
  return m[1]
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
}

/** 提取一个 index.ts 中所有对外导出的**类型名** */
function extractExportedTypeNames(filePath) {
  return exportedNamesFromSource(stripComments(readFileSync(join(ROOT, filePath), 'utf-8')))
}

/** 与 extractExportedTypeNames 同源，只是直接吃源码文本（自证要对合成源码跑） */
function exportedNamesFromSource(src) {
  const names = new Set()

  // `export type { A, B as C } from` / `export { type A } from` / `export { A } from`
  for (const block of parseExportBlocks(src)) {
    for (const n of block.names) names.add(n)
  }

  // `export type Name = ...` / `export interface Name ...`
  const declRe = /export\s+(?:type|interface)\s+([A-Za-z0-9_$]+)/g
  let dm
  while ((dm = declRe.exec(src)) !== null) names.add(dm[1])

  return names
}

/**
 * 守卫自证：拿**合成源码**跑一遍解析层，断言它真的看得见各种导出形态、也真的判得出违规。
 *
 * 照 `scripts/check-data-schemas.mjs:94-109` 的既有写法（内联反向探针），不碰仓库里
 * 任何真实文件，因此可以当常规断言长期驻留 —— 每次跑守卫都会先证明自己没瞎。
 *
 * 为什么必须有：本守卫的两次假绿（`<`/`>` 被当成深度、解析不出对象体被当成解析失败）
 * 都是**静默变绿**，常规运行一条都捕获不到，全靠人工复核才发现。下面每一项都对应
 * 一个真实踩过的坑，退化时这里先红，而不是等到契约又漂了才有人发现。
 *
 * 本自证自身也验证过**非空**：临时注入三处解析退化，确认 selfTest 会把它们全部置红，
 * 再还原 —— ① 把 `>` 计入 depth（历史 bug）② 不剥 `export { type A }` 的 `type` 前缀
 * ③ 让 `hasDecl` 恒真。断言若写成了恒真，这三处注入都不会红。
 */
function selfTest() {
  const failures = []
  const expect = (label, cond) => {
    if (!cond) failures.push(label)
  }

  // ① 导出形态：裸声明 + 四种 `export { }` 写法（`type` 前缀、`as` 改名、带/不带 from）
  const src = stripComments(`
    export interface Bare { a: number }
    export type Alias = 'x' | 'y'
    export type { Re1, Re2 as Renamed } from './other'
    export { type Re3 } from './other'
    export { Re4 }
    export * from './wild'
  `)
  const got = exportedNamesFromSource(src)
  for (const n of ['Bare', 'Alias', 'Re1', 'Renamed', 'Re3', 'Re4']) {
    expect(`导出形态漏抽取（守卫会静默漏掉这类导出）：${n}`, got.has(n))
  }

  // ② 「解析不出对象体」≠「解析失败」：联合/工具类型没有对象体，但声明确实存在。
  //    把这两种情况混为一谈，当年导致七个别名类型被误报成盲区。
  expect('hasDecl 看不见 type 别名声明', hasDecl(src, 'Alias'))
  expect('findObjectBody 对联合类型应返回 null', findObjectBody(src, 'Alias') === null)
  expect('hasDecl 把不存在的名字判成存在', !hasDecl(src, 'NoSuchThing'))

  // ③ `<` / `>` 不是深度：`=>` 会凭空多减一层（`>` 无对应的 `<`），深度跑负后再也回不到 0，
  //    于是换行不再切分成员 —— 既漏掉后续成员，又把子对象里的键泄漏成顶层成员。
  //    样本按 core TableColumn 的真实形状写（render 箭头 + btns 子对象）：实测在真实
  //    TableColumn 上，只把 `>` 当深度会泄漏出 `h` / `ctx`，`<` `>` 都当深度还会泄漏出
  //    `clickEvent` / `title` 等子对象键。这里的断言跑的是简化样本：注入 `>` 计数后
  //    `btns`/`last` 会丢、`clickEvent` 会泄漏 —— 两类症状都覆盖到。
  const arrow = `export interface WithArrow {
    render?: (h: RenderFn, ctx: {
      row: ModelData
      value: unknown
    }) => AnyVNode
    btns?: Array<{ name: string; clickEvent?: () => void }>
    last?: string
  }`
  const members = extractMembers(findObjectBody(arrow, 'WithArrow'))
  for (const m of ['render', 'btns', 'last']) expect(`成员漏抽取：${m}`, members.has(m))
  for (const leak of ['clickEvent']) {
    expect(`参数名/嵌套对象键被误当成顶层成员：${leak}`, !members.has(leak))
  }

  // ④ 通配再导出必须被判红 —— 否则三端把契约类型全塞进 `export * from` 就能绕过逐名核对
  expect('export * from 未被识别为通配再导出', /export\s+\*\s+from/.test(src))
  expect('无通配再导出时被误判', /export\s+\*\s+from/.test('export type { A } from "./x"') === false)

  if (failures.length) {
    console.error('❌ 守卫自证失败 —— 解析层已不可信，下面的结论都不能当真：')
    for (const f of failures) console.error(`   - ${f}`)
    return false
  }
  console.log('✅ 守卫自证通过（6 种导出形态 / hasDecl 双义 / 箭头函数深度 / 通配再导出）\n')
  return true
}

/** `export * from` 会让守卫彻底看不见契约类型，直接判红要求显式具名导出 */
function checkNoWildcardExports() {
  const offenders = []
  for (const r of RENDERERS) {
    const src = stripComments(readFileSync(join(ROOT, r.index), 'utf-8'))
    if (/export\s+\*\s+from/.test(src)) offenders.push(r.name)
  }
  if (offenders.length) {
    console.error(`❌ 以下渲染器的 index.ts 使用了 \`export * from\`：${offenders.join(', ')}`)
    console.error('   通配再导出会让本守卫无法逐名核对契约类型，请改为显式具名导出。\n')
    return false
  }
  return true
}

// ============================================================================
// 主流程
// ============================================================================

function main() {
  // 先自证再断言：解析层若退化成假绿，下面所有「✅」都不作数
  if (!selfTest()) process.exit(1)

  const contract = readContractList()
  console.log(`权威契约类型清单（PUBLIC_CONTRACT_TYPES）共 ${contract.length} 项。\n`)

  let failed = false
  const perPkg = {}

  for (const r of RENDERERS) {
    const exported = extractExportedTypeNames(r.index)
    perPkg[r.name] = exported
    const missing = contract.filter((t) => !exported.has(t))
    if (missing.length) {
      failed = true
      console.error(`❌ ${r.name} 缺失 ${missing.length} 个契约类型导出：`)
      console.error(`   ${missing.join(', ')}\n`)
    } else {
      console.log(`✅ ${r.name} 覆盖全部 ${contract.length} 个契约类型`)
    }
  }

  // ── 多导出 / 不对称：只存在于某一端的导出名 ──────────────
  const all = new Set(RENDERERS.flatMap((r) => [...perPkg[r.name]]))
  const onlyInOne = [...all].filter((n) => RENDERERS.some((r) => !perPkg[r.name].has(n)))
  const unregistered = onlyInOne.filter((n) => {
    const owners = RENDERERS.filter((r) => perPkg[r.name].has(n)).map((r) => r.name)
    // 登记表按「渲染器.类型名」登记，逐个所有者检查
    return owners.some((o) => !RENDERER_SPECIFIC.has(`${o}.${n}`))
  })
  if (unregistered.length) {
    failed = true
    console.error(`❌ 有 ${unregistered.length} 个类型只被部分渲染器导出（破坏「换 import 路径」承诺）：`)
    for (const n of unregistered) {
      const owners = RENDERERS.filter((r) => perPkg[r.name].has(n)).map((r) => r.name)
      const absent = RENDERERS.filter((r) => !perPkg[r.name].has(n)).map((r) => r.name)
      console.error(`   - ${n}：有 ${owners.join(', ')}；无 ${absent.join(', ')}`)
    }
    console.error('   要么补齐三端导出，要么逐端登记进 RENDERER_SPECIFIC 并写明原因。\n')
  } else if (onlyInOne.length) {
    console.log(`✅ ${onlyInOne.length} 个端特化导出均已登记（${onlyInOne.join(', ')}）`)
  }

  // 登记表过期：该名字如今已是三端共有，或已不再被导出
  const stale = []
  for (const key of RENDERER_SPECIFIC.keys()) {
    const dot = key.indexOf('.')
    const pkg = key.slice(0, dot)
    const name = key.slice(dot + 1)
    if (!all.has(name)) stale.push(`${key}（该类型已不再被任何端导出）`)
    else if (!onlyInOne.includes(name)) stale.push(`${key}（${name} 如今三端都导出，请移除该登记）`)
    else if (!perPkg[pkg]?.has(name)) stale.push(`${key}（${pkg} 并未导出 ${name}）`)
  }
  if (stale.length) {
    failed = true
    console.error(`❌ RENDERER_SPECIFIC 含过期条目（请清理）：`)
    for (const s of stale) console.error(`   - ${s}`)
    console.error('')
  }

  if (!checkNoWildcardExports()) failed = true

  // ── 成员级比对 ────────────────────────────────────────
  console.log('\n── 契约类型成员级比对 ──')
  let consistent = 0
  let aliasSkipped = 0
  let registeredDeviations = 0
  let registeredAdditions = 0
  const usedDeviationKeys = new Set()
  const usedAdditionKeys = new Set()
  const usedSharedAugKeys = new Set()
  const unresolvable = []

  for (const name of contract) {
    const coreInfo = { members: declMembers(CORE_SRC, name), declExists: hasDecl(CORE_SRC, name) }
    const coreIsObject = coreInfo.members !== null

    // 本契约类型下，三端各自通过 declare module 增强引入、且 core 里**没有**的成员。
    // 三端都有 → 属于「共享增强」（core 因零依赖不能声明，见 augmentMembers 注释），
    // 登记一次 SHARED_AUGMENT_MEMBERS 即可；只有部分端有 → 那是真的端特化，逐端登记。
    const augOf = new Map(RENDERERS.map((r) => [r.name, augmentMembers(r.dir, name)]))
    const sharedAug = new Set()
    if (coreIsObject) {
      const allAug = new Set(RENDERERS.flatMap((x) => [...(augOf.get(x.name) ?? [])]))
      for (const m of allAug) {
        if (coreInfo.members.has(m)) continue
        if (RENDERERS.every((x) => augOf.get(x.name)?.has(m))) sharedAug.add(m)
      }
    }

    for (const r of RENDERERS) {
      if (!perPkg[r.name].has(name)) continue
      const got = rendererMembers(r, name, coreInfo)
      if (!got || !got.declExists) {
        unresolvable.push(
          `${name} @ ${r.name}（${got ? `找到导出但未定位到声明，特化于 ${got.where}` : '解析路径中断'}）`
        )
        continue
      }
      const gotIsObject = got.members !== null

      // 并入本端 declare module 增强贡献的成员（vxeConfig / vxeOn / vxeColumn 等）。
      // 不并入的话，同一份增强在写进增强文件的端会完全隐形（守卫失明）。
      const aug = augOf.get(r.name)
      if (gotIsObject && aug?.size) {
        for (const x of aug) if (!got.members.has(x)) got.members.add(x)
      }

      // 两侧都不是对象形态（联合类型 / 工具类型）→ 成员级比对不适用，跳过而非报红
      if (!coreIsObject && !gotIsObject) {
        aliasSkipped++
        continue
      }
      // 形态错位：一端是对象、另一端不是 → 换渲染器必然类型不兼容
      if (coreIsObject !== gotIsObject) {
        failed = true
        console.error(`❌ ${name} @ ${r.name}（特化于 ${got.where}）形态不一致`)
        console.error(
          `   core 是${coreIsObject ? '对象' : '非对象（联合/工具类型）'}类型，本端是${gotIsObject ? '对象' : '非对象（联合/工具类型）'}类型`
        )
        console.error('   → 让两端同为对象声明，或让本端继续从 @es-plus/core 再导出。')
        continue
      }

      const missing = [...coreInfo.members].filter((m) => !got.members.has(m)).sort()
      const extra = [...got.members].filter((m) => !coreInfo.members.has(m)).sort()

      const unregisteredMissing = missing.filter((m) => {
        const key = `${name}.${r.name}.${m}`
        if (MEMBER_DEVIATIONS.has(key)) {
          usedDeviationKeys.add(key)
          registeredDeviations++
          return false
        }
        return true
      })
      const unregisteredExtra = []
      const unregisteredSharedAug = []
      for (const m of extra) {
        if (sharedAug.has(m)) {
          const key = `${name}.${m}`
          if (SHARED_AUGMENT_MEMBERS.has(key)) {
            usedSharedAugKeys.add(key)
          } else {
            unregisteredSharedAug.push(m)
          }
          continue
        }
        const key = `${name}.${r.name}.${m}`
        if (MEMBER_ADDITIONS.has(key)) {
          usedAdditionKeys.add(key)
          registeredAdditions++
        } else {
          unregisteredExtra.push(m)
        }
      }

      if (unregisteredMissing.length || unregisteredExtra.length || unregisteredSharedAug.length) {
        failed = true
        console.error(`❌ ${name} @ ${r.name}（特化于 ${got.where}）`)
        if (unregisteredMissing.length) {
          console.error(`   缺 ${unregisteredMissing.length} 个 core 成员：${unregisteredMissing.join(', ')}`)
        }
        if (unregisteredSharedAug.length) {
          console.error(
            `   多 ${unregisteredSharedAug.length} 个共享增强成员：${unregisteredSharedAug.join(', ')}（三端都通过 declare module 提供，core 因零依赖不能声明）`
          )
          console.error('   → 登记进 SHARED_AUGMENT_MEMBERS（key 为「类型名.成员名」，登记一次即可）')
        }
        if (unregisteredExtra.length) {
          console.error(`   多 ${unregisteredExtra.length} 个 core 没有的成员：${unregisteredExtra.join(', ')}`)
          console.error('   → 补齐，或登记进 MEMBER_ADDITIONS 并写明原因')
        }
        if (unregisteredMissing.length) {
          console.error('   → 补齐，或登记进 MEMBER_DEVIATIONS 并写明原因')
        }
      } else {
        consistent++
      }
    }
  }

  if (unresolvable.length) {
    failed = true
    console.error(`❌ 有 ${unresolvable.length} 处无法解析，守卫出现盲区（请修守卫而不是绕过）：`)
    for (const u of unresolvable) console.error(`   - ${u}`)
  }

  // 成员级登记表的过期检查
  const staleMembers = []
  for (const [label, table, used] of [
    ['MEMBER_DEVIATIONS', MEMBER_DEVIATIONS, usedDeviationKeys],
    ['MEMBER_ADDITIONS', MEMBER_ADDITIONS, usedAdditionKeys],
    ['SHARED_AUGMENT_MEMBERS', SHARED_AUGMENT_MEMBERS, usedSharedAugKeys],
  ]) {
    for (const k of table.keys()) {
      if (!used.has(k)) staleMembers.push(`${k}（在 ${label} 中但已不再是差异）`)
    }
  }
  if (staleMembers.length) {
    failed = true
    console.error(`❌ 成员级登记表含过期条目（请清理）：`)
    for (const s of staleMembers) console.error(`   - ${s}`)
    console.error('')
  }

  const totalChecks = RENDERERS.length * contract.length
  if (consistent) {
    console.log(
      `✅ ${consistent}/${totalChecks} 处成员集完全一致` +
        (aliasSkipped ? `；${aliasSkipped} 处两侧同为联合/工具类型，成员级比对不适用` : '') +
        (usedSharedAugKeys.size
          ? `；${usedSharedAugKeys.size} 个共享增强成员（三端各一份 declare module，已去重登记）`
          : '') +
        (registeredDeviations || registeredAdditions
          ? `；另有 ${registeredDeviations} 处已登记缺项 + ${registeredAdditions} 处已登记增项`
          : ''),
    )
  }

  console.log('')

  if (failed) {
    console.error('契约类型导出不一致 —— 请补齐缺失导出/成员，或同步更新 core/public-types.ts / 登记表。')
    process.exit(1)
  }
  console.log('三个渲染器契约类型导出（名字 + 成员）完全一致 ✅')
}

main()
