#!/usr/bin/env node
/**
 * Tier B 类型腿自测（AN-14，meta-eval，无需 API key，进 CI 的 check:consistency）。
 *
 * 这条腿的验收条件只有一句：**缺 `import type { CrudPageSchema }` 或事件签名错误时能红**。
 * 「能红」必须由真跑 `vue-tsc` 证明 —— 只测纯函数等于测了尺子的刻度，没测它是否量得到东西。
 * 因此这里建一个**自包含**的临时工程（stub UI 包 + GlobalComponents），跑三份最小产物：
 *
 *   1) 正常产物 → 绿（否则腿是恒红的）；
 *   2) schema 里写了 `: CrudPageSchema` 却没 import → 红（验收前半句）；
 *   3) `@btn-click` 绑定 `(n: number) => void` → 红（验收后半句；靠 GlobalComponents 映射
 *      到 stub 组件的 emit 签名，与真实组件同机制）。
 *
 * 另有纯函数断言：诊断解析（位置/case 归属）、分母纪律（无产物不计入）、按 target 抽样。
 *
 * 用法：node scripts/eval/typecheck-leg.test.mjs
 * 退出码：0 = 腿的判据全部成立；1 = 至少一条失效。
 */
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import {
  productFiles,
  sampleTypecheckCases,
  parseTypecheckDiagnostics,
  runTypecheck,
  summarizeTypecheck,
  fmtTypecheckDiagnostic,
} from './typecheck-leg.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')

let failures = 0
function check(cond, msg) {
  if (cond) return
  failures++
  console.error(`  ✗ ${msg}`)
}

// ── 1) 纯函数：产物 → 文件 ────────────────────────────
{
  const schema = productFiles({ code: 'export const pageSchema = {}', wrapperCode: '<template></template>' })
  check(schema.length === 2, `schema 产物应拆成两个文件，实得 ${schema.length}`)
  check(schema[0].name === 'schema.ts', `schema 模块必须叫 schema.ts（wrapper 里写死了 './schema'），实得 ${schema[0].name}`)
  check(schema[1].name === 'page.vue', `wrapper 必须叫 page.vue，实得 ${schema[1].name}`)

  const sfc = productFiles({ code: '<template>\n  <div />\n</template>' })
  check(sfc.length === 1 && sfc[0].name === 'page.vue', 'sfc 产物应只有一份 page.vue')
  check(productFiles(null).length === 0, '空产物应返回空文件列表')
}

// ── 2) 纯函数：诊断解析 ──────────────────────────────
{
  const dir = 'node_modules/.esplus-typecheck'
  const out = [
    'node_modules/.esplus-typecheck/vue3/cases/01-a/page.vue(12,7): error TS2322: Type X is not assignable',
    '  Types of parameters ...',
    'node_modules/.esplus-typecheck/vue3/cases/02-b/schema.ts(3,1): error TS2304: Cannot find name \'CrudPageSchema\'.',
    '',
  ].join('\n')
  const ds = parseTypecheckDiagnostics(out, { dir })
  check(ds.length === 2, `应解析出 2 条诊断（解释行不算），实得 ${ds.length}`)
  check(ds[0].id === '01-a' && ds[0].file === 'page.vue' && ds[0].line === 12 && ds[0].column === 7, `首条诊断归属解析错：${JSON.stringify(ds[0])}`)
  check(ds[0].code === 'TS2322', `诊断码应为 TS2322，实得 ${ds[0].code}`)
  check(ds[1].id === '02-b' && ds[1].code === 'TS2304', '第二条诊断归属/诊断码解析错')
  check(fmtTypecheckDiagnostic(ds[0]).includes('page.vue:12:7'), '诊断格式化必须带 file:line:col')
  check(parseTypecheckDiagnostics('', {}).length === 0, '空输出应得到空诊断')
}

// ── 3) 纯函数：分母纪律 ─────────────────────────────
{
  const rows = [
    { id: 'a', typechecks: true, diagnostics: [], error: null },
    { id: 'b', typechecks: false, diagnostics: [{ code: 'TS2322', file: 'page.vue', line: 2, column: 1, message: 'bad' }], error: null },
    { id: 'c', typechecks: null, diagnostics: [], error: '生成器抛错' },
    { id: 'd', typechecks: null, diagnostics: [], error: 'model-failure' },
  ]
  const s = summarizeTypecheck(rows, (r) => r.id !== 'a')
  check(s.measured === 2, `measured 只数有产物的行（期望 2，实得 ${s.measured}）`)
  check(s.checked === 2 && s.ok === 1 && s.failure === 1, `checked/ok/failure 计数错：${JSON.stringify(s)}`)
  check(Math.abs(s.rate - 0.5) < 1e-9, `rate 应为 0.5，实得 ${s.rate}`)
  check(s.modelFailureTypecheck === 1, `「类型对但语义 miss」应单列（期望 1，实得 ${s.modelFailureTypecheck}）`)
  check(s.failureSamples.length === 1 && s.failureSamples[0].includes('page.vue:2:1'), `失败样本必须带位置：${JSON.stringify(s.failureSamples)}`)
  check(summarizeTypecheck([]).rate === null, '空行集：rate 必须是 null（不能是 0 或 1）')
  check(
    summarizeTypecheck([{ id: 'x', typechecks: true, diagnostics: [], error: null }]).modelFailureTypecheck === 0,
    '默认 passes95 全 true：不制造「语义 miss」告警'
  )
}

// ── 4) 纯函数：按 target 抽样 ───────────────────────
{
  const items = [
    ...Array.from({ length: 12 }, (_, i) => ({ id: `v3-${i}`, target: 'vue3', config: {} })),
    ...Array.from({ length: 3 }, (_, i) => ({ id: `v2-${i}`, target: 'vue2', config: {} })),
  ]
  const picked = sampleTypecheckCases(items, { perTarget: 10 })
  check(picked.filter((x) => x.target === 'vue3').length === 10, 'vue3 应被抽满 10 条')
  check(picked.filter((x) => x.target === 'vue2').length === 3, 'vue2 不足 10 条时应全取')
  check(picked[0].id === 'v3-0' && picked[9].id === 'v3-9', '抽样必须保持输入顺序（可复现）')
  check(sampleTypecheckCases(items, { perTarget: 10 }).map((x) => x.id).join() === picked.map((x) => x.id).join(), '同样的输入必须得到同样的样本')
  check(sampleTypecheckCases([], { perTarget: 10 }).length === 0, '空输入应返回空样本')
}

// ── 5) 真跑：验收条件必须咬得住 ──────────────────────
// 用一个**真实的** stub 包（落在 node_modules）而不是 shims 里的 `declare module`：
// 后者在非模块文件里能解析 import，却不会让 GlobalComponents 生效
// （`typeof import('stub')` 解析成了空模块）；实测事件签名错照样判绿。
const STUB_NAME = '@es-plus/typecheck-leg-stub'
const STUB_DIR = join(ROOT, 'node_modules', '@es-plus', 'typecheck-leg-stub')
function writeStub(loose) {
  rmSync(STUB_DIR, { recursive: true, force: true })
  mkdirSync(STUB_DIR, { recursive: true })
  writeFileSync(join(STUB_DIR, 'package.json'), JSON.stringify({ name: STUB_NAME, version: '0.0.0', types: 'index.d.ts', main: 'index.js' }))
  writeFileSync(join(STUB_DIR, 'index.js'), 'module.exports = {}\n')
  writeFileSync(
    join(STUB_DIR, 'index.d.ts'),
    loose
      ? `import type { DefineComponent } from 'vue'
export interface CrudPageSchema { columns: Array<{ prop: string }> }
export const EsCrudPage: DefineComponent<any, any, any>
`
      : `import type { DefineComponent, ComponentOptionsMixin } from 'vue'
export interface CrudPageSchema { columns: Array<{ prop: string }> }
export const EsCrudPage: DefineComponent<
  { schema: CrudPageSchema },
  {},
  {},
  {},
  {},
  ComponentOptionsMixin,
  ComponentOptionsMixin,
  { 'btn-click': (key: string, payload?: Record<string, unknown>) => void }
>
`
  )
}
function stubShims() {
  return `declare module 'vue' {
  interface GlobalComponents {
    EsCrudPage: typeof import('${STUB_NAME}').EsCrudPage
    'es-crud-page': typeof import('${STUB_NAME}').EsCrudPage
  }
}
export {}
`
}

try {
  writeStub(false)
  const page = (handler) => `<template>
  <es-crud-page :schema="pageSchema" @btn-click="${handler}">
  </es-crud-page>
</template>

<script setup lang="ts">
import { pageSchema } from './schema'

function onClick(key: string) {}
function wrongHandler(n: number) {}
</script>
`
  const schemaOk = `import type { CrudPageSchema } from '${STUB_NAME}'

export const pageSchema: CrudPageSchema = { columns: [{ prop: 'name' }] }
`
  const schemaMissingImport = `export const pageSchema: CrudPageSchema = { columns: [{ prop: 'name' }] }
`

  const cases = [
    { id: 'good', target: 'vue3', files: [{ name: 'schema.ts', content: schemaOk }, { name: 'page.vue', content: page('onClick') }] },
    { id: 'bad-missing-import', target: 'vue3', files: [{ name: 'schema.ts', content: schemaMissingImport }, { name: 'page.vue', content: page('onClick') }] },
    { id: 'bad-event', target: 'vue3', files: [{ name: 'schema.ts', content: schemaOk }, { name: 'page.vue', content: page('wrongHandler') }] },
  ]

  const rows = runTypecheck({
    cwd: ROOT,
    cases,
    dir: join(ROOT, 'node_modules', '.esplus-typecheck-test'),
    shims: { vue3: stubShims() },
  })
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]))
  check(rows.length === 3, `三条用例都应返回（实得 ${rows.length}）`)
  check(byId.good?.typechecks === true, `正常产物必须判过；实际诊断 = ${JSON.stringify(byId.good?.diagnostics)}`)
  check(byId['bad-missing-import']?.typechecks === false, '缺 `import type { CrudPageSchema }` 必须判红（验收前半句）')
  check(
    byId['bad-missing-import']?.diagnostics.some((d) => d.code === 'TS2304'),
    `缺类型导入应报 TS2304，实际 = ${JSON.stringify(byId['bad-missing-import']?.diagnostics)}`
  )
  check(byId['bad-event']?.typechecks === false, '事件处理器签名错误必须判红（验收后半句）')
  check(
    byId['bad-event']?.diagnostics.some((d) => d.code === 'TS2322'),
    `事件签名错误应报 TS2322，实际 = ${JSON.stringify(byId['bad-event']?.diagnostics)}`
  )
  const s = summarizeTypecheck(rows)
  check(s.measured === 3 && s.failure === 2 && Math.abs(s.rate - 1 / 3) < 1e-9, `汇总口径错：${JSON.stringify(s)}`)

  // ── 6) 反证：stub 移除事件签名后，bad-event 必须**不再**能红 ──────
  // 证明第 5 节咬住它的是「GlobalComponents → emit 签名」这条链路，而不是别的巧合。
  writeStub(true)
  const looseRows = runTypecheck({
    cwd: ROOT,
    cases: [{
      id: 'loose',
      target: 'vue3',
      files: [
        { name: 'schema.ts', content: `import type { CrudPageSchema } from '${STUB_NAME}'\nexport const pageSchema: CrudPageSchema = { columns: [] }\n` },
        { name: 'page.vue', content: `<template>\n  <es-crud-page :schema="pageSchema" @btn-click="wrongHandler" />\n</template>\n\n<script setup lang="ts">\nimport { pageSchema } from './schema'\nfunction wrongHandler(n: number) {}\n</script>\n` },
      ],
    }],
    dir: join(ROOT, 'node_modules', '.esplus-typecheck-test2'),
    shims: { vue3: stubShims() },
  })
  check(looseRows[0]?.typechecks === true, '自检：组件类型被放宽成 any 后，事件签名错应咬不住（说明第 5 节的判红来自组件类型，而非恒红）')
} finally {
  rmSync(STUB_DIR, { recursive: true, force: true })
}

if (failures > 0) {
  console.error(`\n typecheck-leg 自测失败：${failures} 条`)
  process.exit(1)
}
console.log('✅ Tier B 类型腿自测通过（文件拆分 / 诊断解析 / 分母纪律 / 抽样 / 缺类型导入与事件签名真能红）')
