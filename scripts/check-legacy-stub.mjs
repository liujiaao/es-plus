#!/usr/bin/env node
/**
 * `es-plus-ui` 遗留桩包（packages/es-plus-legacy）的**转发契约**守卫
 *
 * 背景（E4）：这是全仓唯一一个**不出现在任何 workflow 里**的包 —— 5 个 workflow 通篇
 * 没有它的名字，`.changeset/config.json` 的 `ignore: ["es-plus-ui"]` 是唯一引用。
 * 它之所以能被 `npm test --workspaces --if-present` / `npm run typecheck --workspaces
 * --if-present` 这类通配脚本「顺带跳过」，恰恰是因为 `--if-present` 的语义就是**没有该
 * 脚本就静默跳过**：本包只有 `prepublishOnly`，没有 typecheck / test / build。
 * 实测（本守卫的依据之一）：`npm run typecheck --workspace es-plus-ui` 直接报
 * `Missing script: "typecheck"` —— 所以「把它加进 typecheck 矩阵」不是一个可选项，
 * 加进去只会得到一个永久全红的 job（没有 src/、没有 tsconfig.json、没有 TS 可查）。
 *
 * **但它仍然是发布到 npm 的包**（`publishConfig.access: "public"`，包名 es-plus-ui），
 * 且它的全部价值就是「让老 import 路径继续可用」。它不是源码包，而是 8 个**手写**产物
 * 文件（index.mjs/cjs/d.ts、resolver.mjs/cjs/d.ts、style.css、README.md）组成的转发层。
 * 手写 + 无人守 = 与 D1「同名不同成员」同构的静默漂移：声明还在、行为已经不通。
 *
 * 本守卫钉住它真正的契约面（全部静态，不需要任何构建产物，因此能进 consistency job）：
 *
 *   1. **发布完整性**：`exports`/`main`/`module`/`types` 指向的每个文件都必须实际存在，
 *      且被 `package.json#files` 覆盖 —— 后者是 npm 的经典坑：`exports` 写了、`files`
 *      漏了，本地怎么跑都对，用户装下来就是 `ERR_MODULE_NOT_FOUND`。
 *   2. **旧入口不得消失**：README 的「What still works」逐条承诺 `es-plus-ui`、
 *      `es-plus-ui/resolver`、`es-plus-ui/dist/style.css` 三个入口。少一个 = 用户按
 *      README 写的那行 import 直接编译失败，而删掉一个 `exports` 键在 diff 里毫不起眼。
 *   3. **转发目标必须由 vue3 声明**：桩里每一处 `@es-plus/vue3[/子路径]`（含 style.css
 *      的 `@import`）都必须命中 vue3 `exports` 里的某个键（支持 `./x/*` 模式）。vue3 哪天
 *      把 `./resolver` 改名，桩不会报任何错，坏在**用户的构建**里。
 *   4. **`default` 必须在**：`export * from` 不含 default，README 承诺的
 *      `import EsPlus from 'es-plus-ui'` 靠的是显式的 `export { default }`。
 *   5. **手写 .d.ts 的类型名必须在 vue3 源里真的导出**：`resolver.d.ts` 是手抄的，
 *      vue3 重命名一个类型后它就成了「TS 解析得到、运行时不存在」的假契约。
 *   6. **弃用逃生舱在两个变体里都在**：README 明写 `ES_PLUS_SILENCE_DEPRECATION=1` 可静音，
 *      ESM/CJS 只改一处就会出现「require 进来的用户静音不掉」。
 *   7. **`sideEffects` 必须含 css**：丢了它，打包器会把 `import 'es-plus-ui/dist/style.css'`
 *      当无副作用摇掉 —— 组件渲染出来没样式，且没有任何报错。
 *   8. **依赖范围必须覆盖当前 vue3 版本，且与 README 声称的一致**：
 *      本文件动笔时 README 正写着「depends on `@es-plus/vue3@1.4.0`」，而 package.json 是
 *      `^1.6.0` —— 一条已经烂掉、且没有任何门禁看得见的对外声明（README 是发布内容之一）。
 *
 * **非空证明（守在自己身上）**：`collectProblems()` 的输入全部注入（package.json 对象、
 * vue3 的 resolver 源码、以及文件读写回调），所以每条判据都能在**不碰真实目录**的前提下
 * 用一份故意改坏的输入跑一遍；任何一条没变红就直接 exit 1 —— 不能自证的守卫等于没有。
 *
 * 用法：node scripts/check-legacy-stub.mjs
 * 退出码：0 = 转发契约自洽且守卫自证有效；1 = 发现漂移或守卫失效。
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const LEGACY_DIR = join(ROOT, 'packages/es-plus-legacy')
const VUE3_DIR = join(ROOT, 'packages/vue3')

/** README 逐条承诺过的三个 import 形态，一个都不能少。 */
const REQUIRED_ENTRY_POINTS = ['.', './resolver', './dist/style.css']

/** 桩里全部手写文件 —— 转发的 specifier 与 default 再导出都只可能出现在这些文件里。 */
const STUB_FILES = [
  'index.mjs',
  'index.cjs',
  'index.d.ts',
  'resolver.mjs',
  'resolver.cjs',
  'resolver.d.ts',
  'style.css',
]

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * npm 的 files 覆盖判定：条目可以是文件，也可以是目录（覆盖其下全部），还可以含 `*`。
 * 返回 true / false / null（无 files 字段 → npm 自行决定打包内容，本项无从判定）。
 */
function coveredByFiles(rel, files) {
  if (!Array.isArray(files) || !files.length) return null
  for (const raw of files) {
    const entry = String(raw).replace(/^\.\//, '').replace(/\/+$/, '')
    if (!entry) continue
    if (entry.includes('*')) {
      const re = new RegExp('^' + entry.split('*').map(escapeRe).join('[^/]*') + '$')
      if (re.test(rel)) return true
    } else if (rel === entry || rel.startsWith(entry + '/')) {
      return true
    }
  }
  return false
}

/** vue3 是否声明了某个子路径（支持 `./x/*` 模式键）。`sub` 形如 `.` / `./resolver`。 */
function subpathDeclared(sub, exportsMap) {
  const keys = Object.keys(exportsMap || {})
  if (keys.includes(sub)) return true
  for (const k of keys) {
    if (!k.endsWith('/*')) continue
    const prefix = k.slice(0, -1) // './schemas/*' → './schemas/'
    if (sub.startsWith(prefix) && sub.length > prefix.length) return true
  }
  return false
}

/**
 * 依赖范围是否覆盖当前 vue3 版本。支持 `^X.Y.Z` / `~X.Y.Z` / 精确 `X.Y.Z`。
 *
 * **不认识的写法一律判错，而不是放行**：`>=`、`1.x`、`workspace:*`、git url 这些形式
 * 用本函数判不了，此时静默返回「没问题」等于把一条真门禁变成装饰。宁可让改动依赖范围的
 * 人看到一条明确的「请扩展本函数」，也不要让它悄悄通过。
 *
 * @returns null = 覆盖（或已判定为不支持，不算漂移）；否则返回**判断不了的说明**。
 *          —— 注意语义：返回字符串代表「有问题」，由调用方决定措辞。
 */
function rangeCoversVersion(range, version) {
  const m = String(range).match(/^([\^~])?(\d+)\.(\d+)\.(\d+)$/)
  if (!m) {
    return `范围 ${JSON.stringify(range)} 超出本守卫可判定的形式（仅支持 ^/~ / 精确三段版本）—— 请先扩展 rangeCoversVersion() 再改依赖范围`
  }
  const [, op, maj, min, pat] = m
  const base = [Number(maj), Number(min), Number(pat)]
  const cur = String(version).split('.').map(Number)
  if (cur.length !== 3 || cur.some((n) => Number.isNaN(n))) {
    return `vue3 的 version ${JSON.stringify(version)} 不是三段版本号，无法比对`
  }
  const ok =
    op === '^'
      ? // caret：基线大版本非 0 时锁大版本；为 0 时锁次版本（语义与 npm 一致）
        base[0] !== 0
        ? cur[0] === base[0] && cmp(cur, base) >= 0
        : cur[0] === 0 && cur[1] === base[1] && cmp(cur, base) >= 0
      : op === '~'
        ? cur[0] === base[0] && cur[1] === base[1] && cmp(cur, base) >= 0
        : cmp(cur, base) === 0
  return ok ? null : `范围 ${range} 不覆盖当前的 @es-plus/vue3@${version}`
}

const cmp = (a, b) => (a[0] - b[0]) || (a[1] - b[1]) || (a[2] - b[2])

/**
 * 全部判据。输入全部注入，故可被自证用例整体替换。
 *
 * @param {{legacy: object, vue3: object, vue3ResolverSrc: string,
 *          fsx: {exists: (rel: string) => boolean, read: (rel: string) => string|null}}} input
 * @returns {string[]} 问题列表（空 = 自洽）
 */
function collectProblems({ legacy, vue3, vue3ResolverSrc, fsx }) {
  const problems = []
  const read = (rel) => fsx.read(rel)

  // ── 1. 发布完整性：exports/main/module/types 的每个目标都存在且被 files 覆盖 ──
  const targets = new Set()
  for (const value of Object.values(legacy.exports || {})) {
    if (typeof value === 'string') targets.add(value)
    else for (const v of Object.values(value || {})) targets.add(v)
  }
  for (const key of ['main', 'module', 'types']) if (legacy[key]) targets.add(legacy[key])

  for (const target of [...targets].sort()) {
    const rel = String(target).replace(/^\.\//, '')
    if (!fsx.exists(rel)) {
      problems.push(`exports/main 指向的文件不存在：${target}（发布出去的包按该路径 import 必然 404）`)
      continue // 文件都没有，files 覆盖与否已无意义
    }
    if (coveredByFiles(rel, legacy.files) === false) {
      problems.push(
        `${rel} 被 exports/main 引用却未列入 package.json#files（本地怎么跑都对，npm 装下来才 ERR_MODULE_NOT_FOUND）`
      )
    }
  }

  // ── 2. README 承诺的三个旧入口不得消失 ──
  for (const entry of REQUIRED_ENTRY_POINTS) {
    if (!subpathDeclared(entry, legacy.exports)) {
      problems.push(
        `exports 缺少 "${entry}" —— README 的「What still works」承诺过它（用户照 README 写的那行 import 会直接编译失败）`
      )
    }
  }

  // ── 3. 每处转发目标都必须由 vue3 声明 ──
  const specifiers = new Set()
  for (const file of STUB_FILES) {
    const src = read(file)
    if (src == null) {
      problems.push(`读不到桩文件 ${file}（package.json#files 里声明了它，但盘上没有）`)
      continue
    }
    // ESM `from '…'`、CJS `require('…')`、以及 style.css 的 `@import '…'`
    for (const m of src.matchAll(/(?:\bfrom\s*|\brequire\(\s*|@import\s+)['"]([^'"]+)['"]/g)) {
      if (m[1] === '@es-plus/vue3' || m[1].startsWith('@es-plus/vue3/')) specifiers.add(m[1])
    }
  }
  for (const spec of [...specifiers].sort()) {
    const sub = spec === '@es-plus/vue3' ? '.' : './' + spec.slice('@es-plus/vue3/'.length)
    if (!subpathDeclared(sub, vue3.exports)) {
      problems.push(
        `桩转发的 ${spec} 未在 vue3 的 exports 中声明（子路径 "${sub}"）—— vue3 改名后桩不会报错，坏在用户的构建里`
      )
    }
  }

  // ── 4. `export * from` 不含 default：README 承诺的默认导入靠显式再导出 ──
  for (const file of ['index.mjs', 'index.d.ts']) {
    const src = read(file)
    if (src == null) continue // 已在第 3 项报过
    if (!/export\s*\{[^}]*\bdefault\b[^}]*\}/.test(src)) {
      problems.push(`${file} 未再导出 default —— README 承诺的 \`import EsPlus from 'es-plus-ui'\` 会拿到 undefined`)
    }
  }

  // ── 5. 手写 .d.ts 里的类型名必须在 vue3 源里真的导出 ──
  const resolverDts = read('resolver.d.ts')
  if (resolverDts != null) {
    const clause = resolverDts.match(
      /export\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]@es-plus\/vue3\/resolver['"]/
    )
    if (!clause) {
      problems.push("resolver.d.ts 没有 `export { … } from '@es-plus/vue3/resolver'` 形式的再导出")
    } else {
      for (const rawName of clause[1].split(',')) {
        const name = rawName.trim().replace(/^type\s+/, '')
        if (!name) continue
        if (name === 'default') {
          if (!/export\s+default\b/.test(vue3ResolverSrc)) {
            problems.push('resolver.d.ts 再导出了 default，但 vue3 的 src/resolver.ts 没有默认导出')
          }
          continue
        }
        const decl = new RegExp(
          `export\\s+(?:declare\\s+)?(?:interface|type|function|const|class|enum)\\s+${escapeRe(name)}\\b`
        )
        if (!decl.test(vue3ResolverSrc)) {
          problems.push(
            `resolver.d.ts 再导出了 ${name}，但 vue3 的 src/resolver.ts 未导出该名字（TS 解析得到、运行时不存在）`
          )
        }
      }
    }
  }

  // ── 6. 弃用逃生舱在两个变体里都在 ──
  for (const file of ['index.mjs', 'index.cjs']) {
    const src = read(file)
    if (src != null && !src.includes('ES_PLUS_SILENCE_DEPRECATION')) {
      problems.push(`${file} 缺少 ES_PLUS_SILENCE_DEPRECATION 逃生舱 —— README 承诺可静音，改动只落在一个变体会让另一半静音不掉`)
    }
  }

  // ── 7. sideEffects 必须含 css，否则样式 import 被摇掉 ──
  const sideEffects = legacy.sideEffects
  if (!Array.isArray(sideEffects) || !sideEffects.some((p) => /\.css$/.test(String(p)))) {
    problems.push(
      'sideEffects 未包含任何 .css 模式 —— 打包器会把 `import \'es-plus-ui/dist/style.css\'` 当无副作用摇掉，组件渲染出来没有样式且不报错'
    )
  }

  // ── 8. 依赖范围覆盖当前 vue3 版本 ──
  const range = (legacy.dependencies || {})['@es-plus/vue3'] ?? (legacy.peerDependencies || {})['@es-plus/vue3']
  if (!range) {
    problems.push('未在 dependencies/peerDependencies 声明 @es-plus/vue3 —— 桩的转发目标必须可解析')
  } else {
    const verdict = rangeCoversVersion(range, vue3.version)
    if (verdict) problems.push(verdict)
  }

  // ── 9. README 声称的依赖范围必须等于 package.json 的实际范围 ──
  const readme = read('README.md')
  if (readme == null) {
    problems.push('读不到 README.md（它是 files 之一，也是被发布的对外说明）')
  } else {
    const claims = [...readme.matchAll(/@es-plus\/vue3@([^\s`()]+)/g)].map((m) => m[1].trim())
    if (!claims.length) {
      problems.push('README 未声明 @es-plus/vue3 的依赖范围，本守卫无从比对（请写成 `@es-plus/vue3@<range>`）')
    }
    for (const claim of claims) {
      if (claim !== range) {
        problems.push(`README 声称依赖 @es-plus/vue3@${claim}，package.json 实为 ${range}（README 是发布内容，会随包一起发给用户）`)
      }
    }
  }

  return problems
}

function main() {
  const tryRead = (abs) => {
    try {
      return readFileSync(abs, 'utf-8')
    } catch {
      return null
    }
  }

  const real = {
    legacy: JSON.parse(tryRead(join(LEGACY_DIR, 'package.json'))),
    vue3: JSON.parse(tryRead(join(VUE3_DIR, 'package.json'))),
    vue3ResolverSrc: tryRead(join(VUE3_DIR, 'src/resolver.ts')) ?? '',
    fsx: {
      exists: (rel) => existsSync(join(LEGACY_DIR, rel)),
      read: (rel) => tryRead(join(LEGACY_DIR, rel)),
    },
  }

  const problems = collectProblems(real)
  if (problems.length) {
    for (const p of problems) console.error(`❌ ${p}`)
  } else {
    const forwarded = new Set()
    for (const file of STUB_FILES) {
      for (const m of (real.fsx.read(file) ?? '').matchAll(
        /(?:\bfrom\s*|\brequire\(\s*|@import\s+)['"]@es-plus\/vue3([^'"]*)['"]/g
      )) {
        forwarded.add('@es-plus/vue3' + m[1])
      }
    }
    console.log(
      `✅ es-plus-ui 遗留桩转发契约自洽（${REQUIRED_ENTRY_POINTS.length} 个旧入口齐全；` +
        `${forwarded.size} 处转发目标均已被 vue3 声明：${[...forwarded].sort().join(' / ')}；` +
        `依赖 ${real.legacy.dependencies['@es-plus/vue3']} 覆盖 vue3@${real.vue3.version}）`
    )
  }

  // ── 非空证明：每一条判据都必须能红（输入全部注入，不碰真实目录）──
  const mutate = (patch) => ({ ...real, legacy: { ...real.legacy, ...patch } })
  const withoutKey = (obj, key) => Object.fromEntries(Object.entries(obj || {}).filter(([k]) => k !== key))
  const patchFiles = (map) => ({
    ...real,
    fsx: {
      ...real.fsx,
      read: (rel) => (rel in map ? map[rel] : real.fsx.read(rel)),
      exists: (rel) => (map[rel] === null ? false : real.fsx.exists(rel)),
    },
  })

  const proofs = [
    [
      'P1 exports 指向不存在的文件',
      mutate({ exports: { ...real.legacy.exports, './resolver': { import: './resolver.gone.mjs' } } }),
      /指向的文件不存在/,
    ],
    [
      'P2 exports 引用但 files 未覆盖',
      mutate({ files: real.legacy.files.filter((f) => f !== 'style.css') }),
      /未列入 package.json#files/,
    ],
    [
      'P3 vue3 不再声明被转发的子路径',
      // 必须**真的删掉键**：写成 `{ ...exports, './resolver': undefined }` 看着像删除，
      // 但 Object.keys 仍然含它，判据不会红（本守卫的第一版自证就踩了这个 —— 于是
      // 报「判据不具约束力」，而真正错的是注入而不是判据）。
      { ...real, vue3: { ...real.vue3, exports: withoutKey(real.vue3.exports, './resolver') } },
      /未在 vue3 的 exports 中声明/,
    ],
    [
      'P4 index.mjs 丢掉 default 再导出',
      patchFiles({ 'index.mjs': 'export * from \'@es-plus/vue3\'\n' }),
      /未再导出 default/,
    ],
    [
      'P5 .d.ts 再导出一个 vue3 源里没有的类型名',
      patchFiles({ 'resolver.d.ts': "export { EsPlusResolverGone } from '@es-plus/vue3/resolver'\n" }),
      /未导出该名字/,
    ],
    [
      'P6 CJS 变体丢掉弃用逃生舱',
      patchFiles({ 'index.cjs': "module.exports = require('@es-plus/vue3')\n" }),
      /逃生舱/,
    ],
    ['P7 sideEffects 丢掉 css', mutate({ sideEffects: [] }), /sideEffects/],
    [
      'P8 依赖范围不覆盖当前 vue3',
      mutate({ dependencies: { ...real.legacy.dependencies, '@es-plus/vue3': '^0.1.0' } }),
      /不覆盖当前的 @es-plus\/vue3/,
    ],
    [
      'P9 依赖范围形式不可判定（不得静默放行）',
      mutate({ dependencies: { ...real.legacy.dependencies, '@es-plus/vue3': '>=1.6.0' } }),
      /超出本守卫可判定的形式/,
    ],
    [
      'P10 README 声称的范围与 package.json 不一致',
      patchFiles({ 'README.md': '依赖 `@es-plus/vue3@1.4.0`\n' }),
      /README 声称依赖/,
    ],
  ]

  let proofsFailed = 0
  for (const [label, input, expect] of proofs) {
    const got = collectProblems(input)
    if (!got.length) {
      console.error(`❌ 非空证明失败：${label} —— 判据没有变红，说明它不具约束力`)
      proofsFailed++
    } else if (!got.some((p) => expect.test(p))) {
      console.error(`❌ 非空证明失败：${label} —— 变红了，但不是预期的那条判据（实得：${got[0]}）`)
      proofsFailed++
    } else {
      console.log(`✅ 非空证明：${label} 变红`)
    }
  }

  if (problems.length || proofsFailed) {
    console.error(
      '\nes-plus-ui 遗留桩守卫失败 —— 桩的转发面与实际不一致，或守卫自身失效。\n' +
        '排查提示：桩是 8 个手写产物文件，改动 @es-plus/vue3 的 exports 后请同步更新它们。'
    )
    process.exit(1)
  }
}

main()
