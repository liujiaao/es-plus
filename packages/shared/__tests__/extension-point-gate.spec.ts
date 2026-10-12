import { describe, it, expect } from 'vitest'
import { transformSync } from 'esbuild'
import { assertEmittableExpr } from '../src/codegen-escape.js'
import { generateTableBlock } from '../src/fragment-generator.js'
import { generateFromConfig } from '../src/structured-generator.js'

// PR-C1 的核心：扩展点语法闸把「100% 编译」从「策划语料观察」升级成「任意 valid
// config 的结构性不变量」。证明三件事：
//   1. assertEmittableExpr 放行真实合法源码（JS / 带类型 TS / JSX render），只毙垃圾串。
//   2. 畸形 formatter/render 不会被内联 —— 被省略 + 降级告警。
//   3. 省略后产物仍能被 esbuild 解析（即「发射的东西永远能编译」）。

/** 抽出 SFC 的 <script> 内容并用 esbuild 解析；畸形会抛错。 */
function assertScriptCompiles(sfc: string): void {
  const m = sfc.match(/<script[^>]*>([\s\S]*?)<\/script>/)
  expect(m, 'SFC 必须含 <script> 块').toBeTruthy()
  // loader:'ts' —— 本用例的片段不含 JSX（只有 formatter），用 ts 足够。
  transformSync(m![1], { loader: 'ts' })
}

describe('assertEmittableExpr — 语法闸', () => {
  it('放行合法 JS 箭头函数', () => {
    expect(assertEmittableExpr('(row) => Number(row.amount).toFixed(2)')).toBe(true)
  })
  it('放行带类型标注的 TS formatter（new Function 会误杀，esbuild 不会）', () => {
    expect(assertEmittableExpr('(row: Record<string, number>) => String(row.amount)')).toBe(true)
  })
  it('放行 JSX render（列 render 可能是 <Tag/>）', () => {
    expect(assertEmittableExpr('(row) => <span class="x">{row.name}</span>')).toBe(true)
  })
  it('毙未闭合的模板字符串', () => {
    expect(assertEmittableExpr('(row) => `¥${row.amount')).toBe(false)
  })
  it('毙括号不配平', () => {
    expect(assertEmittableExpr('(row) => {{{')).toBe(false)
  })
  it('毙纯垃圾串', () => {
    expect(assertEmittableExpr('return )(')).toBe(false)
  })
})

describe('generateTableBlock — 扩展点语法闸', () => {
  const base = { apiUrl: '/api/t', fields: [] as any[] }

  it('合法 formatter 仍原样内联、无降级告警', () => {
    const { code, warnings } = generateTableBlock({
      ...base,
      fields: [{ prop: 'amount', label: '金额', formtype: 'Input', formatter: '(row) => Number(row.amount).toFixed(2)' }],
    })
    expect(code).toContain('formatter: (row) => Number(row.amount).toFixed(2)')
    expect(warnings.some((w) => w.includes('formatter'))).toBe(false)
    assertScriptCompiles(code)
  })

  it('畸形 formatter 被省略 + 降级告警，且产物仍可编译', () => {
    const { code, warnings } = generateTableBlock({
      ...base,
      fields: [{ prop: 'amount', label: '金额', formtype: 'Input', formatter: '(row) => `¥${row.amount' }],
    })
    expect(code).not.toContain('formatter:')
    expect(code).not.toContain('`¥${row.amount')
    expect(warnings.some((w) => w.includes('amount') && w.includes('formatter'))).toBe(true)
    assertScriptCompiles(code) // 不变量：省略坏串后，发射的东西仍能解析
  })
})

describe('generateFromConfig（sfc 模式）— 扩展点语法闸', () => {
  it('畸形 formatter 不抛错、不内联坏串、带降级告警', () => {
    const run = () =>
      generateFromConfig({
        name: 'T',
        apiUrl: '/api/t',
        mode: 'sfc',
        // export 不是 dialog 动作 → 不走 JSX 弹窗，script 为纯 ts
        actions: ['export'],
        fields: [{ prop: 'amount', label: '金额', formtype: 'Input', formatter: '(row) => {{{' }],
      } as any)
    expect(run).not.toThrow()
    const { code, warnings } = run()
    expect(code).not.toContain('{{{')
    expect(warnings.some((w) => w.includes('amount') && w.includes('formatter'))).toBe(true)
    assertScriptCompiles(code)
  })
})
