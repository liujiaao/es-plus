#!/usr/bin/env node
/**
 * AN-09 —— **能力矩阵三方对账**守卫（matrix ↔ schema ↔ 运行时消费点）
 *
 * ## 守什么
 *
 * 生成物对三端是同一份 JSON，但消费它的组件不是同一套。修前这类差异有三处手写 if、
 * 一份注释表格、零处校验：新增一个键时没人知道该不该补告警，也说不清「真的支持吗」。
 * 本守卫把三件事钉在一起：
 *
 *   A. **矩阵自洽**：`tableOptions.<key>` 必须是 schema 里真实存在的键（走 AN-08 的
 *      权威收集器 `collectUnknownKeys` 判，不复制实现）；三端格子齐全、level 合法、
 *      每格都有证据 note；**无引擎上下文时只有 `none` 会产告警**（`full`/`partial` 设了也不许告警，
 *      否则告警会淹掉真问题）；**引擎上下文已知时**（A8，P0-1），带 `requires.engine` 的
 *      `partial` 格在引擎不匹配时必须告警、匹配时必须安静。
 *   B. **`none` 必须真的响**：矩阵说「该端不支持」的每一格，用 `generateFromConfig`
 *      跑一遍真实生成，**schema 与 sfc 两种 mode** 的 warnings 都必须点名该键与 target。
 *      （修前正是两处各写一份告警、文案还不一致 —— 这条判据让它们不能再漂。）
 *   C. **单源消费**：七个列产出路径都必须**从 `@es-plus/core` 引入**同一个判据
 *      （`synthesizeLeadingColumns` / `buildLeadingColumns`），而不是各写一份 if。
 *      这是「同一配置三端列集合一致」的构造性保证。
 *
 *   D. **运行时剥离表**：`build-grid-config.ts` 直传的每个 vxe 键都必须在三端的
 *      `TABLE_INTERNAL_KEYS` 里 —— 否则默认引擎会把它当未知 attr 落到根节点。
 *      （实测：keepSource / printConfig 两端都漏，antdv 整组 vxe 键都没列。）
 *
 * ## 非空证明（每次跑都验，注入不红就 exit 1）
 *
 *   P1 删掉 vue3 默认引擎里的 `buildLeadingColumns(...)` → C 必须红
 *   P2 矩阵里加一个 schema 不存在的键                → A 必须红
 *   P3 让 `isSet` 永远判「没设」（设了也读不到）      → B 必须红（告警消失）
 *   P4 让 `capabilityWarnings` 在无引擎上下文时也对 partial 告警 → A6（only-none-warns）必须红
 *   P5 从 vue3 的 `TABLE_INTERNAL_KEYS` 删一个键      → D 必须红
 *   P6 删掉 partial+requires 的引擎不匹配告警          → A8 必须红
 *   P7 从 core 运行时 vxe-only 清单删一个键            → D2 必须红
 *   P8 某端 es-table 不再调用运行时告警                → D3 必须红
 *
 * P3 为什么不是「把 vue2 的 virtual 格子改成 full」：那是**改数据**——矩阵说 full，
 * B 就没有格子可查，判据是「不触发」而不是「变红」，证明不了 B 有效。要证明 B 有效，
 * 必须让**消费路径**失明而矩阵不变：B 的红必须来自 `generateFromConfig` 的 warnings 消失。
 *
 * 用法：node scripts/check-capability-parity.mjs
 * 退出码：0 = A/B/C 全绿且四种注入各自变红；1 = 有缺口或守卫失效。
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SHARED_INDEX = join(ROOT, 'packages/shared/src/index.ts')
const CAPABILITY_SRC = join(ROOT, 'packages/shared/src/capability.ts')
const GENERATOR_SRC = join(ROOT, 'packages/shared/src/structured-generator.ts')
const GRID_CONFIG_SRC = join(ROOT, 'packages/core/src/vxe-engine/build-grid-config.ts')
/** core 的运行时 vxe-only 清单（P0-1），相对仓根 —— 走 read() 以便注入伪造。 */
const RUNTIME_VXE_ONLY_SRC = 'packages/core/src/table-engine-keys.ts'

/**
 * 三端的**运行时剥离表**（D 用）。
 *
 * vxe 直传键对默认引擎没有任何意义；不列入 `TABLE_INTERNAL_KEYS` 就会被 `v-bind`
 * 当成未知 attr 落到根节点（`keepsource="false"` / `printconfig="true"`）。
 * 修 keepSource / printConfig 时实测：vue3、vue2 都漏列，antdv 整组 vxe 键都没列 ——
 * 这是「能力矩阵说 partial，但默认引擎被污染」的暗面，靠人眼看不出来。
 */
const INTERNAL_KEY_CONSUMERS = [
  ['packages/vue3/src/components/es-table/src/component.vue', 'vue3'],
  ['packages/vue2/src/components/es-table/component.vue', 'vue2'],
  ['packages/adapter-antdv/src/components/es-table/src/component.vue', 'antdv'],
]

/** 七个列产出路径（相对仓根）。顺序无关，注释即用途。 */
const COLUMN_CONSUMERS = [
  ['packages/vue3/src/components/es-table/src/component.vue', 'buildLeadingColumns', 'vue3 默认 el-table 引擎'],
  ['packages/vue3/src/components/es-table/src/engines/use-column-adapter.ts', 'synthesizeLeadingColumns', 'vue3 虚拟引擎（el-table-v2）'],
  ['packages/vue3/src/components/es-table/src/engines/use-vxe-column-adapter.ts', 'synthesizeLeadingColumns', 'vue3 vxe 适配器'],
  ['packages/vue2/src/components/es-table/component.vue', 'buildLeadingColumns', 'vue2 默认 el-table 引擎'],
  ['packages/vue2/src/components/es-table/engines/use-vxe-column-adapter.ts', 'synthesizeLeadingColumns', 'vue2 vxe 适配器'],
  ['packages/adapter-antdv/src/components/es-table/src/component.vue', 'synthesizeLeadingColumns', 'antdv 标准引擎（a-table）'],
  ['packages/adapter-antdv/src/components/es-table/src/engines/use-vxe-column-adapter.ts', 'synthesizeLeadingColumns', 'antdv vxe 适配器'],
  ['packages/adapter-antdv/src/components/es-table/src/column-adapter.ts', 'synthesizeLeadingColumns', 'antdv 批量列转换（宿主可直调）'],
]

/**
 * 每个矩阵键的**样例值**（B 用）。
 *
 * 刻意不按 schema 类型自动推：样例是「真的设置了这个键」的最小证据，自动推会把
 * 一个 object 型键推成 `{}` 而让语义失真。新增矩阵键时必须在这里登记 —— 漏了直接红，
 * 这也是一道「新增能力先想清楚怎么测」的闸。
 */
const SAMPLE = {
  'tableOptions.multiSelect': true,
  'tableOptions.snIndex': true,
  'tableOptions.virtual': true,
  'tableOptions.rowHeight': 48,
  'tableOptions.estimatedRowHeight': 40,
  'tableOptions.overscanCount': 6,
  'tableOptions.engine': 'default',
  'tableOptions.editConfig': { mode: 'row' },
  'tableOptions.expandConfig': { accordion: true },
  'tableOptions.treeConfig': { childrenField: 'children' },
  'tableOptions.cachePageSelection': true,
  // 服务端排序契约取**改键形态**：boolean 形态测不到字段名是否被 schema 认下。
  'tableOptions.sortParam': { field: 'orderBy', order: 'direction' },
  expandConfig: { fields: [{ prop: 'name' }] },
  treeConfig: { childrenField: 'children' },
  mergeConfig: { rowsBy: ['dept'] },
  'tableOptions.showFooter': true,
  'tableOptions.footerData': [['合计', 1000]],
  'tableOptions.exportConfig': { type: 'csv' },
  'tableOptions.toolbarConfig': true,
  'tableOptions.columnConfig': { resizable: true },
  'tableOptions.keepSource': true,
  'tableOptions.keyboardConfig': { isArrow: true, isEdit: true },
  'tableOptions.mouseConfig': { selected: true },
  'tableOptions.validConfig': { autoPos: true, message: 'tooltip' },
  'tableOptions.seqConfig': { startIndex: 10 },
  'tableOptions.printConfig': true,
}

/** 文件名 → 覆盖文本（注入用；正向跑为空）。 */
const overrides = new Map()
const readSrc = (absPath) => overrides.get(absPath) ?? readFileSync(absPath, 'utf-8')

let failed = false
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}

const tempDirs = []
function cleanup() {
  for (const d of tempDirs) rmSync(d, { recursive: true, force: true })
  tempDirs.length = 0
}

/** 锚点替换：容忍 CRLF（Windows 工作区实况）。锚点没命中要显式报错，不能静默不注入。 */
function replaceAnchor(src, needle, replacement, label) {
  const pairs = [
    [needle, replacement],
    [needle.replace(/\n/g, '\r\n'), replacement.replace(/\n/g, '\r\n')],
  ]
  for (const [n, r] of pairs) {
    if (src.includes(n)) return src.replace(n, r)
  }
  throw new Error(`${label}：注入锚点未命中（源码结构已变，请同步更新守卫）`)
}

/** 从 TS 源码打包。`mutate` = 文件绝对路径 → 变换函数。 */
async function loadApi(mutate = {}) {
  const cacheRoot = join(ROOT, 'node_modules/.cache')
  mkdirSync(cacheRoot, { recursive: true })
  const outDir = mkdtempSync(join(cacheRoot, 'es-capability-parity-'))
  tempDirs.push(outDir)
  const outfile = join(outDir, 'api.mjs')
  const entry = `
export {
  CAPABILITIES, CAPABILITY_TARGETS, capabilityWarnings, capabilityLevel, capabilityOf,
} from ${JSON.stringify(CAPABILITY_SRC)}
export { generateFromConfig } from ${JSON.stringify(GENERATOR_SRC)}
export { collectUnknownKeys } from ${JSON.stringify(SHARED_INDEX)}
export { StructuredCrudConfigSchema as STRUCTURED_SCHEMA } from ${JSON.stringify(SHARED_INDEX)}
`
  const plugin = {
    name: 'mutate',
    setup(b) {
      b.onLoad({ filter: /\.ts$/ }, (args) => {
        const fn = mutate[args.path]
        if (!fn) return null
        return { contents: fn(readFileSync(args.path, 'utf-8')), loader: 'ts' }
      })
    },
  }
  await build({
    stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' },
    bundle: true,
    format: 'esm',
    outfile,
    platform: 'node',
    logLevel: 'silent',
    external: ['esbuild'],
    alias: { '@es-plus/shared': SHARED_INDEX },
    plugins: [plugin],
  })
  return import(pathToFileURL(outfile).href)
}

const base = (extra = {}) => ({
  name: 'DemoManage',
  apiUrl: '/api/demo',
  fields: [{ prop: 'name', label: '名称', formtype: 'Input' }],
  actions: ['add'],
  ...extra,
})

const leafOf = (key) => key.split('.').at(-1)
const dirOf = (key) => key.split('.').slice(0, -1)

/** 把样例值放到 `a.b` 对应的嵌套位置（顶层键就是根上的键）。 */
function withPath(config, key, value) {
  const parts = key.split('.')
  const out = { ...config }
  let node = out
  for (const p of parts.slice(0, -1)) {
    node[p] = { ...(node[p] ?? {}) }
    node = node[p]
  }
  node[parts.at(-1)] = value
  return out
}

/**
 * 对一份 API 跑全部判据，返回失败描述数组（空 = 全绿）。
 * 正向与四种注入共用这一个函数。
 */
function checkSuite(api) {
  const { CAPABILITIES, CAPABILITY_TARGETS, capabilityWarnings, generateFromConfig, collectUnknownKeys, STRUCTURED_SCHEMA } = api
  const problems = []

  // ── A. 矩阵自洽 ──
  const seen = new Set()
  for (const entry of CAPABILITIES) {
    if (entry.key.split('.').length > 2) {
      problems.push(`A1 键 "${entry.key}" 层级过深 —— 只支持 tableOptions.<key> 或顶层 <key>`)
      continue
    }
    if (entry.key.includes('.') && !entry.key.startsWith('tableOptions.')) {
      problems.push(`A1 键 "${entry.key}" 的容器不是 tableOptions —— 未声明的容器不接受`)
      continue
    }
    if (seen.has(entry.key)) problems.push(`A2 矩阵键重复：${entry.key}`)
    seen.add(entry.key)

    for (const t of CAPABILITY_TARGETS) {
      const cell = entry.targets?.[t]
      if (!cell) {
        problems.push(`A3 ${entry.key} 缺 target=${t} 的格子（三端必须显式表态）`)
        continue
      }
      if (cell.level !== 'full' && cell.level !== 'partial' && cell.level !== 'none') {
        problems.push(`A3 ${entry.key}/${t} 的 level 非法：${String(cell.level)}`)
      }
      if (typeof cell.note !== 'string' || cell.note.trim().length === 0) {
        problems.push(`A4 ${entry.key}/${t} 缺 note —— 没有证据的格子不允许存在`)
      }
    }

    // 键必须真实存在于 schema：走权威未知键收集器，不复制形状遍历。
    const sample = SAMPLE[entry.key]
    if (sample === undefined) {
      problems.push(`A5 ${entry.key} 没在守卫的 SAMPLE 表里登记样例值 —— 新增能力键时必须同时写清怎么测`)
    } else {
      const dir = dirOf(entry.key)
      const leaf = leafOf(entry.key)
      const findings = collectUnknownKeys(STRUCTURED_SCHEMA, withPath(base(), entry.key, sample))
      const hit = findings.find(
        (f) =>
          f.key === leaf &&
          f.path.length === dir.length &&
          dir.every((p, i) => f.path[i] === p),
      )
      if (hit) {
        problems.push(`A5 ${entry.key} 在 schema 里不存在（收集器报为未知键：/${f.path.concat(leaf).join('/')}）`)
      }
    }

    // 只有 none 发声：full/partial 设了也不许告警。
    for (const t of CAPABILITY_TARGETS) {
      const cell = entry.targets?.[t]
      if (!cell || cell.level === 'none' || sample === undefined) continue
      const w = capabilityWarnings(t, withPath(base(), entry.key, sample))
      if (w.some((msg) => msg.includes(entry.key))) {
        problems.push(`A6 ${entry.key}/${t} 是 ${cell.level}，却产了告警 —— 只有 none 才该响：${w.join(' | ')}`)
      }
    }
  }

  // 空表 → 零告警（开关全关 / options 缺失都不该刷屏）
  for (const t of CAPABILITY_TARGETS) {
    const w = capabilityWarnings(t, { tableOptions: {} })
    if (w.length) problems.push(`A7 target=${t} 空 tableOptions 产了 ${w.length} 条告警：${w.join(' | ')}`)
    const w2 = capabilityWarnings(t, undefined)
    if (w2.length) problems.push(`A7 target=${t} config 缺失时产了 ${w2.length} 条告警`)
  }

  // A8（P0-1）：带 `requires.engine` 的 partial 格 —— 调用方给出**不匹配**的已解析引擎时必须点名该键，
  // 给出**匹配**引擎时必须安静。A6 管的是「无引擎上下文」的旧路径（仍只许 none 响），
  // 这里管的是「引擎上下文已知」的新路径：两条互不替代。
  for (const entry of CAPABILITIES) {
    const need = entry.requires?.engine
    const sample = SAMPLE[entry.key]
    if (!need || sample === undefined) continue
    const other = need === 'vxe' ? 'default' : 'vxe'
    for (const t of CAPABILITY_TARGETS) {
      const cell = entry.targets?.[t]
      if (!cell || cell.level !== 'partial') continue
      const cfg = withPath(base(), entry.key, sample)
      const miss = capabilityWarnings(t, cfg, other)
      if (!miss.some((msg) => msg.includes(entry.key))) {
        problems.push(`A8 ${entry.key}/${t} 要求 engine:'${need}'，当前引擎 '${other}' 却没有告警 —— 配置会被运行时静默忽略`)
      }
      const hit = capabilityWarnings(t, cfg, need)
      if (hit.some((msg) => msg.includes(entry.key))) {
        problems.push(`A8 ${entry.key}/${t} 引擎已是 '${need}' 仍产了告警：${hit.join(' | ')}`)
      }
    }
  }

  // ── B. none 必须真的响（两种 mode） ──
  for (const entry of CAPABILITIES) {
    const sample = SAMPLE[entry.key]
    if (sample === undefined) continue
    for (const t of CAPABILITY_TARGETS) {
      const cell = entry.targets?.[t]
      if (!cell || cell.level !== 'none') continue
      for (const mode of ['schema', 'sfc']) {
        const cfg = withPath(base({ target: t, mode }), entry.key, sample)
        let run
        try {
          run = generateFromConfig(cfg)
        } catch (err) {
          problems.push(`B1 ${entry.key}/${t}/mode=${mode} 生成抛错：${err?.message ?? err}`)
          continue
        }
        const joined = run.warnings.join('\n')
        if (!joined.includes(entry.key) || !joined.includes(`target=${t}`)) {
          problems.push(`B2 ${entry.key}/${t}/mode=${mode} 没点名该键与 target —— 矩阵说「不支持」就必须告警（实得：${joined || '（空）'}）`)
        }
      }
    }
  }

  // B3：等价写法（virtual:true ⟺ engine:'virtual'）同样要响；显式 false 不许响。
  const virt = CAPABILITIES.find((e) => e.key === 'tableOptions.virtual')
  if (!virt) {
    problems.push('B3 矩阵里没有 tableOptions.virtual —— 这是 AN-09 的核心一格')
  } else {
    const t = 'vue2'
    if (virt.targets[t].level === 'none') {
      const viaEngine = generateFromConfig(base({ target: t, tableOptions: { engine: 'virtual' } })).warnings.join('\n')
      if (!viaEngine.includes('tableOptions.virtual')) {
        problems.push("B3 vue2 + engine:'virtual' 没产 virtual 告警（二者等价，只警告字面量会漏）")
      }
      const off = generateFromConfig(base({ target: t, tableOptions: { virtual: false } })).warnings.join('\n')
      if (off.includes('tableOptions.virtual')) {
        problems.push('B3 vue2 + virtual:false 也告警了 —— 显式关闭不是「设了这个能力」')
      }
    }
  }

  // ── C. 单源消费点（源码断言） ──
  for (const [rel, helper, label] of COLUMN_CONSUMERS) {
    const abs = join(ROOT, rel)
    let src
    try {
      src = readSrc(abs)
    } catch {
      problems.push(`C0 找不到 ${rel}（${label}）—— 路径漂移，请同步守卫`)
      continue
    }
    // 必须来自 core 的单源，而不是本地重新实现。
    const coreImportRe = /import\s*(?:type\s*)?\{([\s\S]*?)\}\s*from\s*['"]@es-plus\/core['"]/g
    let imported = false
    for (let m = coreImportRe.exec(src); m; m = coreImportRe.exec(src)) {
      if (new RegExp(`\\b${helper}\\b`).test(m[1])) imported = true
    }
    if (!imported) {
      problems.push(`C2 ${rel}（${label}）没有从 '@es-plus/core' 引入 ${helper} —— 判据必须单源`)
    }
    // 单有 import 不算数：名字可能只出现在 import 块里而调用点被删/被绕开。
    if (!new RegExp(`\\b${helper}\\s*\\(`).test(src)) {
      problems.push(`C1 ${rel}（${label}）没有调用 ${helper}(...) —— 该路径会与另两端列集合漂移`)
    }
  }

  return problems
}

/** 抓一个 component.vue 的 `TABLE_INTERNAL_KEYS` 键集；结构变了返回 null（不许空集恒绿）。 */
function internalKeysOf(src) {
  const m = src.match(/const TABLE_INTERNAL_KEYS = new Set\(\[([\s\S]*?)\]\)/)
  if (!m) return null
  const keys = new Set()
  for (const t of m[1].matchAll(/['"]([A-Za-z_$][\w$]*)['"]/g)) keys.add(t[1])
  return keys
}

/**
 * vxe 一等公民（`build-grid-config.ts` 读的 `opts.<key>`）。
 * `spanMethod` 例外：它真的是 el-table 的 prop（AI-23 的显式逃生舱），必须漏出去。
 */
function vxeFirstClassKeys() {
  const src = readFileSync(GRID_CONFIG_SRC, 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
  const keys = new Set()
  for (const m of src.matchAll(/\bopts\.([A-Za-z_$][\w$]*)/g)) keys.add(m[1])
  keys.delete('spanMethod')
  return keys
}

/**
 * ── D. 运行时剥离表（默认引擎不得被 vxe 键污染）──
 *
 * @param {(rel: string) => string} read 相对仓根的源码读取（注入时可伪造）
 */
function checkInternalKeys(read) {
  const problems = []
  const wanted = vxeFirstClassKeys()
  if (wanted.size < 10) {
    problems.push(`D0 从 build-grid-config.ts 只解析出 ${wanted.size} 个直传键 —— 解析器失效`)
    return problems
  }
  for (const [rel, target] of INTERNAL_KEY_CONSUMERS) {
    let src
    try {
      src = read(rel)
    } catch {
      problems.push(`D0 找不到 ${rel}（target=${target}）—— 路径漂移，请同步守卫`)
      continue
    }
    const keys = internalKeysOf(src)
    if (!keys || keys.size < 10) {
      problems.push(`D0 ${rel} 解析不出 TABLE_INTERNAL_KEYS —— 结构已变，别让本判据空跑`)
      continue
    }
    for (const k of wanted) {
      if (!keys.has(k)) {
        problems.push(
          `D1 target=${target} 的 TABLE_INTERNAL_KEYS 缺 "${k}" —— vxe 直传键会作为未知 attr 漏到默认引擎根节点`
        )
      }
    }
  }
  return problems
}

/** core 运行时 vxe-only 清单（`table-engine-keys.ts` 的 `VXE_ONLY_TABLE_KEYS`）。结构变了返回 null。 */
function runtimeVxeOnlyKeysOf(src) {
  const m = src.match(/export const VXE_ONLY_TABLE_KEYS = \[([\s\S]*?)\] as const/)
  if (!m) return null
  return new Set([...m[1].matchAll(/['"]([A-Za-z_$][\w$]*)['"]/g)].map((t) => t[1]))
}

/**
 * ── D2/D3. 运行时 vxe-only 告警（P0-1）──
 *
 * D2：core 的运行时清单与能力矩阵 `requires.engine === 'vxe'` 的键**集合全等**
 *     （core 不能依赖 shared，只能各存一份，靠本判据锁同步）。
 * D3：三端 es-table 都必须调用 `warnVxeOnlyKeysOutsideVxe` —— 清单对了但没人调，等于没有。
 *
 * @param {{ CAPABILITIES: any[] }} api
 * @param {(rel: string) => string} read
 */
function checkRuntimeVxeOnly(api, read) {
  const problems = []
  const fromMatrix = new Set(
    api.CAPABILITIES.filter((e) => e.requires?.engine === 'vxe').map((e) => e.key.replace(/^tableOptions\./, ''))
  )
  let coreSrc
  try {
    coreSrc = read(RUNTIME_VXE_ONLY_SRC)
  } catch {
    problems.push(`D2 找不到 ${RUNTIME_VXE_ONLY_SRC} —— 路径漂移，请同步守卫`)
    return problems
  }
  const runtime = runtimeVxeOnlyKeysOf(coreSrc)
  if (!runtime || runtime.size === 0) {
    problems.push(`D2 ${RUNTIME_VXE_ONLY_SRC} 解析不出 VXE_ONLY_TABLE_KEYS —— 结构已变，别让本判据空跑`)
    return problems
  }
  for (const k of fromMatrix) {
    if (!runtime.has(k)) problems.push(`D2 矩阵说 tableOptions.${k} requires vxe，core 运行时清单却没有 —— 手写配置会静默失效`)
  }
  for (const k of runtime) {
    if (!fromMatrix.has(k)) problems.push(`D2 core 运行时清单有 ${k}，矩阵里却没有 requires vxe —— 运行时会对它误报`)
  }
  for (const [rel, target] of INTERNAL_KEY_CONSUMERS) {
    let src
    try {
      src = read(rel)
    } catch {
      continue // D0 已报
    }
    if (!/warnVxeOnlyKeysOutsideVxe\(/.test(src.replace(/\/\/.*$/gm, ''))) {
      problems.push(`D3 target=${target} 的 es-table 没有调用 warnVxeOnlyKeysOutsideVxe —— vxe-only 键在该端仍会静默失效`)
    }
  }
  return problems
}

async function main() {
  // 正向
  const api = await loadApi()
  const problems = [
    ...checkSuite(api),
    ...checkInternalKeys((rel) => readSrc(join(ROOT, rel))),
    ...checkRuntimeVxeOnly(api, (rel) => readSrc(join(ROOT, rel))),
  ]
  if (problems.length) {
    for (const p of problems) fail(p)
  } else {
    console.log(`✅ 能力矩阵三方对账通过（${api.CAPABILITIES.length} 个键 × ${api.CAPABILITY_TARGETS.length} 端；none 格双向告警；${COLUMN_CONSUMERS.length} 个列产出路径共用 core 单源；${INTERNAL_KEY_CONSUMERS.length} 端的 TABLE_INTERNAL_KEYS 覆盖 ${vxeFirstClassKeys().size} 个 vxe 直传键）`)
  }

  // ── 非空证明：每种注入都必须让**对应**判据变红 ──
  const vue3Abs = join(ROOT, 'packages/vue3/src/components/es-table/src/component.vue')

  const injections = [
    {
      name: 'P1 删掉 vue3 默认引擎的前置列合成（调用点 → []，import 名保留）',
      expect: /C1 .*packages\/vue3\/src\/components\/es-table\/src\/component\.vue/,
      override: () => {
        const src = readFileSync(vue3Abs, 'utf-8')
        const next = src.replace(
          /buildLeadingColumns\(tableOptions\.value, columnRowList\.value\)/,
          '[]',
        )
        if (next === src) throw new Error('P1 注入锚点未命中（vue3 filteredColumns 结构已变）')
        overrides.set(vue3Abs, next)
      },
    },
    {
      name: 'P2 矩阵里加一个 schema 不存在的键',
      expect: /A5 tableOptions\.phantomFlag/,
      mutate: {
        [CAPABILITY_SRC]: (s) =>
          replaceAnchor(
            s,
            'export const CAPABILITIES: readonly CapabilityEntry[] = [',
            `export const CAPABILITIES: readonly CapabilityEntry[] = [
  {
    key: 'tableOptions.phantomFlag',
    targets: { vue3: full('注入'), vue2: full('注入'), antdv: full('注入') },
  },`,
            'P2 矩阵注入',
          ),
      },
    },
    {
      name: 'P3 让 isSet 永远判「没设」（matrix 不变、消费路径失明）',
      expect: /B2 tableOptions\.virtual\/vue2/,
      mutate: {
        [CAPABILITY_SRC]: (s) =>
          replaceAnchor(
            s,
            '  if (value !== undefined && value !== false) return true',
            '  if (value !== undefined && value !== false) return false',
            'P3 isSet 失明',
          ),
      },
    },
    {
      name: 'P4 让 capabilityWarnings 在无引擎上下文时也对 partial 告警',
      expect: /A6 tableOptions\.[a-zA-Z]+/,
      mutate: {
        [CAPABILITY_SRC]: (s) =>
          replaceAnchor(
            s,
            '      resolvedEngine != null &&',
            '      true &&',
            'P4 only-none',
          ),
      },
    },
    {
      name: 'P6 删掉 partial+requires 的引擎不匹配告警',
      expect: /A8 tableOptions\.[a-zA-Z]+\/vue3 要求 engine:'vxe'/,
      mutate: {
        [CAPABILITY_SRC]: (s) =>
          replaceAnchor(
            s,
            "      cell.level === 'partial' &&",
            '      false &&',
            'P6 engine-mismatch',
          ),
      },
    },
    {
      name: 'P5 从 vue3 的 TABLE_INTERNAL_KEYS 删掉 keyboardConfig',
      expect: /D1 target=vue3 .*keyboardConfig/,
      override: () => {
        const abs = join(ROOT, INTERNAL_KEY_CONSUMERS[0][0])
        const src = readFileSync(abs, 'utf-8')
        const next = src.replace("'keyboardConfig', 'mouseConfig'", "'mouseConfig'")
        if (next === src) throw new Error('P5 注入锚点未命中（vue3 TABLE_INTERNAL_KEYS 结构已变）')
        overrides.set(abs, next)
      },
      run: () => checkInternalKeys((rel) => readSrc(join(ROOT, rel))),
    },
    {
      name: 'P7 从 core 运行时 vxe-only 清单删掉 keyboardConfig',
      expect: /D2 矩阵说 tableOptions.keyboardConfig requires vxe/,
      override: () => {
        const abs = join(ROOT, RUNTIME_VXE_ONLY_SRC)
        const src = readFileSync(abs, 'utf-8')
        const next = src.replace(/^ {2}'keyboardConfig',\r?\n/m, '')
        if (next === src) throw new Error('P7 注入锚点未命中（VXE_ONLY_TABLE_KEYS 结构已变）')
        overrides.set(abs, next)
      },
      run: () => checkRuntimeVxeOnly(api, (rel) => readSrc(join(ROOT, rel))),
    },
    {
      name: 'P8 vue2 es-table 不再调用运行时告警',
      expect: /D3 target=vue2 /,
      override: () => {
        const rel = INTERNAL_KEY_CONSUMERS.find(([, t]) => t === 'vue2')[0]
        const abs = join(ROOT, rel)
        const src = readFileSync(abs, 'utf-8')
        const next = src.replace(/warnVxeOnlyKeysOutsideVxe\(/g, 'noop(')
        if (next === src) throw new Error('P8 注入锚点未命中（vue2 es-table 没有该调用）')
        overrides.set(abs, next)
      },
      run: () => checkRuntimeVxeOnly(api, (rel) => readSrc(join(ROOT, rel))),
    },
  ]

  for (const inj of injections) {
    overrides.clear()
    try {
      inj.override?.()
    } catch (err) {
      overrides.clear()
      fail(`${inj.name}：注入锚点未命中（源码结构已变，请同步更新守卫）：${err?.message ?? err}`)
      continue
    }
    let injected
    try {
      injected = await loadApi(inj.mutate)
    } catch (err) {
      overrides.clear()
      fail(`${inj.name}：注入后打包失败（注入点已失效）：${err?.message ?? err}`)
      continue
    }
    const got = inj.run ? inj.run() : checkSuite(injected)
    overrides.clear()
    const hit = got.find((p) => inj.expect.test(p))
    if (hit) {
      console.log(`✅ 非空证明 ${inj.name} → 判据变红`)
    } else {
      fail(`非空证明失效：${inj.name} 之后没有命中 ${inj.expect}（实得：${got.length ? got.slice(0, 3).join(' | ') : '（空）'}）`)
    }
  }

  cleanup()
  if (failed) process.exit(1)
  console.log(`✅ 能力矩阵守卫（含 ${injections.length} 条非空证明）全绿`)
}

main().catch((err) => {
  cleanup()
  console.error(`❌ 守卫自身异常：${err?.stack ?? err}`)
  process.exit(1)
})
