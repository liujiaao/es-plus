#!/usr/bin/env node
/**
 * AN-08 —— **未知键判定**守卫
 *
 * 背景：Zod 的 `z.object()` 默认**静默剥掉**未知键，`safeParse` 照样回 `success: true`。
 * 修前的结果是：宿主 LLM 把 `rowkey` 写成 `rowKey`、把 `width` 写成 `widht`、把
 * `tableOptions` 的键写到顶层 —— `validate_config` 一律回「✓ 配置有效」，而产物里那个键
 * 根本不存在。这是最隐蔽的一类失败：连 issue 列表里都没有痕迹，模型无从自查。
 *
 * 本守卫守四件事：
 *   A. **判定本身**：顶层拼写错 / 层级错 / 数组元素 / record 值 / 联合交集 / `x-*` 放行，
 *      每条都断言**具体路径 + 具体建议键**（「返回了非空数组」不构成证据）。
 *   B. **前门**：`validate_config({type:'structured-crud-config'})` 对 `rowKey` 必须判非法，
 *      且错误串里带 `did you mean "rowkey"`（计划验收点名的那条）。
 *   C. **产物不泄漏**：显式 `columns` 里契约外的键（尤其 `formatter` 字符串 —— 运行时
 *      `col.formatter(...)` 是直接调用）不得进 `pageSchema`，且两种模式产出一致。
 *   D. **语料零误杀**：`__tests__/golden/cases/*.json` 全部逐条过 `validate_config`，
 *      已知键不得被报成未知键（片段语料按 `scene` 分派到各自的形状）。
 *
 * 判据走**运行时公开 API**（从 TS 源码 esbuild 打包），不复制实现里的判断。
 *
 * **非空证明**：四种注入各跑一遍同一套判据，每一种都必须让**对应**判据变红，否则 exit 1：
 *   P1 收集器返回空            → B（前门仍判合法）必须红
 *   P2 建议器恒返回 undefined  → A 的 did-you-mean 必须红
 *   P3 列清洗被跳过            → C 必须红
 *   P4 收集器把每个键都报未知  → D 必须红（语料被误杀）
 *
 * 用法：node scripts/check-unknown-keys.mjs
 * 退出码：0 = 四类判据全绿且守卫自证有效；1 = 有漏报/误报或守卫失效。
 */
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SHARED_INDEX = join(ROOT, 'packages/shared/src/index.ts')
const UNKNOWN_KEYS_SRC = join(ROOT, 'packages/shared/src/unknown-keys.ts')
const GENERATOR_SRC = join(ROOT, 'packages/shared/src/structured-generator.ts')
const VALIDATE_CONFIG_SRC = join(ROOT, 'packages/mcp-server/src/tools/validate-config.ts')
const CORPUS_DIR = join(ROOT, '__tests__/golden/cases')

let failed = false
const fail = (msg) => {
  failed = true
  console.error(`❌ ${msg}`)
}

/** 本次跑出来的打包产物目录（结束时删掉，别在仓里堆临时文件）。 */
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

/**
 * 从 TS 源码打包守卫需要的运行时代码。
 * `mutate` 是一张 `文件 → 变换函数` 的表；正向跑传空表，注入跑传入对应变换。
 *
 * `@es-plus/shared` 必须 alias 到 **src**：`validate-config.ts` 从包里引
 * `collectUnknownKeys`/`validateAndRepair`，而跑 vitest/守卫时 `build/` 可能是旧的
 * （`npm test` 不跑 `build:libs`）。指向源码才能保证「守卫验的是这次改的代码」。
 */
async function loadApi(mutate = {}) {
  // 产物落**仓内**的 node_modules/.cache：`shared` 的 index 会带进 `codegen-escape.ts`
  // → `esbuild`（原生二进制，只能 external）。external 的裸模块要从产物所在目录解析，
  // 放到系统临时目录就找不到 node_modules 了。
  const cacheRoot = join(ROOT, 'node_modules/.cache')
  mkdirSync(cacheRoot, { recursive: true })
  const outDir = mkdtempSync(join(cacheRoot, 'es-unknown-keys-'))
  tempDirs.push(outDir)
  const outfile = join(outDir, 'api.mjs')
  const entry = `
export {
  collectUnknownKeys, formatUnknownKey, suggestKey, levenshtein,
} from ${JSON.stringify(UNKNOWN_KEYS_SRC)}
export { generateFromConfig } from ${JSON.stringify(GENERATOR_SRC)}
export { StructuredCrudConfigSchema as STRUCTURED_SCHEMA } from ${JSON.stringify(SHARED_INDEX)}
export {
  validatePayload, STRUCTURED_CRUD_TYPE, ES_TABLE_TYPE, ES_FORM_TYPE, ES_DIALOG_TYPE,
} from ${JSON.stringify(VALIDATE_CONFIG_SRC)}
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

/** 一条未知键的完整指纹（路径 + 键 + 建议），用于「不多不少」的断言。 */
const fingerprint = (f) => `${f.path.length ? '/' + f.path.join('/') : ''}/${f.key}=>${f.suggestion ?? '(无建议)'}`

const base = () => ({
  name: 'DemoManage',
  apiUrl: '/api/demo',
  fields: [{ prop: 'name', label: '名称', formtype: 'Input' }],
  actions: ['add'],
})

/** 读语料（只取 `config` 与 `scene`），按文件名排序保证确定性。 */
let corpusCache
function corpus() {
  if (corpusCache) return corpusCache
  const out = []
  for (const file of readdirSync(CORPUS_DIR).filter((f) => f.endsWith('.json')).sort()) {
    const raw = JSON.parse(readFileSync(join(CORPUS_DIR, file), 'utf-8'))
    if (!raw || typeof raw !== 'object' || raw.config === undefined) continue
    out.push({ file, config: raw.config, scene: raw.scene })
  }
  corpusCache = out
  return out
}

/** 片段语料按 `scene` 分派到权威形状；其余（含显式 `scene: 'crud'`）走结构化配置。 */
function typeFor(scene, api) {
  if (scene === 'table') return api.ES_TABLE_TYPE
  if (scene === 'form') return api.ES_FORM_TYPE
  if (scene === 'dialog') return api.ES_DIALOG_TYPE
  return api.STRUCTURED_CRUD_TYPE
}

/**
 * 对一份 API 跑全部判据，返回失败描述数组（空 = 全绿）。
 * 正向与四种注入共用这一个函数 —— 注入必须走**同一套判据**才叫「判据有约束力」。
 */
function checkSuite(api) {
  const { collectUnknownKeys, suggestKey, levenshtein, formatUnknownKey, validatePayload, generateFromConfig } = api
  const problems = []
  const expectFindings = (label, value, expected) => {
    const got = collectUnknownKeys(api.STRUCTURED_SCHEMA, value).map(fingerprint).join(' | ') || '（空）'
    const want = expected || '（空）'
    if (got !== want) problems.push(`${label}：期望 ${want}，实得 ${got}`)
  }

  expectFindings('A1 顶层拼写错 nme', { ...base(), nme: 'X' }, '/nme=>name')
  expectFindings('A2 层级错 tableOptions.rowKey', { ...base(), tableOptions: { rowKey: 'id' } }, '/tableOptions/rowKey=>rowkey')
  expectFindings(
    'A3 数组元素 fields[0].widht',
    { ...base(), fields: [{ prop: 'name', label: '名称', formtype: 'Input', widht: 100 }] },
    '/fields/0/widht=>width',
  )
  // 别名是**声明过的**键（TableBtnSchema 里 label/action 与 name/actionType 同形），不是未知键。
  expectFindings('A4 别名 label/action 不误杀', { ...base(), tableBtns: [{ label: '导出', action: 'export' }] }, '')
  expectFindings('A5a x-* 扩展键放行', { ...base(), 'x-meta': { a: 1 } }, '')
  expectFindings('A5b 少个连字符的 xmeta 仍判未知', { ...base(), xmeta: 1 }, '/xmeta=>(无建议)')
  // record：键是动态的（弹窗 id），值形状要下钻。
  expectFindings(
    'A6 dialogs 的键不判、值要判',
    { ...base(), dialogs: { anyId: { title: 'X', titel: '拼错' } } },
    '/dialogs/anyId/titel=>title',
  )
  // 联合：isHidden 的表达式分支不能把 field/op/value 误报。
  expectFindings(
    'A7 联合交集（isHidden 表达式）',
    {
      ...base(),
      fields: [{ prop: 'name', label: '名称', formtype: 'Input', isHidden: { field: 'status', op: 'eq', value: 1 } }],
    },
    '',
  )
  // 联合必须**先收窄到接受该值的分支**再取交集：表达式分支是 `z.record(...)`，结构上
  // 放行任何键；若它参与交集，下面这条 `opp` 会被整条洗白 —— 而 zod 随后把 `opp` 静默
  // 剥掉、`op` 回落默认 `eq`，语义从「不等于」变成「等于」，宿主却看到「✓ 合法」。
  expectFindings(
    'A11 联合收窄（isHidden 里 opp 拼错）',
    {
      ...base(),
      fields: [{ prop: 'name', label: '名称', formtype: 'Input', isHidden: { field: 'status', opp: 'eq', value: 1 } }],
    },
    '/fields/0/isHidden/opp=>op',
  )
  // 反过来也要成立：表达式形态不得被条件分支的 findings 误伤（`or` / 算子键是记录键）。
  expectFindings(
    'A12 联合收窄（isHidden 表达式形态不误报）',
    {
      ...base(),
      fields: [
        {
          prop: 'name',
          label: '名称',
          formtype: 'Input',
          isHidden: { or: [{ '==': [{ var: 'status' }, 'pending'] }] },
        },
      ],
    },
    '',
  )
  if (collectUnknownKeys(api.STRUCTURED_SCHEMA, null).length || collectUnknownKeys(api.STRUCTURED_SCHEMA, 'x').length) {
    problems.push('A8 非对象输入必须返回空（类型错误由 Zod 自己报，不重复）')
  }
  if (suggestKey('rowKey', ['rowkey']) !== 'rowkey') {
    problems.push(`A9 建议器大小写不敏感：rowKey→rowkey，实得 ${String(suggestKey('rowKey', ['rowkey']))}`)
  }
  if (levenshtein('nme', 'name') !== 1 || suggestKey('nm', ['name']) !== undefined) {
    problems.push('A10 短键阈值：nme→name（距离 1）应给建议，nm→name（距离 2）不该给')
  }

  // ── B 前门：validate_config 必须判非法，并给出 did you mean ──
  const bad = validatePayload({ ...base(), tableOptions: { rowKey: 'id' } }, api.STRUCTURED_CRUD_TYPE)
  if (bad.valid) problems.push('B1 validate_config 对 tableOptions.rowKey 仍判为合法 —— 未知键被静默剥掉')
  if (!bad.errors.join('\n').includes('未知键 "rowKey"')) {
    problems.push(`B2 错误里没有点名 rowKey（实得：${bad.errors.join(' | ') || '（空）'}）`)
  }
  if (!bad.errors.join('\n').includes('did you mean "rowkey"')) {
    problems.push(`B3 错误里没有 did you mean "rowkey"（实得：${bad.errors.join(' | ') || '（空）'}）`)
  }
  const clean = validatePayload(base(), api.STRUCTURED_CRUD_TYPE)
  if (!clean.valid || (clean.unknownKeys ?? []).length) {
    problems.push(`B4 合规配置被误杀：valid=${clean.valid}，unknownKeys=${(clean.unknownKeys ?? []).length}`)
  }

  // ── C 产物不泄漏 ──
  const dirty = {
    ...base(),
    fields: [
      { prop: 'name', label: '名称', formtype: 'Input' },
      { prop: 'salary', label: '月薪', formtype: 'InputNumber' },
    ],
    columns: [
      { prop: 'name', label: '名称' },
      { prop: 'salary', label: '月薪', formatter: '(row) => row.salary' },
      { label: '分组', groups: [{ prop: 'name', label: '名称', widht: 80 }] },
    ],
  }
  const schemaRun = generateFromConfig(dirty)
  for (const leak of ['formatter', 'widht']) {
    if (schemaRun.code.includes(leak)) {
      problems.push(`C1 显式列里的 "${leak}" 泄漏进 pageSchema —— 运行时会把字符串当 formatter 调用 / 忽略拼错的键`)
    }
  }
  if (!schemaRun.warnings.join('\n').includes('未知键 "formatter"')) {
    problems.push('C2 剥键是静默的：警告里没有点名 formatter（宿主无从知道自己写错了）')
  }
  // 两种模式必须同一份「剥键」结论：此前 schema 泄漏、sfc 丢弃。
  const sfcOut = generateFromConfig({ ...dirty, mode: 'sfc' }).code
  for (const leak of ['formatter', 'widht']) {
    if (sfcOut.includes(leak)) problems.push(`C3 sfc 模式泄漏 "${leak}"（两种模式产物不一致）`)
  }

  // ── D 语料零误杀 ──
  for (const { file, config, scene } of corpus()) {
    const type = typeFor(scene, api)
    const findings = validatePayload(config, type).unknownKeys ?? []
    if (findings.length) {
      problems.push(`D 语料误杀 ${file}（按 ${type}）：${findings.map(formatUnknownKey).join('；')}`)
    }
  }

  return problems
}

async function main() {
  const cases = corpus()
  const problems = checkSuite(await loadApi())
  for (const p of problems) fail(p)
  if (!problems.length) {
    console.log(
      `✅ 未知键判定自洽：判定/前门/产物/语料四类判据全绿（语料 ${cases.length} 条零误杀；` +
        `顶层拼写错、层级错、数组元素、record 值、联合交集均有断言）`,
    )
  }

  // ── 非空证明：四种注入，每一种都必须让对应判据变红 ──
  const proofs = []

  // P1 收集器恒返回空 → 前门必须变红
  {
    const api = await loadApi({
      [UNKNOWN_KEYS_SRC]: (src) =>
        replaceAnchor(
          src,
          '  const out: UnknownKeyFinding[] = []\n  collect(schema, value, [], out, 0)',
          '  const out: UnknownKeyFinding[] = []',
          'P1',
        ),
    })
    proofs.push(['P1 收集器恒返回空 → 漏报必须被抓到', checkSuite(api), /A2 层级错|B1 validate_config/])
  }

  // P2 建议器恒返回 undefined → did you mean 必须红
  {
    const api = await loadApi({
      [UNKNOWN_KEYS_SRC]: (src) =>
        replaceAnchor(
          src,
          '  return best !== undefined && bestDistance <= limit ? best : undefined',
          '  return undefined',
          'P2',
        ),
    })
    proofs.push(['P2 建议器恒返回 undefined → did you mean 必须红', checkSuite(api), /A2 层级错|B3 错误里没有 did you mean/])
  }

  // P3 列清洗被跳过 → 泄漏必须被抓到
  {
    const api = await loadApi({
      [GENERATOR_SRC]: (src) => replaceAnchor(src, '  return columns.map(walk)', '  return columns', 'P3'),
    })
    proofs.push(['P3 跳过显式列清洗 → 产物泄漏必须被抓到', checkSuite(api), /C1 显式列里的/])
  }

  // P4 收集器把每个键都当未知 → 语料误杀必须被抓到
  {
    const api = await loadApi({
      [UNKNOWN_KEYS_SRC]: (src) =>
        replaceAnchor(
          src,
          '        if (key in shape || isExtensionKey(key) || allowsUnknown) continue',
          '        if (false && key in shape) continue',
          'P4',
        ),
    })
    proofs.push(['P4 收集器把每个键都报未知 → 语料误杀必须被抓到', checkSuite(api), /D 语料误杀/])
  }

  for (const [label, probs, expect] of proofs) {
    if (!probs.length) {
      fail(`非空证明失败：${label} —— 判据没有变红，说明它不具约束力`)
    } else if (!probs.some((p) => expect.test(p))) {
      fail(`非空证明失败：${label} —— 变红了，但不是预期的那条判据（实得：${probs[0]}）`)
    } else {
      console.log(`✅ 非空证明：${label} 变红（${probs.length} 条）`)
    }
  }

  if (failed) {
    console.error('\n未知键守卫失败 —— 要么存在漏报/误报，要么守卫自身失去约束力。')
    process.exit(1)
  }
  cleanup()
}

main().catch((e) => {
  cleanup()
  console.error(`❌ 守卫自身抛错：${e.stack || e.message}`)
  process.exit(1)
})
