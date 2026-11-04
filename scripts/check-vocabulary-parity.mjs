#!/usr/bin/env node
/**
 * P10 —— 片段表格词汇 ↔ CRUD 页 vocabulary parity。
 *
 * ## 为什么需要它
 *
 * `check:capability-ledger` 只证明「片段接受这些键」，`check:fragment-contract` 只证明
 * 「形状与发射枚举对得上」。二者都回答不了真问题：**同一份表格词汇，在片段入口和整页
 * 入口里是否发出同一份代码？** P10 的承诺是「与 CRUD 页对齐」，如果两条路径各长出一套
 * 列字面量（键名、顺序、分组、展开列位置不同），宿主换入口就会得到不同页面。
 *
 * ## 判据
 *
 * 用同一份输入（显式列 + groups 多级表头 + index 列 + 顶层 expandConfig + treeConfig +
 * mergeConfig + rowkey）分别跑：
 *   - `generateTableBlock`（片段 `table` 场景）
 *   - `generateFromConfig({ mode:'sfc', operationColumn:false, actions:[] })`（整页 SFC）
 *
 * 逐条断言（**三端各跑一遍**：列字面量与 target 无关，模板/外壳由 target 分流）：
 *   1. `const columns = [...]` 的**列行逐字节相等**（含 groups 递归、展开列前置位置）。
 *      这是「复用同一发射器」的直接证据，而不是 token 抽查；
 *   2. `const options = {...}` 的键集相等；`rowkey` 的值相等（片段顶层 rowkey 与整页
 *      `tableOptions.rowkey` 是同一个运行时家）。
 *
 * `PATH_EXCLUSIONS`：两条路径**合法**不同的键必须登记原因；未登记的差异判红。
 * 反向也判：豁免的键必须真的仍有差异（陈旧的豁免条目同样是错误信息）。
 *
 * 驱动方式与其它 shared 守卫一致：esbuild 现打包 `shared/src`（命中 `shared/build`
 * 即红），不调用 MCP handler。
 *
 * 用法：`node scripts/check-vocabulary-parity.mjs`
 */
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { ROOT } from './lib/front-door.mjs'

/**
 * 两条路径**合法**不同的 options 键。
 *
 * 键 → 原因。当前为空：片段与整页在「同一份表格词汇」上应当完全同形。新增条目
 * 必须是「不是同一个旋钮」或「入口本身没有这个上下文」，不能用来掩盖漂移。
 */
const PATH_EXCLUSIONS = new Map([])

const failures = []
const report = {}
/** 三端都验：`pushSfcColumn` 发射的列字面量与 target 无关，但模板/脚本外壳由 target 分流。 */
const TARGETS = ['vue3', 'vue2', 'antdv']
const fail = (msg) => {
  failures.push(msg)
  console.error(`✗ ${msg}`)
}

const INPUT = {
  fields: [
    { prop: 'name', label: '姓名', formtype: 'Input' },
    { prop: 'dept', label: '部门', formtype: 'Input' },
    { prop: 'amount', label: '金额', formtype: 'InputNumber' },
  ],
  columns: [
    { type: 'index', label: '#', width: 60 },
    {
      label: '基本信息',
      groups: [
        { prop: 'name', label: '姓名' },
        { prop: 'dept', label: '部门' },
      ],
    },
    { prop: 'amount', label: '金额', align: 'right' },
  ],
  expandConfig: { title: '详情', fields: [{ prop: 'dept', label: '部门' }] },
  treeConfig: { childrenField: 'nodes', expandAll: false },
  mergeConfig: { rowsBy: ['dept'] },
  rowkey: 'code',
  apiUrl: '/api/parity',
}

/** `const columns … = [` 到列 0 的 `]` 之间的行（不含首尾）。 */
function blockLines(code, headRe) {
  const lines = code.split('\n')
  const start = lines.findIndex((l) => headRe.test(l))
  if (start === -1) return null
  let end = start + 1
  while (end < lines.length && lines[end].trim() !== ']' && lines[end].trim() !== '}') end++
  if (end >= lines.length) return null
  return lines.slice(start + 1, end)
}

/** options 块里的顶层键（`  key:` 形态）。 */
function optionKeys(code) {
  const lines = blockLines(code, /^const options\b.*= \{/)
  if (!lines) return null
  const keys = []
  for (const line of lines) {
    const m = line.match(/^ {2}([A-Za-z_$][\w$]*):/)
    if (m) keys.push(m[1])
  }
  return keys
}

/** 取 `rowkey: '…',` 的字面量（两条路径都发这一行）。 */
function rowkeyLiteral(code) {
  const m = code.match(/^ {2}rowkey: (.+),$/m)
  return m ? m[1] : null
}

const tmp = mkdtempSync(join(ROOT, 'node_modules', 'es-vocabulary-parity-'))
try {
  const entry = join(tmp, 'entry.ts')
  writeFileSync(
    entry,
    [
      "import { generateTableBlock } from '../../packages/shared/src/fragment-generator.ts'",
      "import { generateFromConfig } from '../../packages/shared/src/structured-generator.ts'",
      "export { generateTableBlock, generateFromConfig }",
    ].join('\n'),
    'utf8',
  )

  const outfile = join(tmp, 'vocabulary-parity.mjs')
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    outfile,
    platform: 'node',
    logLevel: 'silent',
    metafile: true,
    alias: { '@es-plus/shared': join(ROOT, 'packages', 'shared', 'src', 'index.ts') },
    banner: {
      js: "import { createRequire as __createRequire } from 'node:module';const require = __createRequire(import.meta.url);",
    },
  })
  const inputs = Object.keys(result.metafile.inputs)
  const fromBuild = inputs.filter((p) => /shared[\\/]build[\\/]/.test(p))
  if (fromBuild.length > 0) {
    console.error(`✗ 打包命中了 shared/build（${fromBuild.length} 个）：守卫会测到陈旧产物`)
    process.exitCode = 1
  } else {
    const mod = await import(pathToFileURL(outfile).href)

    // 三端都跑：列字面量由 `pushSfcColumn` 发射、模板由 target 分流。两端入口若只在
    // vue3 对齐，vue2/antdv 的宿主换入口仍会拿到不同的列 —— 这正是本守卫要防的入口分叉。
    for (const target of TARGETS) {
      const fragment = mod.generateTableBlock({ ...INPUT, target, typescript: true })
      const crud = mod.generateFromConfig({
        name: 'VocabularyParity',
        apiUrl: INPUT.apiUrl,
        fields: INPUT.fields,
        columns: INPUT.columns,
        expandConfig: INPUT.expandConfig,
        treeConfig: INPUT.treeConfig,
        mergeConfig: INPUT.mergeConfig,
        tableOptions: { rowkey: INPUT.rowkey },
        // actions 至少 1 项（schema 约束）；operationColumn:false 关掉派生操作列，
        // 否则整页会多出一列片段没有的按钮列，把「列字面量相等」变成假阴性。
        actions: ['add'],
        operationColumn: false,
        mode: 'sfc',
        target,
        typescript: true,
      })
      const at = `[${target}] `

      const fCols = blockLines(fragment.code, /^const columns\b.*= \[/)
      const cCols = blockLines(crud.code, /^const columns\b.*= \[/)
      if (!fCols || !cCols) {
        fail(`${at}找不到 columns 块（片段或整页）—— 判据本身失效`)
      } else {
        const diff = []
        const len = Math.max(fCols.length, cCols.length)
        for (let i = 0; i < len; i++) {
          if (fCols[i] !== cCols[i]) {
            diff.push(`第 ${i + 1} 行：片段=${JSON.stringify(fCols[i])} / 整页=${JSON.stringify(cCols[i])}`)
          }
        }
        if (diff.length) {
          fail(`${at}columns 块不是逐字节相等（同一份表格词汇长出了两份列字面量）：\n    ${diff.join('\n    ')}`)
        }
        // 非空证明：输入里的词汇必须真的出现在列块里，否则「相等」只是「都没发」。
        const joined = fCols.join('\n')
        for (const token of ["type: 'index'", 'groups: [', "type: 'expand'", 'expandConfig:']) {
          if (!joined.includes(token)) fail(`${at}columns 块缺少输入词汇的证据 token「${token}」—— 相等可能是空集`)
        }
        report.columnLines = fCols.length
      }

      const fKeys = optionKeys(fragment.code)
      const cKeys = optionKeys(crud.code)
      if (!fKeys || !cKeys) {
        fail(`${at}找不到 options 块（片段或整页）—— 判据本身失效`)
        continue
      }
      const onlyFragment = fKeys.filter((k) => !cKeys.includes(k))
      const onlyCrud = cKeys.filter((k) => !fKeys.includes(k))
      for (const [side, keys] of [
        ['片段', onlyFragment],
        ['整页', onlyCrud],
      ]) {
        for (const key of keys) {
          if (!PATH_EXCLUSIONS.has(key)) {
            fail(`${at}options.${key} 只在${side}出现 —— 路径差异未登记到 PATH_EXCLUSIONS`)
          }
        }
      }
      for (const [key, why] of PATH_EXCLUSIONS) {
        const differs = fKeys.includes(key) !== cKeys.includes(key)
        if (!differs) {
          fail(`${at}PATH_EXCLUSIONS 的 options.${key} 已不再有差异（${why}）—— 删除这条陈旧豁免`)
        }
      }
      for (const key of ['rowkey', 'treeConfig', 'mergeConfig']) {
        if (!fKeys.includes(key) || !cKeys.includes(key)) {
          fail(`${at}options.${key} 没有同时出现在片段与整页产物里`)
        }
        if (PATH_EXCLUSIONS.has(key)) continue
      }
      report.optionKeys = fKeys.length
      const fRowkey = rowkeyLiteral(fragment.code)
      const cRowkey = rowkeyLiteral(crud.code)
      if (fRowkey === null || cRowkey === null || fRowkey !== cRowkey) {
        fail(`${at}rowkey 字面量不一致：片段=${fRowkey} / 整页=${cRowkey}`)
      } else if (fRowkey !== "'code'") {
        fail(`${at}rowkey 字面量应为 'code'，实际 ${fRowkey}`)
      }
    }
  }
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

if (failures.length) {
  console.error(`\n✗ check:vocabulary-parity —— ${failures.length} 处片段/整页词汇漂移`)
  process.exit(1)
}
console.log(
  `✅ check:vocabulary-parity：${TARGETS.join('/')} 三端上，片段表格与 CRUD 页的列字面量逐字节相等（${report.columnLines ?? 0} 行），` +
    `options 词汇同形（${report.optionKeys ?? 0} 键，含 rowkey 值）。`,
)
