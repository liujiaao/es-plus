/**
 * 「把产物放进临时工程跑 `vue-tsc --noEmit`」的**与生成器无关**的那一半。
 *
 * 两个消费者共用：
 *   - `scripts/eval/typecheck-leg.mjs`：eval 里的 Tier B 类型腿（模型产物 + 金标投影）；
 *   - `scripts/check-generated-typecheck.mjs`：零模型确定性探针（能力面最宽形状）。
 *
 * 这里刻意不 import 生成器：探针用 `loadGenerator()`（shared/src 的 esbuild 打包），
 * eval 用 `@es-plus/shared`（build/），两条链的产物来源不同，**尺子必须同一把**。
 *
 * 依赖：临时工程从仓库根的 `node_modules` 解析 `vue` / UI 库 / `@es-plus/<target>`；
 * 后者按 `dist/index.d.ts` 解析，故运行前必须有**新鲜的**组件构建产物
 * （根脚本 `npm run build:components`）。缺 dist 时调用方应**报错**而不是跳过 ——
 * 跳过就是红盲。
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

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
 *   - 要抓的是「产物与自己声明的类型不符」（TS2322/TS2339/TS2741…），不是风格或
 *     严格空值问题；严格模式会让 JS 风格生成物满屏 noImplicitAny，把真信号淹掉。
 *   - `skipLibCheck: true`：不检查三方 d.ts；`types: []` 避免宿主把本仓的全局类型
 *     塞进来，临时工程只看见显式 import 的东西。
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
export function safeId(id) {
  return (
    String(id || 'case')
      .replace(/[^\w.-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'case'
  )
}

/**
 * 按 target 抽样：**每个 target 至多 N 条**，保持输入顺序（确定性）。
 *
 * 模型产物按 target 抽样，而不是全局抽 N 条 —— 三端组件类型差异很大
 * （vue2 的 `MessageBox`、antdv 的 `message`），某一端被抽没就等于没测。
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
 * @returns {Array<{id,target,typechecks:boolean|null,notMeasured?:boolean,diagnostics:Array,error:string|null}>}
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

  // 全部 case 都没有产物 ⟹ 这条腿**一条也没测**。静默返回全 null 会被下游读成
  // 「没有类型错误」或「跳过」，两种读法都是红盲：Tier B 的存在意义就是度量类型。
  // 有产物但一个都不可检查（例如生成器全抛）同样是没测，不是通过。
  const checkableTotal = list.filter((c) => !c.error && Array.isArray(c.files) && c.files.length > 0).length
  if (list.length > 0 && checkableTotal === 0) {
    throw new Error(
      `typecheck 腿没有可检查的产物（${list.length} 条全部缺产物/抛错）—— 这不是「类型全对」，是没测到；` +
        `首条原因：${list[0]?.error ?? '未知'}`
    )
  }

  rmSync(dir, { recursive: true, force: true })
  const rows = []
  try {
    for (const [target, targetCases] of byTarget) {
      const checkable = targetCases.filter((c) => !c.error && Array.isArray(c.files) && c.files.length > 0)
      if (checkable.length === 0) {
        for (const c of targetCases) {
          rows.push({ id: c.id, target, typechecks: null, notMeasured: true, diagnostics: [], error: c.error })
        }
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
      let unmapped = 0
      for (const d of diagnostics) {
        if (!d.id) { unmapped++; continue }
        if (!byId.has(d.id)) byId.set(d.id, [])
        byId.get(d.id).push(d)
      }
      // 诊断存在但一条都落不到 case 上（例如报在 shims.d.ts / tsconfig 里）：逐 case
      // 看都是「无诊断」⟹ 全部判绿，与崩溃同级的红盲。这里必须抛，不能放行。
      if (r.status !== 0 && byId.size === 0) {
        throw new Error(
          `vue-tsc 报了 ${unmapped} 条诊断，但没有一条能归到 case 上（${target}）—— ` +
            `路径映射失效，类型腿会静默全绿：\n${out.trim().slice(0, 2000)}`
        )
      }
      for (const c of targetCases) {
        if (c.error || !Array.isArray(c.files) || c.files.length === 0) {
          rows.push({ id: c.id, target, typechecks: null, notMeasured: true, diagnostics: [], error: c.error ?? '生成器没有返回产物' })
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
    // R4/L8：覆盖率与 rate 并列。rate 的分母是**真被检查**的行；没有覆盖率，
    // 「难的行被跳过」就会伪装成「类型全对」。分母 = 本次交给类型腿的全部用例。
    sampled: all.length,
    coverage: all.length ? Number((checked.length / all.length).toFixed(4)) : null,
    failure: failRows.length,
    modelFailureTypecheck: okRows.filter((r) => !passes95(r)).length,
    failureSamples: failRows.slice(0, 5).map((r) => {
      const first = r.diagnostics[0]
      return `${r.id} [${r.target}] — ${first ? fmtTypecheckDiagnostic(first) : '(no diagnostic)'}`
    }),
    notRun: measured.length - checked.length,
    // 「没测到」必须与「测了且通过」分开计数：rate 的分母只有 checked，
    // 但读的人需要看见有多少行根本没进分母（无产物 / 不可检查）。
    notMeasured: all.filter((r) => r.notMeasured === true || r.typechecks === null).length,
  }
}
