/**
 * Tier B 类型腿（AN-14；A5 起默认**全量**，抽样降级开关保留）：捕获「语法正确但类型不正确」的产物。
 *
 * ## 与 Tier A 的分工
 *
 *   - Tier A（`compile-leg.mjs`）：`@vue/compiler-sfc` / esbuild 把产物**编译**一遍。
 *     它证明模板能编译、脚本能解析，但对「类型」一无所知 ——
 *     `const formItems = [{ formtype: 'Input' }]` 编译得过，赋给 `FormItemOption[]`
 *     却是错的；引用了不存在的类型名、事件处理器签名不对，也全都编译得过。
 *   - Tier B（本文件）：把产物放进一个**临时工程**（`vue` + 对应 UI 库 +
 *     `@es-plus/<target>`），用 `vue-tsc --noEmit` 做类型检查。Volar 会把模板里的
 *     `:schema` / `@btn-click` 也按组件的 prop/emit 类型检查 —— 这正是
 *     「事件签名写错」能红的机制（全局组件通过 `shims.d.ts` 的 `GlobalComponents` 映射）。
 *
 * ## 为什么用「TS 投影」而不是原样产物
 *
 * 当前 216 条金标语料全是 JS（`typescript: false`），而 Volar **只在 TS SFC
 * （`lang="ts"`）里做模板类型检查**；JS 产物在类型腿上等于恒定通过 —— 一条看不见的
 * 红盲。本腿因此对每个 config 重新生成 `{ ...config, typescript: true }` 的产物再检查：
 * 同一份发射器、同一份配置，只是让它产出类型化的那一版。这样：
 *   1. 金标也能被度量（否则 216 条全是「跳过」，腿等于不存在）；
 *   2. 验收条件（缺 `import type { CrudPageSchema }`、事件签名错误）本身就是 TS 属性，
 *      在 JS 产物里无从谈起。
 * 这是对计划字面（「抽样 N=10 模型产物 + 全部金标」）的**偏差**，记入落地记录。
 * A5 起模型产物也改为**全量**（`eval-llm.mjs` 的 `TYPECHECK_FULL`）：抽样每端 10 条时，
 * 带 `expandConfig` / 自定义 `render` 的那类产物大概率一条都没被抽到，而「类型腿 100%」
 * 印在产物里读起来像全量结论。`sampleTypecheckCases` 保留为降级开关。
 * 注意方向：全量让这条腿**更容易**红（样本多了、覆盖的产物形态全了），不是更宽松。
 *
 * ## 依赖
 *
 * 临时工程从仓库根的 `node_modules` 解析 `vue` / UI 库 / `@es-plus/<target>`；后者按
 * `dist/index.d.ts` 解析，故运行前必须有**新鲜的**组件构建产物（根脚本
 * `npm run build:components`）。缺 dist 时本腿**抛错**而不是静默跳过 —— 跳过就是红盲。
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { generateFromConfig } from '@es-plus/shared'

const require = createRequire(import.meta.url)

/** target → 从哪个包解析组件/类型。 */
export const TYPECHECK_TARGETS = {
  vue3: { pkg: '@es-plus/vue3', dist: 'packages/vue3/dist/index.d.ts' },
  vue2: { pkg: '@es-plus/vue2', dist: 'packages/vue2/dist/index.d.ts' },
  antdv: { pkg: '@es-plus/adapter-antdv', dist: 'packages/adapter-antdv/dist/index.d.ts' },
}

/** 生成物模板里会用到的全局组件（kebab 与 Pascal 两套名字都映射）。 */
const GLOBAL_COMPONENTS = ['EsCrudPage', 'EsTable', 'EsForm', 'EsDialog']

/** SFC 判据与 `compile-leg.mjs` 同源口径：出现 `<template>` / `<script>` 标签。 */
const SFC_RE = /<\s*(?:template|script)\b/i

/**
 * 临时工程 tsconfig。刻意**宽松**（`strict: false`）：
 *   - 本腿要抓的是「产物与自己声明的类型不符」（TS2322/TS2339/TS2741…），
 *     不是风格或严格空值问题；严格模式会让 JS 风格生成物满屏 noImplicitAny，
 *     把真信号淹掉。
 *   - `skipLibCheck: true`（计划字面）：不检查三方 d.ts；`types: []` 避免宿主把
 *     本仓的全局类型塞进来，临时工程只看见显式 import 的东西。
 */
export function typecheckTsconfig() {
  return {
    compilerOptions: {
      target: 'ESNext',
      module: 'ESNext',
      moduleResolution: 'bundler',
      jsx: 'preserve',
      strict: false,
      skipLibCheck: true,
      noEmit: true,
      allowJs: false,
      types: [],
      lib: ['ESNext', 'DOM'],
    },
    // `shims.d.ts` 必须显式纳入根文件：只写 `cases/**/*` 时它不被加载，
    // 于是 `GlobalComponents` 从不生效、模板里的 `:schema` / `@btn-click` **完全不检查** ——
    // 腿会静默变成「只查 script」的假绿（自测里 bad-event 咬不住就是这么暴露的）。
    include: ['cases/**/*', '*.d.ts'],
  }
}

/**
 * 全局组件声明：让 Volar 把模板里的 `<es-table :columns>` / `@btn-click` 按真实组件
 * 的 props/emits 检查。kebab 与 PascalCase 两套名字都映射（生成物用 kebab，
 * 手写页面常用 PascalCase，二者是同一个组件）。
 */
export function typecheckShims(target, { pkg = TYPECHECK_TARGETS[target]?.pkg } = {}) {
  if (!pkg) throw new Error(`typecheckShims: 未知 target ${target}`)
  const lines = [`declare module 'vue' {`, `  interface GlobalComponents {`]
  for (const name of GLOBAL_COMPONENTS) {
    const kebab = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
    lines.push(`    ${name}: typeof import('${pkg}').${name}`)
    lines.push(`    '${kebab}': typeof import('${pkg}').${name}`)
  }
  lines.push(`  }`, `}`)
  // 结尾的 `export {}` 不能省：没有它，文件是**脚本**，`declare module 'vue'` 会被当成
  // 「重新声明整个 vue 模块」而不是「给真实 vue 增量补 GlobalComponents」—— 模板检查静默失效
  // （实测：去掉它，事件签名错的产物照样判绿）。
  lines.push(`export {}`)
  return lines.join('\n') + '\n'
}

/**
 * 一份 `generateFromConfig` 产物 → 临时工程里的文件列表。
 *
 * schema 模式是 `code`（pageSchema 模块）+ `wrapperCode`（SFC）：schema 必须落成
 * **`schema.ts`**（wrapper 里写死了 `import { pageSchema } from './schema'`，
 * 文件名不能改）。sfc 模式只有一份整份 SFC。
 */
export function productFiles(result) {
  if (!result) return []
  const files = []
  if (typeof result.code === 'string' && result.code.trim()) {
    const isSfc = SFC_RE.test(result.code)
    files.push({ name: isSfc ? 'page.vue' : 'schema.ts', content: result.code })
  }
  if (typeof result.wrapperCode === 'string' && result.wrapperCode.trim()) {
    files.push({ name: 'page.vue', content: result.wrapperCode })
  }
  return files
}

/** `UserManage` → `user-manage`；仅用于临时目录名，可读性优先。 */
function safeId(id) {
  return String(id || 'case')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'case'
}

/**
 * 按 target 抽样：**每个 target 至多 N 条**，保持输入顺序（确定性）。
 *
 * 模型产物按 target 抽样（计划字面 N=10），而不是全局抽 10 条 —— 三端组件类型
 * 差异很大（vue2 的 `MessageBox`、antdv 的 `message`），某一端被抽没就等于没测。
 */
export function sampleTypecheckCases(items, { perTarget = 10 } = {}) {
  const seen = new Map()
  const out = []
  for (const item of Array.isArray(items) ? items : []) {
    // 与全仓口径一致：config 里省略 target 就是 vue3（goldens 中 154/216 如此）。
    const t = item?.target || 'vue3'
    const n = seen.get(t) ?? 0
    if (n >= perTarget) continue
    seen.set(t, n + 1)
    out.push(item)
  }
  return out
}

/**
 * 把 config 列表变成可检查的 case（生成 TS 投影产物）。
 * 生成器抛错的条目保留为 `{ error }`（与 Tier A 的分母纪律一致：没有产物 ⟹ 不计入类型分母）。
 */
export function buildTypecheckCases(configs) {
  return (Array.isArray(configs) ? configs : []).map(({ id, target, config }) => {
    // 省略 target 即 vue3（scenes.mjs 的口径）；不能让 undefined 流到 runTypecheck。
    const t = target || config?.target || 'vue3'
    try {
      const product = generateFromConfig({ ...config, typescript: true })
      const files = productFiles(product)
      if (files.length === 0) {
        return { id, target: t, error: '生成器没有返回产物' }
      }
      return { id, target: t, files }
    } catch (e) {
      return { id, target: t, error: e instanceof Error ? e.message : String(e) }
    }
  })
}

/** 临时工程根：在仓库 `node_modules` 下（解析 vue/UI 库时向上查找即可）。 */
export function defaultTypecheckDir(cwd) {
  return join(cwd, 'node_modules', '.esplus-typecheck')
}

/**
 * 写一个 target 的临时工程；返回 tsconfig 路径。`shims` 可覆盖（meta 测试用 stub 包）。
 */
export function writeTypecheckProject({ dir, target, cases, shims }) {
  const root = join(dir, target)
  mkdirSync(root, { recursive: true })
  writeFileSync(join(root, 'tsconfig.json'), JSON.stringify(typecheckTsconfig(), null, 2))
  writeFileSync(join(root, 'shims.d.ts'), shims ?? typecheckShims(target))
  for (const c of cases) {
    if (!c.files) continue
    const cd = join(root, 'cases', safeId(c.id))
    mkdirSync(cd, { recursive: true })
    for (const f of c.files) writeFileSync(join(cd, f.name), f.content)
  }
  return join(root, 'tsconfig.json')
}

/**
 * 解析 `vue-tsc`/`tsc` 的诊断行：`path(line,col): error TSxxxx: message`。
 *
 * 只取首行：后续缩进行是解释（Types of parameters…），保留会稀释「哪条用例哪个文件」。
 * 路径统一成正斜杠，并按 `cases/<id>/` 反推 case id（与 `safeId` 的目录名一致）。
 */
export function parseTypecheckDiagnostics(output, { dir } = {}) {
  const text = String(output || '')
  const re = /^(.*?)\((\d+),(\d+)\): error (TS\d+): (.*)$/gm
  const out = []
  let m
  while ((m = re.exec(text))) {
    const file = m[1].split(sep).join('/')
    const marker = dir ? `${String(dir).split(sep).join('/')}/` : ''
    const rel = marker && file.startsWith(marker) ? file.slice(marker.length) : file
    const idm = rel.match(/cases\/([^/]+)\//)
    out.push({
      id: idm ? idm[1] : null,
      file: idm ? rel.slice(idm.index + idm[0].length) : rel,
      line: Number(m[2]),
      column: Number(m[3]),
      code: m[4],
      message: m[5],
    })
  }
  return out
}

/** 组件包 dist 是否齐全；返回缺失列表（空数组 = 齐全）。 */
export function missingComponentDists(cwd) {
  return Object.entries(TYPECHECK_TARGETS)
    .filter(([, meta]) => !existsSync(join(cwd, meta.dist)))
    .map(([target, meta]) => `${target} (${meta.dist})`)
}

/**
 * 真正跑一遍：按 target 各起一个 `vue-tsc --noEmit` 进程。
 *
 * @param {object} opts
 * @param {string} opts.cwd 仓库根（便于解析 node_modules）
 * @param {Array<{id:string,target:string,files?:Array,error?:string}>} opts.cases
 * @param {string} [opts.dir] 临时工程根（默认 `node_modules/.esplus-typecheck`）
 * @param {object} [opts.shims] `{ [target]: string }`，覆盖自动生成的 GlobalComponents
 * @param {boolean} [opts.keep] 保留临时工程（排障用）
 * @param {number} [opts.timeoutMs]
 * @returns {Array<{id,target,typechecks:boolean|null,diagnostics:Array,error:string|null}>}
 */
export function runTypecheck({ cwd, cases, dir = defaultTypecheckDir(cwd), shims, keep = false, timeoutMs = 240000 }) {
  const list = Array.isArray(cases) ? cases : []
  const byTarget = new Map()
  for (const c of list) {
    if (!byTarget.has(c.target)) byTarget.set(c.target, [])
    byTarget.get(c.target).push(c)
  }
  if (byTarget.size === 0) return []

  const missing = [...byTarget.keys()].filter((t) => !TYPECHECK_TARGETS[t])
  if (missing.length) throw new Error(`runTypecheck: 未知 target ${missing.join(', ')}`)

  rmSync(dir, { recursive: true, force: true })
  const rows = []
  try {
    for (const [target, targetCases] of byTarget) {
      const checkable = targetCases.filter((c) => !c.error)
      if (checkable.length === 0) {
        for (const c of targetCases) rows.push({ id: c.id, target, typechecks: null, diagnostics: [], error: c.error })
        continue
      }
      const tsconfig = writeTypecheckProject({ dir, target, cases: checkable, shims: shims?.[target] })
      const bin = require.resolve('vue-tsc/bin/vue-tsc.js')
      // cwd 必须是仓库根：临时工程在 node_modules 下，靠向上查找解析 vue / UI 库。
      const r = spawnSync(process.execPath, [bin, '--noEmit', '-p', tsconfig], {
        cwd,
        encoding: 'utf8',
        timeout: timeoutMs,
        shell: false,
      })
      const out = `${r.stdout || ''}\n${r.stderr || ''}`
      const diagnostics = parseTypecheckDiagnostics(out, { dir })
      if (r.status !== 0 && diagnostics.length === 0) {
        // 进程崩了 / 找不到 vue-tsc / dist 缺类型：这不是「产物有类型错」，是**腿没跑起来**。
        // 静默记成通过就是红盲，必须抛。
        throw new Error(`vue-tsc 未能产出诊断（${target}, exit=${r.status}）：\n${out.trim().slice(0, 2000)}`)
      }
      const byId = new Map()
      for (const d of diagnostics) {
        if (!d.id) continue
        if (!byId.has(d.id)) byId.set(d.id, [])
        byId.get(d.id).push(d)
      }
      for (const c of targetCases) {
        if (c.error) {
          rows.push({ id: c.id, target, typechecks: null, diagnostics: [], error: c.error })
          continue
        }
        const ds = byId.get(safeId(c.id)) ?? []
        rows.push({ id: c.id, target, typechecks: ds.length === 0, diagnostics: ds, error: null })
      }
    }
  } finally {
    if (!keep) rmSync(dir, { recursive: true, force: true })
  }
  return rows
}

/** `file:line:col — TSxxxx: message`。 */
export function fmtTypecheckDiagnostic(d) {
  return `${d.file}:${d.line}:${d.column} — ${d.code}: ${d.message}`
}

/**
 * 类型腿汇总（纯函数）。
 *
 * 分母与 Tier A 同一纪律：只算**有产物**的 case（`!error`）。生成器抛错/模型答错的行
 * 没有产物，记进类型分母会把「没测」当成「类型错」。
 *
 * `modelFailureTypecheck`：产物类型正确、但该行不满足 95% 定义 —— 那是准确率门禁的事，
 * 与 Tier A 的 `modelFailureCompile` 同构，分开计数避免读者把语义 miss 读成类型缺陷。
 */
export function summarizeTypecheck(rows, passes95 = () => true) {
  const all = Array.isArray(rows) ? rows : []
  const measured = all.filter((r) => !r.error)
  const checked = measured.filter((r) => r.typechecks === true || r.typechecks === false)
  const okRows = checked.filter((r) => r.typechecks)
  const failRows = checked.filter((r) => !r.typechecks)
  return {
    measured: measured.length,
    checked: checked.length,
    ok: okRows.length,
    rate: checked.length ? okRows.length / checked.length : null,
    failure: failRows.length,
    modelFailureTypecheck: okRows.filter((r) => !passes95(r)).length,
    failureSamples: failRows.slice(0, 5).map((r) => {
      const first = r.diagnostics[0]
      return `${r.id} [${r.target}] — ${first ? fmtTypecheckDiagnostic(first) : '(no diagnostic)'}`
    }),
    notRun: measured.length - checked.length,
  }
}
